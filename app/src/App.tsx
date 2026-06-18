import { useEffect } from 'react'
import { useStore } from './store'
import { Home } from './screens/Home'
import { Lobby } from './screens/Lobby'
import { Matchmaking } from './screens/Matchmaking'
import { Rules } from './screens/Rules'
import { Leaderboard } from './screens/Leaderboard'
import { Game } from './screens/Game'
import { Logo } from './screens/Logo'

const CONFETTI = ['#f6e6a6', '#f2a93b', '#6ab45f', '#2f93cf', '#e2574c']

export function App() {
  const ready = useStore(s => s.ready)
  const screen = useStore(s => s.screen)
  const init = useStore(s => s.init)

  useEffect(() => { init() }, [init])

  if (!ready) {
    return (
      <div className="app">
        <div className="home" style={{ justifyContent: 'center' }}>
          <div className="brand" style={{ animation: 'pop-in .5s ease both' }}>
            <Logo />
            <div className="brand-name">Секрет ночи</div>
            <div className="brand-tag">Будим город<span className="dots" /></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {screen === 'home' && <Home />}
      {screen === 'lobby' && <Lobby />}
      {screen === 'matchmaking' && <Matchmaking />}
      {screen === 'rules' && <Rules />}
      {screen === 'leaderboard' && <Leaderboard />}
      {screen === 'game' && <Game />}
      <Overlays />
    </div>
  )
}

function Overlays() {
  const result = useStore(s => s.result)
  const toast = useStore(s => s.toast)
  const fly = useStore(s => s.fly)

  return (
    <>
      {toast && <div className="toast">{toast}</div>}
      {fly && <div className="fly" key={fly.id}>{fly.text}</div>}
      {result && <ResultModal />}
    </>
  )
}

function ResultModal() {
  const result = useStore(s => s.result)!
  const mode = useStore(s => s.mode)
  const startSolo = useStore(s => s.startSolo)
  const leaveGame = useStore(s => s.leaveGame)
  const won = result.won
  const townWon = result.winner === 'town'

  return (
    <div className="scrim">
      {won && (
        <div className="confetti">
          {Array.from({ length: 44 }).map((_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 137) % 100}%`,
                background: CONFETTI[i % CONFETTI.length],
                animationDelay: `${(i % 11) * 0.12}s`,
                transform: `rotate(${i * 35}deg)`,
              }}
            />
          ))}
        </div>
      )}
      <div className="sheet pop result">
        <div className="result-emoji">{won ? '🏆' : townWon ? '🌅' : '🌑'}</div>
        <h1>{won ? 'Победа' : 'Поражение'}</h1>
        <div className="result-sub">
          {townWon
            ? 'Город вычислил всю мафию до последнего.'
            : 'Мафия сомкнула хватку на городе.'}
          {' '}
          {won ? 'Вы были на стороне победителей.' : 'В следующую ночь повезёт больше.'}
        </div>
        {won && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <span className="coin-chip">🪙 +30 монет</span>
          </div>
        )}
        <button className="btn block lg" onClick={mode === 'online' ? leaveGame : startSolo}>
          {mode === 'online' ? 'В город' : 'Играть снова 🌙'}
        </button>
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={leaveGame}>На главную</button>
      </div>
    </div>
  )
}
