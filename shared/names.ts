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
  { name: 'Маша', avatar: '👩‍🌾', personality: 'sunny' },
  { name: 'Гриша', avatar: '🧓', personality: 'gruff' },
  { name: 'Нина', avatar: '👩‍🦳', personality: 'sharp' },
  { name: 'Кирилл', avatar: '🧑‍🍳', personality: 'dramatic' },
  { name: 'Инна', avatar: '👩‍🏫', personality: 'sharp' },
  { name: 'Артём', avatar: '🧔', personality: 'gruff' },
  { name: 'Дуся', avatar: '👵', personality: 'nervous' },
  { name: 'Веня', avatar: '👨‍🔧', personality: 'quiet' },
  { name: 'Фая', avatar: '👩‍🎨', personality: 'dramatic' },
  { name: 'Сёма', avatar: '👨‍🌾', personality: 'quiet' },
  { name: 'Гера', avatar: '👩‍⚕️', personality: 'nervous' },
  { name: 'Гоша', avatar: '🧑‍🚒', personality: 'sunny' },
  { name: 'Вера', avatar: '💃', personality: 'sharp' },
  { name: 'Тимур', avatar: '👨‍🦱', personality: 'gruff' },
  { name: 'Лиза', avatar: '👧', personality: 'sunny' },
  { name: 'Рома', avatar: '👨‍🏭', personality: 'quiet' },
]

// Faces for human seats (so live players also get a friendly token).
export const HUMAN_AVATARS = ['🙂', '😎', '🤠', '🥸', '😺', '🦊', '🐻', '🐯']

// Plausible player display names for quick (random) matches, so the table reads
// like a room of strangers who just queued up together.
export const QUICK_NAMES = [
  'Алексей', 'Дима', 'Настя', 'Оля', 'Саша', 'Макс',
  'Катя', 'Игорь', 'Лена', 'Паша', 'Юля', 'Костя',
  'Соня', 'Андрей', 'Вика', 'Никита',
]
