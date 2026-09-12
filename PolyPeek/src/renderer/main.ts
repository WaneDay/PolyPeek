import { createViewer } from './scene'
import { initTheme } from './theme'
import { bindUi, createAppController, animateLoop, onViewportResize } from './controller'

export async function runMain(params: URLSearchParams): Promise<void> {
  const viewport = document.getElementById('viewport') as HTMLElement
  const ui = bindUi()

  document.body.classList.add('main')

  const handles = createViewer(viewport)
  const c = createAppController(handles, ui, { animate: true })

  await initTheme(handles)
  animateLoop(handles, c.getMixers)
  window.addEventListener('resize', () => onViewportResize(handles))

  const file = params.get('file')
  if (file) {
    void c.loadFile(file)
  } else {
    const launch = await window.api.getLaunch()
    if (launch?.file) void c.loadFile(launch.file)
  }
}