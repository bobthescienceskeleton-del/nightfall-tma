import { useStore } from '../store'

const RULES = [
  { ic: '🌙', t: 'A town with a secret', b: 'Everyone is secretly dealt a role. A hidden few are Mafia; the rest are honest Town.' },
  { ic: '🔪', t: 'Night falls', b: 'The Mafia quietly choose someone to eliminate while the town sleeps.' },
  { ic: '🔎', t: 'The Detective', b: 'Each night, investigate one player and learn whether they are Mafia.' },
  { ic: '✚', t: 'The Doctor', b: 'Each night, protect one player. If the Mafia strike them, they survive.' },
  { ic: '☀️', t: 'Day breaks', b: 'The town wakes, sees who was lost, argues, and votes one suspect out.' },
  { ic: '⚖️', t: 'The verdict', b: 'Whoever gets the most votes is removed — and their true role is revealed.' },
  { ic: '🏆', t: 'How to win', b: 'Town wins by unmasking every Mafia. Mafia win once they equal the town.' },
]

export function Rules() {
  const go = useStore(s => s.go)
  return (
    <div className="page rise">
      <div className="page-head">
        <button className="round-btn" onClick={() => go('home')}>‹</button>
        <h1>How to play</h1>
      </div>
      {RULES.map((r, i) => (
        <div className="rule" key={i}>
          <div className="ic">{r.ic}</div>
          <div>
            <div className="rt">{r.t}</div>
            <div className="rb">{r.b}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
