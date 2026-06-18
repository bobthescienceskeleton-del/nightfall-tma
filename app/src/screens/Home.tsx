import { useStore } from '../store'
import { Logo } from './Logo'
import type { Difficulty } from '@shared/roles'

const DIFFS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Лёгкий' },
  { id: 'normal', label: 'Обычный' },
  { id: 'hard', label: 'Сложный' },
]

export function Home() {
  const profile = useStore(s => s.profile)
  const startSolo = useStore(s => s.startSolo)
  const startQuickMatch = useStore(s => s.startQuickMatch)
  const createRoom = useStore(s => s.createRoom)
  const difficulty = useStore(s => s.difficulty)
  const setDifficulty = useStore(s => s.setDifficulty)
  const go = useStore(s => s.go)
  const busy = useStore(s => s.busy)

  return (
    <div className="home rise">
      <div className="brand">
        <Logo />
        <div className="brand-name">Секрет ночи</div>
        <div className="brand-tag">Один город. Скрытая мафия. После заката не верь никому.</div>
      </div>

      {profile && (
        <div className="stat-strip">
          <div className="stat-pill"><div className="v">{profile.wins}</div><div className="l">Победы</div></div>
          <div className="stat-pill"><div className="v">{profile.streak}</div><div className="l">Серия</div></div>
          <div className="stat-pill"><div className="v">{profile.coins}</div><div className="l">Монеты</div></div>
        </div>
      )}

      <div className="seg-label">Сложность ботов в соло</div>
      <div className="seg">
        {DIFFS.map(d => (
          <button key={d.id} className={difficulty === d.id ? 'on' : ''} onClick={() => setDifficulty(d.id)}>
            {d.label}
          </button>
        ))}
      </div>

      <div className="menu-spacer" />

      <div className="menu">
        <button className="tile primary" onClick={startQuickMatch}>
          <span className="tile-emoji">🌙</span>
          <span className="tile-text">
            <span className="tile-title">Быстрая игра</span>
            <span className="tile-sub">Найти город и сыграть прямо сейчас</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile" onClick={startSolo}>
          <span className="tile-emoji">🎭</span>
          <span className="tile-text">
            <span className="tile-title">Соло</span>
            <span className="tile-sub">Партия против жителей города</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile" onClick={createRoom} disabled={busy}>
          <span className="tile-emoji">👥</span>
          <span className="tile-text">
            <span className="tile-title">Игра с друзьями</span>
            <span className="tile-sub">Создай город и поделись кодом</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile" onClick={() => go('lobby')}>
          <span className="tile-emoji">🔑</span>
          <span className="tile-text">
            <span className="tile-title">Зайти в город</span>
            <span className="tile-sub">Введи код из четырёх символов</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <div style={{ display: 'flex', gap: 13 }}>
          <button className="tile" style={{ flex: 1 }} onClick={() => { go('leaderboard'); useStore.getState().loadLeaderboard() }}>
            <span className="tile-emoji">🏆</span>
            <span className="tile-text"><span className="tile-title">Рейтинг</span></span>
          </button>
          <button className="tile" style={{ flex: 1 }} onClick={() => go('rules')}>
            <span className="tile-emoji">📖</span>
            <span className="tile-text"><span className="tile-title">Правила</span></span>
          </button>
        </div>
      </div>
    </div>
  )
}
