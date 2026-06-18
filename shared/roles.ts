// Roles & teams for Nightfall — a public-domain social-deduction folk game
// (the "Mafia"/"Werewolf" family). No third-party assets or names are used.

export type Role = 'mafia' | 'detective' | 'doctor' | 'villager'
export type Team = 'town' | 'mafia'

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
    name: 'Mafia',
    emoji: '🔪',
    blurb: 'You move in the dark.',
    power: 'Each night, you and your partners choose one townsperson to eliminate.',
    color: '#e2574c',
  },
  detective: {
    role: 'detective',
    team: 'town',
    name: 'Detective',
    emoji: '🔎',
    blurb: 'You read the truth in their eyes.',
    power: 'Each night, investigate one player to learn if they are Mafia.',
    color: '#2f93cf',
  },
  doctor: {
    role: 'doctor',
    team: 'town',
    name: 'Doctor',
    emoji: '✚',
    blurb: 'You keep the lamps burning till dawn.',
    power: 'Each night, protect one player from the Mafia’s blade.',
    color: '#54b15a',
  },
  villager: {
    role: 'villager',
    team: 'town',
    name: 'Villager',
    emoji: '🧑‍🌾',
    blurb: 'You have only your wits and your vote.',
    power: 'You have no night power — read the room and vote out the Mafia.',
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
