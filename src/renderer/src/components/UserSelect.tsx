import { useState } from 'react'
import {
  SECTORS,
  SectorId,
  TeamMember,
  setStoredMeId,
  registerUser
} from '../lib/team'
import { GL } from '../lib/design'
import { Avatar } from './Avatar'
import { Popover } from './Popover'
import { KnockingHand } from './KnockingHand'

type Props = {
  team: TeamMember[]
  onPick: (m: TeamMember) => void
}

type View = 'list' | 'register'

export function UserSelect({ team, onPick }: Props) {
  const [view, setView] = useState<View>(team.length === 0 ? 'register' : 'list')
  const [hover, setHover] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [sector, setSector] = useState<SectorId>('inovacao')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePick = (m: TeamMember): void => {
    setStoredMeId(m.id)
    onPick(m)
  }

  const handleRegister = async (): Promise<void> => {
    if (!name.trim()) {
      setError('Digite seu nome')
      return
    }
    setSubmitting(true)
    setError(null)
    const created = await registerUser(name, sector)
    setSubmitting(false)
    if (!created) {
      setError('Erro ao registrar. Tenta de novo.')
      return
    }
    handlePick(created)
  }

  return (
    <Popover>
      <div className="px-4 py-3.5" style={{ borderBottom: '0.5px solid var(--jk-divider)' }}>
        <div className="flex items-center gap-2.5">
          <KnockingHand size={40} radius={26} />
          <div>
            <div className="font-bold" style={{ fontSize: 13, letterSpacing: '-.015em' }}>
              JAPKnock
            </div>
            <div className="font-medium" style={{ fontSize: 10, color: GL.muted, marginTop: 2 }}>
              {view === 'list' ? 'quem é você?' : 'novo aqui'}
            </div>
          </div>
        </div>
      </div>

      {view === 'list' ? (
        <>
          <div className="px-3 pt-3 pb-2" style={{ fontSize: 11, color: GL.muted }}>
            Escolha seu nome pra começar.
          </div>

          <div className="grid grid-cols-3 px-2 pb-2 gap-1">
            {team.map((m) => {
              const isHover = hover === m.id
              return (
                <button
                  key={m.id}
                  onMouseEnter={() => setHover(m.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => handlePick(m)}
                  className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-lg transition-colors"
                  style={{
                    background: isHover ? 'var(--jk-hover)' : 'transparent',
                    border: 0,
                    cursor: 'pointer'
                  }}
                >
                  <Avatar member={m} size={44} ring={isHover ? 'active' : 'subtle'} />
                  <span className="font-medium" style={{ fontSize: 12, color: GL.ink, marginTop: 2 }}>
                    {m.name}
                  </span>
                  {m.role === 'sender' && (
                    <span style={{ fontSize: 9.5, color: GL.faint, marginTop: -2 }}>diretora</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="px-3 pb-3">
            <button
              onClick={() => setView('register')}
              className="w-full text-center py-2 rounded-md transition-colors"
              style={{
                fontSize: 11.5,
                fontWeight: 500,
                color: GL.muted,
                background: 'transparent',
                border: '0.5px dashed var(--jk-divider)',
                cursor: 'pointer'
              }}
            >
              + Não tô na lista
            </button>
          </div>
        </>
      ) : (
        <div className="px-4 pt-3 pb-4">
          <label
            className="font-medium uppercase block"
            style={{ fontSize: 10, color: GL.muted, letterSpacing: '.04em', marginBottom: 6 }}
          >
            Seu nome
          </label>
          <input
            type="text"
            placeholder="ex: Ana Silva"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 rounded-md outline-none"
            style={{
              fontSize: 13,
              color: GL.ink,
              background: GL.inputBg,
              border: '0.5px solid var(--jk-input-border)'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRegister()
            }}
          />

          <label
            className="font-medium uppercase block"
            style={{
              fontSize: 10,
              color: GL.muted,
              letterSpacing: '.04em',
              marginBottom: 6,
              marginTop: 12
            }}
          >
            Setor
          </label>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value as SectorId)}
            className="w-full px-3 py-2 rounded-md outline-none"
            style={{
              fontSize: 13,
              color: GL.ink,
              background: GL.inputBg,
              border: '0.5px solid var(--jk-input-border)',
              appearance: 'auto'
            }}
          >
            {SECTORS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {error && (
            <div
              className="mt-2 font-medium"
              style={{ fontSize: 11, color: 'var(--jk-danger)' }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            {team.length > 0 && (
              <button
                onClick={() => setView('list')}
                className="flex-1 py-2.5 rounded-md font-medium transition-colors"
                style={{
                  fontSize: 12,
                  color: GL.muted,
                  background: 'transparent',
                  border: '0.5px solid var(--jk-divider)',
                  cursor: 'pointer'
                }}
              >
                Voltar
              </button>
            )}
            <button
              onClick={handleRegister}
              disabled={submitting || !name.trim()}
              className="flex-1 py-2.5 rounded-md font-semibold transition-opacity"
              style={{
                fontSize: 12.5,
                color: 'var(--jk-paper)',
                background: GL.ink,
                border: 0,
                cursor: submitting ? 'wait' : 'pointer',
                opacity: !name.trim() ? 0.4 : 1
              }}
            >
              {submitting ? 'Cadastrando…' : 'Entrar no JapKnock'}
            </button>
          </div>
        </div>
      )}
    </Popover>
  )
}
