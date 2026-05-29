import { describe, it, expect } from 'vitest'
import { parseAlertParams } from './alertParams'

// Se este parse furar, o alerta fullscreen mostra a pessoa errada, ou toca
// som no monitor secundário (eco), ou não toca no primário.
describe('parseAlertParams', () => {
  it('lê from/fromName de uma URL completa', () => {
    const p = parseAlertParams('#alert?from=helena&fromName=Helena%20Diretora&silent=1')
    expect(p.from).toBe('helena')
    expect(p.fromName).toBe('Helena Diretora')
    expect(p.silent).toBe(true)
    expect(p.solidBg).toBe(false)
  })

  it('marca o monitor secundário (silent + solidBg)', () => {
    const p = parseAlertParams('#alert?from=marcos&fromName=Marcos&silent=1&solidBg=1')
    expect(p.silent).toBe(true)
    expect(p.solidBg).toBe(true)
  })

  it('monitor primário não é silencioso por padrão', () => {
    const p = parseAlertParams('#alert?from=marcos&fromName=Marcos')
    expect(p.silent).toBe(false)
    expect(p.solidBg).toBe(false)
  })

  it('decodifica nomes com acento/espaços', () => {
    const p = parseAlertParams(`#alert?from=jose&fromName=${encodeURIComponent('José da Silva')}`)
    expect(p.fromName).toBe('José da Silva')
  })

  it('cai em defaults seguros quando faltam params', () => {
    const p = parseAlertParams('#alert')
    expect(p.from).toBe('helena')
    expect(p.fromName).toBe('Alguém')
    expect(p.silent).toBe(false)
    expect(p.solidBg).toBe(false)
  })

  it('aceita hash sem o "?" também', () => {
    const p = parseAlertParams('#alertfrom=x') // robustez: não deve explodir
    expect(p.from).toBeDefined()
  })
})
