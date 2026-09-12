import { createViewer } from './scene'
import { initTheme } from './theme'
import { bindUi, createAppController, animateLoop, onViewportResize } from './controller'

export async function runPreview(params: URLSearchParams): Promise<void> {
  const viewport = document.getElementById('viewport') as HTMLElement
  const ui = bindUi()

  document.body.classList.add('preview')

  const handles = createViewer(viewport)
  const c = createAppController(handles, ui, { animate: true, closeOnSpace: true })

  await initTheme(handles)
  animateLoop(handles, c.getMixers)
  window.addEventListener('resize', () => onViewportResize(handles))

  // Main window ESC is handled at the BrowserWindow level; keep a renderer
  // fallback in case focus lands on an iframe-like element.
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') void window.api.closeWindow()
  })

  const file = params.get('file')
  if (file) {
    c.setStatus(file.split(/[\\/]/).pop() || file)
    const title = file.split(/[\\/]/).pop() || '3D Preview'
    void window.api.setTitle(title)
    void c.loadFile(file)
  } else {
    const launch = await window.api.getLaunch()
    if (launch?.file) void c.loadFile(launch.file)
  }
}