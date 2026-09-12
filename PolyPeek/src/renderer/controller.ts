import * as THREE from 'three'
import { loadModel, waitForTextures } from './loaders'
import {
  createViewer,
  fitCameraToObject,
  applyDefaultAppearance,
  collectStats,
  ViewerHandles,
} from './scene'

interface UiRefs {
  captionEl: HTMLElement
  captionTitle: HTMLElement
  btnClose: HTMLElement
  btnMax: HTMLElement
  btnTop: HTMLElement
  btnPin: HTMLElement
  btnMore: HTMLElement
  qlMenu: HTMLElement
  btnReload: HTMLElement
  btnOpen: HTMLElement
  btnOpenWith: HTMLElement
  btnShare: HTMLElement
  btnOpenFile: HTMLElement
  statusEl: HTMLElement
  filenameEl: HTMLElement
  loadingEl: HTMLElement
  dropEl: HTMLElement
}

export function bindUi(): UiRefs {
  const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement
  return {
    captionEl: $('caption'),
    captionTitle: $('captionTitle'),
    btnClose: $('btnClose'),
    btnMax: $('btnMax'),
    btnTop: $('btnTop'),
    btnPin: $('btnPin'),
    btnMore: $('btnMore'),
    qlMenu: $('qlMenu'),
    btnReload: $('btnReload'),
    btnOpen: $('btnOpen'),
    btnOpenWith: $('btnOpenWith'),
    btnShare: $('btnShare'),
    btnOpenFile: $('btnOpenFile'),
    statusEl: $('status'),
    filenameEl: $('filename'),
    loadingEl: $('loading'),
    dropEl: $('drop'),
  }
}

export interface AppController {
  loadFile: (path: string) => Promise<void>
  setStatus: (text: string, isError?: boolean) => void
  getMixers: () => THREE.AnimationMixer[]
  dispose: () => void
  reload: () => Promise<void>
}

export function createAppController(
  handles: ViewerHandles,
  ui: UiRefs,
  opts: { animate: boolean; onLoaded?: () => void; closeOnSpace?: boolean },
): AppController {
  let currentGroup: THREE.Group | null = null
  let mixers: THREE.AnimationMixer[] = []
  let currentPath: string | null = null
  let pinned = false
  let topOn = false

  const setStatus = (text: string, isError = false): void => {
    ui.statusEl.textContent = text
    ui.statusEl.classList.toggle('err', isError)
  }

  const setTitle = (t: string): void => {
    ui.captionTitle.textContent = t
    void window.api.setTitle(t)
  }

  async function reload(): Promise<void> {
    if (!currentPath) return
    await loadFile(currentPath)
  }

  function disposeCurrent(): void {
    if (currentGroup) {
      handles.root.remove(currentGroup)
      currentGroup.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((m) => m?.dispose())
        else if (mat) mat.dispose()
      })
      mixers = []
      currentGroup = null
    }
  }

  async function loadFile(path: string): Promise<void> {
    currentPath = path
    const name = path.split(/[\\/]/).pop() || path
    ui.filenameEl.textContent = path
    setTitle(name)
    ui.loadingEl.classList.add('show')
    setStatus('加载中…')
    try {
      const loaded = await loadModel(path)
      await waitForTextures(loaded.group)

      disposeCurrent()
      handles.root.add(loaded.group)
      currentGroup = loaded.group
      mixers = loaded.mixers

      const size = fitCameraToObject(handles.controls, handles.camera, loaded.group, loaded.up)
      applyDefaultAppearance(loaded.group, Math.max(size.x, size.y, size.z))

      const stats = collectStats(loaded.group)
      setStatus(
        `${name}　·　顶点 ${stats.vertices.toLocaleString()}　·　三角面 ${stats.triangles.toLocaleString()}`,
      )
      opts.onLoaded?.()
    } catch (err) {
      setStatus(`加载失败: ${String(err)}`, true)
    } finally {
      ui.loadingEl.classList.remove('show')
    }
  }

  /* ---------- caption interactions ---------- */

  ui.btnClose.addEventListener('click', () => {
    void window.api.winControl('close')
  })

  ui.btnMax.addEventListener('click', () => {
    void window.api.winControl('max-toggle')
  })

  ui.btnTop.addEventListener('click', () => {
    topOn = !topOn
    ui.btnTop.classList.toggle('off', !topOn)
    void window.api.winControl('set-top', topOn)
  })

  ui.btnPin.addEventListener('click', () => {
    pinned = !pinned
    ui.btnPin.classList.toggle('off', !pinned)
    void window.api.winControl('set-pin', pinned)
  })

  ui.btnReload.addEventListener('click', () => void reload())

  ui.btnOpen.addEventListener('click', () => {
    if (currentPath) void window.api.winControl('open-path', currentPath)
  })

  ui.btnOpenWith.addEventListener('click', () => {
    if (currentPath) void window.api.winControl('open-with', currentPath)
  })

  ui.btnShare.addEventListener('click', () => {
    if (currentPath) {
      void window.api.winControl('copy-path', currentPath)
      setStatus('文件路径已复制到剪贴板')
    }
  })

  ui.captionEl.addEventListener('dblclick', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.cap-btn')) return
    void window.api.winControl('max-toggle')
  })

  function closeMenu(): void {
    ui.qlMenu.classList.remove('show')
  }

  ui.btnMore.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    const showing = ui.qlMenu.classList.toggle('show')
    if (showing) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      ui.qlMenu.style.left = `${Math.max(4, r.right - 200)}px`
      ui.qlMenu.style.top = `${r.bottom + 4}px`
    }
  })

  ui.qlMenu.querySelectorAll<HTMLElement>('.mi[data-act]').forEach((item) => {
    item.addEventListener('click', () => {
      const act = item.dataset.act
      closeMenu()
      if (act === 'reload') void reload()
      else if (act === 'copy-path') {
        if (currentPath) {
          void window.api.winControl('copy-path', currentPath)
          setStatus('文件路径已复制到剪贴板')
        }
      }
    })
  })

  window.addEventListener('mousedown', (e: MouseEvent) => {
    if (ui.qlMenu.classList.contains('show') && !(e.target as HTMLElement).closest('.ql-menu, #btnMore')) {
      closeMenu()
    }
  })

  window.api.onWinState(({ maximized }) => {
    document.body.classList.toggle('maximized', maximized)
    ui.btnMax.innerHTML = maximized ? '&#xE73F;' : '&#xE740;'
    ui.btnMax.title = maximized ? '还原' : '最大化'
  })

  /* ---------- file open (main mode) ---------- */

  ui.btnOpenFile.addEventListener('click', async () => {
    const res = await window.api.openFile()
    if (!res.canceled && res.files?.length) {
      await loadFile(res.files[0])
    }
  })

  window.api.onOpenFile((p) => void loadFile(p))

  /* ---------- drag & drop ---------- */

  const dragDepth = { value: 0 }
  const onDragOver = (e: DragEvent): void => {
    if (e.dataTransfer && [...(e.dataTransfer.items || [])].some((i) => i.kind === 'file')) {
      e.preventDefault()
      dragDepth.value++
      ui.dropEl.classList.add('show')
    }
  }
  const onDragLeave = (): void => {
    dragDepth.value = Math.max(0, dragDepth.value - 1)
    if (dragDepth.value === 0) ui.dropEl.classList.remove('show')
  }
  const onDrop = (e: DragEvent): void => {
    e.preventDefault()
    dragDepth.value = 0
    ui.dropEl.classList.remove('show')
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    const supported = [...files].filter((f) =>
      /\.(glb|gltf|obj|fbx|stl|ply|dae|3ds|usdz|drc|3mf|amf|lwo|vox|wrl|xyz|pcd|gcode|nc|ncc|ngc|vtk|vtp|step|stp|iges|igs|brep|brp)$/i.test(
        f.name,
      ),
    )
    if (supported.length === 0) {
      setStatus('不支持的文件类型', true)
      return
    }
    const file = supported[0]
    const absPath = window.api.getPathForFile(file)
    if (!absPath) {
      setStatus('无法获取文件路径（拖拽）', true)
      return
    }
    void loadFile(absPath)
  }

  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'F5') {
      e.preventDefault()
      void reload()
    }
    if (opts.closeOnSpace && e.key === ' ') {
      e.preventDefault()
      void window.api.closeWindow()
    }
  })

  return {
    loadFile,
    setStatus,
    reload,
    getMixers: () => mixers,
    dispose() {
      disposeCurrent()
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      handles.dispose()
    },
  }
}

export function animateLoop(
  handles: ViewerHandles,
  getMixers: () => THREE.AnimationMixer[],
): void {
  const clock = { last: performance.now() }
  const tick = (): void => {
    requestAnimationFrame(tick)
    const now = performance.now()
    const dt = Math.min(0.1, (now - clock.last) / 1000)
    clock.last = now
    handles.controls.update()
    for (const m of getMixers()) m.update(dt)
    handles.renderer.render(handles.scene, handles.camera)
  }
  tick()
}

export function onViewportResize(handles: ViewerHandles): void {
  const el = handles.renderer.domElement.parentElement
  if (!el) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (w === 0 || h === 0) return
  handles.camera.aspect = w / h
  handles.camera.updateProjectionMatrix()
  handles.renderer.setSize(w, h)
}