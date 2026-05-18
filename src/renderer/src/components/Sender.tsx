import { useEffect, useRef, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { RECEIVERS, TeamMember, clearStoredMe } from '../lib/team'
import { joinKnockChannel, sendKnock } from '../lib/supabase'
import { playSent } from '../lib/sound'
import { Avatar } from './Avatar'

type Props = {
  me: TeamMember
  onLogout: () => void
}

export function Sender({ me, onLogout }: Props) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [pulsing, setPulsing] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Conectando...')

  useEffect(() => {
    const channel = joinKnockChannel(() => {
      // Helena doesn't receive
    })
    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') setStatus('Online')
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('Sem conexão')
    })
    channelRef.current = channel
    return () => {
      channel.unsubscribe()
    }
  }, [])

  const knock = async (target: TeamMember): Promise<void> => {
    if (!channelRef.current) return
    setPulsing(target.id)
    playSent()
    try {
      await sendKnock(channelRef.current, target.id, me.id)
    } catch (e) {
      console.error('Failed to send knock', e)
    }
    setTimeout(() => setPulsing(null), 800)
  }

  const handleLogout = (): void => {
    clearStoredMe()
    onLogout()
  }

  return (
    <div className="h-full w-full bg-zinc-900 text-zinc-100 flex flex-col p-5 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-lg font-bold leading-tight">Chamar alguém</h1>
          <p className="text-xs text-zinc-400">
            <span
              className={
                'inline-block w-1.5 h-1.5 rounded-full mr-1 ' +
                (status === 'Online' ? 'bg-emerald-400' : 'bg-amber-400')
              }
            />
            {status}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-[11px] text-zinc-500 hover:text-zinc-300"
          title="Trocar usuário"
        >
          Trocar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        {RECEIVERS.map((m) => (
          <button
            key={m.id}
            onClick={() => knock(m)}
            disabled={status !== 'Online'}
            className="flex flex-col items-center gap-2 p-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Avatar
              member={m}
              size={64}
              ringClass={pulsing === m.id ? 'ring-4 ring-emerald-400 animate-pulse-fast' : ''}
            />
            <span className="text-sm font-medium">{m.name}</span>
            {pulsing === m.id && (
              <span className="text-[10px] text-emerald-400 -mt-1">chamando…</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-auto pt-4 text-center">
        <p className="text-[10px] text-zinc-600">Toque numa foto pra apitar o computador</p>
      </div>
    </div>
  )
}
