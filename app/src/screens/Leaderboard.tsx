import { useStore } from '../store'

export function Leaderboard() {
  const go = useStore(s => s.go)
  const rows = useStore(s => s.leaderboard)

  return (
    <div className="page rise">
      <div className="page-head">
        <button className="round-btn" onClick={() => go('home')}>‹</button>
        <h1>Ranks</h1>
      </div>
      {rows.length === 0 ? (
        <div className="empty">No games played yet.<br />Win a round to claim the top spot 🏆</div>
      ) : (
        <div className="board">
          {rows.map((r, i) => (
            <div className="board-row" key={i}>
              <div className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
              <div className="nm">{r.name}</div>
              <div className="wins">{r.wins} {r.wins === 1 ? 'win' : 'wins'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
