import { useState, useEffect } from 'react'
import {
  TeamMember,
  getStoredMeId,
  findMemberIn,
  clearStoredMeId,
  setStoredMeId
} from './lib/team'
import { useTeam } from './lib/useTeam'
import { useSystemTheme } from './lib/theme'
import { useAdminCommands } from './lib/admin'
import { UserSelect } from './components/UserSelect'
import { Sender } from './components/Sender'
import { Receiver } from './components/Receiver'
import { AlertOverlay } from './components/AlertOverlay'

function App() {
  useSystemTheme()
  const isAlertWindow = window.location.hash.startsWith('#alert')
  const { team, loading } = useTeam()
  const [meId, setMeId] = useState<string | null>(() => getStoredMeId())
  // Cache do membro acabado de cadastrar — evita race entre INSERT na DB e
  // Realtime postgres_changes chegar no team state.
  const [optimisticMember, setOptimisticMember] = useState<TeamMember | null>(null)

  const me: TeamMember | null = meId
    ? findMemberIn(team, meId) ?? (optimisticMember?.id === meId ? optimisticMember : null)
    : null

  // Limpeza só fira depois de 3s — dá tempo do subscribe Realtime atualizar o
  // team state. Sem isso, novo cadastro entra em loop infinito de re-cadastro.
  useEffect(() => {
    if (loading || !meId || me) return
    const timer = setTimeout(() => {
      console.warn(`[japknock] usuário ${meId} não encontrado na DB após 3s — limpando`)
      clearStoredMeId()
      setMeId(null)
      setOptimisticMember(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [loading, meId, me])

  useAdminCommands(isAlertWindow ? undefined : me?.id)

  if (isAlertWindow) return <AlertOverlay />
  if (loading) return null

  const handlePick = (m: TeamMember): void => {
    setOptimisticMember(m)
    setStoredMeId(m.id)
    setMeId(m.id)
  }

  if (!me) {
    return <UserSelect team={team} onPick={handlePick} />
  }

  if (me.role === 'sender') {
    return <Sender me={me} team={team} />
  }

  return <Receiver me={me} team={team} />
}

export default App
