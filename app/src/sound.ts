// Tiny synthesized sound effects via WebAudio: no asset files, works offline.
// Created lazily on first play (Telegram's webview requires a user gesture).
let ctx: AudioContext | null = null
let muted = localStorage.getItem('nfMuted') === '1'

export function isSoundOn(): boolean { return !muted }
export function setSoundOn(on: boolean): void {
  muted = !on
  localStorage.setItem('nfMuted', muted ? '1' : '0')
}

function audioCtx(): AudioContext | null {
  if (muted) return null
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = ctx ?? new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

function blip(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = 'sine', peak = 0.12): void {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g); g.connect(c.destination)
  o.start(at); o.stop(at + dur + 0.02)
}

export type Sfx = 'night' | 'dawn' | 'kill' | 'save' | 'reveal' | 'vote' | 'hang' | 'win' | 'lose' | 'tap'

export function playSfx(name: Sfx): void {
  const c = audioCtx()
  if (!c) return
  const t = c.currentTime
  switch (name) {
    case 'tap': blip(c, 620, t, 0.06, 'sine', 0.05); break
    case 'vote': blip(c, 480, t, 0.08, 'triangle', 0.06); break
    case 'night': [330, 247].forEach((f, i) => blip(c, f, t + i * 0.14, 0.4, 'sine', 0.06)); break // low, settling into dark
    case 'dawn': [392, 523, 659].forEach((f, i) => blip(c, f, t + i * 0.1, 0.3, 'triangle', 0.07)); break // gentle rise
    case 'kill': blip(c, 180, t, 0.3, 'sawtooth', 0.07); blip(c, 120, t + 0.12, 0.34, 'sawtooth', 0.06); break
    case 'save': [523, 698, 880].forEach((f, i) => blip(c, f, t + i * 0.07, 0.22, 'sine', 0.07)); break
    case 'reveal': [659, 988].forEach((f, i) => blip(c, f, t + i * 0.08, 0.2, 'triangle', 0.08)); break
    case 'hang': blip(c, 300, t, 0.16, 'square', 0.05); blip(c, 160, t + 0.12, 0.3, 'sawtooth', 0.06); break
    case 'win': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(c, f, t + i * 0.09, 0.28, 'triangle', 0.1)); break
    case 'lose': [392, 311, 233].forEach((f, i) => blip(c, f, t + i * 0.13, 0.3, 'sine', 0.08)); break
  }
}
