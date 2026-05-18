import { createClient, RealtimeChannel } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tnssxlgwebhppkujqnwb.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc3N4bGd3ZWJocHBrdWpxbndiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MzczMTUsImV4cCI6MjA3ODAxMzMxNX0.PQKRBNEwXcmOm8nr3yUadmNCfjMHUZnuLEN4coUpLlg'

const CHANNEL_NAME = 'wall-knock'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 5 } }
})

export type KnockPayload = {
  to: string
  from: string
  ts: number
}

export const joinKnockChannel = (
  onKnock: (payload: KnockPayload) => void,
  onStatus: (status: string) => void
): RealtimeChannel => {
  const channel = supabase.channel(CHANNEL_NAME, {
    config: { broadcast: { self: false } }
  })
  channel.on('broadcast', { event: 'knock' }, ({ payload }) => {
    onKnock(payload as KnockPayload)
  })
  console.log('[japknock] connecting to', SUPABASE_URL, 'channel', CHANNEL_NAME)
  channel.subscribe((status, err) => {
    console.log('[japknock] status:', status, err ? `err=${err.message}` : '')
    if (err) console.error('Realtime error', err)
    onStatus(status)
  })
  return channel
}

export const sendKnock = async (
  channel: RealtimeChannel,
  to: string,
  from: string
): Promise<void> => {
  await channel.send({
    type: 'broadcast',
    event: 'knock',
    payload: { to, from, ts: Date.now() } satisfies KnockPayload
  })
}
