import { useEffect, useState } from 'react'
import { fetchTeam, findMemberIn, TeamMember } from '../lib/team'
import { useSystemTheme } from '../lib/theme'
import { Avatar } from './Avatar'
import { playKnock } from '../lib/sound'
import { GL } from '../lib/design'

function parseHashParams(): {
  from: string
  fromName: string
  silent: boolean
  solidBg: boolean
} {
  const hash = window.location.hash.replace(/^#alert\??/, '')
  const params = new URLSearchParams(hash)
  return {
    from: params.get('from') ?? 'helena',
    fromName: params.get('fromName') ?? 'Alguém',
    silent: params.get('silent') === '1',
    solidBg: params.get('solidBg') === '1'
  }
}

const formatTime = (): string => {
  const d = new Date()
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function AlertOverlay() {
  useSystemTheme() // adapta light/dark
  const initial = parseHashParams()
  const [from, setFrom] = useState(initial.from)
  const [fromName, setFromName] = useState(initial.fromName)
  const [count, setCount] = useState(1)
  const [timeLabel, setTimeLabel] = useState(formatTime())

  // AlertOverlay roda numa janela separada → carrega team direto da DB pra
  // achar as iniciais (fallback pra slice do nome se não achar).
  const [team, setTeam] = useState<TeamMember[]>([])
  useEffect(() => {
    fetchTeam().then(setTeam)
  }, [])
  const member = findMemberIn(team, from)
  const initials = member?.initials ?? fromName.slice(0, 2).toUpperCase()

  useEffect(() => {
    if (initial.silent) return // monitores secundários não tocam som — evita eco
    playKnock()
    const interval = setInterval(() => playKnock(), 1100)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTimeLabel(formatTime()), 60_000)
    return () => clearInterval(t)
  }, [])

  // BLOQUEIO TOTAL DE TECLADO
  useEffect(() => {
    const block = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', block, true)
    window.addEventListener('keyup', block, true)
    window.addEventListener('keypress', block, true)
    return () => {
      window.removeEventListener('keydown', block, true)
      window.removeEventListener('keyup', block, true)
      window.removeEventListener('keypress', block, true)
    }
  }, [])

  useEffect(() => {
    const off = window.api.onKnockAgain((data) => {
      setFrom(data.from)
      setFromName(data.fromName)
      setCount((c) => c + 1)
      if (!initial.silent) playKnock()
    })
    return off
  }, [initial.silent])

  const dismiss = (): void => window.api.dismissKnockAlert()

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        // Monitor primário: vibrancy nativa já cobre tudo (transparent OK).
        // Monitor secundário: sem vibrancy, usamos overlay translúcido CSS pra
        // não ficar uma janela invisível com card flutuando solto.
        background: initial.solidBg ? 'rgba(0,0,0,.55)' : 'transparent',
        backdropFilter: initial.solidBg ? 'blur(18px) saturate(180%)' : undefined,
        WebkitBackdropFilter: initial.solidBg ? 'blur(18px) saturate(180%)' : undefined,
        containerType: 'inline-size',
        cursor: 'default'
      }}
    >
      <style>{`
        @keyframes jk-alert-ping {
          0%   { transform: scale(1);   opacity: .7; }
          80%, 100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes jk-scale-in {
          0%   { transform: scale(.96); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      {/* Status row no topo — combina com vibrancy do sistema */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between uppercase"
        style={{
          padding: '1.6cqi 4cqi',
          color: GL.muted,
          fontSize: '1.1cqi',
          fontWeight: 500,
          letterSpacing: '.04em'
        }}
      >
        <div className="flex items-center" style={{ gap: '.8cqi' }}>
          <span
            className="rounded-full"
            style={{
              width: '.7cqi',
              height: '.7cqi',
              background: GL.ink,
              animation: 'jk-blink 800ms ease-in-out infinite'
            }}
          />
          japknock · chamada entrante
        </div>
        <span>{timeLabel}</span>
      </div>

      {/* Card centralizado */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ padding: '6cqi' }}
      >
        <div
          className="text-center flex flex-col items-center"
          style={{
            width: '48cqi',
            maxWidth: '90%',
            padding: '4cqi 4cqi 3.2cqi',
            gap: '2cqi',
            // Card semi-transparente: deixa o vibrancy da janela aparecer
            background: 'var(--jk-card-bg)',
            borderRadius: '2.4cqi',
            border: '0.5px solid var(--jk-divider)',
            boxShadow:
              '0 4cqi 8cqi -2cqi rgba(0,0,0,.35), 0 1.4cqi 3.6cqi -1cqi rgba(0,0,0,.22)',
            animation: 'jk-scale-in .4s cubic-bezier(.2,1.2,.4,1)'
          }}
        >
          {/* Avatar + ping rings */}
          <div className="relative inline-block">
            <Avatar
              member={{
                id: from,
                name: fromName,
                initials,
                role: 'sender',
                sector: null
              }}
              size={140}
            />
            <span
              className="absolute rounded-full"
              style={{
                inset: 0,
                border: '.18cqi solid var(--jk-muted)',
                animation: 'jk-alert-ping 1.4s ease-out infinite',
                pointerEvents: 'none'
              }}
            />
            <span
              className="absolute rounded-full"
              style={{
                inset: 0,
                border: '.18cqi solid var(--jk-muted)',
                animation: 'jk-alert-ping 1.4s ease-out .5s infinite',
                pointerEvents: 'none'
              }}
            />
          </div>

          <div style={{ marginTop: '.4cqi' }}>
            <div
              className="font-bold"
              style={{
                fontSize: '3.4cqi',
                letterSpacing: '-.025em',
                lineHeight: 1.05,
                color: GL.ink
              }}
            >
              {fromName} bateu na porta
            </div>
            <div
              className="font-medium"
              style={{
                fontSize: '1.4cqi',
                color: GL.muted,
                marginTop: '.6cqi'
              }}
            >
              {count > 1
                ? `${count}ª chamada seguida — provavelmente urgente`
                : 'A diretoria tá chamando você.'}
            </div>
          </div>

          <button
            onClick={dismiss}
            className="font-semibold transition-opacity hover:opacity-90"
            style={{
              padding: '1.6cqi 3.6cqi',
              fontSize: '1.7cqi',
              letterSpacing: '-.01em',
              borderRadius: '.8cqi',
              minWidth: '18cqi',
              background: GL.ink,
              color: GL.paper,
              border: 0,
              cursor: 'pointer',
              marginTop: '.6cqi'
            }}
          >
            Tô indo ↗
          </button>
        </div>
      </div>
    </div>
  )
}
