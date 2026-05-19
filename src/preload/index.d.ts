declare global {
  interface Window {
    api: {
      platform: NodeJS.Platform
      getTheme: () => Promise<boolean>
      onThemeChange: (cb: (isDark: boolean) => void) => () => void
      notify: (title: string, body: string) => Promise<void>
      clearAlert: () => void
      setAutostart: (enable: boolean) => void
      getAutostart: () => Promise<boolean>
      hideWindow: () => void
      showKnockAlert: (from: string, fromName: string) => void
      dismissKnockAlert: () => void
      onKnockAgain: (cb: (data: { from: string; fromName: string }) => void) => () => void
      onAlertAcknowledged: (cb: (data: { from: string; fromName: string }) => void) => () => void
      adminKill: () => void
      adminRestart: () => void
      adminCheckUpdate: () => void
    }
  }
}

export {}
