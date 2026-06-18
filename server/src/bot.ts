import { Bot, webhookCallback } from 'grammy'
import { BOT_TOKEN } from './auth'
import { APP_URL } from './env'

export const bot = BOT_TOKEN ? new Bot(BOT_TOKEN) : null

const OPEN = 'Играть 🌙'

export function appKeyboard(startParam?: string) {
  if (!APP_URL) return undefined
  const url = startParam ? `${APP_URL}?startapp=${encodeURIComponent(startParam)}` : APP_URL
  return { inline_keyboard: [[{ text: OPEN, web_app: { url } }]] }
}

// Profile texts shown around the bot (no long dashes anywhere players can read).
const DESCRIPTION =
  'Секрет ночи это уютная игра про доверие и обман, в духе «Мафии».\n\n' +
  'Каждому достаётся тайная роль: мафия, детектив, доктор или мирный житель. Ночью мафия выбирает жертву, ' +
  'а днём город спорит и голосует, кого изгнать.\n\n' +
  'Играй один против умных ботов или собирай друзей по коду из четырёх символов. Блефуй, веди расследование ' +
  'и старайся пережить ночь.\n\n' +
  'Это игра про настроение, дружбу и хорошую интуицию. Заходи и попробуй.'

const SHORT_DESCRIPTION = 'Уютная социальная игра про доверие и обман, в духе «Мафии» 🌙'

const HELP =
  'Секрет ночи 🌙\n\n' +
  '• Каждому тайно выпадает роль: мафия, детектив, доктор или мирный житель.\n' +
  '• Ночь: мафия выбирает жертву, детектив проверяет одного игрока, доктор кого-то спасает.\n' +
  '• День: город обсуждает и голосует, кого изгнать.\n' +
  '• Город побеждает, когда вычислит всю мафию. Мафия побеждает, когда её становится столько же, сколько горожан.\n\n' +
  'Играй один против жителей или создай комнату и позови друзей. Нажми кнопку внизу 👇'

const ABOUT =
  'Секрет ночи 🌙\n\n' +
  'Уютная игра про доверие и обман, в духе «Мафии». Тайные роли, ночные ходы и дневные споры. ' +
  'Партия занимает всего пару минут.\n\n' +
  'Можно играть одному против умных ботов или собрать друзей по коду. Приятной игры!'

if (bot) {
  void bot.api.setMyName('Секрет ночи').catch(() => {})
  void bot.api.setMyDescription(DESCRIPTION).catch(() => {})
  void bot.api.setMyShortDescription(SHORT_DESCRIPTION).catch(() => {})
  void bot.api
    .setMyCommands([
      { command: 'start', description: 'Начать игру' },
      { command: 'play', description: 'Открыть игру' },
      { command: 'help', description: 'Как играть' },
      { command: 'about', description: 'Об игре' },
    ])
    .catch(() => {})

  bot.command('start', async ctx => {
    const payload = ctx.match?.toString() ?? ''
    const startParam = payload.startsWith('room_') ? payload : undefined
    const name = ctx.from?.first_name || 'друг'
    await ctx.reply(
      `Привет, ${name}! Это Секрет ночи 🌙\n\n` +
        'Если совсем просто, это игра про доверие и обман, как «Мафия». Каждую ночь скрытая мафия выбирает жертву, ' +
        'а днём город спорит и голосует, кого изгнать.\n\n' +
        'Тебе выпадает тайная роль: мафия, детектив, доктор или мирный житель. Блефуй, читай людей и старайся ' +
        'понять, кто свой, а кто враг.\n\n' +
        'Можно играть одному против хитрых жителей или собрать комнату с друзьями по коду. Ничего сложного: ' +
        'одна партия занимает пару минут.\n\n' +
        'Нажми кнопку «Играть» внизу и заходи в город. Жду тебя! 🌙',
      { reply_markup: appKeyboard(startParam) },
    )
  })

  bot.command('play', async ctx => {
    await ctx.reply('Город ждёт 🌙', { reply_markup: appKeyboard() })
  })

  bot.command('help', async ctx => {
    await ctx.reply(HELP, { reply_markup: appKeyboard() })
  })

  bot.command('about', async ctx => {
    await ctx.reply(ABOUT, { reply_markup: appKeyboard() })
  })
}

export const botWebhook = bot ? webhookCallback(bot, 'hono') : null
