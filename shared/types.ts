// Shared DTOs across client & server.
import type { GameView } from './view'

export interface Profile {
  id: number
  name: string
  wins: number
  losses: number
  played: number
  streak: number
  bestStreak: number
  coins: number
}

export interface RoomPlayerDto {
  id: string
  name: string
  avatar: string
  isBot: boolean
  isHost: boolean
  connected: boolean
}

export interface RoomDto {
  code: string
  hostId: string
  started: boolean
  players: RoomPlayerDto[]
  maxPlayers: number
  townSize: number // seats the game fills to (humans + bots)
}

// What a polling online client receives.
export interface RoomStateDto {
  room: RoomDto
  version: number
  view: GameView | null // null while still in the lobby
  roundOver: { winner: 'town' | 'mafia'; youWon: boolean } | null
}

export type { GameView }
