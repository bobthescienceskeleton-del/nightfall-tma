// What a single seat is allowed to see. The server sends only this to each
// online client (never the full state) so roles can't leak; solo builds the
// same view locally. Roles stay hidden until a player dies (their card flips),
// the game ends, or you have private knowledge (Mafia see partners; the
// Detective sees who they've cleared or caught).

import type { GameState, Phase, Role, Team, NightOutcome, Verdict, LogEntry } from './engine'
import type { ChatLine } from './chatter'
import { ROLES } from './roles'

export interface ViewPlayer {
  id: string
  name: string
  avatar: string
  alive: boolean
  isBot: boolean
  isYou: boolean
  knownRole: Role | null // null = hidden from you
  cleared: boolean // you (Detective) confirmed they are NOT Mafia
  diedOn: number
  deathCause: 'mafia' | 'vote' | null
  votedFor: string | null | undefined // public day vote (undefined = not yet)
  votesOn: number // how many votes currently sit on this player
}

export interface GameView {
  youId: string
  you: { role: Role; roleName: string; team: Team; alive: boolean }
  phase: Phase
  day: number
  status: 'playing' | 'finished'
  winner: Team | null

  players: ViewPlayer[]
  aliveCount: number
  mafiaTotal: number // how many Mafia the town began with (known to all)

  mafiaPartners: string[] // ids of your fellow Mafia (incl. you), if you are Mafia
  detectiveReads: { targetId: string; isMafia: boolean }[] // your investigations

  lastNight: NightOutcome | null
  lastVerdict: Verdict | null
  chatter: ChatLine[]
  log: LogEntry[]

  yourVote: string | null | undefined // undefined = not voted, null = skipped
  mafiaTarget: string | null // tonight's Mafia pick (only populated if you're Mafia)

  // what the UI needs to prompt you
  canAct: boolean // you have a night power and haven't used it yet
  actPower: 'kill' | 'save' | 'investigate' | null
  yourNightTarget: string | null // your submitted night pick (if any)
}

export function toView(s: GameState, youId: string): GameView {
  const me = s.players.find(p => p.id === youId)
  const myRole: Role = me?.role ?? 'villager'
  const reveal = s.status === 'finished'

  const myReads = s.detectiveResults[youId] ?? {}

  const players: ViewPlayer[] = s.players.map(p => {
    let knownRole: Role | null = null
    let cleared = false
    if (p.id === youId) knownRole = p.role
    else if (!p.alive) knownRole = p.role // flipped on death
    else if (reveal) knownRole = p.role
    else if (myRole === 'mafia' && p.role === 'mafia') knownRole = 'mafia'
    else if (myRole === 'detective' && p.id in myReads) {
      if (myReads[p.id]) knownRole = 'mafia'
      else cleared = true
    }
    const votedFor = p.id in s.votes ? s.votes[p.id] : undefined
    const votesOn = s.players.filter(q => q.alive && s.votes[q.id] === p.id).length
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      alive: p.alive,
      isBot: p.isBot,
      isYou: p.id === youId,
      knownRole,
      cleared,
      diedOn: p.diedOn,
      deathCause: p.deathCause,
      votedFor,
      votesOn,
    }
  })

  const myPower: 'kill' | 'save' | 'investigate' | null =
    myRole === 'mafia' ? 'kill' : myRole === 'doctor' ? 'save' : myRole === 'detective' ? 'investigate' : null

  const yourNightTarget =
    myRole === 'mafia'
      ? s.night.mafiaTarget
      : myRole === 'doctor'
        ? s.night.doctorTarget
        : myRole === 'detective'
          ? s.night.detectiveTarget
          : null

  const canAct = s.phase === 'night' && !!me?.alive && myPower !== null && !yourNightTarget

  return {
    youId,
    you: { role: myRole, roleName: ROLES[myRole].name, team: ROLES[myRole].team, alive: !!me?.alive },
    phase: s.phase,
    day: s.day,
    status: s.status,
    winner: s.winner,
    players,
    aliveCount: s.players.filter(p => p.alive).length,
    mafiaTotal: s.players.filter(p => p.role === 'mafia').length,
    mafiaPartners:
      myRole === 'mafia' ? s.players.filter(p => p.role === 'mafia').map(p => p.id) : [],
    detectiveReads: Object.entries(myReads).map(([targetId, isMafia]) => ({ targetId, isMafia })),
    lastNight: s.lastNight,
    lastVerdict: s.lastVerdict,
    chatter: s.chatter,
    log: s.log,
    yourVote: youId in s.votes ? s.votes[youId] : undefined,
    mafiaTarget: myRole === 'mafia' ? s.night.mafiaTarget : null,
    canAct,
    actPower: myPower,
    yourNightTarget,
  }
}
