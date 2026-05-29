// Parse dos parâmetros da janela de alerta fullscreen.
// A janela é aberta com uma URL tipo `...#alert?from=helena&fromName=Helena&silent=1`.
// Se esse parse furar, o alerta mostra a pessoa errada ou toca som no monitor
// errado — por isso é função pura e testada isoladamente.

export type AlertParams = {
  from: string
  fromName: string
  silent: boolean
  solidBg: boolean
}

export const parseAlertParams = (hash: string): AlertParams => {
  const clean = hash.replace(/^#alert\??/, '')
  const params = new URLSearchParams(clean)
  return {
    from: params.get('from') ?? 'helena',
    fromName: params.get('fromName') ?? 'Alguém',
    silent: params.get('silent') === '1',
    solidBg: params.get('solidBg') === '1'
  }
}
