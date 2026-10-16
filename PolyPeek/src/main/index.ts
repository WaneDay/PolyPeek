import { app, BrowserWindow, protocol, net, ipcMain, dialog, nativeTheme, shell, clipboard } from 'electron'
import { join, extname, basename } from 'path'
import { pathToFileURL } from 'url'
import * as fs from 'fs'
import { execFile } from 'child_process'
import { ALL_EXTS, ALL_EXTS_SET } from '../shared/formats'

const APP_NAME = 'PolyPeek'

function extOf(p: string): string {
  return extname(p).toLowerCase().replace(/^\./, '')
}

function isSupportedPath(p: string): boolean {
  return ALL_EXTS_SET.has(extOf(p))
}

type WindowMode = 'main' | 'preview'

let windowMode: WindowMode = 'main'
let launchFile: string | null = null
let thumbOut: string | null = null
let thumbSize = 256
let captureOut: string | null = null
let captureJs: string | null = null
let captureDelay = 5500
let captureW = 1100
let captureH = 750
let mainWindow: BrowserWindow | null = null

const pinnedWindows = new Set<number>()

function themeDark(): boolean {
  return nativeTheme.shouldUseDarkColors
}

function themeBackground(): string {
  return themeDark() ? '#292929' : '#fafafa'
}

// Windows personalization accent color (Settings > Personalization > Colors).
// DWM stores it in HKCU\Software\Microsoft\Windows\DWM\AccentColor as 0xAABBGGRR.
function readAccentColor(): Promise<{ r: number; g: number; b: number } | null> {
  return new Promise((resolve) => {
    execFile(
      'reg.exe',
      ['query', 'HKCU\\Software\\Microsoft\\Windows\\DWM', '/v', 'AccentColor'],
      { windowsHide: true, timeout: 5000 },
      (err, stdout) => {
        if (err) return resolve(null)
        const tokens = String(stdout).trim().split(/\s+/)
        for (let i = tokens.length - 1; i >= 0; i--) {
          const t = tokens[i].replace(/^0x/i, '')
          if (!/^[0-9a-f]{6,8}$/i.test(t)) continue
          const v = parseInt(t, 16)
          return resolve({ r: v & 0xff, g: (v >> 8) & 0xff, b: (v >> 16) & 0xff })
        }
        resolve(null)
      },
    )
  })
}

function broadcastTheme(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('theme-changed', { dark: themeDark() })
  }
}

function isThumbnailMode(): boolean {
  return process.argv.includes('--render-thumbnail')
}

function parseArgs(): void {
  const args = process.argv.slice(1)
  const valueOf = (flag: string): string | null => {
    const i = args.indexOf(flag)
    return i >= 0 && i + 1 < args.length ? args[i + 1] : null
  }
  // Hidden test hook: --capture <out.png> [--capture-js "<js>"] [--capture-delay ms]
  // [--capture-size WxH] combined with --preview <file> or a model path. Renders
  // the real UI in an invisible window and writes a PNG - used for background
  // smoke tests, never shown to the user.
  const cap = valueOf('--capture')
  if (cap) {
    captureOut = cap
    captureJs = valueOf('--capture-js')
    const d = Number(valueOf('--capture-delay'))
    if (Number.isFinite(d) && d >= 0) captureDelay = d
    const size = valueOf('--capture-size')
    const m = size?.match(/^(\d+)x(\d+)$/)
    if (m) {
      captureW = Math.max(320, Number(m[1]))
      captureH = Math.max(240, Number(m[2]))
    }
  }
  if (args.includes('--render-thumbnail')) {
    // --render-thumbnail <in> <out> [size]
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--render-thumbnail') {
        launchFile = args[i + 1]
        thumbOut = args[i + 2]
        const s = Number(args[i + 3])
        if (Number.isFinite(s) && s > 0) thumbSize = Math.min(512, Math.max(96, Math.round(s)))
        return
      }
    }
  }
  if (args.includes('--preview')) {
    windowMode = 'preview'
    const i = args.indexOf('--preview')
    launchFile = args[i + 1] ?? null
    return
  }
  for (const a of args) {
    if (a.startsWith('-')) continue
    if (isSupportedPath(a)) {
      launchFile = a
      break
    }
  }
}

function rendererDir(): string {
  return join(app.getAppPath(), 'dist', 'renderer')
}

// Chromium refuses to execute scripts (incl. worker importScripts) served
// with a non-JS MIME type, and net.fetch(file://) has no type for .cjs/.wasm -
// so protocol responses override Content-Type from this table.
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.cjs': 'text/javascript',
  '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json',
}

function responseForFile(absPath: string): Response | Promise<Response> {
  const stat = fs.statSync(absPath, { throwIfNoEntry: false })
  if (!stat || !stat.isFile()) return new Response('Not found', { status: 404 })
  // Stream through net.fetch instead of readFileSync: the main process no
  // longer blocks on (or buffers a full copy of) large models - the renderer
  // reads them straight from disk through Chromium's file loader.
  return net.fetch(pathToFileURL(absPath).toString()).catch(() => {
    return new Response('Not found', { status: 404 })
  })
}

function setupProtocol(): void {
  // Same-origin layout:
  //   vfdv://local/renderer/<asset>  -> bundled renderer files
  //   vfdv://local/file/<abs path>   -> arbitrary local files (models/textures)
  protocol.handle('vfdv', async (request) => {
    try {
      const url = new URL(request.url)
      const raw = url.pathname
      const rel = decodeURIComponent(raw).replace(/^\//, '')
      if (rel.startsWith('file/')) {
        const abs = rel.slice('file/'.length).replace(/\//g, '\\')
        return responseForFile(abs)
      }
      if (rel.startsWith('list/')) {
        const dir = rel.slice('list/'.length).replace(/\//g, '\\')
        const st = fs.statSync(dir, { throwIfNoEntry: false })
        if (!st || !st.isDirectory()) return new Response('Not found', { status: 404 })
        const entries = fs.readdirSync(dir, { withFileTypes: true }).map((d) => ({
          name: d.name,
          isDir: d.isDirectory(),
        }))
        return new Response(JSON.stringify(entries), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (rel === '' || rel.endsWith('/')) {
        return net.fetch(pathToFileURL(join(rendererDir(), 'index.html')).toString())
      }
      let filePath: string
      if (rel.startsWith('renderer/')) {
        filePath = join(rendererDir(), ...rel.slice('renderer/'.length).split('/'))
      } else {
        filePath = join(rendererDir(), ...rel.split('/'))
      }
      const resp = await net.fetch(pathToFileURL(filePath).toString())
      const mime = MIME[extname(filePath).toLowerCase()]
      if (!mime) return resp
      return new Response(resp.body, {
        status: resp.status,
        headers: { 'Content-Type': mime },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

let thumbnailWindowCreated = false

function createThumbnailWindow(): void {
  if (thumbnailWindowCreated) return
  thumbnailWindowCreated = true
  const win = new BrowserWindow({
    width: thumbSize,
    height: thumbSize,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      offscreen: false,
    },
  })

  const timer = setTimeout(() => {
    console.error('[thm] render timeout')
    app.exit(2)
  }, 90000)

  const q = new URLSearchParams({ mode: 'thumbnail', file: launchFile ?? '' })
  q.set('out', thumbOut ?? '')
  q.set('size', String(thumbSize))
  win.loadURL(`vfdv://local/renderer/index.html?${q.toString()}`)

  ipcMain.handle('thumb-complete', (_e, base64: string) => {
    try {
      if (thumbOut) fs.writeFileSync(thumbOut, Buffer.from(base64, 'base64'))
      clearTimeout(timer)
      app.exit(0)
    } catch {
      clearTimeout(timer)
      app.exit(1)
    }
  })
}

function createCaptureWindow(): void {
  const win = new BrowserWindow({
    width: captureW,
    height: captureH,
    show: false,
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      offscreen: true,
    },
  })
  let lastFrame: Electron.NativeImage | null = null
  win.webContents.on('paint', (_e, _dirty, image) => {
    lastFrame = image
  })
  win.webContents.on('console-message', (_e, level, message) => {
    console.error(`[cap][console:${level}]`, message)
  })
  const q = new URLSearchParams({ mode: windowMode, capture: '1' })
  if (launchFile) q.set('file', launchFile)
  win.loadURL(`vfdv://local/renderer/index.html?${q.toString()}`)
  setTimeout(async () => {
    try {
      if (captureJs) {
        const r = await win.webContents.executeJavaScript(captureJs, true)
        console.error('[cap] js ->', JSON.stringify(r))
      }
      await new Promise((r) => setTimeout(r, 1300))
      const img: Electron.NativeImage | null = lastFrame
      if (!img) throw new Error('no paint frame received')
      if (captureOut) fs.writeFileSync(captureOut, img.toPNG())
      console.error('[cap] ok')
      app.exit(0)
    } catch (e) {
      console.error('[cap] failed', e)
      app.exit(1)
    }
  }, captureDelay)
}

function createWindow(mode: WindowMode, file: string | null): BrowserWindow {
  const isPreview = mode === 'preview'
  const win = new BrowserWindow({
    width: isPreview ? 960 : 1280,
    height: isPreview ? 680 : 820,
    minWidth: isPreview ? 420 : 720,
    minHeight: isPreview ? 320 : 520,
    title: APP_NAME,
    backgroundColor: themeBackground(),
    show: false,
    frame: false,
    alwaysOnTop: isPreview,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isPreview) win.setAlwaysOnTop(true, 'floating')

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.on('maximize', () => win.webContents.send('win-state', { maximized: true }))
  win.on('unmaximize', () => win.webContents.send('win-state', { maximized: false }))
  win.on('enter-full-screen', () => win.webContents.send('win-state', { maximized: true }))
  win.on('leave-full-screen', () => win.webContents.send('win-state', { maximized: false }))
  win.on('closed', () => {
    pinnedWindows.delete(win.id)
    if (mode === 'main') mainWindow = null
  })

  win.webContents.on('before-input-event', (_e, input) => {
    if (isPreview && input.type === 'keyDown' && input.key === 'Escape') {
      if (pinnedWindows.has(win.id)) return
      win.close()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void url
    return { action: 'deny' }
  })

  const query = new URLSearchParams({ mode })
  if (file) query.set('file', file)
  win.loadURL(`vfdv://local/renderer/index.html?${query.toString()}`)
  return win
}

// Delivers files that arrive after the window is already shown.
function sendOpenFile(path: string): void {
  if (!path) return
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('open-file', path)
  }
}

function applyIpc(): void {
  ipcMain.handle('read-file', (_e, p: string) => {
    try {
      const buf = fs.readFileSync(p)
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    } catch {
      return null
    }
  })

  ipcMain.handle('exists', (_e, p: string) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })

  ipcMain.handle('open-file', async () => {
    const extMap: Record<string, string[]> = {}
    for (const ext of ALL_EXTS) {
      const label = '3D Model'
      ;(extMap[label] ??= []).push(ext)
    }
    const result = await dialog.showOpenDialog({
      title: 'Open 3D Model',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Supported 3D Formats', extensions: ALL_EXTS },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (result.canceled) return { canceled: true, files: [] as string[] }
    return { canceled: false, files: result.filePaths }
  })

  ipcMain.handle('close-window', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return false
    if (pinnedWindows.has(win.id)) return false
    win.close()
    return true
  })

  ipcMain.handle('set-title', (_e, t: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) win.setTitle(t)
    return true
  })

  ipcMain.handle('get-version', () => app.getVersion())

  ipcMain.handle('get-theme', () => ({ dark: themeDark() }))

  ipcMain.handle('get-accent-color', () => readAccentColor())

  ipcMain.handle('win-control', (_e, action: string, value?: unknown) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return false
    switch (action) {
      case 'minimize':
        win.minimize()
        return true
      case 'max-toggle':
        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
        return true
      case 'close':
        if (pinnedWindows.has(win.id)) return false
        win.close()
        return true
      case 'set-pin':
        if (value) pinnedWindows.add(win.id)
        else pinnedWindows.delete(win.id)
        return true
      case 'set-top':
        win.setAlwaysOnTop(value === true)
        return true
      case 'copy-path': {
        const p = String(value ?? '')
        if (!p) return false
        clipboard.writeText(p)
        return true
      }
      case 'open-path': {
        const p = String(value ?? '')
        if (!p) return false
        void shell.openPath(p)
        return true
      }
      case 'open-with': {
        const p = String(value ?? '')
        if (!p) return false
        execFile('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', p], () => {})
        return true
      }
      default:
        return false
    }
  })

  ipcMain.handle('get-launch', () => ({
    mode: windowMode,
    file: launchFile,
  }))
}

nativeTheme.on('updated', () => broadcastTheme())

app.setAppUserModelId('com.polypeek.app')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vfdv',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
])

app.whenReady().then(() => {
  parseArgs()

  app.setName(APP_NAME)

  setupProtocol()
  applyIpc()

  if (isThumbnailMode()) {
    createThumbnailWindow()
    return
  }

  if (captureOut) {
    createCaptureWindow()
    return
  }

  mainWindow = createWindow(windowMode, launchFile)

  ipcMain.handle('ingest-file', (_e, p: string) => {
    if (!p || !isSupportedPath(p)) return { ok: false }
    sendOpenFile(p)
    return { ok: true }
  })

  mainWindow.on('closed', () => {
    if (windowMode === 'main') app.quit()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (!mainWindow && !isThumbnailMode()) {
    mainWindow = createWindow(windowMode, null)
  }
})