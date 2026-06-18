// ============================================================================
// The town's voice. Each dawn the surviving townsfolk argue — accusations,
// denials, claims, nervous asides. It is generated deterministically from the
// suspicion model + a seeded RNG so the feed is identical for every observer of
// an online room, and reproducible in tests.
//
// Only *bots* speak here; the human reads the room and acts with their vote.
// Imports from the engine are type-only (erased at build) so there is no
// runtime import cycle.
// ============================================================================

import type { GameState, EnginePlayer } from './engine'

export type ChatTone = 'accuse' | 'defend' | 'observe' | 'claim' | 'panic'

export interface ChatLine {
  speakerId: string
  speakerName: string
  avatar: string
  text: string
  tone: ChatTone
}

type Rng = { next(): number }

const aliveBots = (s: GameState) => s.players.filter(p => p.alive && p.isBot)
const alive = (s: GameState) => s.players.filter(p => p.alive)

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng.next() * arr.length)]
}

// a speaker's top suspect among the living (optionally avoiding fellow mafia)
function topSuspect(s: GameState, owner: EnginePlayer, avoidMafia: boolean): EnginePlayer | null {
  const view = s.suspicion[owner.id] ?? {}
  const cands = alive(s).filter(p => p.id !== owner.id && !(avoidMafia && p.role === 'mafia'))
  if (!cands.length) return null
  return cands.reduce((best, p) => ((view[p.id] ?? 0) > (view[best.id] ?? 0) ? p : best))
}

// ── template banks (variety keeps the table from sounding canned) ────────────

const ACCUSE = [
  (a: string, b: string) => `“${b}, you’ve been awfully quiet. Quiet people have something to hide.”`,
  (a: string, b: string) => `“I don’t trust ${b}. Something about that face at dawn.”`,
  (a: string, b: string) => `“Watch ${b} — too eager to point fingers, if you ask me.”`,
  (a: string, b: string) => `“It’s ${b}. I’d stake my last lamp-oil on it.”`,
  (a: string, b: string) => `“${b} hasn’t looked me in the eye once. That’s answer enough.”`,
  (a: string, b: string) => `“Funny how trouble follows ${b} around, isn’t it?”`,
  (a: string, b: string) => `“My gut says ${b}. And my gut kept me alive this long.”`,
]
const DEFEND = [
  (me: string) => `“Me? I was asleep like the rest of you. This is madness.”`,
  (me: string) => `“You’re wasting the day on me while the real wolf grins.”`,
  (me: string) => `“Point that finger somewhere it belongs. I’ve done nothing.”`,
  (me: string) => `“If you hang me you’ll see your mistake tomorrow — too late.”`,
  (me: string) => `“I’m as town as they come. Think it through.”`,
]
const OBSERVE = [
  () => `“Let’s not panic. Who did each of us suspect last night?”`,
  () => `“Two of us are lying. Only two. Narrow it down.”`,
  () => `“Keep your heads. Loud accusers are often the guilty ones.”`,
  () => `“Count the empty chairs. We can’t afford another wrong rope.”`,
  () => `“Somebody here smiled when the body was found. I saw it.”`,
]
const PANIC = [
  () => `“We’re all going to die in our beds, aren’t we?”`,
  () => `“Another dawn, another grave. I can’t take much more of this.”`,
  () => `“Lock your doors tonight. Trust no one. Not even me.”`,
]
const CLAIM = [
  (b: string) => `“I’ll say it plain: I looked into ${b}, and I did not like what I found.”`,
  (b: string) => `“Call me what you like — I’ve been watching ${b}, and I’m sure.”`,
  (b: string) => `“I kept a quiet eye on ${b} in the dark. We should listen to me.”`,
]
const CLEARED = [
  (b: string) => `“For what it’s worth, I’d vouch for ${b}. Look elsewhere.”`,
]

export function composeChatter(s: GameState, rng: Rng): ChatLine[] {
  const speakers = aliveBots(s)
  if (speakers.length === 0) return []

  const lines: ChatLine[] = []
  const used = new Set<string>()
  const say = (sp: EnginePlayer, text: string, tone: ChatTone) =>
    lines.push({ speakerId: sp.id, speakerName: sp.name, avatar: sp.avatar, text, tone })

  // pick a handful of distinct speakers for this morning
  const pool = speakers.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const count = Math.min(pool.length, 3 + Math.floor(rng.next() * 3)) // 3..5 voices

  let lastAccused: EnginePlayer | null = null

  for (let i = 0; i < count; i++) {
    const sp = pool[i]
    const roll = rng.next()

    // a bot detective with a hard mafia read may step forward (later days, sometimes)
    if (sp.role === 'detective' && s.day >= 2 && roll < 0.5) {
      const reads = s.detectiveResults[sp.id] ?? {}
      const guilty = Object.entries(reads).find(([id, m]) => m && s.players.find(p => p.id === id)?.alive)
      if (guilty) {
        const t = s.players.find(p => p.id === guilty[0])!
        say(sp, pick(CLAIM, rng)(t.name), 'claim')
        lastAccused = t
        used.add(t.id)
        continue
      }
    }

    // defend the person just accused (the accused themself, if a bot, or an ally)
    if (lastAccused && rng.next() < 0.55) {
      if (lastAccused.isBot && lastAccused.id !== sp.id && rng.next() < 0.6) {
        say(lastAccused, pick(DEFEND, rng)(lastAccused.name), 'defend')
        lastAccused = null
        continue
      }
      // a mafia partner quietly covers for a fellow mafia under fire
      if (sp.role === 'mafia' && lastAccused.role === 'mafia' && lastAccused.id !== sp.id) {
        say(sp, pick(CLEARED, rng)(lastAccused.name), 'defend')
        lastAccused = null
        continue
      }
    }

    // otherwise: accuse, observe, or (rarely) panic
    if (roll < 0.62) {
      const t = topSuspect(s, sp, sp.role === 'mafia')
      if (t && !used.has(t.id)) {
        say(sp, pick(ACCUSE, rng)(sp.name, t.name), 'accuse')
        lastAccused = t
        used.add(t.id)
        continue
      }
    }
    if (roll < 0.85 || lines.length === 0) {
      say(sp, pick(OBSERVE, rng)(), 'observe')
    } else {
      say(sp, pick(PANIC, rng)(), 'panic')
    }
  }

  return lines
}
