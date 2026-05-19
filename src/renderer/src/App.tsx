import { useState, useEffect } from 'react'
import {
  TeamMember,
  getStoredMeId,
  findMemberIn,
  clearStoredMeId
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

  // Sincroniza `me` com mudanças no team (alguém pode ter sido renomeado/movido)
  const me: TeamMember | null = meId ? findMemberIn(team, meId) ?? null : null

  // Se a pessoa tinha um meId salvo MAS não existe mais na DB (caso o registro
  // tenha sido apagado), limpa pra forçar re-cadastro.
  useEffect(() => {
    if (!loading && meId && !me) {
      console.warn(`[japknock] usuário ${meId} não existe mais na DB, limpando`)
      clearStoredMeId()
      setMeId(null)
    }
  }, [loading, meId, me])

  useAdminCommands(isAlertWindow ? undefined : me?.id)

  if (isAlertWindow) return <AlertOverlay />

  if (loading) return null // skeleton implícito: janela vazia até carregar (~200ms)

  if (!me) {
    return (
      <UserSelect
        team={team}
        onPick={(m) => {
          setMeId(m.id)
        }}
      />
    )
  }

  if (me.role === 'sender') {
    return <Sender me={me} team={team} />
  }

  return <Receiver me={me} team={team} />
}

export default App
