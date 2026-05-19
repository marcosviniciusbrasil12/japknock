import { TeamMember } from '../lib/team'
import { GL } from '../lib/design'

type Props = {
  member: TeamMember
  size?: number
  inverse?: boolean // disco "inverso" pra current user
  ring?: 'none' | 'subtle' | 'active'
  className?: string
}

export function Avatar({ member, size = 64, inverse = false, ring = 'none', className = '' }: Props) {
  const bg = inverse ? GL.avatarInverseBg : GL.avatarBg
  const fg = inverse ? GL.avatarInverseFg : GL.avatarFg

  let ringShadow = 'none'
  if (ring === 'subtle')
    ringShadow = 'inset 0 0 0 0.5px var(--jk-divider), 0 1px 2px rgba(0,0,0,.06)'
  else if (ring === 'active')
    ringShadow =
      'inset 0 0 0 1.5px var(--jk-paper), 0 0 0 2.5px var(--jk-ink), 0 6px 18px -4px rgba(0,0,0,.35)'

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: size * 0.36,
        letterSpacing: '0.02em',
        boxShadow: ringShadow,
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'
      }}
    >
      {member.initials}
    </div>
  )
}
