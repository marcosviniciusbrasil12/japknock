import { TeamMember } from '../lib/team'
import { GL } from '../lib/design'
import { Avatar } from './Avatar'
import { KnockingHand } from './KnockingHand'

type Status = 'online' | 'connecting' | 'offline'

type Props = {
  me: TeamMember
  status: Status
  subtitle?: string
}

const statusColor: Record<Status, string> = {
  online: '#34c759',
  connecting: '#ff9500',
  offline: '#ff3b30'
}

const statusLabel: Record<Status, string> = {
  online: 'online',
  connecting: 'conectando…',
  offline: 'sem conexão'
}

export function PopoverHeader({ me, status, subtitle }: Props) {
  return (
    <div
      className="flex items-center justify-between px-3.5 py-3"
      style={{ borderBottom: '0.5px solid var(--jk-divider)' }}
    >
      <div className="flex items-center gap-2.5">
        <KnockingHand size={40} radius={26} />
        <div className="flex flex-col">
          <div
            className="leading-none font-bold"
            style={{ fontSize: 13, letterSpacing: '-0.015em' }}
          >
            JAPKnock
          </div>
          <div
            className="mt-1 font-medium flex items-center gap-1"
            style={{ fontSize: 10, color: GL.muted }}
          >
            <span
              className="inline-block rounded-full"
              style={{
                width: 5,
                height: 5,
                background: statusColor[status],
                boxShadow:
                  status === 'online' ? `0 0 4px ${statusColor.online}80` : 'none'
              }}
            />
            {subtitle ?? statusLabel[status]}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 11, color: GL.muted, fontWeight: 500 }}>{me.name}</span>
        <Avatar member={me} size={22} inverse ring="subtle" />
      </div>
    </div>
  )
}
