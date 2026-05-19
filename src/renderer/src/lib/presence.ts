import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Hook que mantém o usuário 'me' presente num canal Supabase Realtime e
// retorna o set de user_ids atualmente online. Ao desconectar (PC desligou,
// app fechou, internet caiu), Supabase remove a presença em ~30s.
export function usePresence(meId: string | undefined): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!meId) {
      setOnline(new Set())
      return
    }

    const channel = supabase.channel('japknock-presence', {
      config: { presence: { key: meId } }
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      setOnline(new Set(Object.keys(state)))
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: meId, online_at: new Date().toISOString() })
      }
    })

    return () => {
      channel.unsubscribe()
    }
  }, [meId])

  return online
}
