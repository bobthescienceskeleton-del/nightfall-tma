import { getInitData } from './telegram'
import type { Profile, RoomStateDto } from '@shared/types'

let token: string | null = sessionStorage.getItem('nf_jwt')

async function req<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(json.error ?? 'request_failed'), { status: res.status, data: json })
  return json as T
}

export interface LeaderRow { name: string; wins: number; played: number }

export const api = {
  async auth(): Promise<{ profile: Profile; startParam: string | null; botUsername: string }> {
    const r = await req<{ token: string; profile: Profile; startParam: string | null; botUsername: string }>('/auth', {
      initData: getInitData(),
    })
    token = r.token
    sessionStorage.setItem('nf_jwt', r.token)
    return { profile: r.profile, startParam: r.startParam, botUsername: r.botUsername }
  },
  profile: () => req<{ profile: Profile }>('/profile'),
  leaderboard: () => req<{ top: LeaderRow[] }>('/leaderboard'),
  soloResult: (won: boolean, team: 'town' | 'mafia') =>
    req<{ profile: Profile }>('/solo/result', { won, team }),
  roomCreate: () => req<RoomStateDto>('/room/create', {}),
  roomJoin: (code: string) => req<RoomStateDto>('/room/join', { code }),
  roomState: (code: string) => req<RoomStateDto>(`/room/${code}`),
  roomStart: (code: string, addBots: boolean, difficulty: 'easy' | 'normal' | 'hard') =>
    req<RoomStateDto>(`/room/${code}/start`, { addBots, difficulty }),
  roomSay: (code: string, text: string) => req<RoomStateDto>(`/room/${code}/say`, { text }),
  roomAct: (code: string, power: 'kill' | 'save' | 'investigate', targetId: string) =>
    req<RoomStateDto>(`/room/${code}/act`, { power, targetId }),
  roomVote: (code: string, targetId: string | null) =>
    req<RoomStateDto>(`/room/${code}/vote`, { targetId }),
  roomLeave: (code: string) => req<{ ok: boolean }>(`/room/${code}/leave`, {}),
}
