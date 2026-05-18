import { useEffect, useRef, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { TeamMember, findMember, clearStoredMe } from '../lib/team'
import { joinKnockChannel, KnockPayload } from '../lib/supabase'
import { Avatar } from './Avatar'

type KnockEvent = KnockPayload & { fromName: string }

type Props = {
  me: TeamMember
  onLogout: () => void
}

export function Receiver({ me, onLogout }: Props) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [status, setStatus] = useState<string>('Conectando...')
  const [lastKnock, setLastKnock] = useState<KnockEvent | null>(null)
  const [knockCount, setKnockCount] = useState<number>(0)

  useEffect(() => {
    const channel = joinKnockChannel(
      (payload) => {
        if (payload.to !== me.id) return
        const fromMember = findMember(payload.from)
        const fromName = fromMember?.name ?? payload.from
        const event: KnockEvent = { ...payload, fromName }
        setLastKnock(event)
        setKnockCount((c) => c + 1)
        // Fullscreen "ESCANCARADO" overlay (covers everything, plays sound on loop)
        window.api.showKnockAlert(payload.from, fromName)
        // Quiet system notification as a backup (if the window is somehow blocked)
        window.api.notify(`${fromName} está te chamando`, 'Bateu na sua porta digital')
      },
      (s) => {
        if (s === 'SUBSCRIBED') setStatus('Online')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED')
          setStatus('Sem conexão')
      }
    )
    channelRef.current = channel
    return () => {
      channel.unsubscribe()
    }
  }, [me.id])

  const handleAck = (): void => {
    window.api.clearAlert()
    setKnockCount(0)
  }

  const handleLogout = (): void => {
    clearStoredMe()
    onLogout()
  }

  return (
    <div className="h-full w-full bg-zinc-900 text-zinc-100 flex flex-col p-5 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar member={me} size={36} />
          <div>
            <p className="text-sm font-semibold leading-tight">{me.name}</p>
            <p className="text-[11px] text-zinc-400">
              <span
                className={
                  'inline-block w-1.5 h-1.5 rounded-full mr-1 ' +
                  (status === 'Online' ? 'bg-emerald-400' : 'bg-amber-400')
                }
              />
              {status}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-[11px] text-zinc-500 hover:text-zinc-300"
          title="Trocar usuário"
        >
          Trocar
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {lastKnock ? (
          <>
            <div className="text-5xl mb-3 animate-pulse-fast">🚪</div>
            <p className="text-2xl font-bold">{lastKnock.fromName}</p>
            <p className="text-sm text-zinc-400 mt-1">te chamou</p>
            {knockCount > 1 && (
              <p className="text-xs text-amber-400 mt-2">{knockCount}x</p>
            )}
            <p className="text-[11px] text-zinc-500 mt-4">
              {new Date(lastKnock.ts).toLocaleTimeString('pt-BR')}
            </p>
            <button
              onClick={handleAck}
              className="mt-5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium"
            >
              Vou já!
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3 opacity-30">🚪</div>
            <p className="text-sm text-zinc-500">Aguardando chamadas…</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Você é notificado quando alguém chamar
            </p>
          </>
        )}
      </div>

      <div className="mt-auto pt-3 text-center">
        <p className="text-[10px] text-zinc-600">Fica rodando em segundo plano</p>
      </div>
    </div>
  )
}
