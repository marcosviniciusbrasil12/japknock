import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  ipcMain,
  nativeImage,
  screen,
  shell,
  dialog
} from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

// Test helper: allow forcing an isolated userData dir per instance.
// Usage: JAPKNOCK_DATA_DIR=/tmp/japknock-helena open ... → 2nd instance gets its own localStorage.
if (process.env.JAPKNOCK_DATA_DIR) {
  app.setPath('userData', process.env.JAPKNOCK_DATA_DIR)
}

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let alertWindow: BrowserWindow | null = null
let alertInterval: NodeJS.Timeout | null = null
let updateDownloaded = false
let pendingUpdateVersion: string | null = null

const isMac = process.platform === 'darwin'
const RELEASES_URL = 'https://github.com/marcosviniciusbrasil12/japknock/releases/latest'

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 560,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    skipTaskbar: true,
    movable: false,
    alwaysOnTop: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('blur', () => {
    if (!is.dev && mainWindow?.isVisible()) mainWindow.hide()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // DEBUG: open devtools detached so we can inspect Realtime connection
  if (process.env.JAPKNOCK_DEBUG) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

function positionWindow(): void {
  if (!mainWindow || !tray) return
  const trayBounds = tray.getBounds()
  const winBounds = mainWindow.getBounds()

  if (isMac) {
    const x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2)
    const y = Math.round(trayBounds.y + trayBounds.height + 4)
    mainWindow.setPosition(x, y, false)
  } else {
    const display = screen.getPrimaryDisplay().workArea
    const x = trayBounds.x
      ? Math.max(display.x, trayBounds.x + trayBounds.width / 2 - winBounds.width / 2)
      : display.x + display.width - winBounds.width - 16
    const y = trayBounds.y
      ? Math.max(display.y, trayBounds.y - winBounds.height - 4)
      : display.y + display.height - winBounds.height - 60
    mainWindow.setPosition(Math.round(x), Math.round(y), false)
  }
}

function setupAutoUpdate(): void {
  if (is.dev) return // skip in dev mode
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update available:', info.version)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] no update available')
  })

  autoUpdater.on('download-progress', (p) => {
    console.log(`[updater] download progress: ${Math.round(p.percent)}%`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] downloaded:', info.version)
    updateDownloaded = true
    pendingUpdateVersion = info.version
    new Notification({
      title: 'JapKnock atualizado',
      body: `Versão ${info.version} pronta. Será instalada quando você sair do app — ou clique aqui pra reiniciar agora.`,
      silent: true
    })
      .on('click', () => quitAndInstall())
      .show()
    rebuildTrayMenu()
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.message)
    // On macOS unsigned, signature check may fail. Fall back to opening browser
    // with the latest release page so the user can grab the new .dmg manually.
    if (isMac && /signature|code\s*sign/i.test(err.message)) {
      new Notification({
        title: 'Atualização disponível',
        body: 'Não foi possível atualizar automaticamente. Clique pra baixar a nova versão.',
        silent: true
      })
        .on('click', () => shell.openExternal(RELEASES_URL))
        .show()
    }
  })

  // First check 5s after startup so we don't slow it down
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => console.error('[updater] check error:', e))
  }, 5000)

  // Re-check every 4 hours
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch((e) => console.error('[updater] check error:', e))
    },
    4 * 60 * 60 * 1000
  )
}

function quitAndInstall(): void {
  if (!updateDownloaded) return
  autoUpdater.quitAndInstall(false, true)
}

async function manualCheckForUpdates(): Promise<void> {
  if (is.dev) {
    dialog.showMessageBox({
      type: 'info',
      title: 'JapKnock',
      message: 'Modo desenvolvedor — auto-update desativado.',
      buttons: ['OK']
    })
    return
  }
  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result || !result.updateInfo) {
      dialog.showMessageBox({
        type: 'info',
        title: 'JapKnock',
        message: 'Você está na versão mais recente.',
        detail: `Versão atual: ${app.getVersion()}`,
        buttons: ['OK']
      })
    }
  } catch (e) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'JapKnock',
      message: 'Não foi possível verificar atualizações.',
      detail: String(e),
      buttons: ['OK', 'Abrir página de releases']
    }).then((r) => {
      if (r.response === 1) shell.openExternal(RELEASES_URL)
    })
  }
}

function showKnockAlert(from: string, fromName: string): void {
  if (alertWindow && !alertWindow.isDestroyed()) {
    // Already showing — bump count via IPC
    alertWindow.webContents.send('knock-again', { from, fromName })
    alertWindow.focus()
    alertWindow.moveTop()
    return
  }

  const display = screen.getPrimaryDisplay()
  alertWindow = new BrowserWindow({
    width: display.bounds.width,
    height: display.bounds.height,
    x: display.bounds.x,
    y: display.bounds.y,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: false,
    alwaysOnTop: true,
    focusable: true,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  alertWindow.setAlwaysOnTop(true, 'screen-saver')
  alertWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const baseUrl =
    is.dev && process.env['ELECTRON_RENDERER_URL']
      ? process.env['ELECTRON_RENDERER_URL']
      : `file://${join(__dirname, '../renderer/index.html')}`
  const params = `from=${encodeURIComponent(from)}&fromName=${encodeURIComponent(fromName)}`
  alertWindow.loadURL(`${baseUrl}#alert?${params}`)

  alertWindow.once('ready-to-show', () => {
    alertWindow?.show()
    alertWindow?.focus()
    alertWindow?.moveTop()
  })

  alertWindow.on('closed', () => {
    alertWindow = null
    stopAlert()
  })
}

function dismissKnockAlert(): void {
  if (alertWindow && !alertWindow.isDestroyed()) alertWindow.close()
  alertWindow = null
  stopAlert()
}

function rebuildTrayMenu(): void {
  if (!tray) return
  const updateMenuItem = updateDownloaded
    ? [
        {
          label: `Reiniciar e atualizar pra v${pendingUpdateVersion}`,
          click: () => quitAndInstall()
        },
        { type: 'separator' as const }
      ]
    : []

  const menu = Menu.buildFromTemplate([
    ...updateMenuItem,
    { label: 'Abrir', click: () => toggleWindow() },
    { label: 'Limpar alerta', click: () => stopAlert() },
    { type: 'separator' },
    {
      label: 'Iniciar no boot',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) =>
        app.setLoginItemSettings({ openAtLogin: item.checked, openAsHidden: true })
    },
    { label: 'Verificar atualizações', click: () => manualCheckForUpdates() },
    { label: `Sobre — JapKnock v${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() }
  ])
  tray?.popUpContextMenu(menu)
}

function toggleWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    positionWindow()
    mainWindow.show()
    mainWindow.focus()
  }
}

function startAlert(): void {
  if (!tray || alertInterval) return
  let on = false
  alertInterval = setInterval(() => {
    on = !on
    tray?.setTitle(on ? ' •' : '  ')
  }, 500)
}

function stopAlert(): void {
  if (alertInterval) {
    clearInterval(alertInterval)
    alertInterval = null
  }
  tray?.setTitle('')
}

function buildTrayImage(): Electron.NativeImage {
  // Use bundled icon.png, resized for menu bar (~18x18 on macOS retina)
  const img = nativeImage.createFromPath(icon)
  if (img.isEmpty()) {
    // Fallback: empty image — text title will still show
    return nativeImage.createEmpty()
  }
  return img.resize({ width: 18, height: 18, quality: 'best' })
}

app.whenReady().then(() => {
  if (isMac) app.dock?.hide()

  const trayImage = buildTrayImage()
  tray = new Tray(trayImage)
  tray.setToolTip('JapKnock')
  // Text label as visible-fallback in case icon doesn't render (e.g. on first
  // run before the resources path is fully resolved)
  if (trayImage.isEmpty()) tray.setTitle('🚪')

  createWindow()

  tray.on('click', () => {
    stopAlert()
    toggleWindow()
  })

  tray.on('right-click', () => rebuildTrayMenu())

  ipcMain.handle('notify', (_event, { title, body }: { title: string; body: string }) => {
    new Notification({ title, body, silent: true }).show()
    startAlert()
    if (mainWindow && !mainWindow.isVisible()) mainWindow.flashFrame(true)
  })

  ipcMain.on(
    'show-knock-alert',
    (_event, { from, fromName }: { from: string; fromName: string }) => {
      showKnockAlert(from, fromName)
    }
  )

  ipcMain.on('dismiss-knock-alert', () => dismissKnockAlert())

  ipcMain.on('clear-alert', () => stopAlert())

  ipcMain.on('set-autostart', (_event, enable: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enable, openAsHidden: true })
  })

  ipcMain.handle('get-autostart', () => app.getLoginItemSettings().openAtLogin)

  ipcMain.on('hide-window', () => mainWindow?.hide())

  if (!app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })
  }

  setupAutoUpdate()
})

app.on('window-all-closed', () => {
  // Tray-only app: keep running when window hides
})

app.on('before-quit', () => {
  stopAlert()
})
