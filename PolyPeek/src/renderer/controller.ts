import * as THREE from 'three'
import { loadModel, waitForTextures } from './loaders'
import {
  createViewer,
  fitCameraToObject,
  computeModelBounds,
  applyDefaultAppearance,
  ViewerHandles,
  Up,
} from './scene'
import { ALL_CLIPS, Timeline, collectMorphTargets, applyMorphSelection, MorphEntry } from './animation'
import { loadViewSettings, saveViewSettings, ViewerMode } from './settings'
import {
  LightRig,
  GroundGrid,
  AxesMarker,
  StageFloor,
  CornerGizmo,
  collectModelStats,
  estimateVolume,
  formatDims,
  formatVolume,
  LightPreset,
} from './viewfx'

interface UiRefs {
  captionEl: HTMLElement
  captionTitle: HTMLElement
  btnClose: HTMLElement
  btnMax: HTMLElement
  btnTop: HTMLElement
  btnPin: HTMLElement
  btnMore: HTMLElement
  btnPanel: HTMLElement
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
  animBar: HTMLElement
  btnPlay: HTMLElement
  btnSpeed: HTMLElement
  speedPop: HTMLElement
  animRange: HTMLInputElement
  animTimeEl: HTMLElement
  panel: HTMLElement
  btnPanelClose: HTMLElement
  stVerts: HTMLElement
  stTris: HTMLElement
  stMeshes: HTMLElement
  stMats: HTMLElement
  stSize: HTMLElement
  stVolume: HTMLElement
  modeSeg: HTMLElement
  tgGrid: HTMLInputElement
  tgAxes: HTMLInputElement
  tgGizmo: HTMLInputElement
  tgRotate: HTMLInputElement
  tgPerf: HTMLInputElement
  lightSeg: HTMLElement
  lightRange: HTMLInputElement
  secAnim: HTMLElement
  clipSel: HTMLSelectElement
  secMorph: HTMLElement
  morphChips: HTMLElement
  perfEl: HTMLElement
}

export function bindUi(): UiRefs {
  const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement
  const $in = (id: string): HTMLInputElement => document.getElementById(id) as HTMLInputElement
  return {
    captionEl: $('caption'),
    captionTitle: $('captionTitle'),
    btnClose: $('btnClose'),
    btnMax: $('btnMax'),
    btnTop: $('btnTop'),
    btnPin: $('btnPin'),
    btnMore: $('btnMore'),
    btnPanel: $('btnPanel'),
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
    animBar: $('animbar'),
    btnPlay: $('btnPlay'),
    btnSpeed: $('btnSpeed'),
    speedPop: $('speedPop'),
    animRange: $in('animRange'),
    animTimeEl: $('animTime'),
    panel: $('panel'),
    btnPanelClose: $('btnPanelClose'),
    stVerts: $('stVerts'),
    stTris: $('stTris'),
    stMeshes: $('stMeshes'),
    stMats: $('stMats'),
    stSize: $('stSize'),
    stVolume: $('stVolume'),
    modeSeg: $('modeSeg'),
    tgGrid: $in('tgGrid'),
    tgAxes: $in('tgAxes'),
    tgGizmo: $in('tgGizmo'),
    tgRotate: $in('tgRotate'),
    tgPerf: $in('tgPerf'),
    lightSeg: $('lightSeg'),
    lightRange: $in('lightRange'),
    secAnim: $('secAnim'),
    clipSel: document.getElementById('clipSel') as HTMLSelectElement,
    secMorph: $('secMorph'),
    morphChips: $('morphChips'),
    perfEl: $('perf'),
  }
}

interface LoadTimings {
  parseMs?: number
  setupMs?: number
  totalMs?: number
}

export interface AppController {
  loadFile: (path: string) => Promise<void>
  setStatus: (text: string, isError?: boolean) => void
  update: (dt: number) => void
  afterRender: () => void
  dispose: () => void
  reload: () => Promise<void>
}

export function createAppController(
  handles: ViewerHandles,
  ui: UiRefs,
  opts: { animate: boolean; onLoaded?: () => void; closeOnSpace?: boolean },
): AppController {
  // Shadows are enabled once; they only cost anything while a stage light
  // actually casts (toggling renderer.shadowMap.enabled at runtime would need
  // every material to recompile).
  handles.renderer.shadowMap.enabled = true
  handles.renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const lightRig = new LightRig(handles.scene)
  const grid = new GroundGrid(handles.scene)
  const axes = new AxesMarker(handles.scene)
  const floor = new StageFloor(handles.scene)
  const gizmo = new CornerGizmo()

  // pivot group: presentation mode rotates THIS around the model centre
  const spin = new THREE.Group()
  handles.root.add(spin)

  let currentGroup: THREE.Group | null = null
  let currentPath: string | null = null
  let pinned = false
  let topOn = false

  let timeline: Timeline | null = null
  let morphEntries: MorphEntry[] = []
  const morphSelected = new Set<string>()

  // restored once per window: the panel state (grid, axes, view mode, ...)
  // persists as the default for every later open, including ~ previews
  const saved = loadViewSettings()
  const view = {
    mode: saved.mode,
    autoRotate: saved.autoRotate,
    grid: saved.grid,
    axes: saved.axes,
    gizmo: saved.gizmo,
    perf: saved.perf,
    preset: saved.preset,
  }
  let lightIntensity = saved.intensity

  // presentation (展台) drag: pointer drives target rotation, release springs
  // back to the front view
  let presenting = false
  let presentLastX = 0
  let presentLastY = 0
  const presentTarget = { x: 0, y: 0 }
  const presentCurrent = { x: 0, y: 0 }

  // fps overlay
  let fps = 0
  let fpsAcc = 0
  let fpsFrames = 0

  const setStatus = (text: string, isError = false): void => {
    ui.statusEl.textContent = text
    ui.statusEl.classList.toggle('err', isError)
  }

  const setTitle = (t: string): void => {
    ui.captionTitle.textContent = t
    void window.api.setTitle(t)
  }

  /* ---------- view state ---------- */

  const resetSpin = (): void => {
    presentTarget.x = 0
    presentTarget.y = 0
    presentCurrent.x = 0
    presentCurrent.y = 0
    spin.rotation.set(0, 0, 0)
  }

  const applyMode = (): void => {
    const stage = view.mode === 'stage'
    const presentation = view.mode === 'presentation'
    handles.controls.enabled = !presentation
    handles.controls.autoRotate = view.autoRotate && !presentation
    if (presentation) resetSpin()
    lightRig.setShadows(stage)
    floor.setVisible(stage)
    if (currentGroup) {
      currentGroup.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = stage
      })
    }
    ui.modeSeg.querySelectorAll<HTMLElement>('.seg-btn').forEach((b) => {
      b.classList.toggle('on', b.dataset.mode === view.mode)
    })
  }

  const syncDisplayUi = (): void => {
    ui.tgGrid.checked = view.grid
    ui.tgAxes.checked = view.axes
    ui.tgGizmo.checked = view.gizmo
    ui.tgRotate.checked = view.autoRotate
    ui.tgPerf.checked = view.perf
    grid.setVisible(view.grid)
    axes.setVisible(view.axes)
    ui.perfEl.classList.toggle('show', view.perf)
    handles.controls.autoRotate = view.autoRotate && view.mode !== 'presentation'
  }

  const persist = (): void => {
    saveViewSettings({
      mode: view.mode,
      grid: view.grid,
      axes: view.axes,
      gizmo: view.gizmo,
      autoRotate: view.autoRotate,
      perf: view.perf,
      preset: view.preset,
      intensity: lightIntensity,
    })
  }

  const setPanel = (open: boolean): void => {
    ui.btnPanel.classList.toggle('on', open)
    if (open) {
      ui.panel.classList.add('show')
      void ui.panel.offsetWidth
      ui.panel.classList.add('open')
    } else {
      ui.panel.classList.remove('open')
      window.setTimeout(() => {
        if (!ui.panel.classList.contains('open')) ui.panel.classList.remove('show')
      }, 220)
    }
  }

  ui.btnPanel.addEventListener('click', () => {
    setPanel(!ui.panel.classList.contains('open'))
  })
  ui.btnPanelClose.addEventListener('click', () => setPanel(false))

  /* ---------- animation timeline ---------- */

  const animLabel = (t: number): string => {
    const total = Math.max(0, Math.round(t))
    const m = Math.floor(total / 60)
    const s = String(total % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  let lastLabel = ''
  let lastSlider = -1
  let lastGlyphPlaying: boolean | null = null

  const updateAnimUi = (): void => {
    const tl = timeline
    if (!tl || !tl.hasAnimation || tl.duration <= 0) {
      ui.animBar.classList.remove('show')
      lastLabel = ''
      lastSlider = -1
      return
    }
    ui.animBar.classList.add('show')
    const label = `${animLabel(tl.time)} / ${animLabel(tl.duration)}`
    if (label !== lastLabel) {
      ui.animTimeEl.textContent = label
      lastLabel = label
    }
    if (!tl.scrubbing && document.activeElement !== ui.animRange) {
      const slider = Math.round((tl.time / tl.duration) * 1000)
      if (slider !== lastSlider) {
        ui.animRange.value = String(slider)
        lastSlider = slider
      }
    }
    if (tl.playing !== lastGlyphPlaying) {
      ui.btnPlay.innerHTML = tl.playing ? '&#xE769;' : '&#xE768;'
      lastGlyphPlaying = tl.playing
    }
  }

  const rebuildClipUi = (): void => {
    const tl = timeline
    if (!tl || !tl.hasAnimation) {
      ui.secAnim.classList.add('hide')
      ui.animBar.classList.remove('show')
      return
    }
    ui.secAnim.classList.remove('hide')
    ui.clipSel.innerHTML = ''
    const all = document.createElement('option')
    all.value = ALL_CLIPS
    all.textContent = `全部片段（${tl.clips.length}）`
    ui.clipSel.appendChild(all)
    for (const c of tl.clips) {
      const o = document.createElement('option')
      o.value = c.name
      o.textContent = c.name
      ui.clipSel.appendChild(o)
    }
    ui.clipSel.value = tl.clipName
  }

  const SPEEDS = [0.25, 0.5, 1, 1.5, 2]
  let speedIdx = 2
  const applySpeed = (): void => {
    const v = SPEEDS[speedIdx]
    ui.btnSpeed.textContent = `${v}×`
    timeline?.setSpeed(v)
    ui.speedPop.querySelectorAll('button').forEach((b, i) => {
      b.classList.toggle('on', i === speedIdx)
    })
  }
  SPEEDS.forEach((v, i) => {
    const b = document.createElement('button')
    b.textContent = `${v}×`
    b.addEventListener('click', () => {
      speedIdx = i
      applySpeed()
      ui.speedPop.classList.remove('show')
    })
    ui.speedPop.appendChild(b)
  })
  applySpeed()
  ui.btnSpeed.addEventListener('click', () => {
    ui.speedPop.classList.toggle('show')
    ui.btnSpeed.blur()
  })
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as Node
    if (t !== ui.btnSpeed && !ui.speedPop.contains(t)) {
      ui.speedPop.classList.remove('show')
    }
  })

  /* ---------- morph targets ---------- */

  const refreshMorphChips = (): void => {
    ui.morphChips.querySelectorAll<HTMLElement>('.chip').forEach((b) => {
      b.classList.toggle('on', morphSelected.has(b.textContent ?? ''))
    })
  }

  const rebuildMorphUi = (): void => {
    ui.morphChips.innerHTML = ''
    morphSelected.clear()
    if (morphEntries.length === 0) {
      ui.secMorph.classList.add('hide')
      return
    }
    ui.secMorph.classList.remove('hide')
    const names = [...new Set(morphEntries.map((e) => e.name))]
    for (const name of names) {
      const b = document.createElement('button')
      b.className = 'chip'
      b.textContent = name
      b.title = '点击切换形态键（可同时选择多个）'
      b.addEventListener('click', () => {
        if (morphSelected.has(name)) morphSelected.delete(name)
        else morphSelected.add(name)
        applyMorphSelection(morphEntries, morphSelected)
        refreshMorphChips()
      })
      ui.morphChips.appendChild(b)
    }
  }

  /* ---------- stats ---------- */

  let volumeToken = 0
  const clearStats = (): void => {
    volumeToken++
    ui.stVerts.textContent = '—'
    ui.stTris.textContent = '—'
    ui.stMeshes.textContent = '—'
    ui.stMats.textContent = '—'
    ui.stSize.textContent = '—'
    ui.stVolume.textContent = '—'
  }

  const scheduleVolume = (group: THREE.Group): void => {
    const token = ++volumeToken
    ui.stVolume.textContent = '计算中…'
    window.setTimeout(() => {
      if (token !== volumeToken) return
      let v: number | null = null
      try {
        v = estimateVolume(group)
      } catch {
        v = null
      }
      if (token !== volumeToken) return
      ui.stVolume.textContent = formatVolume(v)
    }, 60)
  }

  /* ---------- load / dispose ---------- */

  function update(dt: number): void {
    if (view.perf) {
      fpsAcc += dt
      fpsFrames++
      if (fpsAcc >= 0.5) {
        fps = fpsFrames / fpsAcc
        const ms = (fpsAcc / fpsFrames) * 1000
        ui.perfEl.textContent = `${Math.round(fps)} FPS · ${ms.toFixed(1)} ms`
        fpsAcc = 0
        fpsFrames = 0
      }
    }
    if (timeline) {
      timeline.update(dt)
      updateAnimUi()
    }
    if (view.mode === 'presentation') {
      if (!presenting) {
        const k = 1 - Math.exp(-3.0 * dt)
        presentTarget.x += (0 - presentTarget.x) * k
        presentTarget.y += (0 - presentTarget.y) * k
      }
      const k2 = 1 - Math.exp(-16 * dt)
      presentCurrent.x += (presentTarget.x - presentCurrent.x) * k2
      presentCurrent.y += (presentTarget.y - presentCurrent.y) * k2
      spin.rotation.order = 'YXZ'
      spin.rotation.x = presentCurrent.x
      spin.rotation.y = presentCurrent.y
      spin.rotation.z = 0
    }
  }

  function afterRender(): void {
    if (!view.gizmo) return
    const bottom = document.body.classList.contains('main') ? 34 : 14
    gizmo.render(handles.renderer, handles.camera, handles.controls.target, {
      size: 88,
      margin: 12,
      bottom,
    })
  }

  async function reload(): Promise<void> {
    if (!currentPath) return
    await loadFile(currentPath)
  }

  function disposeCurrent(): void {
    clearStats()
    timeline?.dispose()
    timeline = null
    morphEntries = []
    morphSelected.clear()
    ui.secAnim.classList.add('hide')
    ui.secMorph.classList.add('hide')
    ui.morphChips.innerHTML = ''
    ui.animBar.classList.remove('show')
    resetSpin()
    if (currentGroup) {
      spin.remove(currentGroup)
      currentGroup.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
        const mats = Array.isArray(mat) ? mat : mat ? [mat] : []
        for (const m of mats) {
          if (!m) continue
          // materials keep their textures in arbitrary slots (map, normalMap,
          // ...) - dispose every texture value before the material itself
          for (const key of Object.keys(m)) {
            const v = (m as unknown as Record<string, unknown>)[key]
            if (v instanceof THREE.Texture) v.dispose()
          }
          m.dispose()
        }
      })
      currentGroup = null
    }
  }

  async function loadFile(path: string): Promise<void> {
    currentPath = path
    const t0 = performance.now()
    // hidden test hook: timings are read back via --capture-js
    const timings: LoadTimings = {}
    ;(window as unknown as { __ppTimings?: LoadTimings }).__ppTimings = timings
    const name = path.split(/[\\/]/).pop() || path
    ui.filenameEl.textContent = path
    setTitle(name)
    ui.loadingEl.classList.add('show')
    setStatus('解析模型中…')
    try {
      const loaded = await loadModel(path)
      timings.parseMs = Math.round(performance.now() - t0)

      // Free the previous model right after the new one parsed: peak memory
      // stays at one parsed model instead of two during the texture phase.
      disposeCurrent()
      currentGroup = loaded.group

      // centre the model inside the spin pivot: rotating the pivot then spins
      // the model around its own centre, not around the world origin
      spin.add(loaded.group)
      // measure the fresh model in a clean identity frame (the pivot may still
      // carry the previous model's transform which would skew the bounds)
      spin.position.set(0, 0, 0)
      spin.rotation.set(0, 0, 0)
      spin.updateMatrixWorld(true)
      const box = computeModelBounds(loaded.group)
      const center = box.getCenter(new THREE.Vector3())
      const sizeV = box.getSize(new THREE.Vector3())
      spin.position.copy(center)
      loaded.group.position.sub(center)
      // refresh world matrices so the fit below sees the real (recentred)
      // transform instead of the previous frame's stale spin matrix
      spin.updateMatrixWorld(true)

      const size = fitCameraToObject(handles.controls, handles.camera, loaded.group, loaded.up, box)
      // keep the spin pivot at the fitted focus point so turntable rotation
      // stays centred on screen (world position of the model is unchanged)
      const focus = handles.controls.target
      const focusDelta = focus.clone().sub(center)
      if (focusDelta.lengthSq() > 1e-12) {
        spin.position.add(focusDelta)
        loaded.group.position.sub(focusDelta)
        spin.updateMatrixWorld(true)
      }
      const maxDim = Math.max(size.x, size.y, size.z, 0.05)
      applyDefaultAppearance(loaded.group, maxDim)

      grid.fit(center, sizeV, loaded.up)
      axes.fit(center, sizeV, loaded.up)
      floor.fit(center, sizeV, loaded.up)
      lightRig.setBounds(center, maxDim)
      applyMode()

      timeline = new Timeline(loaded.animRoot, loaded.clips)
      rebuildClipUi()
      morphEntries = collectMorphTargets(loaded.group)
      rebuildMorphUi()

      const stats = collectModelStats(loaded.group)
      ui.stVerts.textContent = stats.vertices.toLocaleString()
      ui.stTris.textContent = stats.triangles.toLocaleString()
      ui.stMeshes.textContent = stats.meshes.toLocaleString()
      ui.stMats.textContent = stats.materials.toLocaleString()
      ui.stSize.textContent = formatDims(sizeV)
      scheduleVolume(loaded.group)

      timings.setupMs = Math.round(performance.now() - t0 - timings.parseMs)
      timings.totalMs = Math.round(performance.now() - t0)

      // show the model now; external textures keep decoding in the background
      // and the render loop displays them as they arrive
      ui.loadingEl.classList.remove('show')

      const anim =
        timeline.hasAnimation
          ? `　·　动画 ${timeline.clips.length} 个片段`
          : ''
      const slow =
        (timings.parseMs ?? 0) > 1200 ? `　·　解析 ${((timings.parseMs ?? 0) / 1000).toFixed(1)}s` : ''
      setStatus(
        `${name}　·　顶点 ${stats.vertices.toLocaleString()}　·　三角面 ${stats.triangles.toLocaleString()}${anim}${slow}`,
      )
      opts.onLoaded?.()
      void waitForTextures(loaded.group).catch(() => {
        /* texture pruning failure is non-fatal */
      })
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
      ui.qlMenu.style.left = `${Math.max(4, r.right - 220)}px`
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
      } else if (act === 'panel') setPanel(!ui.panel.classList.contains('open'))
      else if (act === 'grid-toggle') {
        view.grid = !view.grid
        syncDisplayUi()
        persist()
      } else if (act === 'axes-toggle') {
        view.axes = !view.axes
        syncDisplayUi()
        persist()
      }
    })
  })

  const onDocMouseDown = (e: MouseEvent): void => {
    if (ui.qlMenu.classList.contains('show') && !(e.target as HTMLElement).closest('.ql-menu, #btnMore')) {
      closeMenu()
    }
  }
  window.addEventListener('mousedown', onDocMouseDown)

  window.api.onWinState(({ maximized }) => {
    document.body.classList.toggle('maximized', maximized)
    ui.btnMax.innerHTML = maximized ? '&#xE73F;' : '&#xE740;'
    ui.btnMax.title = maximized ? '还原' : '最大化'
  })

  /* ---------- panel controls ---------- */

  ui.modeSeg.querySelectorAll<HTMLElement>('.seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      view.mode = (b.dataset.mode as ViewerMode) || 'orbit'
      applyMode()
      persist()
    })
  })

  ui.tgGrid.addEventListener('change', () => {
    view.grid = ui.tgGrid.checked
    syncDisplayUi()
    persist()
  })
  ui.tgAxes.addEventListener('change', () => {
    view.axes = ui.tgAxes.checked
    syncDisplayUi()
    persist()
  })
  ui.tgGizmo.addEventListener('change', () => {
    view.gizmo = ui.tgGizmo.checked
    persist()
  })
  ui.tgRotate.addEventListener('change', () => {
    view.autoRotate = ui.tgRotate.checked
    syncDisplayUi()
    persist()
  })
  ui.tgPerf.addEventListener('change', () => {
    view.perf = ui.tgPerf.checked
    fpsAcc = 0
    fpsFrames = 0
    syncDisplayUi()
    persist()
  })

  ui.lightSeg.querySelectorAll<HTMLElement>('.seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      view.preset = (b.dataset.preset as LightPreset) || 'threePoint'
      lightRig.setPreset(view.preset)
      ui.lightSeg.querySelectorAll<HTMLElement>('.seg-btn').forEach((x) => {
        x.classList.toggle('on', x.dataset.preset === view.preset)
      })
      persist()
    })
  })

  ui.lightRange.addEventListener('input', () => {
    lightIntensity = Number(ui.lightRange.value) / 100
    lightRig.setIntensity(lightIntensity)
  })
  ui.lightRange.addEventListener('change', persist)

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
      /\.(glb|gltf|obj|fbx|stl|ply|dae|3ds|usdz|drc|3mf|amf|lwo|vox|wrl|xyz|pcd|gcode|nc|ncc|ngc|vtk|vtp|step|stp|iges|igs|brep|brp|sldprt|sldasm)$/i.test(
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

  /* ---------- canvas interactions ---------- */

  const canvas = handles.renderer.domElement

  const onCanvasDblClick = (): void => {
    resetSpin()
    handles.controls.reset()
    handles.controls.update()
  }
  canvas.addEventListener('dblclick', onCanvasDblClick)

  const onPointerDown = (e: PointerEvent): void => {
    if (view.mode !== 'presentation' || e.button !== 0) return
    presenting = true
    presentLastX = e.clientX
    presentLastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent): void => {
    if (!presenting) return
    const dx = e.clientX - presentLastX
    const dy = e.clientY - presentLastY
    presentLastX = e.clientX
    presentLastY = e.clientY
    presentTarget.y += dx * 0.011
    presentTarget.x = Math.max(-0.75, Math.min(0.75, presentTarget.x + dy * 0.009))
  }
  const onPointerUp = (): void => {
    presenting = false
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)

  /* ---------- animation bar ---------- */

  ui.btnPlay.addEventListener('click', () => {
    if (timeline) timeline.playing = !timeline.playing
    updateAnimUi()
    ui.btnPlay.blur()
  })

  ui.clipSel.addEventListener('change', () => {
    if (!timeline) return
    timeline.selectClip(ui.clipSel.value)
    timeline.setTime(0)
    updateAnimUi()
  })

  const endScrub = (): void => {
    if (!timeline || !timeline.scrubbing) return
    timeline.scrubbing = false
    updateAnimUi()
  }

  ui.animRange.addEventListener('pointerdown', () => {
    if (timeline) timeline.scrubbing = true
  })
  ui.animRange.addEventListener('input', () => {
    if (!timeline || timeline.duration <= 0) return
    timeline.setTime((Number(ui.animRange.value) / 1000) * timeline.duration)
    updateAnimUi()
  })
  ui.animRange.addEventListener('change', endScrub)
  window.addEventListener('pointerup', endScrub)

  /* ---------- keyboard ---------- */

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'F5') {
      e.preventDefault()
      void reload()
      return
    }
    if (e.key === ' ' && !e.repeat) {
      if (opts.closeOnSpace) {
        e.preventDefault()
        void window.api.closeWindow()
      } else if (timeline?.hasAnimation) {
        e.preventDefault()
        timeline.playing = !timeline.playing
        updateAnimUi()
      }
      return
    }
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
    if (e.key === 'g' || e.key === 'G') {
      view.grid = !view.grid
      syncDisplayUi()
      persist()
    } else if (e.key === 'x' || e.key === 'X') {
      view.axes = !view.axes
      syncDisplayUi()
      persist()
    } else if (e.key === 'p' || e.key === 'P') {
      setPanel(!ui.panel.classList.contains('open'))
    }
  }
  window.addEventListener('keydown', onKeyDown)

  /* ---------- restore persisted view settings ---------- */

  syncDisplayUi()
  lightRig.setPreset(view.preset)
  lightRig.setIntensity(lightIntensity)
  ui.lightRange.value = String(Math.round(lightIntensity * 100))
  ui.lightSeg.querySelectorAll<HTMLElement>('.seg-btn').forEach((b) => {
    b.classList.toggle('on', b.dataset.preset === view.preset)
  })
  applyMode()

  return {
    loadFile,
    setStatus,
    reload,
    update,
    afterRender,
    dispose() {
      disposeCurrent()
      timeline = null
      lightRig.dispose()
      grid.dispose()
      axes.dispose()
      floor.dispose()
      gizmo.dispose()
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('pointerup', endScrub)
      window.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('dblclick', onCanvasDblClick)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      handles.dispose()
    },
  }
}

export function animateLoop(
  handles: ViewerHandles,
  onFrame?: (dt: number) => void,
  afterFrame?: () => void,
): void {
  const clock = { last: performance.now() }
  // offscreen capture windows report hidden too - keep rendering for those
  const isCapture = (window as unknown as { __ppCapture?: boolean }).__ppCapture === true
  const tick = (): void => {
    requestAnimationFrame(tick)
    const now = performance.now()
    // minimized / hidden windows: idle instead of burning CPU + GPU on frames
    // nobody can see (timestamps reset so dt does not spike on restore)
    if (document.hidden && !isCapture) {
      clock.last = now
      return
    }
    const dt = Math.min(0.1, (now - clock.last) / 1000)
    clock.last = now
    handles.controls.update()
    onFrame?.(dt)
    handles.renderer.render(handles.scene, handles.camera)
    afterFrame?.()
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
