import { useStore } from '../store'

// Russian plural for "победа" (win): 1 победа, 2–4 победы, 5+ побед.
function winsWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'победа'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'победы'
  return 'побед'
}

export function Leaderboard() {
  const go = useStore(s => s.go)
  const rows = useStore(s => s.leaderboard)

  return (
    <div className="page rise">
      <div className="page-head">
        <button className="round-btn" onClick={() => go('home')}>‹</button>
        <h1>Рейтинг</h1>
      </div>
      {rows.length === 0 ? (
        <div className="empty">Пока нет сыгранных партий.<br />Выиграй раунд и займи вершину 🏆</div>
      ) : (
        <div className="board">
          {rows.map((r, i) => (
            <div className="board-row" key={i}>
              <div className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
              <div className="nm">{r.name}</div>
              <div className="wins">{r.wins} {winsWord(r.wins)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
