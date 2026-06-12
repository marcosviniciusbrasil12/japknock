import { useState, useEffect } from 'react'
import { TeamMember, getStoredMeId, findMemberIn, clearStoredMeId, setStoredMeId } from './lib/team'
import { useTeam } from './lib/useTeam'
import { useSystemTheme } from './lib/theme'
import { useAdminCommands } from './lib/admin'
import { UserSelect } from './components/UserSelect'
import { Sender } from './components/Sender'
import { Receiver } from './components/Receiver'
import { AlertOverlay } from './components/AlertOverlay'
import { Popover } from './components/Popover'
import { KnockingHand } from './components/KnockingHand'
import { GL } from './lib/design'

// Identidade salva mas ainda sem resposta da DB (ex: boot antes do Wi-Fi).
// Mantém a identidade e espera — a subscription resiliente reconecta sozinha.
function Reconnecting() {
  return (
    <Popover>
      <div className="flex flex-col items-center text-center" style={{ padding: '40px 24px' }}>
        <KnockingHand size={48} radius={30} />
        <div
          className="font-bold"
          style={{ fontSize: 15, marginTop: 14, letterSpacing: '-.015em' }}
        >
          Sem conexão
        </div>
        <div style={{ fontSize: 11.5, color: GL.muted, marginTop: 4, lineHeight: 1.4 }}>
          Esperando a internet voltar.
          <br />O JapKnock reconecta sozinho.
        </div>
      </div>
    </Popover>
  )
}

function App() {
  useSystemTheme()
  const isAlertWindow = window.location.hash.startsWith('#alert')
  const { team, loading, synced } = useTeam()
  const [meId, setMeId] = useState<string | null>(() => getStoredMeId())
  // Cache do membro acabado de cadastrar — evita race entre INSERT na DB e
  // Realtime postgres_changes chegar no team state.
  const [optimisticMember, setOptimisticMember] = useState<TeamMember | null>(null)

  const me: TeamMember | null = meId
    ? (findMemberIn(team, meId) ?? (optimisticMember?.id === meId ? optimisticMember : null))
    : null

  // Limpeza DESTRUTIVA (apaga identidade local): só quando a DB respondeu de
  // verdade (synced) e o usuário realmente não existe mais — ex: deletado pelo
  // admin. Sem o guard de synced, um boot offline (fetch falha → team vazio)
  // apagava a identidade em 3s e a máquina ficava surda até recadastrar.
  // O delay de 3s dá tempo do subscribe Realtime atualizar o team state após
  // um cadastro novo (evita loop de re-cadastro).
  useEffect(() => {
    if (loading || !synced || !meId || me) return
    const timer = setTimeout(() => {
      console.warn(`[japknock] usuário ${meId} não encontrado na DB após 3s — limpando`)
      clearStoredMeId()
      setMeId(null)
      setOptimisticMember(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [loading, synced, meId, me])

  useAdminCommands(isAlertWindow ? undefined : me?.id)

  if (isAlertWindow) return <AlertOverlay />
  if (loading) return null

  const handlePick = (m: TeamMember): void => {
    setOptimisticMember(m)
    setStoredMeId(m.id)
    setMeId(m.id)
  }

  if (!me) {
    // Tem identidade salva mas a DB ainda não respondeu nesta sessão: NÃO cair
    // no cadastro (geraria duplicata tipo "ana-2") — mostra estado de espera.
    if (meId && !synced) return <Reconnecting />
    return <UserSelect team={team} onPick={handlePick} />
  }

  if (me.role === 'sender') {
    return <Sender me={me} team={team} />
  }

  return <Receiver me={me} team={team} />
}

export default App
