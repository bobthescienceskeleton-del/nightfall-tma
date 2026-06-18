import { Bot, webhookCallback } from 'grammy'
import { BOT_TOKEN } from './auth'
import { APP_URL } from './env'

export const bot = BOT_TOKEN ? new Bot(BOT_TOKEN) : null

const OPEN = 'Play Nightfall 🌙'

export function appKeyboard(startParam?: string) {
  if (!APP_URL) return undefined
  const url = startParam ? `${APP_URL}?startapp=${encodeURIComponent(startParam)}` : APP_URL
  return { inline_keyboard: [[{ text: OPEN, web_app: { url } }]] }
}

if (bot) {
  void bot.api.setMyDescription(
    'Nightfall: a game of trust and treachery. By night the Mafia strike; by day the town argues and votes. Bluff, deduce, and survive. Tap below to play.',
  ).catch(() => {})
  void bot.api.setMyShortDescription('Social-deduction Mafia for you and your friends 🌙').catch(() => {})

  bot.command('start', async ctx => {
    const payload = ctx.match?.toString() ?? ''
    const startParam = payload.startsWith('room_') ? payload : undefined
    const name = ctx.from?.first_name || 'friend'
    await ctx.reply(
      `Welcome to Nightfall, ${name}. 🌙\n\nOne town, a handful of hidden Mafia, and only your wits to tell friend from foe. Play solo against clever townsfolk or gather a room of friends. Tap below to begin.`,
      { reply_markup: appKeyboard(startParam) },
    )
  })

  bot.command('play', async ctx => {
    await ctx.reply('The town is waiting 🌙', { reply_markup: appKeyboard() })
  })

  bot.command('help', async ctx => {
    await ctx.reply(
      'Nightfall 🌙\n\n' +
        '• Everyone is secretly dealt a role: Mafia, Detective, Doctor, or Villager.\n' +
        '• Night: the Mafia choose a victim, the Detective investigates, the Doctor protects.\n' +
        '• Day: the town debates and votes someone out — hope it’s a wolf.\n' +
        '• Town wins by unmasking every Mafia. Mafia win when they equal the town.\n\n' +
        'Play solo against the townsfolk or start a room and invite friends. Tap below 👇',
      { reply_markup: appKeyboard() },
    )
  })
}

export const botWebhook = bot ? webhookCallback(bot, 'hono') : null
