import { useEffect, useState } from 'react'
import { findMember } from '../lib/team'
import { Avatar } from './Avatar'
import { playKnock } from '../lib/sound'

function parseHashParams(): { from: string; fromName: string } {
  const hash = window.location.hash.replace(/^#alert\??/, '')
  const params = new URLSearchParams(hash)
  return {
    from: params.get('from') ?? 'helena',
    fromName: params.get('fromName') ?? 'Alguém'
  }
}

export function AlertOverlay() {
  const initial = parseHashParams()
  const [from, setFrom] = useState(initial.from)
  const [fromName, setFromName] = useState(initial.fromName)
  const [count, setCount] = useState(1)

  const member = findMember(from)

  // Loop sound until dismissed
  useEffect(() => {
    playKnock()
    const interval = setInterval(() => playKnock(), 1100)
    return () => clearInterval(interval)
  }, [])

  // ESC dismisses
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        window.api.dismissKnockAlert()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Subsequent knocks bump the counter
  useEffect(() => {
    const off = window.api.onKnockAgain((data) => {
      setFrom(data.from)
      setFromName(data.fromName)
      setCount((c) => c + 1)
      playKnock()
    })
    return off
  }, [])

  const dismiss = (): void => window.api.dismissKnockAlert()

  return (
    <div
      onClick={dismiss}
      className="fixed inset-0 flex items-center justify-center cursor-pointer"
      style={{
        background:
          'radial-gradient(circle at center, rgba(220, 38, 38, 0.55) 0%, rgba(0, 0, 0, 0.92) 80%)',
        animation: 'flash 1.2s ease-in-out infinite alternate'
      }}
    >
      <style>{`
        @keyframes flash {
          0%   { background: radial-gradient(circle at center, rgba(220, 38, 38, 0.55) 0%, rgba(0, 0, 0, 0.92) 80%); }
          100% { background: radial-gradient(circle at center, rgba(220, 38, 38, 0.25) 0%, rgba(0, 0, 0, 0.85) 80%); }
        }
        @keyframes shake-bell {
          0%, 100% { transform: rotate(-12deg); }
          50%      { transform: rotate(12deg); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.9; }
          70%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes scale-in {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center text-white px-12 py-10 rounded-3xl"
        style={{ animation: 'scale-in 0.35s cubic-bezier(.2,1.2,.4,1)' }}
      >
        <div className="relative mb-8">
          <div
            className="absolute inset-0 rounded-full bg-red-500"
            style={{ animation: 'pulse-ring 1.4s ease-out infinite' }}
          />
          <div
            className="absolute inset-0 rounded-full bg-red-500"
            style={{ animation: 'pulse-ring 1.4s ease-out infinite 0.4s' }}
          />
          {member ? (
            <div className="relative">
              <Avatar member={member} size={200} />
            </div>
          ) : (
            <div
              className="relative w-[200px] h-[200px] rounded-full bg-zinc-700 flex items-center justify-center text-7xl"
              style={{ animation: 'shake-bell 0.4s ease-in-out infinite' }}
            >
              🔔
            </div>
          )}
          <div
            className="absolute -top-4 -right-4 text-7xl"
            style={{
              animation: 'shake-bell 0.4s ease-in-out infinite',
              filter: 'drop-shadow(0 0 12px rgba(255, 200, 50, 0.9))'
            }}
          >
            🔔
          </div>
        </div>

        <div
          className="text-7xl font-black mb-3 tracking-tight text-center"
          style={{ textShadow: '0 4px 20px rgba(0,0,0,0.7)' }}
        >
          {fromName.toUpperCase()}
        </div>
        <div className="text-3xl text-zinc-200 mb-2 font-light">está te chamando</div>
        {count > 1 && (
          <div className="text-xl text-amber-300 font-bold mb-2">
            ({count}x — tá impaciente)
          </div>
        )}

        <button
          onClick={dismiss}
          className="mt-10 px-12 py-5 bg-emerald-500 hover:bg-emerald-400 text-white text-2xl font-bold rounded-full shadow-2xl transition-transform hover:scale-105 active:scale-95"
          style={{ boxShadow: '0 0 60px rgba(16, 185, 129, 0.6)' }}
        >
          Vou já! 🏃
        </button>
        <div className="mt-4 text-sm text-zinc-400">
          Aperta ESC, ENTER ou clica fora pra fechar
        </div>
      </div>
    </div>
  )
}
