import { useEffect, useState } from 'react'
import { TeamMember, fetchTeam, subscribeToTeamChanges } from './team'

// Hook que carrega o team da prod + escuta postgres_changes em tempo real.
// Toda vez que alguém se registra na equipe, o team atualiza pra todo mundo.
export function useTeam(): { team: TeamMember[]; loading: boolean } {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchTeam().then((t) => {
      if (cancelled) return
      setTeam(t)
      setLoading(false)
    })

    const ch = subscribeToTeamChanges((updated) => {
      setTeam(updated)
    })

    return () => {
      cancelled = true
      ch.unsubscribe()
    }
  }, [])

  return { team, loading }
}
