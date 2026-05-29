import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mocka o SDK pra importar supabase.ts sem rede. ResilientSubscription não usa
// o client diretamente (recebe um `build` factory), então um stub vazio basta.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
  RealtimeChannel: class {}
}))

import { ResilientSubscription } from './supabase'

type SubCb = (status: string, err?: { message: string }) => void

// Canal falso: guarda o callback do subscribe pra dispararmos manualmente
// (o supabase real chama de forma assíncrona, então não invocamos aqui).
function makeFakeChannel(): { subscribe: (cb: SubCb) => unknown; unsubscribe: () => void; fire: SubCb } {
  let cb: SubCb = () => {}
  return {
    subscribe(c: SubCb) {
      cb = c
      return this
    },
    unsubscribe: vi.fn(),
    fire: (status, err) => cb(status, err)
  }
}

describe('ResilientSubscription', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reconecta com backoff quando a conexão cai', () => {
    const channels: ReturnType<typeof makeFakeChannel>[] = []
    const build = (): never => {
      const ch = makeFakeChannel()
      channels.push(ch)
      return ch as never
    }
    const sub = new ResilientSubscription({ label: 'test', build }).start()

    expect(channels).toHaveLength(1) // conectou uma vez

    channels[0].fire('CHANNEL_ERROR') // caiu
    expect(channels).toHaveLength(1) // ainda não reconectou (esperando backoff)

    vi.advanceTimersByTime(2000) // backoffDelay(0)
    expect(channels).toHaveLength(2) // reconectou
    expect(channels[0].unsubscribe).toHaveBeenCalled() // limpou o canal antigo

    sub.unsubscribe()
  })

  it('reseta o backoff após reconectar com sucesso', () => {
    const channels: ReturnType<typeof makeFakeChannel>[] = []
    const build = (): never => {
      const ch = makeFakeChannel()
      channels.push(ch)
      return ch as never
    }
    new ResilientSubscription({ label: 'test', build }).start()

    channels[0].fire('CHANNEL_ERROR')
    vi.advanceTimersByTime(2000)
    expect(channels).toHaveLength(2)

    channels[1].fire('SUBSCRIBED') // reconectou de fato → reseta retryCount
    channels[1].fire('CHANNEL_ERROR') // caiu de novo
    vi.advanceTimersByTime(2000) // deve usar backoffDelay(0)=2000 de novo, não escalar
    expect(channels).toHaveLength(3)
  })

  it('chama onSubscribed a cada conexão (catch-up de cadastros perdidos)', () => {
    const onSubscribed = vi.fn()
    const channels: ReturnType<typeof makeFakeChannel>[] = []
    const build = (): never => {
      const ch = makeFakeChannel()
      channels.push(ch)
      return ch as never
    }
    new ResilientSubscription({ label: 'test', build, onSubscribed }).start()

    channels[0].fire('SUBSCRIBED')
    expect(onSubscribed).toHaveBeenCalledTimes(1)

    channels[0].fire('CHANNEL_ERROR')
    vi.advanceTimersByTime(2000)
    channels[1].fire('SUBSCRIBED')
    expect(onSubscribed).toHaveBeenCalledTimes(2) // re-sincroniza no reconnect
  })

  it('após unsubscribe() não reconecta mais', () => {
    const channels: ReturnType<typeof makeFakeChannel>[] = []
    const build = (): never => {
      const ch = makeFakeChannel()
      channels.push(ch)
      return ch as never
    }
    const sub = new ResilientSubscription({ label: 'test', build }).start()

    sub.unsubscribe()
    channels[0].fire('CHANNEL_ERROR')
    vi.advanceTimersByTime(60_000)
    expect(channels).toHaveLength(1) // nenhuma reconexão depois de cancelado
  })
})
