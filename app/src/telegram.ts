// Thin typed wrapper over the Telegram WebApp bridge; safe no-ops outside Telegram.
interface TgWebApp {
  initData: string
  initDataUnsafe: { user?: { id: number; first_name: string }; start_param?: string }
  colorScheme: 'light' | 'dark'
  viewportHeight: number
  viewportStableHeight: number
  onEvent(type: string, cb: () => void): void
  ready(): void
  expand(): void
  isVersionAtLeast(v: string): boolean
  disableVerticalSwipes?(): void
  enableClosingConfirmation(): void
  setHeaderColor(c: string): void
  setBackgroundColor(c: string): void
  openTelegramLink?(url: string): void
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void }
}

declare global {
  interface Window { Telegram?: { WebApp: TgWebApp } }
}

export const tg: TgWebApp | null = window.Telegram?.WebApp ?? null
export const inTelegram = !!tg && tg.initData.length > 0

const NIGHT = '#141733'

// Telegram's in-app webview is often taller than the visible area, so a layout
// pinned to the raw viewport pushes its lower half (Start button, scroll tail)
// off-screen with nowhere to scroll. We drive the app height from Telegram's
// reported viewport so content always fits and inner scroll containers work.
function syncViewport() {
  const h = tg?.viewportStableHeight || tg?.viewportHeight || window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${h}px`)
}

export function initTelegram() {
  syncViewport()
  window.addEventListener('resize', syncViewport)
  if (!tg) return
  try {
    tg.ready()
    tg.expand()
    tg.setHeaderColor(NIGHT)
    tg.setBackgroundColor(NIGHT)
    if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes?.()
    tg.onEvent('viewportChanged', syncViewport)
  } catch { /* older clients */ }
}

export function haptic(kind: 'tap' | 'select' | 'success' | 'warn' | 'heavy' = 'tap') {
  const h = tg?.HapticFeedback
  if (!h) return
  try {
    if (kind === 'tap') h.impactOccurred('light')
    else if (kind === 'heavy') h.impactOccurred('rigid')
    else if (kind === 'select') h.selectionChanged()
    else if (kind === 'success') h.notificationOccurred('success')
    else h.notificationOccurred('warning')
  } catch { /* ignore */ }
}

export function getInitData(): string {
  return tg?.initData ?? ''
}

export function getStartParam(): string | null {
  return tg?.initDataUnsafe?.start_param ?? null
}

// Open a t.me/share/url forward dialog; works on every client.
export function shareLink(url: string, text: string): void {
  const u = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  try {
    if (tg?.openTelegramLink) tg.openTelegramLink(u)
    else window.open(u, '_blank')
  } catch { /* ignore */ }
}
