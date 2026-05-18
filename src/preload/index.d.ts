declare global {
  interface Window {
    api: {
      notify: (title: string, body: string) => Promise<void>
      clearAlert: () => void
      setAutostart: (enable: boolean) => void
      getAutostart: () => Promise<boolean>
      hideWindow: () => void
      showKnockAlert: (from: string, fromName: string) => void
      dismissKnockAlert: () => void
      onKnockAgain: (cb: (data: { from: string; fromName: string }) => void) => () => void
    }
  }
}

export {}
