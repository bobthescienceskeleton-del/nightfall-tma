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
  (a: string, b: string) => `«${b}, ты что-то притих. Тихони обычно что-то скрывают.»`,
  (a: string, b: string) => `«Я не верю ${b}. Что-то не так с этим лицом на рассвете.»`,
  (a: string, b: string) => `«Приглядитесь к ${b}. Слишком уж рвётся обвинять других.»`,
  (a: string, b: string) => `«Это ${b}. Готов спорить на последнюю лампу.»`,
  (a: string, b: string) => `«${b} ни разу не посмотрел мне в глаза. Этого достаточно.»`,
  (a: string, b: string) => `«Странно, как беда ходит за ${b} по пятам, правда?»`,
  (a: string, b: string) => `«Чутьё говорит: ${b}. А оно меня пока спасало.»`,
]
const DEFEND = [
  (me: string) => `«Я? Я спал, как и все вы. Это безумие.»`,
  (me: string) => `«Вы тратите день на меня, а настоящий волк ухмыляется.»`,
  (me: string) => `«Показывай пальцем туда, где есть вина. Я ничего не делал.»`,
  (me: string) => `«Повесите меня, завтра поймёте ошибку. Поздно будет.»`,
  (me: string) => `«Я свой, до мозга костей. Подумайте сами.»`,
]
const OBSERVE = [
  () => `«Без паники. Кого каждый из нас подозревал ночью?»`,
  () => `«Двое из нас лгут. Всего двое. Сузим круг.»`,
  () => `«Держите голову холодной. Кто громче кричит, тот часто и виновен.»`,
  () => `«Сосчитайте пустые стулья. Ещё одна ошибка нам не по карману.»`,
  () => `«Кто-то здесь улыбнулся, когда нашли тело. Я видел.»`,
]
const PANIC = [
  () => `«Мы все погибнем в своих постелях, да?»`,
  () => `«Ещё рассвет, ещё могила. Я так долго не выдержу.»`,
  () => `«Запирайте двери на ночь. Никому не верьте. Даже мне.»`,
]
const CLAIM = [
  (b: string) => `«Скажу прямо: я приглядывал за ${b}, и мне не понравилось то, что я увидел.»`,
  (b: string) => `«Называйте как хотите, но я следил за ${b} и уверен.»`,
  (b: string) => `«Я тихо наблюдал за ${b} в темноте. Стоит меня послушать.»`,
]
const CLEARED = [
  (b: string) => `«Я поручусь за ${b}. Ищите в другом месте.»`,
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
