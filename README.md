# Nightfall 🌙

A cozy, cinematic game of trust and treachery — a **Mafia / social-deduction** Telegram Mini App. By night the hidden Mafia strike; by day the town argues and votes. Bluff, deduce, and survive.

Built in the same "house" style and architecture as our other Telegram games (Wildcards / TT): a warm, premium UI, a shared pure game engine, instant client-side solo play, and server-authoritative online rooms.

## Roles

| Role | Team | Night power |
|------|------|-------------|
| 🔪 Mafia | Mafia | Choose one townsperson to eliminate |
| 🔎 Detective | Town | Investigate one player — learn if they're Mafia |
| ✚ Doctor | Town | Protect one player from the Mafia's blade |
| 🧑‍🌾 Villager | Town | No power — read the room and vote |

**Town wins** by unmasking every Mafia. **Mafia win** once they equal the town.

## Play

- **Solo** — instant offline match against six characterful AI townsfolk (runs entirely client-side).
- **Play with friends** — create a town, share the 4-letter code; empty seats fill with bots.

## Architecture

A workspace monorepo:

- `shared/` — the pure, deterministic, serialisable game **engine** (`engine.ts`), bot brains (`bots.ts`), the day's chatter composer (`chatter.ts`), per-seat redacted **view** (`view.ts`), roles, names, and a seeded RNG. The same engine runs on the client (solo) and the server (online).
- `server/` — Node + [Hono](https://hono.dev) API, [grammY](https://grammy.dev) Telegram bot (webhook), and `better-sqlite3` for profiles/leaderboard. Online rooms are **server-authoritative**, held in memory, tick-paced, and only ever send each client its own redacted view (roles never leak).
- `app/` — Vite + React + Zustand client. Telegram WebApp bridge, synthesized WebAudio SFX, the warm house design system (`theme.css`), and a cinematic night ⇄ dawn town scene.

## Develop

```bash
npm install
npm run dev:server   # http://localhost:3000  (DEV MODE if no BOT_TOKEN)
npm run dev:app      # http://localhost:5175  (proxies /api → 3000)
npm test             # engine unit tests
npm run typecheck
```

With no `BOT_TOKEN` the server runs in **DEV MODE** (auth stubbed to a single local user) so you can play locally. Solo play needs no server at all.

## Deploy (Railway)

Build: `npm install && npm run build` · Start: `npm start`. Set the env vars from `.env.example`:

- `BOT_TOKEN` — from [@BotFather](https://t.me/BotFather) (`/newbot`). Required in production.
- `APP_URL` — your public HTTPS origin (Railway gives you one). Used for the webhook + Mini App button.
- `BOT_USERNAME`, `WEBHOOK_SECRET`, `JWT_SECRET`, `DATA_DIR` (point at a mounted volume to persist), `NODE_ENV=production`.

Then in @BotFather set the Mini App / menu button URL to `APP_URL`.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
