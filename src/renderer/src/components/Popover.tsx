import { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export function Popover({ children }: Props) {
  // Mac: vibrancy da janela já cuida do chrome (NSVisualEffectView).
  // Win: cor sólida da janela (#ffffff) e divisores internos pros componentes.
  // Aqui só enche a janela.
  return (
    <div className="gl-panel" style={{ width: '100%', overflow: 'hidden' }}>
      {children}
    </div>
  )
}
