import { ROLES } from '@shared/roles'
import type { GameView } from '@shared/view'

// The secret identity card, shown on game start and re-openable from the
// role chip. Mafia also see their partners here.
export function RoleCard({ view, onClose }: { view: GameView; onClose: () => void }) {
  const meta = ROLES[view.you.role]
  const partners = view.players.filter(p => view.mafiaPartners.includes(p.id) && !p.isYou)

  return (
    <div className="scrim" onClick={onClose}>
      <div className={`rolecard r-${view.you.role}`} onClick={e => e.stopPropagation()}>
        <div className="rc-emoji">{meta.emoji}</div>
        <div className="rc-eyebrow">Твоя роль</div>
        <div className="rc-name">{meta.name}</div>
        <div className="rc-blurb">«{meta.blurb}»</div>
        <div className="rc-power">{meta.power}</div>
        <div className="rc-team">
          {meta.team === 'mafia' ? '🌑 Мафия' : '🏘️ Город'} · {meta.team === 'mafia' ? 'победа, когда вас станет больше' : 'победа, когда вычислите мафию'}
        </div>
        {view.you.role === 'mafia' && (
          <div className="rc-partners">
            {partners.length
              ? <>{partners.length > 1 ? 'Твои подельники' : 'Твой подельник'}: <b>{partners.map(p => p.name).join(', ')}</b></>
              : <>Этой ночью ты работаешь один.</>}
          </div>
        )}
        <button className="btn cream block lg" style={{ marginTop: 20 }} onClick={onClose}>
          {meta.team === 'mafia' ? 'Во тьму 🔪' : 'Я готов 🌙'}
        </button>
      </div>
    </div>
  )
}
