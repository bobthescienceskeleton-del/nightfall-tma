import { useStore } from '../store'

// The lobby a quick-match player sees while the town fills up. Seats appear one
// by one, like a public room gathering strangers, then the round begins.
export function Matchmaking() {
  const seats = useStore(s => s.matchSeats)
  const leaveGame = useStore(s => s.leaveGame)
  const total = 7

  return (
    <div className="match rise">
      <div className="page-head" style={{ alignSelf: 'flex-start' }}>
        <button className="round-btn" onClick={leaveGame}>‹</button>
        <h1>Поиск игроков</h1>
      </div>

      <div className="match-spinner">🌙</div>
      <div className="match-count">
        Собираем город<span className="dots" /> {seats.length} из {total}
      </div>

      <div className="seatlist">
        {seats.map(p => (
          <div className="seat joining" key={p.id}>
            <div className="av">{p.avatar}</div>
            <div className="nm">{p.id === 'you' ? `${p.name} (вы)` : p.name}</div>
            <div className="tag wait">В ИГРЕ</div>
          </div>
        ))}
        {Array.from({ length: total - seats.length }).map((_, i) => (
          <div className="seat" style={{ opacity: 0.5 }} key={`e${i}`}>
            <div className="av">＋</div>
            <div className="nm">Ждём игрока<span className="dots" /></div>
          </div>
        ))}
      </div>
    </div>
  )
}
