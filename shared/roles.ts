// Roles & teams for Nightfall — a public-domain social-deduction folk game
// (the "Mafia"/"Werewolf" family). No third-party assets or names are used.

export type Role = 'mafia' | 'detective' | 'doctor' | 'villager'
export type Team = 'town' | 'mafia'

// Bot skill levels. Higher difficulty means sharper, less random play.
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface RoleMeta {
  role: Role
  team: Team
  name: string
  emoji: string
  blurb: string // one-line identity shown on the role card
  power: string // what you do at night
  color: string // accent used on the role card (CSS var or hex)
}

export const ROLES: Record<Role, RoleMeta> = {
  mafia: {
    role: 'mafia',
    team: 'mafia',
    name: 'Мафия',
    emoji: '🔪',
    blurb: 'Ты ходишь во тьме.',
    power: 'Каждую ночь вы с напарниками выбираете одного горожанина, кого убрать.',
    color: '#e2574c',
  },
  detective: {
    role: 'detective',
    team: 'town',
    name: 'Детектив',
    emoji: '🔎',
    blurb: 'Ты читаешь правду по глазам.',
    power: 'Каждую ночь проверяй одного игрока и узнавай, мафия ли он.',
    color: '#2f93cf',
  },
  doctor: {
    role: 'doctor',
    team: 'town',
    name: 'Доктор',
    emoji: '✚',
    blurb: 'Ты не даёшь погаснуть лампам до рассвета.',
    power: 'Каждую ночь защищай одного игрока от ножа мафии.',
    color: '#54b15a',
  },
  villager: {
    role: 'villager',
    team: 'town',
    name: 'Мирный житель',
    emoji: '🧑‍🌾',
    blurb: 'У тебя есть только смекалка и твой голос.',
    power: 'У тебя нет ночной силы. Читай людей и голосуй против мафии.',
    color: '#f2a93b',
  },
}

export const teamOf = (role: Role): Team => ROLES[role].team

// Role distribution for a town of N players. Roughly one quarter are Mafia,
// always exactly one Detective and one Doctor once the town is big enough.
export function rolesForCount(n: number): Role[] {
  const mafia = n <= 5 ? 1 : n <= 8 ? 2 : Math.floor(n / 4)
  const roles: Role[] = []
  for (let i = 0; i < mafia; i++) roles.push('mafia')
  if (n >= 4) roles.push('detective')
  if (n >= 5) roles.push('doctor')
  while (roles.length < n) roles.push('villager')
  return roles.slice(0, n)
}
