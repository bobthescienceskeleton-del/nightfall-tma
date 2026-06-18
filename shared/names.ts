// The townsfolk roster: warm, characterful bot identities. Each has a name, a
// face (emoji), and a personality that colours how they speak during the day.
// Personalities only affect flavour text — never the hidden role they're dealt.

export type Personality = 'sharp' | 'nervous' | 'gruff' | 'sunny' | 'quiet' | 'dramatic'

export interface Townie {
  name: string
  avatar: string
  personality: Personality
}

// A generous roster so no two bots in a town ever share a face.
export const ROSTER: Townie[] = [
  { name: 'Mabel', avatar: '👩‍🌾', personality: 'sunny' },
  { name: 'Otto', avatar: '🧓', personality: 'gruff' },
  { name: 'Pearl', avatar: '👩‍🦳', personality: 'sharp' },
  { name: 'Cyrus', avatar: '🧑‍🍳', personality: 'dramatic' },
  { name: 'Ines', avatar: '👩‍🏫', personality: 'sharp' },
  { name: 'Bram', avatar: '🧔', personality: 'gruff' },
  { name: 'Dot', avatar: '👵', personality: 'nervous' },
  { name: 'Wendell', avatar: '👨‍🔧', personality: 'quiet' },
  { name: 'Fern', avatar: '👩‍🎨', personality: 'dramatic' },
  { name: 'Silas', avatar: '👨‍🌾', personality: 'quiet' },
  { name: 'Greta', avatar: '👩‍⚕️', personality: 'nervous' },
  { name: 'Hugo', avatar: '🧑‍🚒', personality: 'sunny' },
  { name: 'Vera', avatar: '💃', personality: 'sharp' },
  { name: 'Amos', avatar: '👨‍🦱', personality: 'gruff' },
  { name: 'Lottie', avatar: '👧', personality: 'sunny' },
  { name: 'Reuben', avatar: '👨‍🏭', personality: 'quiet' },
]

// Faces for human seats (so live players also get a friendly token).
export const HUMAN_AVATARS = ['🙂', '😎', '🤠', '🥸', '😺', '🦊', '🐻', '🐯']
