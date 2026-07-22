import { useEffect } from 'react'
import { subscribeToCommands, markCommandExecuted, AdminCommand } from './supabase'

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
    // O tick imediato do polling já cobre comandos emitidos com o app offline.
    // Marca executado ANTES de despachar: kill/restart derrubam o app e o
    // comando não pode voltar a rodar no próximo boot.
    const ch = subscribeToCommands(userId, async (cmd) => {
      console.log('[japknock] executing command', cmd.command, cmd.id)
      await markCommandExecuted(cmd.id)
      dispatch(cmd.command)
    })
    return () => ch.unsubscribe()
  }, [userId])
}
