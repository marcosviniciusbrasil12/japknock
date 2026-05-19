// Renderiza hand.svg em alta resolução (256px) via Electron headless, então
// Python+Pillow Lanczos downscale pros 3 tamanhos do menu bar (22, 44, 88).
// stroke-width engrossa os paths SEM flood-fill destrutivo — detalhe preservado.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')

const SVG_PATH = path.resolve(__dirname, '../design/source/hand.svg')
const OUT_DIR = path.resolve(__dirname, '../resources')
const RENDER_PX = 256
const TILT = 35
const FILL = 0.92
const STROKE_WIDTH = 80

app.whenReady().then(async () => {
  const svgData = fs.readFileSync(SVG_PATH, 'utf-8')
  const handPx = Math.round(RENDER_PX * FILL)
  const tmpHtmlPath = path.join(os.tmpdir(), 'japknock-tray-hires.html')
  const tmpPngPath = path.join(os.tmpdir(), 'japknock-tray-hires.png')

  fs.writeFileSync(
    tmpHtmlPath,
    `<!doctype html><html><head><style>
      html,body { margin:0; padding:0; background:transparent; }
      body { display:flex; align-items:center; justify-content:center; width:${RENDER_PX}px; height:${RENDER_PX}px; }
      .wrap { width:${handPx}px; height:${handPx}px; display:flex; align-items:center; justify-content:center; transform:rotate(${TILT}deg); }
      .wrap > svg { width:100%; height:100%; display:block; overflow:visible; }
      .wrap > svg path { fill:#000 !important; stroke:#000 !important; stroke-width:${STROKE_WIDTH} !important; stroke-linejoin:round !important; }
    </style></head><body><div class="wrap">${svgData}</div></body></html>`
  )

  const win = new BrowserWindow({
    width: RENDER_PX,
    height: RENDER_PX,
    show: false,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true }
  })
  await win.loadFile(tmpHtmlPath)
  await new Promise((r) => setTimeout(r, 800))
  const image = await win.webContents.capturePage()
  fs.writeFileSync(tmpPngPath, image.toPNG())
  console.log(`✓ Hi-res render @${RENDER_PX}px done`)
  win.destroy()

  // Downscale pros 3 tamanhos via Pillow. Crop artefatos de scrollbar primeiro.
  const py = `
from PIL import Image
src = Image.open("${tmpPngPath}").convert("RGBA")
# Remove ~6% nas bordas direita/baixo (scrollbar do BrowserWindow)
w, h = src.size
margin = int(min(w, h) * 0.06)
src = src.crop((0, 0, w - margin, h - margin))
# Crop pro bounding box do conteúdo, depois pad pra ficar quadrado centrado
bbox = src.getbbox()
content = src.crop(bbox) if bbox else src
cw, ch = content.size
side = max(cw, ch)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(content, ((side - cw) // 2, (side - ch) // 2), content)
# Adiciona pequena margem de 8% pra não ficar grudado nas bordas
padded_side = int(side * 1.16)
padded = Image.new("RGBA", (padded_side, padded_side), (0, 0, 0, 0))
off = (padded_side - side) // 2
padded.paste(canvas, (off, off), canvas)
for size, name in [(22, "trayTemplate.png"), (44, "trayTemplate@2x.png"), (88, "trayTemplate@3x.png")]:
    padded.resize((size, size), Image.LANCZOS).save("${OUT_DIR}/" + name)
    print(f"✓ {name} ({size}x{size})")
`
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf-8' })
  console.log(r.stdout, r.stderr)

  fs.unlinkSync(tmpHtmlPath)
  fs.unlinkSync(tmpPngPath)
  app.quit()
})
