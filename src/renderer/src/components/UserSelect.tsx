import { useState } from 'react'
import { TEAM, TeamMember, setStoredMe } from '../lib/team'
import { GL } from '../lib/design'
import { Avatar } from './Avatar'
import { Popover } from './Popover'
import { KnockingHand } from './KnockingHand'

type Props = {
  onPick: (m: TeamMember) => void
}

export function UserSelect({ onPick }: Props) {
  const [hover, setHover] = useState<string | null>(null)

  const handlePick = (m: TeamMember): void => {
    setStoredMe(m.id)
    onPick(m)
  }

  return (
    <Popover>
      <div className="px-4 py-3.5" style={{ borderBottom: '0.5px solid var(--gl-divider)' }}>
        <div className="flex items-center gap-2.5">
          <KnockingHand size={40} radius={26} />
          <div>
            <div className="font-bold" style={{ fontSize: 13, letterSpacing: '-.015em' }}>
              JAPKnock
            </div>
            <div className="font-medium" style={{ fontSize: 10, color: GL.muted, marginTop: 2 }}>
              quem é você?
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 pb-2" style={{ fontSize: 11, color: GL.muted }}>
        Escolha seu nome pra começar. Fica salvo nesta máquina.
      </div>

      <div className="grid grid-cols-3 px-2 pb-3 gap-1">
        {TEAM.map((m) => {
          const isHover = hover === m.id
          return (
            <button
              key={m.id}
              onMouseEnter={() => setHover(m.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => handlePick(m)}
              className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-lg transition-colors"
              style={{
                background: isHover ? 'rgba(0,0,0,.05)' : 'transparent',
                border: 0,
                cursor: 'pointer'
              }}
            >
              <Avatar member={m} size={44} ring={isHover ? 'active' : 'subtle'} />
              <span
                className="font-medium"
                style={{ fontSize: 12, color: GL.ink, marginTop: 2 }}
              >
                {m.name}
              </span>
              {m.role === 'sender' && (
                <span style={{ fontSize: 9.5, color: GL.faint, marginTop: -2 }}>
                  diretora
                </span>
              )}
            </button>
          )
        })}
      </div>
    </Popover>
  )
}
