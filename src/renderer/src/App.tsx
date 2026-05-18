import { useState } from 'react'
import { TeamMember, getStoredMe } from './lib/team'
import { UserSelect } from './components/UserSelect'
import { Sender } from './components/Sender'
import { Receiver } from './components/Receiver'
import { AlertOverlay } from './components/AlertOverlay'

function App() {
  const isAlertWindow = window.location.hash.startsWith('#alert')
  const [me, setMe] = useState<TeamMember | null>(() => getStoredMe())

  if (isAlertWindow) {
    return <AlertOverlay />
  }

  if (!me) {
    return <UserSelect onPick={setMe} />
  }

  if (me.role === 'sender') {
    return <Sender me={me} onLogout={() => setMe(null)} />
  }

  return <Receiver me={me} onLogout={() => setMe(null)} />
}

export default App
