// Renderiza o ícone do app (Dock/Finder/Launchpad/instalador) no padrão macOS:
// squircle 824/1024 centralizado, gradiente + profundidade, e a mão CENTRALIZADA
// DE VERDADE — recortada no bounding box real (o desenho fica torto dentro do
// próprio viewBox, então centralizar o container do SVG não basta).
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
const SQUIRCLE = 824
const RADIUS = 185
const HAND_FRAC = 0.46 // fração do squircle que a mão ocupa

async function snap(win, html, out) {
  fs.writeFileSync(html.path, html.body)
  await win.loadFile(html.path)
  await new Promise((r) => setTimeout(r, 500))
  const img = await win.webContents.capturePage()
  fs.writeFileSync(out, img.toPNG())
}

app.whenReady().then(async () => {
  const handSvg = fs.readFileSync(HAND, 'utf-8')
  const bgHtml = { path: path.join(os.tmpdir(), 'jk-bg.html'), body: '' }
  const handHtml = { path: path.join(os.tmpdir(), 'jk-hand.html'), body: '' }
  const bgPng = path.join(os.tmpdir(), 'jk-bg.png')
  const handPng = path.join(os.tmpdir(), 'jk-hand.png')

  // 1) Fundo squircle (sem a mão)
  bgHtml.body = `<!doctype html><html><head><style>
    html,body { margin:0; padding:0; width:${PX}px; height:${PX}px; overflow:hidden; background:transparent; }
    .icon {
      position:absolute; left:${(PX - SQUIRCLE) / 2}px; top:${(PX - SQUIRCLE) / 2}px;
      width:${SQUIRCLE}px; height:${SQUIRCLE}px; border-radius:${RADIUS}px;
      background:linear-gradient(160deg,#ffffff 0%,#f4f5f7 52%,#e8eaee 100%);
      box-shadow: 0 24px 60px rgba(0,0,0,.18), inset 0 3px 0 rgba(255,255,255,.9), inset 0 0 0 2px rgba(0,0,0,.05);
    }
  </style></head><body><div class="icon"></div></body></html>`

  // 2) Mão sozinha em transparente (grande, pra recortar no bbox depois)
  handHtml.body = `<!doctype html><html><head><style>
    html,body { margin:0; padding:0; width:${PX}px; height:${PX}px; overflow:hidden; background:transparent; }
    .wrap { width:${PX}px; height:${PX}px; display:flex; align-items:center; justify-content:center; }
    .wrap > svg { width:90%; height:90%; display:block; overflow:visible; }
    .wrap > svg path { fill:#1d1d1f !important; stroke:#1d1d1f !important; stroke-width:45 !important; stroke-linejoin:round !important; }
  </style></head><body><div class="wrap">${handSvg}</div></body></html>`

  const win = new BrowserWindow({
    width: PX, height: PX, show: false, transparent: true, frame: false,
    backgroundColor: '#00000000', webPreferences: { offscreen: true }
  })
  await snap(win, bgHtml, bgPng)
  await snap(win, handHtml, handPng)
  win.destroy()
  console.log('✓ render bg + mão')

  // 3) Pillow: recorta a mão no bbox e cola CENTRALIZADA no fundo
  const py = `
from PIL import Image
bg = Image.open("${bgPng}").convert("RGBA")
hand = Image.open("${handPng}").convert("RGBA")
bbox = hand.getbbox()
hand = hand.crop(bbox)            # recorte no conteúdo real → centro visual correto
W, H = bg.size
squircle = W * ${SQUIRCLE} / ${PX}
target = int(squircle * ${HAND_FRAC})
hw, hh = hand.size
s = target / max(hw, hh)
hand = hand.resize((round(hw*s), round(hh*s)), Image.LANCZOS)
hw, hh = hand.size
bg.paste(hand, ((W - hw)//2, (H - hh)//2), hand)   # centro do canvas = centro do squircle
bg.resize((1024,1024), Image.LANCZOS).save("${path.join(BUILD, 'icon.png')}")
bg.resize((512,512), Image.LANCZOS).save("${path.join(RES, 'icon.png')}")
import os
iconset = "${path.join(os.tmpdir(), 'JapKnock.iconset')}"
os.makedirs(iconset, exist_ok=True)
for size, name in [(16,'icon_16x16.png'),(32,'icon_16x16@2x.png'),(32,'icon_32x32.png'),(64,'icon_32x32@2x.png'),(128,'icon_128x128.png'),(256,'icon_128x128@2x.png'),(256,'icon_256x256.png'),(512,'icon_256x256@2x.png'),(512,'icon_512x512.png'),(1024,'icon_512x512@2x.png')]:
    bg.resize((size,size), Image.LANCZOS).save(os.path.join(iconset, name))
print("✓ composite + iconset")
`
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf-8' })
  console.log(r.stdout, r.stderr)

  const iconset = path.join(os.tmpdir(), 'JapKnock.iconset')
  spawnSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(BUILD, 'icon.icns')], { stdio: 'inherit' })
  console.log('✓ build/icon.icns')

  fs.rmSync(iconset, { recursive: true, force: true })
  ;[bgHtml.path, handHtml.path, bgPng, handPng].forEach((f) => fs.existsSync(f) && fs.unlinkSync(f))
  app.quit()
})
