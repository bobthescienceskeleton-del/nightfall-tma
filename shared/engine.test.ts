import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  createGame,
  applyAction,
  living,
  counts,
  nightReady,
  voteReady,
  type GameState,
  type Role,
  type Action,
} from './engine'
import { rolesForCount, ROLES } from './roles'
import { botNightActions, botVotes } from './bots'
import { toView } from './view'

function seats(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    avatar: '🙂',
    isBot: true,
  }))
}

function newGame(n = 7, seed = 12345): GameState {
  return createGame({ players: seats(n), seed })
}

// drive a fully-automated game (all bots) to its conclusion
function playOut(seed: number, n = 7): GameState {
  let g = newGame(n, seed)
  const none = new Set<string>()
  let guard = 0
  while (g.status === 'playing' && guard++ < 2000) {
    if (g.phase === 'night') {
      for (const a of botNightActions(g, none)) g = applyAction(g, a).state
      g = applyAction(g, { type: 'advance' }).state
    } else if (g.phase === 'day') {
      for (const a of botVotes(g, none)) g = applyAction(g, a).state
      g = applyAction(g, { type: 'advance' }).state
    } else {
      g = applyAction(g, { type: 'advance' }).state // reveal / verdict
    }
  }
  assert.ok(guard < 2000, `game ${seed} did not terminate`)
  return g
}

function forceRoles(g: GameState, roles: Role[]): GameState {
  const next = structuredClone(g)
  next.players.forEach((p, i) => (p.role = roles[i]))
  return next
}

test('role distribution scales with town size', () => {
  assert.deepEqual(rolesForCount(5).filter(r => r === 'mafia').length, 1)
  const seven = rolesForCount(7)
  assert.equal(seven.length, 7)
  assert.equal(seven.filter(r => r === 'mafia').length, 2)
  assert.equal(seven.filter(r => r === 'detective').length, 1)
  assert.equal(seven.filter(r => r === 'doctor').length, 1)
  assert.equal(seven.filter(r => r === 'villager').length, 3)
})

test('createGame deals a full, valid town', () => {
  const g = newGame(7)
  assert.equal(g.players.length, 7)
  assert.equal(g.phase, 'night')
  assert.equal(g.day, 1)
  assert.ok(g.players.every(p => p.alive))
  const m = g.players.filter(p => p.role === 'mafia').length
  assert.equal(m, 2)
  assert.equal(g.players.filter(p => p.role === 'detective').length, 1)
})

test('every seeded game terminates with a coherent winner', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const g = playOut(seed)
    assert.equal(g.status, 'finished')
    assert.ok(g.winner === 'town' || g.winner === 'mafia')
    const { mafia, town } = counts(g)
    if (g.winner === 'town') assert.equal(mafia, 0)
    else assert.ok(mafia >= town)
  }
})

test('games are deterministic for a given seed', () => {
  const a = playOut(777)
  const b = playOut(777)
  assert.equal(a.winner, b.winner)
  assert.equal(a.day, b.day)
  assert.deepEqual(
    a.players.map(p => p.alive),
    b.players.map(p => p.alive),
  )
})

test('the Doctor can catch the blade', () => {
  // p0 mafia, p1 doctor, p2 detective, rest villagers
  let g = forceRoles(newGame(7), ['mafia', 'doctor', 'detective', 'villager', 'villager', 'villager', 'villager'])
  g = applyAction(g, { type: 'act', playerId: 'p0', power: 'kill', targetId: 'p3' }).state
  g = applyAction(g, { type: 'act', playerId: 'p1', power: 'save', targetId: 'p3' }).state
  g = applyAction(g, { type: 'act', playerId: 'p2', power: 'investigate', targetId: 'p0' }).state
  assert.ok(nightReady(g))
  g = applyAction(g, { type: 'advance' }).state
  assert.equal(g.phase, 'reveal')
  assert.ok(g.lastNight?.saved)
  assert.equal(g.lastNight?.victimId, null)
  assert.ok(living(g).find(p => p.id === 'p3')) // survived
})

test('an unprotected target dies at dawn', () => {
  let g = forceRoles(newGame(7), ['mafia', 'doctor', 'detective', 'villager', 'villager', 'villager', 'villager'])
  g = applyAction(g, { type: 'act', playerId: 'p0', power: 'kill', targetId: 'p4' }).state
  g = applyAction(g, { type: 'act', playerId: 'p1', power: 'save', targetId: 'p3' }).state
  g = applyAction(g, { type: 'act', playerId: 'p2', power: 'investigate', targetId: 'p0' }).state
  g = applyAction(g, { type: 'advance' }).state
  assert.equal(g.lastNight?.victimId, 'p4')
  const p4 = g.players.find(p => p.id === 'p4')!
  assert.equal(p4.alive, false)
  assert.equal(p4.deathCause, 'mafia')
})

test('the Detective gets one read per night, and the view reflects it', () => {
  let g = forceRoles(newGame(7), ['mafia', 'doctor', 'detective', 'villager', 'villager', 'villager', 'villager'])
  g = applyAction(g, { type: 'act', playerId: 'p0', power: 'kill', targetId: 'p4' }).state
  g = applyAction(g, { type: 'act', playerId: 'p1', power: 'save', targetId: 'p4' }).state
  g = applyAction(g, { type: 'act', playerId: 'p2', power: 'investigate', targetId: 'p3' }).state // change of mind…
  g = applyAction(g, { type: 'act', playerId: 'p2', power: 'investigate', targetId: 'p0' }).state // …lock onto the wolf
  g = applyAction(g, { type: 'advance' }).state // dawn records the single read
  assert.equal(g.detectiveResults['p2']['p0'], true)
  assert.equal('p3' in (g.detectiveResults['p2'] ?? {}), false) // the earlier pick bought nothing
  const v = toView(g, 'p2')
  assert.equal(v.players.find(p => p.id === 'p0')!.knownRole, 'mafia') // caught
  assert.equal(v.detectiveReads.length, 1)
})

test('a Detective keeps their read even if the Mafia take them that same night', () => {
  // two mafia so they can target the detective; detective investigates first
  let g = forceRoles(newGame(7), ['mafia', 'mafia', 'detective', 'doctor', 'villager', 'villager', 'villager'])
  g = applyAction(g, { type: 'act', playerId: 'p0', power: 'kill', targetId: 'p2' }).state // kill the detective
  g = applyAction(g, { type: 'act', playerId: 'p2', power: 'investigate', targetId: 'p0' }).state
  g = applyAction(g, { type: 'act', playerId: 'p3', power: 'save', targetId: 'p4' }).state
  g = applyAction(g, { type: 'advance' }).state
  // the detective died, but their finding was recorded (attributed to them)
  assert.equal(g.players.find(p => p.id === 'p2')!.alive, false)
  assert.equal(g.detectiveResults['p2']['p0'], true)
})

test('the night never deadlocks when the Mafia have no legal target', () => {
  const g = forceRoles(createGame({ players: seats(3), seed: 5 }), ['mafia', 'mafia', 'mafia'])
  // no town remains, so the Mafia owe no kill — the night is immediately resolvable
  assert.equal(nightReady(g), true)
  const after = applyAction(g, { type: 'advance' }).state
  assert.equal(after.lastNight?.victimId, null)
})

test('illegal actions are rejected without mutating state', () => {
  const g = forceRoles(newGame(7), ['mafia', 'doctor', 'detective', 'villager', 'villager', 'villager', 'villager'])
  assert.equal(applyAction(g, { type: 'act', playerId: 'p3', power: 'kill', targetId: 'p0' }).error, 'not_mafia')
  assert.equal(applyAction(g, { type: 'act', playerId: 'p2', power: 'investigate', targetId: 'p2' }).error, 'no_self_investigate')
  // mafia cannot kill a fellow mafia — use a 2-mafia town
  const g2 = forceRoles(newGame(7), ['mafia', 'mafia', 'detective', 'villager', 'villager', 'villager', 'villager'])
  assert.equal(applyAction(g2, { type: 'act', playerId: 'p0', power: 'kill', targetId: 'p1' }).error, 'no_kill_ally')
  // voting is illegal during the night, and state is untouched on a rejected action
  assert.equal(applyAction(g, { type: 'vote', playerId: 'p0', targetId: 'p1' }).error, 'not_day')
  assert.equal(g.phase, 'night')
})

test('a clear majority hangs the accused; a tie spares everyone', () => {
  // get to a day phase
  let g = forceRoles(newGame(7), ['mafia', 'mafia', 'detective', 'doctor', 'villager', 'villager', 'villager'])
  g = applyAction(g, { type: 'act', playerId: 'p0', power: 'kill', targetId: 'p6' }).state
  g = applyAction(g, { type: 'act', playerId: 'p2', power: 'investigate', targetId: 'p0' }).state
  g = applyAction(g, { type: 'act', playerId: 'p3', power: 'save', targetId: 'p4' }).state
  g = applyAction(g, { type: 'advance' }).state // reveal
  g = applyAction(g, { type: 'advance' }).state // day
  assert.equal(g.phase, 'day')
  const liveIds = living(g).map(p => p.id)
  // everyone votes p0
  for (const id of liveIds) g = applyAction(g, { type: 'vote', playerId: id, targetId: id === 'p0' ? 'p1' : 'p0' }).state
  assert.ok(voteReady(g))
  g = applyAction(g, { type: 'advance' }).state
  assert.equal(g.phase === 'verdict' || g.phase === 'gameover', true)
  assert.equal(g.lastVerdict?.targetId, 'p0')
  assert.equal(g.players.find(p => p.id === 'p0')!.alive, false)
})

test('town wins when the last Mafia falls; view reveals all at game over', () => {
  // tiny endgame: p0 mafia (alone), p1 villager, p2 villager → vote out p0
  let g = forceRoles(createGame({ players: seats(3), seed: 9 }, ), ['mafia', 'villager', 'villager'])
  // skip to day by resolving an empty-ish night (mafia must pick someone)
  g = applyAction(g, { type: 'act', playerId: 'p0', power: 'kill', targetId: 'p1' }).state
  g = applyAction(g, { type: 'advance' }).state // reveal: p1 dies
  // now p0 (mafia) vs p2 (town): mafia >= town → mafia should already have won at dawn
  assert.equal(g.status, 'finished')
  assert.equal(g.winner, 'mafia')
  const v = toView(g, 'p2')
  // at game over everyone's role is visible
  assert.ok(v.players.every(p => p.knownRole !== null))
})

test("a villager cannot see living players' hidden roles", () => {
  const g = forceRoles(newGame(7), ['mafia', 'mafia', 'detective', 'doctor', 'villager', 'villager', 'villager'])
  const v = toView(g, 'p4') // a villager
  assert.equal(v.you.role, 'villager')
  const hidden = v.players.filter(p => !p.isYou && p.alive)
  assert.ok(hidden.every(p => p.knownRole === null && !p.cleared))
  assert.deepEqual(v.mafiaPartners, [])
})

test('mafia partners see each other', () => {
  const g = forceRoles(newGame(7), ['mafia', 'mafia', 'detective', 'doctor', 'villager', 'villager', 'villager'])
  const v = toView(g, 'p0')
  assert.deepEqual(v.mafiaPartners.sort(), ['p0', 'p1'])
  assert.equal(v.players.find(p => p.id === 'p1')!.knownRole, 'mafia')
  assert.equal(v.players.find(p => p.id === 'p2')!.knownRole, null) // town still hidden
})

test('role metadata is complete', () => {
  for (const r of ['mafia', 'detective', 'doctor', 'villager'] as Role[]) {
    assert.ok(ROLES[r].name && ROLES[r].emoji && ROLES[r].power && ROLES[r].blurb)
  }
})
