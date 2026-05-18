import { contextBridge, ipcRenderer } from 'electron'

const api = {
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
  }
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
