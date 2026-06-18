// --- Online room manager ---------------------------------------------------
// Server-authoritative games held in memory (single-instance Railway deploy),
// mirroring uno's design. Solo play is fully client-side and needs none of this;
// rooms add the play-with-friends layer.
//
// Nightfall has dwell phases (a beat to read the dawn, a beat on the verdict),
// so the room is driven by a wall-clock `tick` run on every poll and after every
// human action: bots act/vote on their own, humans get a window, and any seat
// that misses its window is auto-filled so the town never stalls.

import {
  createGame,
  applyAction,
  living,
  nightReady,
  voteReady,
  type GameState,
  type Action,
} from '../../shared/engine'
import { toView } from '../../shared/view'
import {
  botNightActions,
  botVotes,
  botMafiaTarget,
  botDoctorTarget,
  botDetectiveTarget,
  botVote,
} from '../../shared/bots'
import { ROLES } from '../../shared/roles'
import { ROSTER, HUMAN_AVATARS } from '../../shared/names'
import type { RoomStateDto, RoomDto } from '../../shared/types'
import { recordResult } from './profiles'

interface Seat {
  id: string // 'u<tgid>' for humans, 'bot1'… for bots
  tgId: number | null
  name: string
  avatar: string
  isBot: boolean
  isHost: boolean
  lastSeen: number
}

interface Room {
  code: string
  hostTgId: number
  seats: Seat[]
  game: GameState | null
  version: number
  townSize: number
  createdAt: number
  lastActivity: number
  // pacing
  phaseAt: number
  lastPhase: string
  botNightDone: boolean
  botVotesDone: boolean
  scored: boolean
}

const rooms = new Map<string, Room>()
const TOWN_SIZE = 7
const MAX_HUMANS = 7
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no easily-confused chars

// pacing (ms)
const NIGHT_MS = 30000
const REVEAL_MS = 5000
const DISCUSS_MS = 3500
const DAY_MS = 45000
const VERDICT_MS = 5000

function newCode(): string {
  let code = ''
  do {
    code = ''
    for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  } while (rooms.has(code))
  return code
}

const seatFor = (room: Room, tgId: number) => room.seats.find(s => s.tgId === tgId)

function roomDto(room: Room): RoomDto {
  return {
    code: room.code,
    hostId: `u${room.hostTgId}`,
    started: !!room.game,
    maxPlayers: MAX_HUMANS,
    townSize: room.townSize,
    players: room.seats.map(s => ({
      id: s.id,
      name: s.name,
      avatar: s.avatar,
      isBot: s.isBot,
      isHost: s.isHost,
      connected: s.isBot || Date.now() - s.lastSeen < 15000,
    })),
  }
}

export function createRoom(tgId: number, name: string): RoomStateDto {
  const code = newCode()
  const room: Room = {
    code,
    hostTgId: tgId,
    seats: [
      { id: `u${tgId}`, tgId, name, avatar: HUMAN_AVATARS[0], isBot: false, isHost: true, lastSeen: Date.now() },
    ],
    game: null,
    version: 1,
    townSize: TOWN_SIZE,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    phaseAt: Date.now(),
    lastPhase: '',
    botNightDone: false,
    botVotesDone: false,
    scored: false,
  }
  rooms.set(code, room)
  return stateFor(room, tgId)
}

export function joinRoom(code: string, tgId: number, name: string): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room) return { error: 'no_room' }
  if (room.game) return { error: 'already_started' }
  const existing = seatFor(room, tgId)
  if (existing) {
    existing.lastSeen = Date.now()
    return stateFor(room, tgId)
  }
  const humans = room.seats.filter(s => !s.isBot).length
  if (humans >= MAX_HUMANS) return { error: 'full' }
  room.seats.push({
    id: `u${tgId}`,
    tgId,
    name,
    avatar: HUMAN_AVATARS[humans % HUMAN_AVATARS.length],
    isBot: false,
    isHost: false,
    lastSeen: Date.now(),
  })
  room.version++
  room.lastActivity = Date.now()
  return stateFor(room, tgId)
}

export function startRoom(code: string, tgId: number): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room) return { error: 'no_room' }
  if (room.hostTgId !== tgId) return { error: 'not_host' }
  if (room.game) return { error: 'already_started' }

  // pad with characterful bots up to a full town
  let b = 0
  const used = new Set(room.seats.map(s => s.avatar))
  while (room.seats.length < room.townSize) {
    const t = ROSTER.find(r => !used.has(r.avatar)) ?? ROSTER[b % ROSTER.length]
    used.add(t.avatar)
    b++
    room.seats.push({
      id: `bot${b}`,
      tgId: null,
      name: t.name,
      avatar: t.avatar,
      isBot: true,
      isHost: false,
      lastSeen: Date.now(),
    })
  }

  const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
  room.game = createGame({
    players: room.seats.map(s => ({ id: s.id, name: s.name, avatar: s.avatar, isBot: s.isBot })),
    seed,
  })
  room.scored = false
  room.botNightDone = false
  room.botVotesDone = false
  room.phaseAt = Date.now()
  room.lastPhase = room.game.phase
  room.version++
  room.lastActivity = Date.now()
  tickRoom(room)
  return stateFor(room, tgId)
}

const humanIds = (room: Room) => new Set(room.seats.filter(s => !s.isBot).map(s => s.id))

function apply(room: Room, action: Action): string | undefined {
  if (!room.game) return 'no_game'
  const res = applyAction(room.game, action)
  if (res.error) return res.error
  room.game = res.state
  room.version++
  return undefined
}

// Drive the room forward based on the wall clock + whose inputs are in.
function tickRoom(room: Room): void {
  if (!room.game) return
  const now = Date.now()

  // reset pacing flags whenever the phase changes
  if (room.game.phase !== room.lastPhase) {
    room.lastPhase = room.game.phase
    room.phaseAt = now
    room.botNightDone = false
    room.botVotesDone = false
  }

  const g = room.game
  if (g.status === 'finished') {
    finalize(room)
    return
  }

  switch (g.phase) {
    case 'night': {
      if (!room.botNightDone) {
        for (const a of botNightActions(g, humanIds(room))) apply(room, a)
        room.botNightDone = true
      }
      if (nightReady(room.game!)) {
        apply(room, { type: 'advance' })
        tickRoom(room)
      } else if (now - room.phaseAt > NIGHT_MS) {
        fillMissingNight(room)
        apply(room, { type: 'advance' })
        tickRoom(room)
      }
      break
    }
    case 'reveal': {
      if (now - room.phaseAt > REVEAL_MS) {
        apply(room, { type: 'advance' })
        tickRoom(room)
      }
      break
    }
    case 'day': {
      if (!room.botVotesDone && now - room.phaseAt > DISCUSS_MS) {
        for (const a of botVotes(g, humanIds(room))) apply(room, a)
        room.botVotesDone = true
      }
      if (voteReady(room.game!)) {
        apply(room, { type: 'advance' })
        tickRoom(room)
      } else if (now - room.phaseAt > DAY_MS) {
        if (!room.botVotesDone) {
          for (const a of botVotes(g, humanIds(room))) apply(room, a)
          room.botVotesDone = true
        }
        fillMissingVotes(room)
        apply(room, { type: 'advance' })
        tickRoom(room)
      }
      break
    }
    case 'verdict': {
      if (now - room.phaseAt > VERDICT_MS) {
        apply(room, { type: 'advance' })
        tickRoom(room)
      }
      break
    }
  }
}

// A human who let the clock run out gets a sensible auto-pick for their power.
function fillMissingNight(room: Room): void {
  const g = room.game!
  const hi = humanIds(room)
  if (g.night.mafiaTarget === null) {
    const mafia = living(g).find(p => p.role === 'mafia')
    const t = botMafiaTarget(g)
    if (mafia && t) apply(room, { type: 'act', playerId: mafia.id, power: 'kill', targetId: t })
  }
  const doctor = living(g).find(p => p.role === 'doctor')
  if (doctor && g.night.doctorTarget === null) {
    const t = botDoctorTarget(g, doctor.id)
    if (t) apply(room, { type: 'act', playerId: doctor.id, power: 'save', targetId: t })
  }
  const det = living(g).find(p => p.role === 'detective')
  if (det && g.night.detectiveTarget === null) {
    const t = botDetectiveTarget(g, det.id)
    if (t) apply(room, { type: 'act', playerId: det.id, power: 'investigate', targetId: t })
  }
  void hi
}

function fillMissingVotes(room: Room): void {
  const g = room.game!
  for (const p of living(g)) {
    if (!(p.id in g.votes)) apply(room, { type: 'vote', playerId: p.id, targetId: botVote(g, p.id) })
  }
}

export function actInRoom(
  code: string,
  tgId: number,
  power: 'kill' | 'save' | 'investigate',
  targetId: string,
): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room || !room.game) return { error: 'no_game' }
  const seat = seatFor(room, tgId)
  if (!seat) return { error: 'not_in_room' }
  seat.lastSeen = Date.now()
  const e = apply(room, { type: 'act', playerId: seat.id, power, targetId })
  room.lastActivity = Date.now()
  tickRoom(room)
  if (e) return { error: e }
  return stateFor(room, tgId)
}

export function voteInRoom(
  code: string,
  tgId: number,
  targetId: string | null,
): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room || !room.game) return { error: 'no_game' }
  const seat = seatFor(room, tgId)
  if (!seat) return { error: 'not_in_room' }
  seat.lastSeen = Date.now()
  const e = apply(room, { type: 'vote', playerId: seat.id, targetId })
  room.lastActivity = Date.now()
  tickRoom(room)
  if (e) return { error: e }
  return stateFor(room, tgId)
}

export function getRoomState(code: string, tgId: number): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room) return { error: 'no_room' }
  // only seated players may read a room — otherwise any authed user could poll
  // arbitrary 4-char codes to enumerate lobby rosters. Join via /room/join first.
  const seat = seatFor(room, tgId)
  if (!seat) return { error: 'not_in_room' }
  seat.lastSeen = Date.now()
  tickRoom(room)
  return stateFor(room, tgId)
}

export function leaveRoom(code: string, tgId: number): void {
  const room = rooms.get(code.toUpperCase())
  if (!room) return
  if (!room.game) {
    room.seats = room.seats.filter(s => s.tgId !== tgId)
    if (room.seats.filter(s => !s.isBot).length === 0) rooms.delete(code.toUpperCase())
    else room.version++
  }
}

function finalize(room: Room): void {
  if (!room.game || room.game.status !== 'finished' || room.scored) return
  room.scored = true
  const winner = room.game.winner!
  for (const s of room.seats) {
    if (s.isBot || s.tgId == null) continue
    const me = room.game.players.find(p => p.id === s.id)
    if (!me) continue
    const team = ROLES[me.role].team
    recordResult(s.tgId, 'online', team === winner, team)
  }
}

function stateFor(room: Room, tgId: number): RoomStateDto {
  const seat = seatFor(room, tgId)
  const view = room.game && seat ? toView(room.game, seat.id) : null
  let roundOver: RoomStateDto['roundOver'] = null
  if (room.game?.status === 'finished' && room.game.winner && seat) {
    const me = room.game.players.find(p => p.id === seat.id)
    const team = me ? ROLES[me.role].team : 'town'
    roundOver = { winner: room.game.winner, youWon: team === room.game.winner }
  }
  return { room: roomDto(room), version: room.version, view, roundOver }
}

// sweep idle rooms every 10 min (30 min idle means gone)
setInterval(() => {
  const now = Date.now()
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > 30 * 60_000) rooms.delete(code)
  }
}, 10 * 60_000).unref?.()
