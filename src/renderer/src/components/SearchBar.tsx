import { GL } from '../lib/design'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder = 'Buscar pessoa…' }: Props) {
  return (
    <div className="px-3.5 pt-3 pb-1.5">
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
        style={{
          background: 'rgba(0,0,0,.05)',
          border: '0.5px solid rgba(0,0,0,.08)'
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke={GL.muted} strokeWidth="1.6" />
          <path
            d="M11 11 L14 14"
            stroke={GL.muted}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          className="flex-1 bg-transparent outline-none border-0"
          style={{ fontSize: 13, color: GL.ink }}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="leading-none cursor-pointer"
            style={{
              background: 'transparent',
              border: 0,
              padding: 0,
              color: GL.muted,
              fontSize: 14
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
