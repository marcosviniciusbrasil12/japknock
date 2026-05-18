declare global {
  interface Window {
    api: {
      notify: (title: string, body: string) => Promise<void>
      clearAlert: () => void
      setAutostart: (enable: boolean) => void
      getAutostart: () => Promise<boolean>
      hideWindow: () => void
    }
  }
}

export {}
