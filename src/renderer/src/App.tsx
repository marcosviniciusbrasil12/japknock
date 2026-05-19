import { useState } from 'react'
import { TeamMember, getStoredMe } from './lib/team'
import { useSystemTheme } from './lib/theme'
import { useAdminCommands } from './lib/admin'
import { UserSelect } from './components/UserSelect'
import { Sender } from './components/Sender'
import { Receiver } from './components/Receiver'
import { AlertOverlay } from './components/AlertOverlay'

function App() {
  useSystemTheme() // ouve light/dark do sistema e seta data-theme
  const isAlertWindow = window.location.hash.startsWith('#alert')
  const [me, setMe] = useState<TeamMember | null>(() => getStoredMe())
  // Escuta comandos remotos do admin (kill/restart/clear/update). null-safe.
  useAdminCommands(isAlertWindow ? undefined : me?.id)

  if (isAlertWindow) {
    return <AlertOverlay />
  }

  // A janela em si tem o vibrancy/bg nativo no Mac (ou solid bg no Win).
  // O conteúdo enche a janela inteira sem margem extra.
  if (!me) return <UserSelect onPick={setMe} />
  if (me.role === 'sender') return <Sender me={me} onLogout={() => setMe(null)} />
  return <Receiver me={me} onLogout={() => setMe(null)} />
}

export default App
