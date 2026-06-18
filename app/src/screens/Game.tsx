import { useMemo, useState } from 'react'
import { useStore, YOU } from '../store'
import { TownScene } from '../game/TownScene'
import { RoleCard } from '../game/RoleCard'
import { ROLES } from '@shared/roles'
import { toView, type GameView, type ViewPlayer } from '@shared/view'

export function Game() {
  // Compute the view with useMemo from the primitive state. Calling a store
  // method via a selector would return a fresh object each read and break
  // zustand's snapshot stability (infinite re-render).
  const mode = useStore(s => s.mode)
  const solo = useStore(s => s.solo)
  const room = useStore(s => s.room)
  const view = useMemo<GameView | null>(() => {
    if (mode === 'solo' && solo) return toView(solo, YOU)
    if (mode === 'online' && room?.view) return room.view
    return null
  }, [mode, solo, room])
  const showRole = useStore(s => s.showRole)
  const dismissRole = useStore(s => s.dismissRole)
  const leaveGame = useStore(s => s.leaveGame)
  const [peek, setPeek] = useState(false)

  if (!view) {
    return (
      <div className="scene night">
        <TownScene mode="night" />
        <div className="wait-panel"><div className="wait-moon">🌙</div><div className="wait-text">Gathering the town<span className="dots" /></div></div>
      </div>
    )
  }

  const phase = view.phase
  const isNight = phase === 'night'
  const sceneMode: 'night' | 'day' = isNight ? 'night' : 'day'
  const meta = ROLES[view.you.role]

  return (
    <div className={`scene ${sceneMode}`}>
      <TownScene mode={sceneMode} />

      <div className="scene-body">
        <div className="gtop">
          <button className="round-btn" onClick={leaveGame} aria-label="Leave">‹</button>
          <span className="phase-badge">{badge(phase, view.day)}</span>
          <span className="gtop-spacer" />
          <span className="alive-chip">👥 {view.aliveCount}</span>
          <button className="role-chip" onClick={() => setPeek(true)}>
            <span className="dot">{meta.emoji}</span>
            {meta.name}
          </button>
        </div>

        {phase === 'night' && <NightView view={view} />}
        {phase === 'reveal' && <RevealView view={view} />}
        {phase === 'day' && <DayView view={view} />}
        {phase === 'verdict' && <VerdictView view={view} />}
        {phase === 'gameover' && <Roster view={view} />}
      </div>

      {(showRole || peek) && (
        <RoleCard view={view} onClose={() => { if (showRole) dismissRole(); setPeek(false) }} />
      )}
    </div>
  )
}

function badge(phase: GameView['phase'], day: number): string {
  if (phase === 'night') return `🌙 Night ${day}`
  if (phase === 'reveal') return `🌅 Dawn ${day}`
  if (phase === 'day') return `☀️ Day ${day}`
  if (phase === 'verdict') return `⚖️ Verdict`
  return `🌑 Over`
}

// ── NIGHT ────────────────────────────────────────────────────────────────────
function NightView({ view }: { view: GameView }) {
  const nightAct = useStore(s => s.nightAct)
  const me = view.players.find(p => p.isYou)!

  // you have a power and haven't used it yet → targeting
  if (view.canAct && view.actPower) {
    const prompt =
      view.actPower === 'kill' ? 'Choose tonight’s victim'
      : view.actPower === 'save' ? 'Choose someone to protect'
      : 'Choose someone to investigate'
    return (
      <>
        <div className="phase-head">
          <div className="phase-title">{ROLES[view.you.role].emoji} {prompt}</div>
          <div className="phase-sub">The town is asleep. Make your move.</div>
        </div>
        <Grid view={view} selectableFn={p => targetable(view, p)} selectedId={view.yourNightTarget}
          onPick={id => nightAct(id)} />
      </>
    )
  }

  // you've acted, or you have no night power → wait for dawn
  const acted = !!view.yourNightTarget
  const target = acted ? view.players.find(p => p.id === view.yourNightTarget) : null
  return (
    <div className="wait-panel">
      <div style={{ position: 'relative' }}>
        <div className="wait-moon">🌙</div>
        <span className="wait-z" style={{ left: '60%', top: '-4px', animationDelay: '0s' }}>z</span>
        <span className="wait-z" style={{ left: '74%', top: '-14px', animationDelay: '1s' }}>z</span>
      </div>
      <div className="wait-text">
        {acted && target ? povAction(view.actPower, target.name) : me.alive ? 'Night falls over the town' : 'You rest among the lost'}
      </div>
      <div className="wait-sub">
        {me.alive
          ? <>The streets are dark and quiet. Dawn is coming<span className="dots" /></>
          : <>Watch the town decide its fate from the shadows.</>}
      </div>
    </div>
  )
}

function povAction(power: GameView['actPower'], name: string): string {
  if (power === 'kill') return `Your mark is set on ${name}`
  if (power === 'save') return `You stand watch over ${name}`
  if (power === 'investigate') return `You shadow ${name} through the night`
  return 'Your move is made'
}

// ── DAWN (reveal) ────────────────────────────────────────────────────────────
function RevealView({ view }: { view: GameView }) {
  const ln = view.lastNight
  const victim = ln?.victimId ? view.players.find(p => p.id === ln.victimId) : null
  const freshRead = view.you.role === 'detective' ? view.detectiveReads[view.detectiveReads.length - 1] : null
  const readTarget = freshRead ? view.players.find(p => p.id === freshRead.targetId) : null

  return (
    <>
      <div className="obit">
        {victim ? (
          <>
            <div className="face-big">{victim.avatar}</div>
            <h2>{victim.name} is gone</h2>
            <p>Found at first light, taken in the night. They were {article(view, victim)}.</p>
          </>
        ) : ln?.saved ? (
          <>
            <div className="face-big saved">✚</div>
            <h2>Saved!</h2>
            <p>A blade fell in the dark — but the Doctor was faster. Everyone woke to see the dawn.</p>
          </>
        ) : (
          <>
            <div className="face-big">🌅</div>
            <h2>A quiet night</h2>
            <p>No one was taken. The town wakes whole — for now.</p>
          </>
        )}
      </div>

      {readTarget && freshRead && (
        <div className="obit" style={{ marginTop: 12 }}>
          <div className="face-big">{freshRead.isMafia ? '🔪' : '🕊️'}</div>
          <h2>Your findings</h2>
          <p>You shadowed <b>{readTarget.name}</b> — they are {freshRead.isMafia ? 'one of the Mafia.' : 'not Mafia.'}</p>
        </div>
      )}
    </>
  )
}

// ── DAY (discussion + voting) ────────────────────────────────────────────────
function DayView({ view }: { view: GameView }) {
  const castVote = useStore(s => s.castVote)
  const voted = view.yourVote !== undefined
  const canVote = view.you.alive && !voted

  return (
    <>
      <div className="phase-head">
        <div className="phase-title">The town gathers</div>
        <div className="phase-sub">{view.you.alive ? 'Read the room, then cast your vote.' : 'You look on from beyond.'}</div>
      </div>

      {view.chatter.length > 0 && (
        <div className="feed">
          {view.chatter.map((c, i) => (
            <div className="bubble" key={i} style={{ animationDelay: `${i * 0.14}s` }}>
              <div className="av">{c.avatar}</div>
              <div className={`say ${c.tone}`}>
                <span className="who">{c.speakerName}</span>
                {c.text}
              </div>
            </div>
          ))}
        </div>
      )}

      <Grid view={view} selectableFn={p => canVote && p.alive && !p.isYou}
        selectedId={view.yourVote ?? undefined} onPick={id => castVote(id)} showVotes />

      <div className="dock" style={{ paddingBottom: 4 }}>
        {!view.you.alive ? (
          <div className="dock-note">You’ve been eliminated — watch how it unfolds.</div>
        ) : voted ? (
          <div className="dock-note">
            {view.yourVote ? `Your vote is cast for ${nameOf(view, view.yourVote)}. ` : 'You abstained. '}
            Waiting for the town<span className="dots" />
          </div>
        ) : (
          <>
            <div className="dock-note">Tap a neighbour to vote them out.</div>
            <button className="btn onnight block" onClick={() => castVote(null)}>Abstain 🤐</button>
          </>
        )}
      </div>
    </>
  )
}

// ── VERDICT ──────────────────────────────────────────────────────────────────
function VerdictView({ view }: { view: GameView }) {
  const ver = view.lastVerdict
  const out = ver?.targetId ? view.players.find(p => p.id === ver.targetId) : null
  return (
    <>
      <div className="obit">
        {out ? (
          <>
            <div className="face-big">{out.avatar}</div>
            <h2>{out.name} is cast out</h2>
            <p>The town has spoken. They were {article(view, out)}.</p>
          </>
        ) : (
          <>
            <div className="face-big">⚖️</div>
            <h2>No one hangs today</h2>
            <p>{ver?.tie ? 'The vote split clean down the middle.' : 'The town stayed its hand.'} The Mafia walk free another night.</p>
          </>
        )}
      </div>
      <Grid view={view} selectableFn={() => false} />
    </>
  )
}

// ── shared roster grid + token ───────────────────────────────────────────────
function Roster({ view }: { view: GameView }) {
  return <Grid view={view} selectableFn={() => false} />
}

function Grid({
  view,
  selectableFn,
  selectedId,
  onPick,
  showVotes,
}: {
  view: GameView
  selectableFn: (p: ViewPlayer) => boolean
  selectedId?: string | null
  onPick?: (id: string) => void
  showVotes?: boolean
}) {
  return (
    <div className="grid">
      {view.players.map(p => {
        const selectable = selectableFn(p)
        const selected = selectedId === p.id
        return (
          <button
            key={p.id}
            className={`token${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}${p.alive ? '' : ' dead'}`}
            onClick={selectable && onPick ? () => onPick(p.id) : undefined}
            disabled={!selectable}
          >
            {p.isYou && <span className="badge you">YOU</span>}
            {p.alive && p.knownRole === 'mafia' && !p.isYou && <span className="badge mafia">🔪</span>}
            {showVotes && p.alive && p.votesOn > 0 && <span className="badge votes">{p.votesOn}</span>}
            {!p.alive && <span className="grave">🪦</span>}
            <span className="face">{p.avatar}</span>
            <span className={`nm${p.isYou ? ' you' : ''}`}>{p.name}</span>
            <Sub view={view} p={p} />
          </button>
        )
      })}
    </div>
  )
}

function Sub({ view, p }: { view: GameView; p: ViewPlayer }) {
  if (!p.alive && p.knownRole) {
    const team = ROLES[p.knownRole].team
    return <span className={`role-reveal t-${team}`}>{ROLES[p.knownRole].name}</span>
  }
  if (p.cleared) return <span className="sub cleared">✓ cleared</span>
  if (p.alive && p.knownRole === 'mafia' && !p.isYou) return <span className="sub caught">mafia</span>
  if (p.isYou) return <span className="sub">{ROLES[view.you.role].name}</span>
  return <span className="sub">&nbsp;</span>
}

function targetable(view: GameView, p: ViewPlayer): boolean {
  if (!view.canAct || !p.alive) return false
  if (view.actPower === 'kill') return !p.isYou && p.knownRole !== 'mafia'
  if (view.actPower === 'investigate') return !p.isYou
  if (view.actPower === 'save') return true // the Doctor may shield anyone, even themselves
  return false
}

function article(view: GameView, p: ViewPlayer): string {
  const r = p.knownRole
  if (!r) return 'a townsperson'
  const n = ROLES[r].name
  return /^[AEIOU]/.test(n) ? `an ${n}` : `a ${n}`
}

function nameOf(view: GameView, id: string): string {
  return view.players.find(p => p.id === id)?.name ?? 'someone'
}
