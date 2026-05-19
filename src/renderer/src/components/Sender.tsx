import { useEffect, useRef, useState } from 'react'
import { SECTORS, TeamMember, clearStoredMe, membersOfSector, findMember } from '../lib/team'
import { joinKnockChannel } from '../lib/supabase'
import { playSent } from '../lib/sound'
import { GL } from '../lib/design'
import { Avatar } from './Avatar'
import { Popover } from './Popover'
import { PopoverHeader } from './PopoverHeader'
import { SearchBar } from './SearchBar'

type Props = {
  me: TeamMember
  onLogout: () => void
}

type ConnStatus = 'online' | 'connecting' | 'offline'

type AckInfo = { byId: string; byName: string; ts: number }

const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const DEBOUNCE_MS = 1500

export function Sender({ me, onLogout }: Props) {
  const channelRef = useRef<ReturnType<typeof joinKnockChannel> | null>(null)
  const lastKnockAt = useRef<Record<string, number>>({})
  const [hover, setHover] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [justSent, setJustSent] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ConnStatus>('connecting')
  const [acks, setAcks] = useState<Record<string, AckInfo>>({})

  useEffect(() => {
    const channel = joinKnockChannel({
      onKnock: () => {
        /* Helena não recebe knocks */
      },
      onAck: (payload) => {
        const m = findMember(payload.by)
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

    setActive(target.id)
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
      setActive(null)
      setJustSent(target.id)
      setTimeout(() => setJustSent(null), 1400)
    }, 900)
  }

  const handleLogout = (): void => {
    clearStoredMe()
    onLogout()
  }

  const matchesQuery = (m: TeamMember): boolean =>
    !query || norm(m.name).includes(norm(query))

  const anyMatch = SECTORS.some((s) => membersOfSector(s.id).filter(matchesQuery).length > 0)

  return (
    <Popover>
      <PopoverHeader
        me={me}
        status={status}
        subtitle={status === 'online' ? 'online · transmissão ativa' : undefined}
        onLogout={handleLogout}
      />

      <SearchBar value={query} onChange={setQuery} />

      <div className="px-2.5 pb-2.5 max-h-[520px] overflow-y-auto">
        {SECTORS.map((sec) => {
          const members = membersOfSector(sec.id).filter(matchesQuery)
          if (query && members.length === 0) return null

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
                <span
                  className="font-medium uppercase"
                  style={{
                    fontSize: 10,
                    color: GL.faint,
                    letterSpacing: '.04em'
                  }}
                >
                  {membersOfSector(sec.id).length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-0.5">
                {members.map((m) => {
                  const isHover = hover === m.id
                  const isActive = active === m.id
                  const wasSent = justSent === m.id
                  const ack = acks[m.id]
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
                          className="mt-px font-medium"
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
                          {isActive
                            ? 'chamando…'
                            : ack
                              ? 'tá indo ↗'
                              : wasSent
                                ? 'enviado'
                                : 'online'}
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
