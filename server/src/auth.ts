import { createHmac, timingSafeEqual } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me')
export const BOT_TOKEN = process.env.BOT_TOKEN ?? ''
// DEV_MODE stubs auth to a single local user — only ever in non-production.
// In production without a token we fail CLOSED (every request is unauthorized)
// rather than silently making everyone the same account.
export const DEV_MODE = !BOT_TOKEN && process.env.NODE_ENV !== 'production'

export interface TgUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

// HMAC validation per https://core.telegram.org/bots/webapps
export function validateInitData(raw: string): { user: TgUser; startParam: string | null } | null {
  if (DEV_MODE) {
    // Stable dev identity so local browser tabs can play; no bot token needed.
    return { user: { id: 1, first_name: 'Dev' }, startParam: null }
  }
  const params = new URLSearchParams(raw)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  const a = Buffer.from(computed, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const authDate = Number(params.get('auth_date') ?? 0)
  if (Date.now() / 1000 - authDate > 3600) return null
  const userJson = params.get('user')
  if (!userJson) return null
  try {
    const user = JSON.parse(userJson) as TgUser
    if (typeof user?.id !== 'number' || !Number.isFinite(user.id)) return null
    return { user, startParam: params.get('start_param') }
  } catch {
    return null // signed but malformed → invalid, never 500
  }
}

export async function issueToken(userId: number): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return typeof payload.uid === 'number' ? payload.uid : null
  } catch {
    return null
  }
}
