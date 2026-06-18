// ============================================================================
// Nightfall — authoritative game engine (pure, deterministic, serialisable).
//
// The same engine runs in two places, exactly like the rest of the house:
//   • solo  — on the client, for instant offline play against bots
//   • online — on the server, authoritative for play-with-friends rooms
//
// A round is a loop of phases:
//   night  → players with powers act in the dark
//   reveal → dawn: who the Mafia took (or that the Doctor saved them)
//   day    → the town argues (bot chatter) and everyone votes
//   verdict→ the accused is unmasked
//   …and back to night until one side wins.
//
// Everything that must look identical to every observer (role deal, night
// outcome, the suspicion that drives bot votes, the day's chatter) is computed
// here from a seeded RNG. Bot *decisions* (who to kill / vote) live in bots.ts
// and are fed back in as actions by the driver — mirroring uno's design.
// ============================================================================

import { type Role, type Team, ROLES, teamOf, rolesForCount } from './roles'
import { makeRng, shuffle } from './rng'
import { composeChatter, type ChatLine } from './chatter'

export type { Role, Team, ChatLine }

export type Phase = 'night' | 'reveal' | 'day' | 'verdict' | 'gameover'

export interface EnginePlayer {
  id: string
  name: string
  avatar: string
  isBot: boolean
  role: Role
  alive: boolean
  /** day number the player left the game (for the graveyard); 0 if still in. */
  diedOn: number
  /** how they left — useful for the obituary line. */
  deathCause: 'mafia' | 'vote' | null
}

export interface NightActions {
  mafiaTarget: string | null
  doctorTarget: string | null
  detectiveTarget: string | null
  detectiveId: string | null // who is doing the investigating (so the read is theirs)
}

export interface NightOutcome {
  victimId: string | null // who actually died (null if saved / no kill)
  targetId: string | null // who the Mafia aimed at
  saved: boolean // the Doctor caught the blade
}

export interface Verdict {
  targetId: string | null // who was voted out (null on a tie / skip)
  role: Role | null
  tie: boolean
  tally: { id: string; votes: number }[]
}

export interface GameState {
  players: EnginePlayer[]
  phase: Phase
  day: number // 1-based; "night N" comes before "day N"
  rngState: number
  status: 'playing' | 'finished'
  winner: Team | null

  night: NightActions
  // detectiveId -> targetId -> isMafia (private, redacted per viewer)
  detectiveResults: Record<string, Record<string, boolean>>
  lastNight: NightOutcome | null

  votes: Record<string, string | null> // voterId -> targetId | null(skip)
  lastVerdict: Verdict | null

  // each living mind's read on everyone else: ownerId -> targetId -> 0..100
  suspicion: Record<string, Record<string, number>>

  chatter: ChatLine[] // the current day's discussion feed
  log: LogEntry[] // public narrative timeline (for the recap / history)
}

export interface LogEntry {
  day: number
  kind: 'dawn' | 'verdict' | 'gameover'
  text: string
}

export type GameEvent =
  | { kind: 'nightFell' }
  | { kind: 'dawn'; victimId: string | null; saved: boolean }
  | { kind: 'chatter' }
  | { kind: 'voted'; voterId: string; targetId: string | null }
  | { kind: 'verdict'; targetId: string | null; role: Role | null; tie: boolean }
  | { kind: 'gameover'; winner: Team }

export type Action =
  | { type: 'act'; playerId: string; power: 'kill' | 'save' | 'investigate'; targetId: string }
  | { type: 'vote'; playerId: string; targetId: string | null }
  | { type: 'advance' } // driver-paced transition between phases

export interface ApplyResult {
  state: GameState
  events: GameEvent[]
  error?: string
}

// ── setup ───────────────────────────────────────────────────────────────────

export interface NewGameOpts {
  players: { id: string; name: string; avatar: string; isBot: boolean }[]
  seed: number
}

export function createGame(opts: NewGameOpts): GameState {
  const rng = makeRng(opts.seed)
  const deal = shuffle(rolesForCount(opts.players.length), rng)
  const players: EnginePlayer[] = opts.players.map((p, i) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    isBot: p.isBot,
    role: deal[i],
    alive: true,
    diedOn: 0,
    deathCause: null,
  }))

  // seed every mind with a light, asymmetric base read so the first day isn't flat
  const suspicion: Record<string, Record<string, number>> = {}
  for (const a of players) {
    suspicion[a.id] = {}
    for (const b of players) {
      if (a.id === b.id) continue
      suspicion[a.id][b.id] = 18 + Math.floor(rng.next() * 16) // 18..33
    }
  }

  return {
    players,
    phase: 'night',
    day: 1,
    rngState: rng.state,
    status: 'playing',
    winner: null,
    night: { mafiaTarget: null, doctorTarget: null, detectiveTarget: null, detectiveId: null },
    detectiveResults: {},
    lastNight: null,
    votes: {},
    lastVerdict: null,
    suspicion,
    chatter: [],
    log: [],
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

export const living = (s: GameState): EnginePlayer[] => s.players.filter(p => p.alive)
export const playerById = (s: GameState, id: string): EnginePlayer | undefined =>
  s.players.find(p => p.id === id)
const aliveWithRole = (s: GameState, role: Role) => living(s).filter(p => p.role === role)
const mafiaAlive = (s: GameState) => aliveWithRole(s, 'mafia')

export function counts(s: GameState): { mafia: number; town: number } {
  const m = mafiaAlive(s).length
  return { mafia: m, town: living(s).length - m }
}

/** Every living player who owes a night action has supplied one. */
export function nightReady(s: GameState): boolean {
  if (s.phase !== 'night') return false
  // the Mafia owe a kill only while a legal town target still exists; otherwise
  // the night resolves with no kill (the win-check ends the game anyway) and we
  // must never block forever waiting for an impossible pick.
  const townLeft = living(s).some(p => p.role !== 'mafia')
  if (mafiaAlive(s).length > 0 && townLeft && !s.night.mafiaTarget) return false
  if (aliveWithRole(s, 'detective').length > 0 && !s.night.detectiveTarget) return false
  if (aliveWithRole(s, 'doctor').length > 0 && !s.night.doctorTarget) return false
  return true
}

/** Every living player has cast a vote (target or deliberate skip). */
export function voteReady(s: GameState): boolean {
  if (s.phase !== 'day') return false
  return living(s).every(p => p.id in s.votes)
}

function winnerIfAny(s: GameState): Team | null {
  const { mafia, town } = counts(s)
  if (mafia === 0) return 'town'
  if (mafia >= town) return 'mafia'
  return null
}

// ── the reducer ──────────────────────────────────────────────────────────────

export function applyAction(state: GameState, action: Action): ApplyResult {
  const s: GameState = structuredClone(state)
  const events: GameEvent[] = []

  switch (action.type) {
    case 'act': {
      if (s.phase !== 'night') return err(state, 'not_night')
      const actor = playerById(s, action.playerId)
      const target = playerById(s, action.targetId)
      if (!actor || !actor.alive) return err(state, 'bad_actor')
      if (!target || !target.alive) return err(state, 'bad_target')
      if (action.power === 'kill') {
        if (actor.role !== 'mafia') return err(state, 'not_mafia')
        if (target.role === 'mafia') return err(state, 'no_kill_ally')
        s.night.mafiaTarget = target.id
      } else if (action.power === 'save') {
        if (actor.role !== 'doctor') return err(state, 'not_doctor')
        s.night.doctorTarget = target.id
      } else {
        if (actor.role !== 'detective') return err(state, 'not_detective')
        if (target.id === actor.id) return err(state, 'no_self_investigate')
        // only the target is locked here; the single read is recorded at dawn,
        // so changing your mind before the night resolves can't buy extra looks.
        // We remember WHO is investigating so the read is attributed correctly
        // even if this detective is the one the Mafia takes tonight.
        s.night.detectiveTarget = target.id
        s.night.detectiveId = actor.id
      }
      return { state: s, events }
    }

    case 'vote': {
      if (s.phase !== 'day') return err(state, 'not_day')
      const voter = playerById(s, action.playerId)
      if (!voter || !voter.alive) return err(state, 'bad_voter')
      if (action.targetId !== null) {
        const t = playerById(s, action.targetId)
        if (!t || !t.alive) return err(state, 'bad_target')
        if (t.id === voter.id) return err(state, 'no_self_vote')
      }
      s.votes[voter.id] = action.targetId
      events.push({ kind: 'voted', voterId: voter.id, targetId: action.targetId })
      return { state: s, events }
    }

    case 'advance':
      return advance(s, events)
  }
}

function err(state: GameState, error: string): ApplyResult {
  return { state, events: [], error }
}

// Phase transitions are driver-paced: the driver calls `advance` once a phase's
// inputs are in (so the UI can dwell on dawn / the verdict for drama).
function advance(s: GameState, events: GameEvent[]): ApplyResult {
  const rng = makeRng(s.rngState)

  if (s.phase === 'night') {
    if (!nightReady(s)) return { state: s, events, error: 'night_incomplete' }
    // record the Detective's single read FIRST, attributed to the detective who
    // locked it — so they keep their finding even if the Mafia take them tonight.
    if (s.night.detectiveTarget && s.night.detectiveId) {
      const probed = playerById(s, s.night.detectiveTarget)
      if (probed) (s.detectiveResults[s.night.detectiveId] ??= {})[probed.id] = probed.role === 'mafia'
    }
    // resolve the night
    const target = s.night.mafiaTarget
    const saved = !!target && target === s.night.doctorTarget
    const victimId = target && !saved ? target : null
    if (victimId) {
      const v = playerById(s, victimId)!
      v.alive = false
      v.diedOn = s.day
      v.deathCause = 'mafia'
    }
    s.lastNight = { victimId, targetId: target, saved }
    s.log.push({
      day: s.day,
      kind: 'dawn',
      text: victimId
        ? `${playerById(s, victimId)!.name} was found gone at first light.`
        : saved
          ? `A blade fell in the dark — but everyone woke to see the dawn.`
          : `The night passed quietly. Everyone is still here.`,
    })
    bumpSuspicionAfterNight(s, rng)
    s.phase = 'reveal'
    s.rngState = rng.state
    events.push({ kind: 'dawn', victimId, saved })
    const w = winnerIfAny(s)
    if (w) return finish(s, w, events)
    return { state: s, events }
  }

  if (s.phase === 'reveal') {
    // open the floor: clear the night, compose the day's argument, collect votes
    s.night = { mafiaTarget: null, doctorTarget: null, detectiveTarget: null, detectiveId: null }
    s.votes = {}
    s.chatter = composeChatter(s, rng)
    s.phase = 'day'
    s.rngState = rng.state
    events.push({ kind: 'chatter' })
    return { state: s, events }
  }

  if (s.phase === 'day') {
    if (!voteReady(s)) return { state: s, events, error: 'vote_incomplete' }
    const verdict = tallyVotes(s)
    s.lastVerdict = verdict
    if (verdict.targetId) {
      const t = playerById(s, verdict.targetId)!
      t.alive = false
      t.diedOn = s.day
      t.deathCause = 'vote'
      s.log.push({
        day: s.day,
        kind: 'verdict',
        text: `The town turned on ${t.name}. They were ${roleArticle(t.role)}.`,
      })
    } else {
      s.log.push({
        day: s.day,
        kind: 'verdict',
        text: verdict.tie
          ? `The vote split clean down the middle. No one hangs today.`
          : `The town stayed its hand. No one hangs today.`,
      })
    }
    bumpSuspicionAfterVote(s, verdict, rng)
    s.phase = 'verdict'
    s.rngState = rng.state
    events.push({ kind: 'verdict', targetId: verdict.targetId, role: verdict.role, tie: verdict.tie })
    const w = winnerIfAny(s)
    if (w) return finish(s, w, events)
    return { state: s, events }
  }

  if (s.phase === 'verdict') {
    s.day += 1
    s.phase = 'night'
    s.lastNight = null
    s.chatter = []
    s.rngState = rng.state
    events.push({ kind: 'nightFell' })
    return { state: s, events }
  }

  return { state: s, events } // gameover: nothing further
}

function finish(s: GameState, winner: Team, events: GameEvent[]): ApplyResult {
  s.status = 'finished'
  s.winner = winner
  s.phase = 'gameover'
  s.log.push({
    day: s.day,
    kind: 'gameover',
    text: winner === 'town'
      ? `The last of the Mafia is unmasked. The town survives.`
      : `The Mafia hold the town in their grip. Darkness wins.`,
  })
  events.push({ kind: 'gameover', winner })
  return { state: s, events }
}

function roleArticle(role: Role): string {
  const n = ROLES[role].name
  return /^[AEIOU]/.test(n) ? `an ${n}` : `a ${n}`
}

// ── vote tally ───────────────────────────────────────────────────────────────

function tallyVotes(s: GameState): Verdict {
  const tally = new Map<string, number>()
  for (const p of living(s)) tally.set(p.id, 0)
  for (const voter of living(s)) {
    const t = s.votes[voter.id]
    if (t && tally.has(t)) tally.set(t, tally.get(t)! + 1)
  }
  const ranked = [...tally.entries()]
    .map(([id, votes]) => ({ id, votes }))
    .sort((a, b) => b.votes - a.votes)
  const top = ranked[0]
  if (!top || top.votes === 0) return { targetId: null, role: null, tie: false, tally: ranked }
  const tie = ranked.filter(r => r.votes === top.votes).length > 1
  if (tie) return { targetId: null, role: null, tie: true, tally: ranked }
  return { targetId: top.id, role: playerById(s, top.id)!.role, tie: false, tally: ranked }
}

// ── suspicion model ──────────────────────────────────────────────────────────
// A living mind's read on others drifts with events. Town minds reason from
// public signals; Mafia minds steer heat away from their own and onto the town.
// This is what makes bot votes (and chatter) feel like a real table.

function bumpSuspicionAfterNight(s: GameState, rng: ReturnType<typeof makeRng>): void {
  for (const owner of living(s)) {
    const view = s.suspicion[owner.id]
    if (!view) continue
    const ownerIsMafia = owner.role === 'mafia'
    for (const t of living(s)) {
      if (t.id === owner.id) continue
      if (ownerIsMafia) {
        // mafia cool the heat on fellow mafia, warm a chosen town scapegoat
        if (t.role === 'mafia') view[t.id] = clamp(view[t.id] - 6 - rng.next() * 6)
        else view[t.id] = clamp(view[t.id] + rng.next() * 5)
      } else {
        // town: small honest drift in the dark
        view[t.id] = clamp(view[t.id] + (rng.next() - 0.45) * 8)
      }
    }
    // a detective's private read hardens their own suspicion
    const reads = s.detectiveResults[owner.id]
    if (reads) {
      for (const [tid, isMafia] of Object.entries(reads)) {
        if (!playerById(s, tid)?.alive) continue
        view[tid] = isMafia ? clamp(view[tid] + 55) : clamp(view[tid] - 35)
      }
    }
  }
}

function bumpSuspicionAfterVote(
  s: GameState,
  verdict: Verdict,
  rng: ReturnType<typeof makeRng>,
): void {
  const lynched = verdict.targetId ? playerById(s, verdict.targetId) : null
  for (const owner of living(s)) {
    const view = s.suspicion[owner.id]
    if (!view) continue
    for (const t of living(s)) {
      if (t.id === owner.id) continue
      // people who voted with the (correct) majority earn a little trust
      const votedForLynched = lynched && s.votes[t.id] === lynched.id
      if (lynched && lynched.role === 'mafia') {
        if (votedForLynched) view[t.id] = clamp(view[t.id] - 8) // good read, trust them
      } else if (lynched && lynched.role !== 'mafia') {
        if (votedForLynched && owner.role !== 'mafia')
          view[t.id] = clamp(view[t.id] + 10) // you lynched an innocent — suspicious
      }
      view[t.id] = clamp(view[t.id] + (rng.next() - 0.5) * 6)
    }
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}
