import { useState } from 'react'
import { TEAM, TeamMember, setStoredMe } from '../lib/team'
import { Avatar } from './Avatar'

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
    <div className="h-full w-full bg-zinc-900 text-zinc-100 flex flex-col p-5 rounded-xl">
      <h1 className="text-lg font-bold mb-1">Quem é você?</h1>
      <p className="text-xs text-zinc-400 mb-4">Escolha seu nome pra começar</p>
      <div className="grid grid-cols-3 gap-3 overflow-y-auto">
        {TEAM.map((m) => (
          <button
            key={m.id}
            onMouseEnter={() => setHover(m.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => handlePick(m)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Avatar
              member={m}
              size={56}
              ringClass={hover === m.id ? 'ring-2 ring-white' : ''}
            />
            <span className="text-xs font-medium">{m.name}</span>
            {m.role === 'sender' && (
              <span className="text-[10px] text-zinc-500">(diretora)</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
