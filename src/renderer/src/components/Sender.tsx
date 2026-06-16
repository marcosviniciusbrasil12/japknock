import { useEffect, useRef, useState } from 'react'
import {
  SectorId,
  TeamMember,
  membersOfSectorIn,
  findMemberIn,
  sectorsVisibleTo
} from '../lib/team'
import { joinKnockChannel, KnockPayload } from '../lib/supabase'
import { usePresence } from '../lib/presence'
import { playSent } from '../lib/sound'
import { formatWhen } from '../lib/time'
import { GL } from '../lib/design'
import { Avatar } from './Avatar'
import { Popover } from './Popover'
import { PopoverHeader } from './PopoverHeader'
import { SearchBar } from './SearchBar'

// Painel de quem CHAMA. Usado por dois papéis:
// - sender (Helena): vê todos os setores, não recebe knock.
// - manager (gestor): vê só o próprio setor E também recebe knock — quando
//   chega um, a view de "chamada recebida" toma o lugar da lista até o "Tô indo".
type Props = {
  me: TeamMember
  team: TeamMember[]
}

type ConnStatus = 'online' | 'connecting' | 'offline'

type AckInfo = { byId: string; byName: string; ts: number }

type Incoming = KnockPayload & { fromName: string; fromInitials: string; count: number }

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const DEBOUNCE_MS = 1500

export function Sender({ me, team }: Props) {
  const isManager = me.role === 'manager'
  const visibleSectors = sectorsVisibleTo(me)
  const channelRef = useRef<ReturnType<typeof joinKnockChannel> | null>(null)
  const lastKnockAt = useRef<Record<string, number>>({})
  const lastSectorKnockAt = useRef<Record<string, number>>({})
  const onlineUsers = usePresence(me.id)
  const [hover, setHover] = useState<string | null>(null)
  const [active, setActive] = useState<Set<string>>(new Set())
  const [justSent, setJustSent] = useState<Set<string>>(new Set())
  const [hoverSector, setHoverSector] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ConnStatus>('connecting')
  const [acks, setAcks] = useState<Record<string, AckInfo>>({})
  const [incoming, setIncoming] = useState<Incoming | null>(null)

  // Callbacks do canal vivem fora do ciclo do React — ref evita snapshot velho
  // da equipe (nome errado pra quem se cadastrou depois do mount).
  const teamRef = useRef(team)
  useEffect(() => {
    teamRef.current = team
  }, [team])

  // TODOS os chamadores sem ack (from → knockId): se Helena e outro gestor
  // batem no gestor antes do "Tô indo", o ack responde todo mundo.
  const unackedIncoming = useRef<Map<string, string | undefined>>(new Map())

  const ackAllIncoming = async (): Promise<void> => {
    const entries = [...unackedIncoming.current.entries()]
    unackedIncoming.current.clear()
    if (!channelRef.current) return
    for (const [from, knockId] of entries) {
      try {
        await channelRef.current.sendAck(from, me.id, knockId)
      } catch (e) {
        console.error('Failed to send ack', e)
      }
    }
  }

  const addActive = (id: string): void =>
    setActive((s) => {
      const n = new Set(s)
      n.add(id)
      return n
    })
  const removeActive = (id: string): void =>
    setActive((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
  const addSent = (id: string): void =>
    setJustSent((s) => {
      const n = new Set(s)
      n.add(id)
      return n
    })
  const removeSent = (id: string): void =>
    setJustSent((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })

  useEffect(() => {
    const channel = joinKnockChannel({
      onKnock: (payload) => {
        // Só gestor recebe; sender (Helena) ignora knocks
        if (!isManager || payload.to !== me.id) return
        const fm = findMemberIn(teamRef.current, payload.from)
        const fromName = fm?.name ?? payload.from
        const fromInitials = fm?.initials ?? payload.from.slice(0, 2).toUpperCase()
        unackedIncoming.current.set(payload.from, payload.knockId)
        setIncoming((prev) =>
          prev && prev.from === payload.from
            ? { ...payload, fromName, fromInitials, count: prev.count + 1 }
            : { ...payload, fromName, fromInitials, count: 1 }
        )
        window.api.showKnockAlert(payload.from, fromName, fm?.role ?? 'sender')
        window.api.notify(fromName, 'está chamando você')
      },
      onAck: (payload) => {
        // Agora há mais de um chamador no canal: só reage a acks dos MEUS knocks
        if (payload.knocker !== me.id) return
        const m = findMemberIn(teamRef.current, payload.by)
        setAcks((prev) => ({
          ...prev,
          [payload.by]: { byId: payload.by, byName: m?.name ?? payload.by, ts: payload.ts }
        }))
        // Clear after 30s
        setTimeout(() => {
          setAcks((prev) => {
            if (prev[payload.by]?.ts !== payload.ts) return prev
            const { [payload.by]: _drop, ...rest } = prev
            return rest
          })
        }, 30_000)
      },
      onStatus: (s) => setStatus(s)
    })
    channelRef.current = channel
    return () => {
      channel.unsubscribe()
    }
  }, [])

  // Gestor: usuário clicou "Tô indo" no AlertOverlay fullscreen.
  // Acka TODOS os pendentes — ackAllIncoming só usa refs, sem re-registrar.
  useEffect(() => {
    if (!isManager) return
    const off = window.api.onAlertAcknowledged(async ({ from }) => {
      // Fallback: mapa pode ter zerado num remount com alerta vivo — responde
      // ao menos o chamador do payload (sem knockId, só broadcast)
      if (!unackedIncoming.current.has(from)) unackedIncoming.current.set(from, undefined)
      await ackAllIncoming()
      setIncoming(null)
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id, isManager])

  const ackIncoming = async (): Promise<void> => {
    window.api.clearAlert()
    // dismissKnockAlert dispara 'alert-acknowledged' de volta — o ackAll de lá
    // encontra o mapa já vazio e vira no-op (sem ack duplicado)
    window.api.dismissKnockAlert()
    await ackAllIncoming()
    setIncoming(null)
  }

  // Alvos chamáveis de um setor — exclui a própria pessoa (gestor não se chama)
  const targetsOf = (sectorId: SectorId): TeamMember[] =>
    membersOfSectorIn(team, sectorId).filter((m) => m.id !== me.id)

  const knock = async (target: TeamMember): Promise<void> => {
    if (!channelRef.current || status !== 'online') return
    // Debounce: ignora clicks dentro de 1.5s do último click pro mesmo alvo
    const now = Date.now()
    const last = lastKnockAt.current[target.id] ?? 0
    if (now - last < DEBOUNCE_MS) return
    lastKnockAt.current[target.id] = now

    addActive(target.id)
    setAcks((prev) => {
      const { [target.id]: _drop, ...rest } = prev
      return rest
    })
    playSent()
    try {
      await channelRef.current.sendKnock(target.id, me.id)
    } catch (e) {
      console.error('Failed to send knock', e)
    }
    setTimeout(() => {
      removeActive(target.id)
      addSent(target.id)
      setTimeout(() => removeSent(target.id), 1400)
    }, 900)
  }

  // Chama todo o setor de uma vez (com staggering leve pra evitar burst no Realtime)
  const knockSector = (sectorId: SectorId): void => {
    if (status !== 'online') return
    const now = Date.now()
    const last = lastSectorKnockAt.current[sectorId] ?? 0
    if (now - last < DEBOUNCE_MS) return
    lastSectorKnockAt.current[sectorId] = now

    targetsOf(sectorId).forEach((m, i) => {
      setTimeout(() => knock(m), i * 80)
    })
  }

  const matchesQuery = (m: TeamMember): boolean => !query || norm(m.name).includes(norm(query))

  const anyMatch = visibleSectors.some((s) => targetsOf(s.id).filter(matchesQuery).length > 0)
  const hasAnyTarget = visibleSectors.some((s) => targetsOf(s.id).length > 0)

  // GESTOR COM CHAMADA ENTRANTE: a view de receber toma o popover até o ack
  if (isManager && incoming) {
    return (
      <Popover>
        <PopoverHeader me={me} status={status} subtitle="chamada recebida" />

        <div className="text-center" style={{ padding: '20px 22px 18px' }}>
          <div className="relative inline-block">
            <Avatar
              member={{
                id: incoming.from,
                name: incoming.fromName,
                initials: incoming.fromInitials,
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
            {incoming.fromName} está te chamando
          </div>
          <div
            className="flex items-center justify-center gap-1.5"
            style={{ fontSize: 11.5, color: GL.muted, marginTop: 4 }}
          >
            <span>{formatWhen(incoming.ts)}</span>
            {incoming.count > 1 && (
              <>
                <span>·</span>
                <span style={{ color: GL.ink, fontWeight: 600 }}>{incoming.count}× seguidas</span>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2" style={{ padding: '0 16px 14px' }}>
          <button
            onClick={ackIncoming}
            className="flex-1 font-semibold transition-colors hover:opacity-90"
            style={{
              padding: '11px 14px',
              fontSize: 14,
              letterSpacing: '-.005em',
              background: GL.ink,
              color: GL.paper,
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
            borderTop: '0.5px solid var(--jk-divider)',
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

  return (
    <Popover>
      <PopoverHeader
        me={me}
        status={status}
        subtitle={
          status === 'online'
            ? isManager
              ? `online · gerência ${visibleSectors[0]?.name ?? ''}`
              : 'online · transmissão ativa'
            : undefined
        }
      />

      <SearchBar value={query} onChange={setQuery} />

      <div className="px-2.5 pb-2.5 max-h-[520px] overflow-y-auto">
        {visibleSectors.map((sec) => {
          const sectorTargets = targetsOf(sec.id)
          const members = sectorTargets.filter(matchesQuery)
          // Esconde setor vazio (a não ser que seja busca ativa, pra dar feedback)
          if (members.length === 0 && !query) return null
          if (query && members.length === 0) return null

          const isSectorHover = hoverSector === sec.id
          return (
            <div key={sec.id} className="py-1.5">
              <div className="flex items-center gap-2 px-1.5 pt-0.5 pb-1">
                <span
                  className="font-semibold uppercase"
                  style={{
                    fontSize: 10,
                    color: GL.muted,
                    letterSpacing: '.04em'
                  }}
                >
                  {sec.name}
                </span>
                <span className="flex-1 h-px" style={{ background: 'var(--jk-divider)' }} />
                <button
                  onClick={() => knockSector(sec.id)}
                  onMouseEnter={() => setHoverSector(sec.id)}
                  onMouseLeave={() => setHoverSector(null)}
                  disabled={status !== 'online' || sectorTargets.length === 0}
                  className="flex items-center gap-1 font-semibold uppercase transition-all"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: '.05em',
                    color: isSectorHover ? GL.ink : GL.muted,
                    background: isSectorHover ? 'var(--jk-hover)' : 'transparent',
                    border: 0,
                    padding: '3px 7px',
                    borderRadius: 5,
                    cursor: status === 'online' ? 'pointer' : 'not-allowed',
                    opacity: status === 'online' ? 1 : 0.4
                  }}
                  title={`Chamar todos de ${sec.name}`}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2.5 7v2c0 .55.45 1 1 1h.5l2 3 .5-.5V4.5L6 4l-2 3h-.5c-.55 0-1 .45-1 1z"
                      fill="currentColor"
                    />
                    <path d="M8.5 4L13 2v12L8.5 12V4z" fill="currentColor" />
                    <path
                      d="M14 6c.55.45.95 1.15.95 2s-.4 1.55-.95 2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <span>Chamar {sectorTargets.length}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-0.5">
                {members.map((m) => {
                  const isHover = hover === m.id
                  const isActive = active.has(m.id)
                  const wasSent = justSent.has(m.id)
                  const ack = acks[m.id]
                  const isOnline = onlineUsers.has(m.id)
                  return (
                    <button
                      key={m.id}
                      onMouseEnter={() => setHover(m.id)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => knock(m)}
                      disabled={status !== 'online'}
                      className="relative flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: isHover || isActive ? 'rgba(0,0,0,.05)' : 'transparent',
                        border: 0,
                        cursor: status === 'online' ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar
                          member={m}
                          size={34}
                          className={isActive ? 'scale-95' : isHover ? 'scale-105' : ''}
                        />
                        {isActive && (
                          <>
                            <span
                              className="absolute rounded-full"
                              style={{
                                inset: -3,
                                border: '1.5px solid rgba(0,0,0,.45)',
                                animation: 'jk-ping 1s ease-out infinite'
                              }}
                            />
                            <span
                              className="absolute rounded-full"
                              style={{
                                inset: -3,
                                border: '1.5px solid rgba(0,0,0,.45)',
                                animation: 'jk-ping 1s ease-out 0.3s infinite'
                              }}
                            />
                          </>
                        )}
                        {(wasSent || ack) && (
                          <div
                            className="absolute flex items-center justify-center rounded-full"
                            style={{
                              bottom: -2,
                              right: -2,
                              width: 15,
                              height: 15,
                              background: ack ? '#0a84ff' : '#34c759',
                              boxShadow: '0 0 0 1.5px var(--jk-paper), 0 1px 2px rgba(0,0,0,.2)'
                            }}
                          >
                            <svg width="8" height="8" viewBox="0 0 9 9" fill="none">
                              <path
                                d="M1.5 4.5 L3.5 6.5 L7.5 2.5"
                                stroke="white"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div
                          className="font-medium"
                          style={{
                            fontSize: 13,
                            lineHeight: 1.2,
                            letterSpacing: '-.005em',
                            color: GL.ink
                          }}
                        >
                          {m.name}
                          {m.role === 'manager' && (
                            <span
                              className="uppercase"
                              style={{
                                fontSize: 8.5,
                                fontWeight: 700,
                                color: GL.faint,
                                letterSpacing: '.05em',
                                marginLeft: 5
                              }}
                            >
                              gerente
                            </span>
                          )}
                        </div>
                        <div
                          className="mt-px font-medium flex items-center gap-1"
                          style={{
                            fontSize: 10.5,
                            color: isActive
                              ? GL.ink
                              : ack
                                ? '#0a84ff'
                                : wasSent
                                  ? '#34c759'
                                  : GL.faint
                          }}
                        >
                          {!isActive && !ack && !wasSent && (
                            <span
                              className="inline-block rounded-full"
                              style={{
                                width: 5,
                                height: 5,
                                background: isOnline ? '#34c759' : 'transparent',
                                border: isOnline ? 'none' : `1px solid ${GL.faint}`
                              }}
                            />
                          )}
                          <span>
                            {isActive
                              ? 'chamando…'
                              : ack
                                ? 'tá indo ↗'
                                : wasSent
                                  ? 'enviado'
                                  : isOnline
                                    ? 'online'
                                    : 'offline'}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {!query && !hasAnyTarget && (
          <div
            className="text-center"
            style={{ padding: '28px 16px', fontSize: 11.5, color: GL.muted, lineHeight: 1.5 }}
          >
            {isManager
              ? `Ninguém do seu setor se cadastrou ainda. Assim que alguém entrar em ${visibleSectors[0]?.name ?? 'seu setor'}, aparece aqui.`
              : 'Ninguém se cadastrou ainda.'}
          </div>
        )}

        {query && !anyMatch && (
          <div
            className="text-center"
            style={{ padding: '24px 12px', fontSize: 11, color: GL.muted }}
          >
            Ninguém com esse nome.
          </div>
        )}
      </div>
    </Popover>
  )
}
