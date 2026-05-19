import handSvgUrl from '../assets/hand.svg'

type Props = {
  size?: number
  radius?: number // percentage
  delay?: string
  boxed?: boolean // se true, usa squircle branco como tile (header). Se false, só a mão.
}

export function KnockingHand({
  size = 30,
  radius = 28,
  delay = '0.4s',
  boxed = true
}: Props) {
  return (
    <div
      className="jk-tile-shake"
      style={
        {
          width: size,
          height: size,
          borderRadius: boxed ? `${radius}%` : 0,
          background: boxed ? '#ffffff' : 'transparent',
          border: boxed ? '0.5px solid rgba(0,0,0,.08)' : 'none',
          boxShadow: boxed
            ? '0 1px 0 rgba(0,0,0,.02) inset, 0 6px 16px -8px rgba(0,0,0,.18)'
            : 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          ['--jk-delay' as never]: delay
        } as React.CSSProperties
      }
    >
      {/* Estrelas de impacto no canto superior direito (onde a mão "bate") */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      >
        {[0, 1].map((i) => (
          <g
            key={i}
            className={i === 0 ? 'jk-impact-a' : 'jk-impact-b'}
            style={{ ['--jk-delay' as never]: delay } as React.CSSProperties}
          >
            <line x1="48" y1="8" x2="51" y2="2" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="54" y1="14" x2="60" y2="9" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="58" y1="22" x2="62" y2="20" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="42" y1="6" x2="42" y2="1" stroke="#0a0a0a" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        ))}
      </svg>

      {/* Mão que faz o thrust de bater */}
      <div
        className="jk-fist-anim"
        style={
          {
            ['--jk-delay' as never]: delay,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '78%',
            height: '78%'
          } as React.CSSProperties
        }
      >
        <img
          src={handSvgUrl}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
            pointerEvents: 'none'
          }}
        />
      </div>
    </div>
  )
}
