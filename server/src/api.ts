import { Hono } from 'hono'
import { z } from 'zod'
import { validateInitData, issueToken, verifyToken } from './auth'
import type { Env } from './env'
import { getOrCreateUser, getProfile, recordResult, topPlayers } from './profiles'
import {
  createRoom,
  joinRoom,
  startRoom,
  actInRoom,
  voteInRoom,
  sayInRoom,
  getRoomState,
  leaveRoom,
} from './rooms'
import { BOT_USERNAME } from './env'

export const api = new Hono<Env>()

api.get('/health', c => c.json({ ok: true }))

api.post('/auth', async c => {
  const body = await c.req.json<{ initData: string }>().catch(() => null)
  if (!body) return c.json({ error: 'bad_request' }, 400)
  const v = validateInitData(body.initData ?? '')
  if (!v) return c.json({ error: 'invalid_init_data' }, 401)
  const name = [v.user.first_name, v.user.last_name].filter(Boolean).join(' ').slice(0, 40) || 'Player'
  getOrCreateUser(v.user.id, name, v.user.username)
  const token = await issueToken(v.user.id)
  return c.json({ token, profile: getProfile(v.user.id), startParam: v.startParam, botUsername: BOT_USERNAME })
})

// auth gate for everything below
api.use('/*', async (c, next) => {
  const p = c.req.path
  if (p === '/api/auth' || p === '/api/health') return next()
  const token = c.req.header('authorization')?.replace(/^Bearer /, '')
  const uid = token ? await verifyToken(token) : null
  if (!uid) return c.json({ error: 'unauthorized' }, 401)
  c.set('uid', uid)
  return next()
})

api.get('/profile', c => c.json({ profile: getProfile(c.get('uid')) }))

api.get('/leaderboard', c => c.json({ top: topPlayers(20) }))

// record a finished solo game (client runs the engine; we keep the tally)
api.post('/solo/result', async c => {
  const body = await c.req.json<{ won: boolean; team: 'town' | 'mafia' }>().catch(() => null)
  if (!body) return c.json({ error: 'bad_request' }, 400)
  const team = body.team === 'mafia' ? 'mafia' : 'town'
  const profile = recordResult(c.get('uid'), 'solo', !!body.won, team)
  return c.json({ profile })
})

// ── online rooms ───────────────────────────────────────────────────────────
const nameOf = (uid: number) => getProfile(uid)?.name ?? 'Player'

api.post('/room/create', c => {
  const uid = c.get('uid')
  return c.json(createRoom(uid, nameOf(uid)))
})

api.post('/room/join', async c => {
  const uid = c.get('uid')
  const body = await c.req.json<{ code: string }>().catch(() => null)
  const code = (body?.code ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{4}$/.test(code)) return c.json({ error: 'bad_code' }, 400)
  const r = joinRoom(code, uid, nameOf(uid))
  if ('error' in r) return c.json(r, 400)
  return c.json(r)
})

api.get('/room/:code', c => {
  const r = getRoomState(c.req.param('code'), c.get('uid'))
  if ('error' in r) return c.json(r, 404)
  return c.json(r)
})

const startSchema = z.object({
  addBots: z.boolean().optional(),
  difficulty: z.enum(['easy', 'normal', 'hard']).optional(),
})

api.post('/room/:code/start', async c => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = startSchema.safeParse(body ?? {})
  const opts = parsed.success ? parsed.data : {}
  const r = startRoom(c.req.param('code'), c.get('uid'), {
    addBots: opts.addBots ?? true,
    difficulty: opts.difficulty ?? 'normal',
  })
  if ('error' in r) return c.json(r, 400)
  return c.json(r)
})

const actSchema = z.object({
  power: z.enum(['kill', 'save', 'investigate']),
  targetId: z.string().min(1).max(40),
})

api.post('/room/:code/act', async c => {
  const body = await c.req.json().catch(() => null)
  const parsed = actSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'bad_action' }, 400)
  const r = actInRoom(c.req.param('code'), c.get('uid'), parsed.data.power, parsed.data.targetId)
  if ('error' in r) return c.json(r, 400)
  return c.json(r)
})

const voteSchema = z.object({ targetId: z.string().min(1).max(40).nullable() })

api.post('/room/:code/vote', async c => {
  const body = await c.req.json().catch(() => null)
  const parsed = voteSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'bad_vote' }, 400)
  const r = voteInRoom(c.req.param('code'), c.get('uid'), parsed.data.targetId)
  if ('error' in r) return c.json(r, 400)
  return c.json(r)
})

const saySchema = z.object({ text: z.string().min(1).max(140) })

api.post('/room/:code/say', async c => {
  const body = await c.req.json().catch(() => null)
  const parsed = saySchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'bad_message' }, 400)
  const r = sayInRoom(c.req.param('code'), c.get('uid'), parsed.data.text)
  if ('error' in r) return c.json(r, 400)
  return c.json(r)
})

api.post('/room/:code/leave', c => {
  leaveRoom(c.req.param('code'), c.get('uid'))
  return c.json({ ok: true })
})
