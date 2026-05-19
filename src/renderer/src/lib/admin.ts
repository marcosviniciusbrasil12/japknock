import { useEffect } from 'react'
import {
  subscribeToCommands,
  fetchPendingCommands,
  markCommandExecuted,
  AdminCommand
} from './supabase'

const dispatch = (cmd: AdminCommand): void => {
  switch (cmd) {
    case 'kill':
      window.api.adminKill()
      break
    case 'restart':
      window.api.adminRestart()
      break
    case 'clear_alert':
      window.api.dismissKnockAlert()
      break
    case 'update_now':
      window.api.adminCheckUpdate()
      break
  }
}

export function useAdminCommands(userId: string | undefined): void {
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    // Pega comandos pendentes que possam ter sido emitidos enquanto offline
    fetchPendingCommands(userId).then(async (rows) => {
      if (cancelled) return
      for (const row of rows) {
        console.log('[japknock] executing pending command', row.command, row.id)
        await markCommandExecuted(row.id)
        dispatch(row.command)
      }
    })

    // Subscribe a inserts em tempo real
    const ch = subscribeToCommands(userId, async (cmd) => {
      console.log('[japknock] received command', cmd.command, cmd.id)
      await markCommandExecuted(cmd.id)
      dispatch(cmd.command)
    })

    return () => {
      cancelled = true
      ch.unsubscribe()
    }
  }, [userId])
}
