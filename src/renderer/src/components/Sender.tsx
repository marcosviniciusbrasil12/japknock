import { useEffect, useRef, useState } from 'react'
import {
  SECTORS,
  SectorId,
  TeamMember,
  membersOfSectorIn,
  findMemberIn
} from '../lib/team'
import { joinKnockChannel } from '../lib/supabase'
import { usePresence } from '../lib/presence'
import { playSent } from '../lib/sound'
import { GL } from '../lib/design'
import { Avatar } from './Avatar'
import { Popover } from './Popover'
import { PopoverHeader } from './PopoverHeader'
import { SearchBar } from './SearchBar'

type Props = {
  me: TeamMember
  team: TeamMember[]
}

type ConnStatus = 'online' | 'connecting' | 'offline'

type AckInfo = { byId: string; byName: string; ts: number }

const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const DEBOUNCE_MS = 1500

export function Sender({ me, team }: Props) {
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
      onKnock: () => {
        /* Helena não recebe knocks */
      },
      onAck: (payload) => {
        const m = findMemberIn(team, payload.by)
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

    const members = membersOfSectorIn(team, sectorId)
    members.forEach((m, i) => {
      setTimeout(() => knock(m), i * 80)
    })
  }


  const matchesQuery = (m: TeamMember): boolean =>
    !query || norm(m.name).includes(norm(query))

  const anyMatch = SECTORS.some(
    (s) => membersOfSectorIn(team, s.id).filter(matchesQuery).length > 0
  )

  return (
    <Popover>
      <PopoverHeader
        me={me}
        status={status}
        subtitle={status === 'online' ? 'online · transmissão ativa' : undefined}
      />

      <SearchBar value={query} onChange={setQuery} />

      <div className="px-2.5 pb-2.5 max-h-[520px] overflow-y-auto">
        {SECTORS.map((sec) => {
          const members = membersOfSectorIn(team, sec.id).filter(matchesQuery)
          // Esconde setor vazio (a não ser que seja busca ativa, pra dar feedback)
          if (members.length === 0 && !query) return null
          if (query && members.length === 0) return null

          const sectorMembers = membersOfSectorIn(team, sec.id)
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
                <span className="flex-1 h-px" style={{ background: 'var(--gl-divider)' }} />
                <button
                  onClick={() => knockSector(sec.id)}
                  onMouseEnter={() => setHoverSector(sec.id)}
                  onMouseLeave={() => setHoverSector(null)}
                  disabled={status !== 'online' || sectorMembers.length === 0}
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
                    <path
                      d="M8.5 4L13 2v12L8.5 12V4z"
                      fill="currentColor"
                    />
                    <path
                      d="M14 6c.55.45.95 1.15.95 2s-.4 1.55-.95 2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <span>Chamar {sectorMembers.length}</span>
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
                        background:
                          isHover || isActive ? 'rgba(0,0,0,.05)' : 'transparent',
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
                              boxShadow:
                                '0 0 0 1.5px var(--gl-paper-solid), 0 1px 2px rgba(0,0,0,.2)'
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
