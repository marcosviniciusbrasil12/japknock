import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  ipcMain,
  nativeImage,
  nativeTheme,
  screen,
  shell,
  dialog
} from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import trayTemplate from '../../resources/trayTemplate.png?asset'
import trayTemplate2x from '../../resources/trayTemplate@2x.png?asset'
import trayTemplate3x from '../../resources/trayTemplate@3x.png?asset'

// Test helper: allow forcing an isolated userData dir per instance.
// Usage: JAPKNOCK_DATA_DIR=/tmp/japknock-helena open ... → 2nd instance gets its own localStorage.
const isTestMode = !!process.env.JAPKNOCK_DATA_DIR
if (isTestMode) {
  app.setPath('userData', process.env.JAPKNOCK_DATA_DIR!)
}

// Admin escape hatch: só permite quit se JAPKNOCK_ALLOW_QUIT=1 (ou em test mode).
// Usuário comum não consegue fechar o app — é ferramenta corporativa.
const allowQuit = isTestMode || process.env.JAPKNOCK_ALLOW_QUIT === '1'

// Single instance lock — só 1 JapKnock por usuário em produção.
// Em test mode (JAPKNOCK_DATA_DIR setado), pulamos pra permitir múltiplas instâncias paralelas.
if (!isTestMode) {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    // Outra instância já tá rodando — sai silenciosamente. A outra vai pegar o foco.
    app.quit()
  }
}

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let alertWindows: BrowserWindow[] = []
let alertInterval: NodeJS.Timeout | null = null
let updateDownloaded = false
let pendingUpdateVersion: string | null = null
let currentAlert: { from: string; fromName: string } | null = null

const isMac = process.platform === 'darwin'
const RELEASES_URL = 'https://github.com/marcosviniciusbrasil12/japknock/releases/latest'

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 520,
    show: false,
    frame: false,
    closable: allowQuit, // user não consegue fechar via Cmd+W
    ...(isMac
      ? {
          // macOS: NSVisualEffectMaterialPopover — mesmo material usado pelos
          // popovers nativos (Foco, Centro de Controle, Bateria).
          vibrancy: 'popover' as const,
          visualEffectState: 'active' as const,
          transparent: true,
          backgroundColor: '#00000000',
          roundedCorners: true
        }
      : {
          // Windows: 'acrylic' (Win10+) ou 'mica' (Win11). Acrylic dá um glass
          // similar ao macOS, transparent + bg 0 são obrigatórios pra funcionar.
          backgroundMaterial: 'acrylic' as const,
          transparent: true,
          backgroundColor: '#00000000'
        }),
    hasShadow: true,
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

  // Notifica o renderer sobre mudanças de tema (light/dark) do sistema
  const broadcastTheme = (): void => {
    mainWindow?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors)
  }
  nativeTheme.on('updated', broadcastTheme)
  mainWindow.on('closed', () => {
    nativeTheme.off('updated', broadcastTheme)
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
    // Encostado na barra de menu (1px gap só pra não colar de cara)
    const x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2)
    const y = Math.round(trayBounds.y + trayBounds.height + 1)
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

  // electron-updater needs a Resources/app-update.yml file embedded in the bundle.
  // It's only generated when building with a full target (--mac/.dmg, not --dir).
  // If it's missing (e.g. running an unpacked build for debugging), skip setup
  // entirely so the missing-file error doesn't crash the app.
  const appUpdatePath = join(process.resourcesPath, 'app-update.yml')
  try {
    require('fs').accessSync(appUpdatePath)
  } catch {
    console.log('[updater] app-update.yml missing — auto-update disabled for this build')
    return
  }

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
  currentAlert = { from, fromName }

  // Se já tem alertas mostrando (de uma chamada anterior), só atualiza o contador
  if (alertWindows.length > 0) {
    alertWindows.forEach((w) => {
      if (!w.isDestroyed()) {
        w.webContents.send('knock-again', { from, fromName })
        w.focus()
        w.moveTop()
      }
    })
    return
  }

  const displays = screen.getAllDisplays()
  const baseUrl =
    is.dev && process.env['ELECTRON_RENDERER_URL']
      ? process.env['ELECTRON_RENDERER_URL']
      : `file://${join(__dirname, '../renderer/index.html')}`

  // Cria 1 janela de alerta por monitor. Só o primeiro toca som (silent=1 nos outros).
  alertWindows = displays.map((display, idx) => {
    const win = new BrowserWindow({
      width: display.bounds.width,
      height: display.bounds.height,
      x: display.bounds.x,
      y: display.bounds.y,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      ...(isMac
        ? {
            vibrancy: 'fullscreen-ui' as const,
            visualEffectState: 'active' as const
          }
        : {
            backgroundMaterial: 'acrylic' as const
          }),
      resizable: false,
      movable: false,
      skipTaskbar: true,
      fullscreenable: false,
      hasShadow: false,
      alwaysOnTop: true,
      focusable: true,
      minimizable: false,
      maximizable: false,
      closable: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true
      }
    })

    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    win.webContents.on('before-input-event', (event, input) => {
      const isClose =
        (input.meta || input.control) && ['w', 'q', 'm', 'h'].includes(input.key.toLowerCase())
      const isEscape = input.key === 'Escape'
      if (isClose || isEscape) event.preventDefault()
    })

    const params =
      `from=${encodeURIComponent(from)}` +
      `&fromName=${encodeURIComponent(fromName)}` +
      (idx > 0 ? '&silent=1' : '')
    win.loadURL(`${baseUrl}#alert?${params}`)

    win.once('ready-to-show', () => {
      win.show()
      win.focus()
      win.moveTop()
    })

    win.on('closed', () => {
      alertWindows = alertWindows.filter((w) => w !== win)
      if (alertWindows.length === 0) stopAlert()
    })

    return win
  })
}

function dismissKnockAlert(): void {
  const ackInfo = currentAlert
  currentAlert = null
  // Destrói TODAS as janelas de alerta (uma por monitor)
  alertWindows.forEach((w) => {
    if (!w.isDestroyed()) w.destroy()
  })
  alertWindows = []
  stopAlert()
  if (ackInfo && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('alert-acknowledged', ackInfo)
  }
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

  // App corporativo: sem opção de fechar. Single point of admin escape via env var.
  const adminQuitItem = allowQuit
    ? [
        { type: 'separator' as const },
        { label: 'Sair (admin)', click: () => app.exit(0) }
      ]
    : []

  const menu = Menu.buildFromTemplate([
    ...updateMenuItem,
    { label: 'Abrir', click: () => toggleWindow() },
    { type: 'separator' },
    { label: 'Verificar atualizações', click: () => manualCheckForUpdates() },
    { label: `Sobre — JapKnock v${app.getVersion()}`, enabled: false },
    ...adminQuitItem
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
  // Use the macOS template glyph (black + alpha) so the system can tint it
  // automatically for light/dark menu bars.
  const img = nativeImage.createFromPath(trayTemplate)
  if (img.isEmpty()) {
    // Fallback to colored app icon if template missing
    return nativeImage.createFromPath(icon).resize({ width: 22, height: 22, quality: 'best' })
  }
  // Add @2x and @3x companions for retina/super-retina displays
  for (const [scale, path] of [
    [2, trayTemplate2x],
    [3, trayTemplate3x]
  ] as const) {
    try {
      const variant = nativeImage.createFromPath(path)
      if (!variant.isEmpty()) {
        img.addRepresentation({ scaleFactor: scale, buffer: variant.toPNG() })
      }
    } catch {
      // ignore — lower-density fallbacks still work
    }
  }
  img.setTemplateImage(true)
  return img
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

  ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors)

  // === Admin remote commands ===
  // Bypassam before-quit handler porque app.exit() ignora before-quit/will-quit.
  ipcMain.on('admin-kill', () => {
    console.log('[japknock] admin remote KILL received')
    app.exit(0)
  })
  ipcMain.on('admin-restart', () => {
    console.log('[japknock] admin remote RESTART received')
    app.relaunch()
    app.exit(0)
  })
  ipcMain.on('admin-check-update', () => {
    console.log('[japknock] admin remote UPDATE check received')
    manualCheckForUpdates()
  })

  ipcMain.on('hide-window', () => mainWindow?.hide())

  // Mandatório: app corporativo deve SEMPRE iniciar no boot.
  // Force a config em toda abertura — usuário não consegue desligar.
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })

  setupAutoUpdate()
})

app.on('window-all-closed', () => {
  // Tray-only app: keep running when window hides
})

// App corporativo: bloqueia QUALQUER tentativa de quit que não venha do admin.
// Sistema de shutdown do SO ainda consegue matar o processo (vai relançar no boot
// graças ao autostart). Single point of escape: JAPKNOCK_ALLOW_QUIT=1.
app.on('before-quit', (event) => {
  if (!allowQuit) {
    event.preventDefault()
    console.log('[japknock] quit attempt blocked — ferramenta corporativa')
  } else {
    stopAlert()
  }
})

// macOS cria um menu padrão com Cmd+Q. Desabilita pra travar essa rota.
Menu.setApplicationMenu(null)
