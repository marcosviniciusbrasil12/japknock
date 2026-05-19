import { useEffect, useState } from 'react'

export function useSystemTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    let cancelled = false

    // Inicial: pega o tema atual via IPC
    window.api.getTheme().then((isDark) => {
      if (!cancelled) setTheme(isDark ? 'dark' : 'light')
    })

    // Atualiza quando o sistema mudar
    const off = window.api.onThemeChange((isDark) => {
      setTheme(isDark ? 'dark' : 'light')
    })

    return () => {
      cancelled = true
      off()
    }
  }, [])

  // Aplica no root pra CSS variables responderem
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return theme
}
