import { TeamMember } from '../lib/team'

type Props = {
  member: TeamMember
  size?: number
  ringClass?: string
}

export function Avatar({ member, size = 80, ringClass = '' }: Props) {
  return (
    <div
      className={`flex items-center justify-center rounded-full text-white font-bold shadow-md ${ringClass}`}
      style={{
        width: size,
        height: size,
        background: member.color,
        fontSize: size * 0.36
      }}
    >
      {member.initials}
    </div>
  )
}
