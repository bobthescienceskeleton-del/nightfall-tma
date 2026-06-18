import { useState } from 'react'
import { useStore } from '../store'
import { shareLink, haptic } from '../telegram'

export function Lobby() {
  const room = useStore(s => s.room)
  const profile = useStore(s => s.profile)
  const botUsername = useStore(s => s.botUsername)
  const startRoom = useStore(s => s.startRoom)
  const leaveGame = useStore(s => s.leaveGame)
  const joinRoom = useStore(s => s.joinRoom)
  const joinError = useStore(s => s.joinError)
  const busy = useStore(s => s.busy)
  const [code, setCode] = useState('')

  // ── join form (no room yet) ───────────────────────────────────────────────
  if (!room) {
    return (
      <div className="lobby rise">
        <div className="page-head" style={{ alignSelf: 'flex-start' }}>
          <button className="round-btn" onClick={() => useStore.getState().go('home')}>‹</button>
          <h1>Зайти в город</h1>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <input
            className="code-input"
            placeholder="КОД"
            value={code}
            maxLength={4}
            autoCapitalize="characters"
            onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4))}
          />
          {joinError && <p style={{ color: 'var(--red-deep)', textAlign: 'center', fontWeight: 800, marginTop: 12 }}>{joinError}</p>}
          <button
            className="btn block lg"
            style={{ marginTop: 18 }}
            disabled={code.length !== 4 || busy}
            onClick={() => joinRoom(code)}
          >
            {busy ? 'Заходим…' : 'Войти в игру'}
          </button>
        </div>
      </div>
    )
  }

  // ── town lobby ────────────────────────────────────────────────────────────
  const isHost =
    room.room.players.find(p => p.isHost)?.id === `u${profile?.id}` ||
    room.room.players.find(p => p.isHost)?.id === room.view?.youId
  const humans = room.room.players.filter(p => !p.isBot)

  const share = () => {
    haptic('tap')
    const link = `https://t.me/${botUsername}?startapp=room_${room.room.code}`
    shareLink(link, `Сыграй со мной в Секрет ночи! Код города ${room.room.code} 🌙`)
  }

  return (
    <div className="lobby rise">
      <div className="page-head" style={{ alignSelf: 'flex-start' }}>
        <button className="round-btn" onClick={leaveGame}>‹</button>
        <h1>Городская площадь</h1>
      </div>

      <div className="code-card">
        <div>Поделись этим кодом</div>
        <div className="code-big">{room.room.code}</div>
        <button className="btn accent block" style={{ marginTop: 8 }} onClick={share}>Позвать друзей ↗</button>
      </div>

      <div className="seatlist">
        {room.room.players.map(p => (
          <div className="seat" key={p.id}>
            <div className="av">{p.avatar}</div>
            <div className="nm">{p.name}</div>
            {p.isHost ? <div className="tag host">ХОЗЯИН</div> : p.isBot ? <div className="tag wait">В ИГРЕ</div> : <div className="tag wait">ГОТОВ</div>}
          </div>
        ))}
        {humans.length < room.room.maxPlayers && (
          <div className="seat" style={{ opacity: 0.6 }}>
            <div className="av">＋</div>
            <div className="nm">Ждём соседей<span className="dots" /></div>
          </div>
        )}
      </div>

      <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>
        Пустые места займут жители, когда ты начнёшь. Город из {room.room.townSize}.
      </p>

      {isHost ? (
        <button className="btn block lg" style={{ maxWidth: 420, marginTop: 8 }} disabled={busy} onClick={startRoom}>
          {busy ? 'Собираем…' : 'Начать игру 🌙'}
        </button>
      ) : (
        <p className="hint" style={{ marginTop: 8 }}>Ждём, пока хозяин начнёт<span className="dots" /></p>
      )}
    </div>
  )
}
