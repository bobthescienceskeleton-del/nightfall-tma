import { create } from 'zustand'
import {
  createGame,
  applyAction,
  playerById,
  living,
  nightReady,
  voteReady,
  type GameState,
  type GameEvent,
} from '@shared/engine'
import { toView, type GameView } from '@shared/view'
import {
  botNightActions,
  botVotes,
  botMafiaTarget,
  botDoctorTarget,
  botDetectiveTarget,
} from '@shared/bots'
import { ROLES } from '@shared/roles'
import { ROSTER } from '@shared/names'
import type { Profile, RoomStateDto } from '@shared/types'
import { api } from './api'
import { haptic } from './telegram'
import { playSfx } from './sound'

type Screen = 'home' | 'rules' | 'leaderboard' | 'lobby' | 'game'
type Mode = 'solo' | 'online'
interface ResultInfo { won: boolean; winner: 'town' | 'mafia' }

const TOWN = 7
export const YOU = 'you'

// dwell timings (ms) for the solo cinematic pacing
const BEAT = 650
const REVEAL_MS = 3600
const DISCUSS_MS = 2800
const VERDICT_MS = 3600
const DAY_DEADLINE_MS = 75000

interface S {
  ready: boolean
  screen: Screen
  mode: Mode | null
  profile: Profile | null
  botUsername: string

  solo: GameState | null
  room: RoomStateDto | null
  joinError: string | null
  busy: boolean

  showRole: boolean // the secret role-card overlay
  toast: string | null
  fly: { id: number; text: string } | null
  result: ResultInfo | null
  leaderboard: { name: string; wins: number; played: number }[]

  view(): GameView | null
  init(): Promise<void>
  go(s: Screen): void
  startSolo(): void
  dismissRole(): void
  nightAct(targetId: string): void
  castVote(targetId: string | null): void
  leaveGame(): void
  loadLeaderboard(): Promise<void>
  createRoom(): Promise<void>
  joinRoom(code: string): Promise<void>
  startRoom(): Promise<void>
}

// module-scoped timers (kept out of state to avoid re-renders)
let stepTimer: ReturnType<typeof setTimeout> | null = null
let voteTimer: ReturnType<typeof setTimeout> | null = null
let dayTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let flyId = 0

function clearSolo() {
  for (const t of [stepTimer, voteTimer, dayTimer]) if (t) clearTimeout(t)
  stepTimer = voteTimer = dayTimer = null
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

export const useStore = create<S>((set, get) => {
  // ── presentation: sound + fly chips from engine events ───────────────────
  function present(events: GameEvent[]) {
    for (const e of events) {
      if (e.kind === 'nightFell') playSfx('night')
      else if (e.kind === 'dawn') {
        if (e.victimId) { playSfx('kill'); flash(`☠️ ${nameOf(e.victimId)}`) }
        else if (e.saved) { playSfx('save'); flash('✚ Saved!') }
        else playSfx('dawn')
      } else if (e.kind === 'verdict') {
        if (e.targetId) playSfx('hang')
      }
    }
  }
  function nameOf(id: string): string {
    return get().solo?.players.find(p => p.id === id)?.name ?? 'Someone'
  }
  function flash(text: string) {
    const id = ++flyId
    set({ fly: { id, text } })
    setTimeout(() => { if (get().fly?.id === id) set({ fly: null }) }, 1100)
  }
  function toast(text: string) {
    set({ toast: text })
    setTimeout(() => { if (get().toast === text) set({ toast: null }) }, 1700)
  }

  // ── SOLO driver ──────────────────────────────────────────────────────────
  const humanSet = new Set([YOU])

  function setSolo(next: GameState) { set({ solo: next }) }
  function applyToSolo(action: Parameters<typeof applyAction>[1]) {
    const s = get().solo
    if (!s) return
    const r = applyAction(s, action)
    if (r.error) return
    setSolo(r.state)
    present(r.events)
  }
  function advanceSolo() {
    const s = get().solo
    if (!s) return
    const r = applyAction(s, { type: 'advance' })
    if (r.error) return
    setSolo(r.state)
    present(r.events)
    onEnterPhase()
  }

  function onEnterPhase() {
    clearSolo()
    const s = get().solo
    if (!s || get().mode !== 'solo') return
    if (s.status === 'finished') { finishSolo(); return }

    if (s.phase === 'night') {
      // bots act in the dark, then either wait for you or resolve
      for (const a of botNightActions(s, humanSet)) applyToSolo(a)
      const after = get().solo!
      const v = toView(after, YOU)
      if (nightReady(after)) {
        stepTimer = setTimeout(advanceSolo, BEAT)
      } else if (!v.canAct) {
        // you have no power (or you're dead): dwell on the night, then resolve
        stepTimer = setTimeout(() => { fillSoloNight(); advanceSolo() }, 1700)
      }
      // else: your power is needed — the grid waits for your tap
    } else if (s.phase === 'reveal') {
      stepTimer = setTimeout(advanceSolo, REVEAL_MS)
    } else if (s.phase === 'day') {
      voteTimer = setTimeout(() => { castBotVotes(); checkDay() }, DISCUSS_MS)
      dayTimer = setTimeout(() => { autoFinishDay() }, DAY_DEADLINE_MS)
    } else if (s.phase === 'verdict') {
      stepTimer = setTimeout(advanceSolo, VERDICT_MS)
    }
  }

  function fillSoloNight() {
    const s = get().solo
    if (!s) return
    if (s.night.mafiaTarget === null) {
      const m = living(s).find(p => p.role === 'mafia')
      const t = botMafiaTarget(s)
      if (m && t) applyToSolo({ type: 'act', playerId: m.id, power: 'kill', targetId: t })
    }
    const doc = living(s).find(p => p.role === 'doctor')
    if (doc && get().solo!.night.doctorTarget === null) {
      const t = botDoctorTarget(get().solo!, doc.id)
      if (t) applyToSolo({ type: 'act', playerId: doc.id, power: 'save', targetId: t })
    }
    const det = living(s).find(p => p.role === 'detective')
    if (det && get().solo!.night.detectiveTarget === null) {
      const t = botDetectiveTarget(get().solo!, det.id)
      if (t) applyToSolo({ type: 'act', playerId: det.id, power: 'investigate', targetId: t })
    }
  }

  function castBotVotes() {
    const s = get().solo
    if (!s) return
    for (const a of botVotes(s, humanSet)) applyToSolo(a)
  }

  function checkDay() {
    const s = get().solo
    if (!s || s.phase !== 'day') return
    if (voteReady(s)) { clearSolo(); stepTimer = setTimeout(advanceSolo, BEAT) }
  }

  function autoFinishDay() {
    const s = get().solo
    if (!s || s.phase !== 'day') return
    castBotVotes()
    // skip any still-missing living votes (e.g. you idled)
    for (const p of living(get().solo!)) {
      if (!(p.id in get().solo!.votes)) applyToSolo({ type: 'vote', playerId: p.id, targetId: null })
    }
    advanceSolo()
  }

  function finishSolo() {
    clearSolo()
    const s = get().solo!
    const me = s.players.find(p => p.id === YOU)!
    const team = ROLES[me.role].team
    const won = s.winner === team
    playSfx(won ? 'win' : 'lose')
    haptic(won ? 'success' : 'warn')
    set({ result: { won, winner: s.winner ?? 'town' } })
    api.soloResult(won, team).then(r => set({ profile: r.profile })).catch(() => {})
  }

  // ── ONLINE driver ──────────────────────────────────────────────────────────
  function applyRoom(next: RoomStateDto) {
    const prev = get().room
    // surface dawn/verdict beats by phase change
    const pv = prev?.view, nv = next.view
    if (pv && nv && pv.phase !== nv.phase) {
      if (nv.phase === 'reveal') {
        if (nv.lastNight?.victimId) playSfx('kill')
        else if (nv.lastNight?.saved) playSfx('save')
        else playSfx('dawn')
      } else if (nv.phase === 'night') playSfx('night')
      else if (nv.phase === 'verdict' && nv.lastVerdict?.targetId) playSfx('hang')
    }
    set({ room: next })
    if (next.roundOver && !prev?.roundOver) {
      playSfx(next.roundOver.youWon ? 'win' : 'lose')
      haptic(next.roundOver.youWon ? 'success' : 'warn')
      set({ result: { won: next.roundOver.youWon, winner: next.roundOver.winner } })
      api.profile().then(r => set({ profile: r.profile })).catch(() => {})
    }
  }
  function startPoll(code: string) {
    stopPoll()
    pollTimer = setInterval(async () => {
      try { applyRoom(await api.roomState(code)) } catch { /* transient */ }
    }, 1100)
  }
  async function onlineAct(fn: () => Promise<RoomStateDto>) {
    try { applyRoom(await fn()) }
    catch (e) {
      haptic('warn')
      const code = (e as { data?: { error?: string } })?.data?.error
      if (code && !['not_your_turn', 'bad_action', 'bad_vote'].includes(code)) toast(code.replace(/_/g, ' '))
    }
  }

  return {
    ready: false,
    screen: 'home',
    mode: null,
    profile: null,
    botUsername: 'nightfall_play_bot',
    solo: null,
    room: null,
    joinError: null,
    busy: false,
    showRole: false,
    toast: null,
    fly: null,
    result: null,
    leaderboard: [],

    view() {
      const st = get()
      if (st.mode === 'solo' && st.solo) return toView(st.solo, YOU)
      if (st.mode === 'online' && st.room?.view) return st.room.view
      return null
    },

    async init() {
      try {
        const { profile, startParam, botUsername } = await api.auth()
        set({ profile, botUsername: botUsername || 'nightfall_play_bot', ready: true })
        if (startParam?.startsWith('room_')) {
          const code = startParam.slice(5).toUpperCase()
          if (/^[A-Z0-9]{4}$/.test(code)) await get().joinRoom(code)
        }
      } catch {
        set({ ready: true }) // still allow offline solo play
      }
    },

    go(screen) {
      haptic('tap')
      if (screen !== 'lobby' && screen !== 'game') stopPoll()
      set({ screen })
    },

    startSolo() {
      clearSolo(); stopPoll()
      const shuffled = ROSTER.slice().sort(() => Math.random() - 0.5).slice(0, TOWN - 1)
      const players = [
        { id: YOU, name: get().profile?.name?.split(' ')[0] || 'You', avatar: '🙂', isBot: false },
        ...shuffled.map((t, i) => ({ id: `bot${i + 1}`, name: t.name, avatar: t.avatar, isBot: true })),
      ]
      const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
      const game = createGame({ players, seed })
      set({ mode: 'solo', solo: game, room: null, screen: 'game', result: null, showRole: true })
      haptic('select')
      playSfx('reveal')
    },

    dismissRole() {
      haptic('tap')
      set({ showRole: false })
      if (get().mode === 'solo') onEnterPhase()
    },

    nightAct(targetId) {
      const v = get().view()
      if (!v || v.phase !== 'night' || !v.canAct || !v.actPower) return
      haptic('select'); playSfx('tap')
      if (get().mode === 'solo') {
        applyToSolo({ type: 'act', playerId: YOU, power: v.actPower, targetId })
        const s = get().solo!
        if (nightReady(s)) { clearSolo(); stepTimer = setTimeout(advanceSolo, BEAT) }
      } else {
        const code = get().room!.room.code
        onlineAct(() => api.roomAct(code, v.actPower!, targetId))
      }
    },

    castVote(targetId) {
      const v = get().view()
      if (!v || v.phase !== 'day' || !v.you.alive || v.yourVote !== undefined) return
      haptic('select'); playSfx('vote')
      if (get().mode === 'solo') {
        applyToSolo({ type: 'vote', playerId: YOU, targetId })
        checkDay()
      } else {
        const code = get().room!.room.code
        onlineAct(() => api.roomVote(code, targetId))
      }
    },

    leaveGame() {
      clearSolo(); stopPoll()
      const room = get().room
      if (room && get().mode === 'online') api.roomLeave(room.room.code).catch(() => {})
      set({ mode: null, solo: null, room: null, result: null, showRole: false, screen: 'home' })
      haptic('tap')
    },

    async loadLeaderboard() {
      try { set({ leaderboard: (await api.leaderboard()).top }) } catch { /* offline */ }
    },

    async createRoom() {
      set({ busy: true, joinError: null })
      try {
        const st = await api.roomCreate()
        set({ mode: 'online', room: st, screen: 'lobby', result: null, busy: false })
        startPoll(st.room.code)
      } catch {
        set({ busy: false, joinError: 'Could not create a room. Check your connection.' })
      }
    },

    async joinRoom(code) {
      set({ busy: true, joinError: null })
      try {
        const st = await api.roomJoin(code)
        set({ mode: 'online', room: st, screen: 'lobby', result: null, busy: false })
        startPoll(st.room.code)
      } catch (e) {
        const err = (e as { data?: { error?: string } })?.data?.error
        set({
          busy: false,
          joinError: err === 'no_room' ? 'No town with that code.'
            : err === 'already_started' ? 'That game already started.'
            : err === 'full' ? 'That town is full.' : 'Could not join.',
        })
      }
    },

    async startRoom() {
      const room = get().room
      if (!room) return
      set({ busy: true })
      try {
        const st = await api.roomStart(room.room.code)
        set({ room: st, screen: 'game', busy: false, showRole: true, result: null })
      } catch {
        set({ busy: false }); toast('Could not start')
      }
    },
  }
})
