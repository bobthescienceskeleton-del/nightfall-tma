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
          <h1>Join a town</h1>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <input
            className="code-input"
            placeholder="CODE"
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
            {busy ? 'Joining…' : 'Join game'}
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
    shareLink(link, `Come play Nightfall with me! Town code ${room.room.code} 🌙`)
  }

  return (
    <div className="lobby rise">
      <div className="page-head" style={{ alignSelf: 'flex-start' }}>
        <button className="round-btn" onClick={leaveGame}>‹</button>
        <h1>Town square</h1>
      </div>

      <div className="code-card">
        <div>Share this code</div>
        <div className="code-big">{room.room.code}</div>
        <button className="btn accent block" style={{ marginTop: 8 }} onClick={share}>Invite friends ↗</button>
      </div>

      <div className="seatlist">
        {room.room.players.map(p => (
          <div className="seat" key={p.id}>
            <div className="av">{p.avatar}</div>
            <div className="nm">{p.name}</div>
            {p.isHost ? <div className="tag host">HOST</div> : p.isBot ? <div className="tag bot">BOT</div> : <div className="tag wait">READY</div>}
          </div>
        ))}
        {humans.length < room.room.maxPlayers && (
          <div className="seat" style={{ opacity: 0.6 }}>
            <div className="av">＋</div>
            <div className="nm">Waiting for neighbours…</div>
          </div>
        )}
      </div>

      <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>
        Empty seats fill with townsfolk when you start. Town of {room.room.townSize}.
      </p>

      {isHost ? (
        <button className="btn block lg" style={{ maxWidth: 420, marginTop: 8 }} disabled={busy} onClick={startRoom}>
          {busy ? 'Gathering…' : 'Start game 🌙'}
        </button>
      ) : (
        <p className="hint" style={{ marginTop: 8 }}>Waiting for the host to start…</p>
      )}
    </div>
  )
}
