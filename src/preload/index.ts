import { contextBridge, ipcRenderer } from 'electron'

const api = {
  notify: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke('notify', { title, body }),
  clearAlert: (): void => ipcRenderer.send('clear-alert'),
  setAutostart: (enable: boolean): void => ipcRenderer.send('set-autostart', enable),
  getAutostart: (): Promise<boolean> => ipcRenderer.invoke('get-autostart'),
  hideWindow: (): void => ipcRenderer.send('hide-window')
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
