import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mocka o SDK pra importar supabase.ts sem rede. startPolling não usa o
// client, então um stub vazio basta.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
  RealtimeChannel: class {}
}))

import { startPolling } from './supabase'

describe('startPolling', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('roda o primeiro tick imediatamente e repete no intervalo', async () => {
    const tick = vi.fn().mockResolvedValue(undefined)
    const handle = startPolling('test', 45_000, tick)

    await vi.advanceTimersByTimeAsync(0)
    expect(tick).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(45_000)
    expect(tick).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(45_000)
    expect(tick).toHaveBeenCalledTimes(3)

    handle.unsubscribe()
  })

  it('tick com erro não mata o loop (falha de rede é transitória)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tick = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined)
    const handle = startPolling('test', 45_000, tick)

    await vi.advanceTimersByTimeAsync(0)
    expect(tick).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(45_000)
    expect(tick).toHaveBeenCalledTimes(2)

    handle.unsubscribe()
    consoleSpy.mockRestore()
  })

  it('após unsubscribe() não roda mais nenhum tick', async () => {
    const tick = vi.fn().mockResolvedValue(undefined)
    const handle = startPolling('test', 45_000, tick)

    await vi.advanceTimersByTimeAsync(0)
    handle.unsubscribe()

    await vi.advanceTimersByTimeAsync(300_000)
    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('não sobrepõe ticks: o intervalo conta a partir do FIM do tick anterior', async () => {
    let resolveTick: (() => void) | null = null
    const tick = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveTick = resolve
        })
    )
    const handle = startPolling('test', 45_000, tick)

    await vi.advanceTimersByTimeAsync(0)
    expect(tick).toHaveBeenCalledTimes(1)

    // Tick 1 ainda pendente: mesmo passando muito tempo, nada novo dispara.
    await vi.advanceTimersByTimeAsync(200_000)
    expect(tick).toHaveBeenCalledTimes(1)

    resolveTick!()
    await vi.advanceTimersByTimeAsync(45_000)
    expect(tick).toHaveBeenCalledTimes(2)

    handle.unsubscribe()
  })
})
