import { useEffect, useState } from 'react'
import { TeamMember, fetchTeam, subscribeToTeamChanges } from './team'
import { backoffDelay } from './backoff'

// Hook que carrega o team da prod + escuta postgres_changes em tempo real.
// Toda vez que alguém se registra na equipe, o team atualiza pra todo mundo.
// `synced` = já tivemos PELO MENOS UMA resposta real da DB nesta sessão.
// Enquanto synced=false, `team` vazio significa "sem rede", não "equipe vazia"
// — decisões destrutivas (ex: apagar identidade local) exigem synced=true.
export function useTeam(): { team: TeamMember[]; loading: boolean; synced: boolean } {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    let cancelled = false
    let done = false
    let retryCount = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    // Re-tenta com backoff até a primeira resposta real. Cobre o caso em que o
    // REST falha com o websocket saudável — aí o onSubscribed da subscription
    // não re-dispara e, sem este loop, ficaríamos presos em "Sem conexão".
    // [] também é tratado como não-confiável (RLS negando SELECT devolve 200
    // vazio, sem error): em produção a equipe nunca é vazia (helena é seed).
    const attempt = (): void => {
      fetchTeam().then((t) => {
        if (cancelled || done) return
        if (t && t.length > 0) {
          done = true
          setTeam(t)
          setSynced(true)
          setLoading(false)
          return
        }
        setLoading(false)
        timer = setTimeout(attempt, backoffDelay(retryCount++))
      })
    }
    attempt()

    // A subscription é resiliente (backoff + catch-up no reconnect) e é o
    // caminho normal de recuperação quando a rede volta.
    const ch = subscribeToTeamChanges((updated) => {
      done = true
      setTeam(updated)
      setSynced(true)
    })

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      ch.unsubscribe()
    }
  }, [])

  return { team, loading, synced }
}
