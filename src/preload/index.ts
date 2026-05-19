import { contextBridge, ipcRenderer } from 'electron'

const api = {
  platform: process.platform as NodeJS.Platform,
  getTheme: (): Promise<boolean> => ipcRenderer.invoke('get-theme'),
  onThemeChange: (cb: (isDark: boolean) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, isDark: boolean): void => cb(isDark)
    ipcRenderer.on('theme-changed', handler)
    return () => ipcRenderer.removeListener('theme-changed', handler)
  },
  notify: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke('notify', { title, body }),
  clearAlert: (): void => ipcRenderer.send('clear-alert'),
  setAutostart: (enable: boolean): void => ipcRenderer.send('set-autostart', enable),
  getAutostart: (): Promise<boolean> => ipcRenderer.invoke('get-autostart'),
  hideWindow: (): void => ipcRenderer.send('hide-window'),
  showKnockAlert: (from: string, fromName: string): void =>
    ipcRenderer.send('show-knock-alert', { from, fromName }),
  dismissKnockAlert: (): void => ipcRenderer.send('dismiss-knock-alert'),
  onKnockAgain: (cb: (data: { from: string; fromName: string }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { from: string; fromName: string }) =>
      cb(data)
    ipcRenderer.on('knock-again', handler)
    return () => ipcRenderer.removeListener('knock-again', handler)
  },
  onAlertAcknowledged: (
    cb: (data: { from: string; fromName: string }) => void
  ): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { from: string; fromName: string }) =>
      cb(data)
    ipcRenderer.on('alert-acknowledged', handler)
    return () => ipcRenderer.removeListener('alert-acknowledged', handler)
  },
  // Admin remote commands
  adminKill: (): void => ipcRenderer.send('admin-kill'),
  adminRestart: (): void => ipcRenderer.send('admin-restart'),
  adminCheckUpdate: (): void => ipcRenderer.send('admin-check-update')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
