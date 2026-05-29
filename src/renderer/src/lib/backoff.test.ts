import { describe, it, expect } from 'vitest'
import { backoffDelay, BACKOFF_MS } from './backoff'

// A reconexão do Realtime depende disto. Se o backoff quebrar, o app pode
// martelar o servidor (delay 0) ou parar de tentar reconectar.
describe('backoffDelay', () => {
  it('segue a escada de delays nas primeiras tentativas', () => {
    expect(backoffDelay(0)).toBe(2000)
    expect(backoffDelay(1)).toBe(5000)
    expect(backoffDelay(2)).toBe(10000)
    expect(backoffDelay(3)).toBe(30000)
    expect(backoffDelay(4)).toBe(60000)
  })

  it('satura no teto (60s) — nunca cresce sem limite', () => {
    expect(backoffDelay(5)).toBe(60000)
    expect(backoffDelay(99)).toBe(60000)
    expect(backoffDelay(Number.MAX_SAFE_INTEGER)).toBe(60000)
  })

  it('nunca retorna 0 nem negativo (proteção contra martelar o servidor)', () => {
    expect(backoffDelay(-1)).toBe(2000)
    expect(backoffDelay(-999)).toBe(2000)
    for (let i = 0; i < 200; i++) expect(backoffDelay(i)).toBeGreaterThanOrEqual(2000)
  })

  it('a escada é estritamente crescente', () => {
    for (let i = 1; i < BACKOFF_MS.length; i++) {
      expect(BACKOFF_MS[i]).toBeGreaterThan(BACKOFF_MS[i - 1])
    }
  })
})
