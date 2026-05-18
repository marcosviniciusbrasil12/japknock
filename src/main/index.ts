import { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let alertInterval: NodeJS.Timeout | null = null

const isMac = process.platform === 'darwin'

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
  // 16x16 template image (black + alpha) for macOS menu bar
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAg0lEQVQ4jWNgGAW0Bv///2f4//8/AzbMxMDAwIBNjImBgYGBkREfYP5//wMDA8N/dPyfgYGBgQVdkpGREZcjGNAFmZiYGFnQBVnQHcEEEvz//z/eUGCEOQDmCJBLcDmCEd0BIBcgewgZw1zPjCqYmZmZ8YYHikN+xRWNDGwUOJ+BgYEBAEQUI3rt9kFNAAAAAElFTkSuQmCC'
  const img = nativeImage.createFromDataURL(dataUrl)
  if (img.isEmpty()) return nativeImage.createFromPath(icon).resize({ width: 18, height: 18 })
  img.setTemplateImage(true)
  return img
}

app.whenReady().then(() => {
  if (isMac) app.dock?.hide()

  const trayImage = buildTrayImage()
  tray = new Tray(trayImage)
  tray.setToolTip('JapKnock')

  createWindow()

  tray.on('click', () => {
    stopAlert()
    toggleWindow()
  })

  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
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
      { type: 'separator' },
      { label: 'Sair', click: () => app.quit() }
    ])
    tray?.popUpContextMenu(menu)
  })

  ipcMain.handle('notify', (_event, { title, body }: { title: string; body: string }) => {
    new Notification({ title, body, silent: false }).show()
    startAlert()
    if (mainWindow && !mainWindow.isVisible()) mainWindow.flashFrame(true)
  })

  ipcMain.on('clear-alert', () => stopAlert())

  ipcMain.on('set-autostart', (_event, enable: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enable, openAsHidden: true })
  })

  ipcMain.handle('get-autostart', () => app.getLoginItemSettings().openAtLogin)

  ipcMain.on('hide-window', () => mainWindow?.hide())

  if (!app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })
  }
})

app.on('window-all-closed', () => {
  // Tray-only app: keep running when window hides
})

app.on('before-quit', () => {
  stopAlert()
})
