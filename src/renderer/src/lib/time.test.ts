import { describe, it, expect } from 'vitest'
import { formatWhen, relativeLabel } from './time'

// `now` é fixo em horário LOCAL pra o teste ser determinístico em qualquer fuso
// (formatWhen usa getHours/getDate locais).
const NOW = new Date(2026, 4, 29, 14, 30, 0).getTime() // 29/mai/2026 14:30 local

describe('formatWhen', () => {
  it('segundos atrás', () => {
    expect(formatWhen(NOW - 5_000, NOW)).toBe('há 5s')
  })

  it('minutos atrás', () => {
    expect(formatWhen(NOW - 2 * 60_000, NOW)).toBe('há 2 min')
  })

  it('mesmo dia, mais de 1h → "hoje, HH:MM"', () => {
    const at9 = new Date(2026, 4, 29, 9, 5, 0).getTime()
    expect(formatWhen(at9, NOW)).toBe('hoje, 09:05')
  })

  it('outro dia → "D/M HH:MM"', () => {
    const yesterday = new Date(2026, 4, 28, 10, 0, 0).getTime()
    expect(formatWhen(yesterday, NOW)).toBe('28/5 10:00')
  })
})

describe('relativeLabel', () => {
  it('"agora" para < 1 min', () => {
    expect(relativeLabel(NOW - 30_000, NOW)).toBe('agora')
  })

  it('minutos', () => {
    expect(relativeLabel(NOW - 12 * 60_000, NOW)).toBe('há 12m')
  })

  it('horas', () => {
    expect(relativeLabel(NOW - 3 * 3_600_000, NOW)).toBe('há 3h')
  })

  it('mais de 1 dia → "ontem"', () => {
    expect(relativeLabel(NOW - 2 * 86_400_000, NOW)).toBe('ontem')
  })
})
