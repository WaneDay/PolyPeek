import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { loadModel, waitForTextures } from './loaders'
import { fitCameraToObject, applyDefaultAppearance } from './scene'

function makePlaceholder(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = '#14161c'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#3a4152'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.round(size * 0.13)}px Segoe UI, sans-serif`
  ctx.fillText('3D', size / 2, size / 2 - size * 0.05)
  ctx.font = `${Math.round(size * 0.07)}px Segoe UI, sans-serif`
  ctx.fillText('无法预览', size / 2, size / 2 + size * 0.16)
}

function encodeBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const data = String(reader.result)
      resolve(data.slice(data.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function deliver(canvas: HTMLCanvasElement, size: number, onError: boolean): void {
  const finish = (base64: string): void => {
    void window.api.thumbComplete(base64).then(() => {
      // main process writes the file and calls app.exit()
    })
  }
  if (onError) {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      makePlaceholder(ctx, size)
      finish(canvas.toDataURL('image/png').split(',')[1])
      return
    }
  }
  canvas.toBlob(async (blob) => {
    if (!blob) {
      finish(canvas.toDataURL('image/png').split(',')[1])
      return
    }
    try {
      const b64 = await encodeBlob(blob)
      finish(b64)
    } catch {
      finish(canvas.toDataURL('image/png').split(',')[1])
    }
  }, 'image/png')
}

export async function runThumbnail(params: URLSearchParams): Promise<void> {
  const file = params.get('file')
  const sizeRaw = Number(params.get('size') || 256)
  const size = Math.min(512, Math.max(96, Math.round(sizeRaw || 256)))

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  let failTimer = window.setTimeout(() => {
    // Last-resort fallback so the caller never hangs waiting for a file.
    deliver(canvas, size, true)
  }, 75000)

  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
      alpha: true,
      powerPreference: 'low-power',
    })
    renderer.setPixelRatio(1)
    renderer.setSize(size, size, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.setClearColor(0x424242, 1)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x424242)

    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000000)
    camera.position.set(3, 2.5, 4)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x555566, 0.55)
    const dir = new THREE.DirectionalLight(0xffffff, 0.7)
    dir.position.set(5, 8, 4)
    scene.add(hemi, dir)

    const loaded = await loadModel(file!)
    await waitForTextures(loaded.group)

    scene.add(loaded.group)
    fitCameraToObject(null, camera, loaded.group, loaded.up)
    applyDefaultAppearance(loaded.group, 1)

    // Wait two frames so GPU work settles before capture.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    renderer.render(scene, camera)

    window.clearTimeout(failTimer)
    deliver(canvas, size, false)
  } catch (err) {
    console.error('[thumb] failed:', err)
    window.clearTimeout(failTimer)
    deliver(canvas, size, true)
  }
}