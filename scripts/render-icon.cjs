// Renderiza o ícone do app (Dock/Finder/Launchpad/instalador) no padrão macOS:
// squircle 824x824 centralizado num canvas 1024 (margem de 100px como os apps
// nativos), fundo com leve gradiente + profundidade, mão centralizada.
// Gera build/icon.png (1024), resources/icon.png (512) e build/icon.icns.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')

const HAND = path.resolve(__dirname, '../design/source/hand.svg')
const BUILD = path.resolve(__dirname, '../build')
const RES = path.resolve(__dirname, '../resources')
const PX = 1024
const SQUIRCLE = 824 // área do ícone dentro do canvas (grade de ícone do macOS)
const RADIUS = 185 // ~22.4% — corner radius da grade da Apple
const HAND_PX = 470 // mão centralizada dentro do squircle

app.whenReady().then(async () => {
  const handSvg = fs.readFileSync(HAND, 'utf-8')
  const html = path.join(os.tmpdir(), 'japknock-icon.html')
  const png = path.join(os.tmpdir(), 'japknock-icon-hi.png')

  fs.writeFileSync(
    html,
    `<!doctype html><html><head><style>
      html,body { margin:0; padding:0; width:${PX}px; height:${PX}px; overflow:hidden; background:transparent; }
      .icon {
        position:absolute; left:${(PX - SQUIRCLE) / 2}px; top:${(PX - SQUIRCLE) / 2}px;
        width:${SQUIRCLE}px; height:${SQUIRCLE}px; border-radius:${RADIUS}px;
        background:linear-gradient(160deg,#ffffff 0%,#f4f5f7 52%,#e8eaee 100%);
        box-shadow:
          0 24px 60px rgba(0,0,0,.18),
          inset 0 3px 0 rgba(255,255,255,.9),
          inset 0 0 0 2px rgba(0,0,0,.05);
        display:flex; align-items:center; justify-content:center; overflow:hidden;
      }
      .hand { width:${HAND_PX}px; height:${HAND_PX}px; display:flex; align-items:center; justify-content:center; }
      .hand > svg { width:100%; height:100%; display:block; overflow:visible; }
      .hand > svg path { fill:#1d1d1f !important; stroke:#1d1d1f !important; stroke-width:45 !important; stroke-linejoin:round !important; }
    </style></head><body><div class="icon"><div class="hand">${handSvg}</div></div></body></html>`
  )

  const win = new BrowserWindow({
    width: PX,
    height: PX,
    show: false,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true }
  })
  await win.loadFile(html)
  await new Promise((r) => setTimeout(r, 600))
  const img = await win.webContents.capturePage()
  fs.writeFileSync(png, img.toPNG())
  win.destroy()
  console.log(`✓ render @${PX}px`)

  // build/icon.png (1024) + resources/icon.png (512)
  fs.copyFileSync(png, path.join(BUILD, 'icon.png'))
  spawnSync('sips', ['-z', '512', '512', png, '--out', path.join(RES, 'icon.png')], { stdio: 'ignore' })
  console.log('✓ build/icon.png (1024) + resources/icon.png (512)')

  // build/icon.icns via iconset + iconutil
  const iconset = path.join(os.tmpdir(), 'JapKnock.iconset')
  fs.rmSync(iconset, { recursive: true, force: true })
  fs.mkdirSync(iconset)
  const variants = [
    [16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'], [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'], [1024, 'icon_512x512@2x.png']
  ]
  for (const [size, name] of variants) {
    spawnSync('sips', ['-z', String(size), String(size), png, '--out', path.join(iconset, name)], { stdio: 'ignore' })
  }
  spawnSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(BUILD, 'icon.icns')], { stdio: 'inherit' })
  console.log('✓ build/icon.icns')

  fs.rmSync(iconset, { recursive: true, force: true })
  fs.unlinkSync(html)
  fs.unlinkSync(png)
  app.quit()
})
