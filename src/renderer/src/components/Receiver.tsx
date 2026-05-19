import { useEffect, useRef, useState } from 'react'
import { TeamMember, findMember, clearStoredMe } from '../lib/team'
import { joinKnockChannel, KnockPayload, fetchRecentKnocksTo } from '../lib/supabase'
import { GL } from '../lib/design'
import { Avatar } from './Avatar'
import { Popover } from './Popover'
import { PopoverHeader } from './PopoverHeader'

type KnockEvent = KnockPayload & { fromName: string; fromInitials: string; ackedAt?: number }

type Props = {
  me: TeamMember
  onLogout: () => void
}

type ConnStatus = 'online' | 'connecting' | 'offline'

const formatWhen = (ts: number): string => {
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return `há ${Math.floor(diff / 1000)}s`
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday)
    return `hoje, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const relativeLabel = (ts: number): string => {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`
  return 'ontem'
}

export function Receiver({ me, onLogout }: Props) {
  const channelRef = useRef<ReturnType<typeof joinKnockChannel> | null>(null)
  const [status, setStatus] = useState<ConnStatus>('connecting')
  const [recents, setRecents] = useState<KnockEvent[]>([])
  const [pending, setPending] = useState<KnockEvent | null>(null)
  const [, setTick] = useState(0) // forces re-render pra atualizar "há Xs"

  // Re-render a cada 10s pra atualizar timestamps relativos
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(i)
  }, [])

  // Carrega histórico do banco na primeira abertura
  useEffect(() => {
    let cancelled = false
    fetchRecentKnocksTo(me.id, 10).then((rows) => {
      if (cancelled) return
      const mapped: KnockEvent[] = rows.map((r) => {
        const fm = findMember(r.from_user)
        return {
          to: r.to_user,
          from: r.from_user,
          ts: new Date(r.ts).getTime(),
          knockId: r.id,
          fromName: fm?.name ?? r.from_user,
          fromInitials: fm?.initials ?? r.from_user.slice(0, 2).toUpperCase(),
          ackedAt: r.acked_at ? new Date(r.acked_at).getTime() : undefined
        }
      })
      setRecents(mapped)
    })
    return () => {
      cancelled = true
    }
  }, [me.id])

  // Escuta quando o usuário clica "Tô indo" no fullscreen AlertOverlay
  useEffect(() => {
    const off = window.api.onAlertAcknowledged(async ({ from }) => {
      // Acha o knockId do pending pra mandar o ack pra a row certa
      const knockId = pending?.knockId
      if (channelRef.current) {
        try {
          await channelRef.current.sendAck(from, me.id, knockId)
        } catch (e) {
          console.error('Failed to send ack after alert dismiss', e)
        }
      }
      setPending((curr) => (curr?.from === from ? null : curr))
      // Marca como acked na lista de recentes
      setRecents((r) =>
        r.map((k) =>
          k.knockId === knockId ? { ...k, ackedAt: Date.now() } : k
        )
      )
    })
    return off
  }, [me.id, pending])

  useEffect(() => {
    const channel = joinKnockChannel({
      onKnock: (payload) => {
        if (payload.to !== me.id) return
        const fromMember = findMember(payload.from)
        const fromName = fromMember?.name ?? payload.from
        const fromInitials = fromMember?.initials ?? payload.from.slice(0, 2).toUpperCase()
        const event: KnockEvent = { ...payload, fromName, fromInitials }
        setPending(event)
        setRecents((r) => [event, ...r.filter((k) => k.knockId !== event.knockId)].slice(0, 10))
        window.api.showKnockAlert(payload.from, fromName)
        window.api.notify(`${fromName} está te chamando`, 'Bateu na sua porta digital')
      },
      onAck: () => {
        /* Receiver não age em acks (só Sender) */
      },
      onStatus: (s) => setStatus(s)
    })
    channelRef.current = channel
    return () => {
      channel.unsubscribe()
    }
  }, [me.id])

  const handleAck = async (): Promise<void> => {
    window.api.clearAlert()
    window.api.dismissKnockAlert()
    if (pending && channelRef.current) {
      try {
        await channelRef.current.sendAck(pending.from, me.id, pending.knockId)
      } catch (e) {
        console.error('Failed to send ack', e)
      }
      setRecents((r) =>
        r.map((k) =>
          k.knockId === pending.knockId ? { ...k, ackedAt: Date.now() } : k
        )
      )
    }
    setPending(null)
  }

  const handleLogout = (): void => {
    clearStoredMe()
    onLogout()
  }

  // INCOMING: chamada não-reconhecida → mostra "X bateu na porta"
  if (pending) {
    const count = recents.filter((r) => r.from === pending.from && Date.now() - r.ts < 30_000)
      .length
    return (
      <Popover>
        <PopoverHeader me={me} status={status} subtitle="chamada recebida" onLogout={handleLogout} />

        <div className="text-center" style={{ padding: '20px 22px 18px' }}>
          <div className="relative inline-block">
            <Avatar
              member={{
                id: pending.from,
                name: pending.fromName,
                initials: pending.fromInitials,
                role: 'sender',
                sector: null
              }}
              size={70}
            />
            <span
              className="absolute rounded-full"
              style={{
                inset: -6,
                border: '1.5px solid rgba(0,0,0,.35)',
                animation: 'jk-ping 1.4s ease-out infinite'
              }}
            />
            <span
              className="absolute rounded-full"
              style={{
                inset: -6,
                border: '1.5px solid rgba(0,0,0,.35)',
                animation: 'jk-ping 1.4s ease-out 0.5s infinite'
              }}
            />
          </div>

          <div
            className="font-bold"
            style={{ fontSize: 21, marginTop: 14, letterSpacing: '-.022em' }}
          >
            {pending.fromName} bateu na porta
          </div>
          <div
            className="flex items-center justify-center gap-1.5"
            style={{ fontSize: 11.5, color: GL.muted, marginTop: 4 }}
          >
            <span>{formatWhen(pending.ts)}</span>
            {count > 1 && (
              <>
                <span>·</span>
                <span style={{ color: GL.ink, fontWeight: 600 }}>{count}× seguidas</span>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2" style={{ padding: '0 16px 14px' }}>
          <button
            onClick={handleAck}
            className="flex-1 font-semibold transition-colors hover:opacity-90"
            style={{
              padding: '11px 14px',
              fontSize: 14,
              letterSpacing: '-.005em',
              background: GL.ink,
              color: '#fff',
              border: 0,
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Tô indo ↗
          </button>
        </div>

        <div
          className="flex items-center justify-center uppercase"
          style={{
            padding: '8px 14px 9px',
            borderTop: '0.5px solid var(--gl-divider)',
            fontSize: 10,
            color: GL.faint,
            fontWeight: 500,
            letterSpacing: '.04em'
          }}
        >
          tocando som… aguardando reconhecimento
        </div>
      </Popover>
    )
  }

  // IDLE: à escuta
  return (
    <Popover>
      <PopoverHeader me={me} status={status} subtitle="à escuta" onLogout={handleLogout} />

      <div className="text-center" style={{ padding: '24px 22px 18px' }}>
        <div className="relative inline-block">
          <Avatar member={me} size={72} inverse ring="subtle" />
          <span
            className="absolute rounded-full"
            style={{
              top: -1,
              right: -1,
              width: 10,
              height: 10,
              background: '#34c759',
              boxShadow:
                '0 0 0 2px var(--gl-paper-solid), 0 0 6px rgba(52,199,89,.4)'
            }}
          />
        </div>
        <div
          className="font-bold"
          style={{ fontSize: 18, marginTop: 14, letterSpacing: '-.02em' }}
        >
          Tudo quieto.
        </div>
        <div style={{ fontSize: 12, color: GL.muted, marginTop: 4, lineHeight: 1.4 }}>
          A gente avisa quando alguém bater.
        </div>
      </div>

      {recents.length > 0 && (
        <div style={{ padding: '0 12px 6px' }}>
          <div
            className="font-semibold uppercase"
            style={{
              fontSize: 10,
              color: GL.muted,
              letterSpacing: '.06em',
              padding: '4px 6px 8px'
            }}
          >
            recentes
          </div>
          <div className="flex flex-col gap-px">
            {recents.map((r, i) => (
              <div key={`${r.ts}-${i}`} className="flex items-center gap-2.5 px-1.5 py-2 rounded-md">
                <Avatar
                  member={{
                    id: r.from,
                    name: r.fromName,
                    initials: r.fromInitials,
                    role: 'sender',
                    sector: null
                  }}
                  size={26}
                />
                <div className="flex-1">
                  <div
                    className="font-medium"
                    style={{ fontSize: 12, lineHeight: 1.2, color: GL.ink }}
                  >
                    <span style={{ fontWeight: 600 }}>{r.fromName}</span> te chamou
                  </div>
                  <div style={{ fontSize: 10, color: GL.faint, marginTop: 1 }}>
                    {formatWhen(r.ts)}
                  </div>
                </div>
                <span
                  className="font-medium"
                  style={{ fontSize: 10, color: GL.faint }}
                >
                  {relativeLabel(r.ts)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="flex items-center justify-between font-medium"
        style={{
          padding: '8px 14px 9px',
          borderTop: '0.5px solid var(--gl-divider)',
          fontSize: 10,
          color: GL.faint
        }}
      >
        <span>rodando em segundo plano</span>
        <span>v 1.0</span>
      </div>
    </Popover>
  )
}
