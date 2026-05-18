import { useState } from 'react'
import { TeamMember, getStoredMe } from './lib/team'
import { UserSelect } from './components/UserSelect'
import { Sender } from './components/Sender'
import { Receiver } from './components/Receiver'

function App() {
  const [me, setMe] = useState<TeamMember | null>(() => getStoredMe())

  if (!me) {
    return <UserSelect onPick={setMe} />
  }

  if (me.role === 'sender') {
    return <Sender me={me} onLogout={() => setMe(null)} />
  }

  return <Receiver me={me} onLogout={() => setMe(null)} />
}

export default App
