import { useStore } from '../store'
import { Logo } from './Logo'

export function Home() {
  const profile = useStore(s => s.profile)
  const startSolo = useStore(s => s.startSolo)
  const createRoom = useStore(s => s.createRoom)
  const go = useStore(s => s.go)
  const busy = useStore(s => s.busy)

  return (
    <div className="home rise">
      <div className="brand">
        <Logo />
        <div className="brand-name">Nightfall</div>
        <div className="brand-tag">One town. Hidden Mafia. Trust no one after dark.</div>
      </div>

      {profile && (
        <div className="stat-strip">
          <div className="stat-pill"><div className="v">{profile.wins}</div><div className="l">Wins</div></div>
          <div className="stat-pill"><div className="v">{profile.streak}</div><div className="l">Streak</div></div>
          <div className="stat-pill"><div className="v">{profile.coins}</div><div className="l">Coins</div></div>
        </div>
      )}

      <div className="menu-spacer" />

      <div className="menu">
        <button className="tile primary" onClick={startSolo}>
          <span className="tile-emoji">🌙</span>
          <span className="tile-text">
            <span className="tile-title">Play solo</span>
            <span className="tile-sub">A town of six clever townsfolk</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile" onClick={createRoom} disabled={busy}>
          <span className="tile-emoji">👥</span>
          <span className="tile-text">
            <span className="tile-title">Play with friends</span>
            <span className="tile-sub">Make a town &amp; share the code</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile" onClick={() => go('lobby')}>
          <span className="tile-emoji">🔑</span>
          <span className="tile-text">
            <span className="tile-title">Join a town</span>
            <span className="tile-sub">Enter a 4-letter code</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <div style={{ display: 'flex', gap: 13 }}>
          <button className="tile" style={{ flex: 1 }} onClick={() => { go('leaderboard'); useStore.getState().loadLeaderboard() }}>
            <span className="tile-emoji">🏆</span>
            <span className="tile-text"><span className="tile-title">Ranks</span></span>
          </button>
          <button className="tile" style={{ flex: 1 }} onClick={() => go('rules')}>
            <span className="tile-emoji">📖</span>
            <span className="tile-text"><span className="tile-title">Rules</span></span>
          </button>
        </div>
      </div>
    </div>
  )
}
