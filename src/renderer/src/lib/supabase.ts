import { createClient, RealtimeChannel } from '@supabase/supabase-js'

// Supabase de PRODUÇÃO do JAPHub (migrado de dev em v1.0.1)
const SUPABASE_URL = 'https://fokqgkurdshfygfjntxd.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZva3Fna3VyZHNoZnlnZmpudHhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1OTg3NzMsImV4cCI6MjA4MDE3NDc3M30.2y4zA1zovJnLiaO6xv8VkeGBqCYcd1HZqAIYjEsTRAM'

const CHANNEL_NAME = 'wall-knock'
const KNOCKS_TABLE = 'japknock_knocks'
const COMMANDS_TABLE = 'japknock_commands'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 5 } }
})

export type KnockPayload = {
  to: string
  from: string
  ts: number
  knockId?: string // uuid da row em japknock_knocks (pra ack atualizar a row certa)
}

export type AckPayload = {
  knocker: string
  by: string
  ts: number
  knockId?: string
}

export type HistoryEntry = {
  id: string
  from_user: string
  to_user: string
  ts: string
  acked_at: string | null
}

export type ChannelCallbacks = {
  onKnock: (payload: KnockPayload) => void
  onAck: (payload: AckPayload) => void
  onStatus: (status: 'online' | 'connecting' | 'offline') => void
}

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

  // Persiste no banco + manda broadcast (instant + history)
  async sendKnock(to: string, from: string): Promise<string | null> {
    let knockId: string | null = null
    try {
      const { data, error } = await supabase
        .from(KNOCKS_TABLE)
        .insert({ from_user: from, to_user: to })
        .select('id')
        .single()
      if (error) console.error('Failed to persist knock', error)
      else knockId = data?.id ?? null
    } catch (e) {
      console.error('DB insert exception', e)
    }
    if (!this.channel) throw new Error('Channel not ready')
    await this.channel.send({
      type: 'broadcast',
      event: 'knock',
      payload: { to, from, ts: Date.now(), knockId: knockId ?? undefined } satisfies KnockPayload
    })
    return knockId
  }

  // Marca knock como acked no banco + broadcast pra UI do sender atualizar
  async sendAck(knocker: string, by: string, knockId?: string): Promise<void> {
    if (knockId) {
      try {
        const { error } = await supabase
          .from(KNOCKS_TABLE)
          .update({ acked_at: new Date().toISOString() })
          .eq('id', knockId)
        if (error) console.error('Failed to mark ack in DB', error)
      } catch (e) {
        console.error('DB update exception', e)
      }
    }
    if (!this.channel) throw new Error('Channel not ready')
    await this.channel.send({
      type: 'broadcast',
      event: 'ack',
      payload: { knocker, by, ts: Date.now(), knockId } satisfies AckPayload
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

// === Admin remote commands ===

export type AdminCommand = 'kill' | 'restart' | 'clear_alert' | 'update_now'

export type CommandRow = {
  id: string
  target_user: string
  command: AdminCommand
  created_at: string
  executed_at: string | null
}

// Pega comandos não-executados pendentes pro usuário (na primeira abertura,
// caso o app tenha ficado offline quando o admin emitiu).
export const fetchPendingCommands = async (userId: string): Promise<CommandRow[]> => {
  const { data, error } = await supabase
    .from(COMMANDS_TABLE)
    .select('id, target_user, command, created_at, executed_at')
    .or(`target_user.eq.${userId},target_user.eq.all`)
    .is('executed_at', null)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('fetchPendingCommands failed', error)
    return []
  }
  return data ?? []
}

export const markCommandExecuted = async (id: string): Promise<void> => {
  await supabase.from(COMMANDS_TABLE).update({ executed_at: new Date().toISOString() }).eq('id', id)
}

// Subscribe a postgres_changes da tabela de comandos — Marcos insere uma row, app recebe.
export const subscribeToCommands = (
  userId: string,
  onCommand: (cmd: CommandRow) => void
): RealtimeChannel => {
  const ch = supabase
    .channel(`admin-commands-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: COMMANDS_TABLE
      },
      (payload) => {
        const row = payload.new as CommandRow
        if (row.target_user === userId || row.target_user === 'all') {
          onCommand(row)
        }
      }
    )
    .subscribe()
  return ch
}

// Histórico dos últimos N knocks recebidos por um usuário
export const fetchRecentKnocksTo = async (
  userId: string,
  limit = 10
): Promise<HistoryEntry[]> => {
  const { data, error } = await supabase
    .from(KNOCKS_TABLE)
    .select('id, from_user, to_user, ts, acked_at')
    .eq('to_user', userId)
    .order('ts', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('fetchRecentKnocksTo failed', error)
    return []
  }
  return data ?? []
}
