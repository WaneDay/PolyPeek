import { runThumbnail } from './thumbnail'
import { runPreview } from './preview'
import { runMain } from './main'

const params = new URLSearchParams(window.location.search)
const mode = params.get('mode') || 'main'

// hidden capture windows are offscreen and report document.hidden - tell the
// render loop to keep drawing frames for them
if (params.get('capture')) (window as unknown as Record<string, unknown>).__ppCapture = true

document.body.className = mode === 'thumbnail' ? 'main' : mode

async function boot(): Promise<void> {
  if (mode === 'thumbnail') {
    await runThumbnail(params)
    return
  }
  if (mode === 'preview') {
    await runPreview(params)
    return
  }
  await runMain(params)
}

boot().catch((err) => {
  const status = document.getElementById('status')
  if (status) status.textContent = '初始化失败: ' + String(err)
  console.error(err)
})