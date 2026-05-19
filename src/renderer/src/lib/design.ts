// Design tokens — todos referem-se a CSS variables que flipam automaticamente
// quando o sistema muda entre light/dark mode (via `useTheme` hook no App).

export const GL = {
  ink: 'var(--jk-ink)',
  inkStrong: 'var(--jk-ink-strong)',
  muted: 'var(--jk-muted)',
  faint: 'var(--jk-faint)',
  paper: 'var(--jk-paper)',
  divider: 'var(--jk-divider)',
  hover: 'var(--jk-hover)',
  active: 'var(--jk-active)',
  accent: 'var(--jk-accent)',
  success: 'var(--jk-success)',
  warning: 'var(--jk-warning)',
  danger: 'var(--jk-danger)',
  inputBg: 'var(--jk-input-bg)',
  inputBorder: 'var(--jk-input-border)',
  avatarBg: 'var(--jk-avatar-bg)',
  avatarFg: 'var(--jk-avatar-fg)',
  avatarInverseBg: 'var(--jk-avatar-inverse-bg)',
  avatarInverseFg: 'var(--jk-avatar-inverse-fg)'
} as const

export const isMac = (): boolean => window.api?.platform === 'darwin'
