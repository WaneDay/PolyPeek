import { runThumbnail } from './thumbnail'
import { runPreview } from './preview'
import { runMain } from './main'

const params = new URLSearchParams(window.location.search)
const mode = params.get('mode') || 'main'

document.body.classList.add(mode === 'thumbnail' ? 'main' : mode)

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