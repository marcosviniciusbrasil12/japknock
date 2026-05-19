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

export type AckPayload = {
  // O receiver (quem recebeu o knock) reconhece pra o sender
  knocker: string // ID de quem chamou (Helena)
  by: string // ID de quem reconheceu (Marcos)
  ts: number
}

export type ChannelCallbacks = {
  onKnock: (payload: KnockPayload) => void
  onAck: (payload: AckPayload) => void
  onStatus: (status: 'online' | 'connecting' | 'offline') => void
}

// Backoff: 2s, 5s, 10s, 30s, 60s, 60s, 60s...
const BACKOFF_MS = [2000, 5000, 10000, 30000, 60000]

class ResilientChannel {
  private channel: RealtimeChannel | null = null
  private retryCount = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private cancelled = false

  constructor(private cb: ChannelCallbacks) {}

  start(): void {
    this.cancelled = false
    this.connect()
  }

  unsubscribe(): void {
    this.cancelled = true
    if (this.retryTimer) clearTimeout(this.retryTimer)
    if (this.channel) this.channel.unsubscribe()
  }

  async sendKnock(to: string, from: string): Promise<void> {
    if (!this.channel) throw new Error('Channel not ready')
    await this.channel.send({
      type: 'broadcast',
      event: 'knock',
      payload: { to, from, ts: Date.now() } satisfies KnockPayload
    })
  }

  async sendAck(knocker: string, by: string): Promise<void> {
    if (!this.channel) throw new Error('Channel not ready')
    await this.channel.send({
      type: 'broadcast',
      event: 'ack',
      payload: { knocker, by, ts: Date.now() } satisfies AckPayload
    })
  }

  private connect(): void {
    if (this.cancelled) return
    this.cb.onStatus('connecting')
    const ch = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } }
    })
    ch.on('broadcast', { event: 'knock' }, ({ payload }) => {
      this.cb.onKnock(payload as KnockPayload)
    })
    ch.on('broadcast', { event: 'ack' }, ({ payload }) => {
      this.cb.onAck(payload as AckPayload)
    })
    ch.subscribe((status, err) => {
      console.log('[japknock] status:', status, err ? `err=${err.message}` : '')
      if (status === 'SUBSCRIBED') {
        this.retryCount = 0
        this.cb.onStatus('online')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this.cb.onStatus('offline')
        if (this.channel === ch) this.scheduleRetry()
      }
    })
    this.channel = ch
  }

  private scheduleRetry(): void {
    if (this.cancelled) return
    const delay = BACKOFF_MS[Math.min(this.retryCount, BACKOFF_MS.length - 1)]
    this.retryCount++
    console.log(`[japknock] retry in ${delay}ms (attempt ${this.retryCount})`)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => {
      if (this.channel) {
        try {
          this.channel.unsubscribe()
        } catch {
          /* ignore */
        }
      }
      this.connect()
    }, delay)
  }
}

export const joinKnockChannel = (cb: ChannelCallbacks): ResilientChannel => {
  const r = new ResilientChannel(cb)
  r.start()
  return r
}
