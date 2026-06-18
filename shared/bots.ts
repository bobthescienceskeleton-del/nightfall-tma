// ============================================================================
// Bot brains. The driver (solo store / online room) calls these to fill in the
// actions of every non-human seat — exactly like uno's bots.ts. Decisions read
// the shared suspicion model so a bot's night kills and day votes line up with
// how it "feels" about the table, which is what the chatter shows the player.
//
// Imports from the engine are type-only; a local RNG salted from the live
// rngState gives believable variety without touching engine state.
// ============================================================================

import type { GameState, EnginePlayer, Action } from './engine'
import { makeRng } from './rng'

// How much randomness colours a bot's decision. Easy bots wander (more noise =
// looser, more forgiving play); hard bots lock onto the best read with little
// slack. The factor scales every random term in the rankings below.
const NOISE: Record<string, number> = { easy: 2.4, normal: 1, hard: 0.4 }
const nz = (s: GameState) => NOISE[s.difficulty] ?? 1

const alive = (s: GameState) => s.players.filter(p => p.alive)
const livingMafia = (s: GameState) => alive(s).filter(p => p.role === 'mafia')
const livingTown = (s: GameState) => alive(s).filter(p => p.role !== 'mafia')

// average heat the rest of the table puts on `targetId` (lower = more trusted)
function avgSuspicion(s: GameState, targetId: string): number {
  let sum = 0
  let n = 0
  for (const owner of alive(s)) {
    if (owner.id === targetId) continue
    sum += s.suspicion[owner.id]?.[targetId] ?? 0
    n++
  }
  return n ? sum / n : 0
}

// the player the whole town most distrusts (the emerging lynch consensus)
function townConsensus(s: GameState): EnginePlayer | null {
  const c = alive(s)
  if (!c.length) return null
  return c.reduce((best, p) => (avgSuspicion(s, p.id) > avgSuspicion(s, best.id) ? p : best))
}

function localRng(s: GameState, salt: number) {
  return makeRng((s.rngState ^ (salt * 0x9e3779b1)) >>> 0)
}

// ── night ────────────────────────────────────────────────────────────────────

// The Mafia agree on one victim: a trusted (therefore dangerous) townsperson,
// with a little randomness so play isn't robotic. A confirmed detective-claimer
// is the juiciest target of all.
export function botMafiaTarget(s: GameState): string | null {
  const town = livingTown(s)
  if (!town.length) return null
  const rng = localRng(s, 101 + s.day)
  // rank town by how trusted they are (ascending avg suspicion = most dangerous)
  const ranked = town
    .map(p => ({ p, trust: -avgSuspicion(s, p.id) + rng.next() * 12 * nz(s) }))
    .sort((a, b) => b.trust - a.trust)
  return ranked[0].p.id
}

// The Doctor shields whoever the town leans on most (a likely Mafia target),
// occasionally themselves.
export function botDoctorTarget(s: GameState, doctorId: string): string | null {
  const cands = alive(s)
  if (!cands.length) return null
  const rng = localRng(s, 202 + s.day)
  if (rng.next() < (s.difficulty === 'hard' ? 0.1 : 0.2)) return doctorId // hedge and save self
  const town = livingTown(s).filter(p => p.id !== doctorId)
  const pool = town.length ? town : cands
  // protect the most-trusted town pillar (mafia's likely pick)
  const ranked = pool
    .map(p => ({ p, score: -avgSuspicion(s, p.id) + rng.next() * 14 * nz(s) }))
    .sort((a, b) => b.score - a.score)
  return ranked[0].p.id
}

// The Detective probes someone they haven't cleared yet, leaning on their own
// suspicion to spend the look well.
export function botDetectiveTarget(s: GameState, detId: string): string | null {
  const seen = s.detectiveResults[detId] ?? {}
  const view = s.suspicion[detId] ?? {}
  const cands = alive(s).filter(p => p.id !== detId && !(p.id in seen))
  const pool = cands.length ? cands : alive(s).filter(p => p.id !== detId)
  if (!pool.length) return null
  const rng = localRng(s, 303 + s.day)
  const ranked = pool
    .map(p => ({ p, score: (view[p.id] ?? 0) + rng.next() * 20 * nz(s) }))
    .sort((a, b) => b.score - a.score)
  return ranked[0].p.id
}

// Every bot night action, coordinated. The driver submits these (skipping any
// power the human seat owns, which the human supplies through the UI).
export function botNightActions(s: GameState, humanIds: Set<string>): Action[] {
  const acts: Action[] = []

  // Mafia: one shared kill, chosen by a bot if no human mafia is alive to pick.
  const mafia = livingMafia(s)
  const humanMafiaAlive = mafia.some(m => humanIds.has(m.id))
  if (mafia.length && !humanMafiaAlive) {
    const target = botMafiaTarget(s)
    const actor = mafia[0]
    if (target) acts.push({ type: 'act', playerId: actor.id, power: 'kill', targetId: target })
  }

  // Doctor
  const doctor = alive(s).find(p => p.role === 'doctor' && p.isBot && !humanIds.has(p.id))
  if (doctor) {
    const t = botDoctorTarget(s, doctor.id)
    if (t) acts.push({ type: 'act', playerId: doctor.id, power: 'save', targetId: t })
  }

  // Detective
  const det = alive(s).find(p => p.role === 'detective' && p.isBot && !humanIds.has(p.id))
  if (det) {
    const t = botDetectiveTarget(s, det.id)
    if (t) acts.push({ type: 'act', playerId: det.id, power: 'investigate', targetId: t })
  }

  return acts
}

// ── day ───────────────────────────────────────────────────────────────────────

export function botVote(s: GameState, voterId: string): string | null {
  const voter = s.players.find(p => p.id === voterId)
  if (!voter) return null
  const view = s.suspicion[voterId] ?? {}
  const rng = localRng(s, 404 + s.day * 7 + hash(voterId))
  const others = alive(s).filter(p => p.id !== voterId)
  if (!others.length) return null

  if (voter.role === 'mafia') {
    // push the town toward a town victim; never vote a fellow mafia
    const town = others.filter(p => p.role !== 'mafia')
    if (!town.length) return null
    const ranked = town
      .map(p => ({ p, score: avgSuspicion(s, p.id) + rng.next() * 16 * nz(s) }))
      .sort((a, b) => b.score - a.score)
    return ranked[0].p.id
  }

  // town: a detective with a live, confirmed read votes the wolf without flinching
  const reads = s.detectiveResults[voterId]
  if (reads) {
    const wolf = Object.entries(reads).find(([id, m]) => m && s.players.find(p => p.id === id)?.alive)
    if (wolf) return wolf[0]
  }

  // otherwise: usually your own top suspect, sometimes ride the town consensus
  if (rng.next() < 0.35) {
    const c = townConsensus(s)
    if (c && c.id !== voterId) return c.id
  }
  const ranked = others
    .map(p => ({ p, score: (view[p.id] ?? 0) + rng.next() * 14 * nz(s) }))
    .sort((a, b) => b.score - a.score)
  // a hung jury is no fun every round, but the meek (and easy bots) sometimes abstain
  const abstainChance = s.difficulty === 'easy' ? 0.4 : s.difficulty === 'hard' ? 0.12 : 0.25
  if (ranked[0].score < 8 && rng.next() < abstainChance) return null
  return ranked[0].p.id
}

export function botVotes(s: GameState, humanIds: Set<string>): Action[] {
  return alive(s)
    .filter(p => p.isBot && !humanIds.has(p.id))
    .map(p => ({ type: 'vote', playerId: p.id, targetId: botVote(s, p.id) }) as Action)
}

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h)
}
