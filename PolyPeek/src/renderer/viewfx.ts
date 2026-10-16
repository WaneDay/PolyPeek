import * as THREE from 'three'

// ---- lighting presets -------------------------------------------------------

export type LightPreset = 'threePoint' | 'front' | 'rim' | 'top' | 'none'

interface PresetLight {
  /** Direction the light shines FROM (position relative to the model). */
  pos: [number, number, number]
  intensity: number
  shadow?: boolean
}

const PRESETS: Record<LightPreset, PresetLight[]> = {
  threePoint: [
    { pos: [4, 6, 3], intensity: 1.15, shadow: true },
    { pos: [-5, 3, 1], intensity: 0.5 },
    { pos: [0, 4, -7], intensity: 0.65 },
  ],
  front: [{ pos: [0, 1.5, 8], intensity: 1.25, shadow: true }],
  rim: [
    { pos: [0, 5, -8], intensity: 1.25, shadow: true },
    { pos: [0, 1, 6], intensity: 0.22 },
  ],
  top: [{ pos: [0.4, 9, 0.6], intensity: 1.2, shadow: true }],
  none: [],
}

/**
 * Key/fill/rim light rig with presets and a master intensity, sharing one
 * target that follows the loaded model so shadow cameras stay fitted.
 */
export class LightRig {
  readonly group = new THREE.Group()
  private ambient = new THREE.AmbientLight(0xffffff, 0.3)
  private target = new THREE.Object3D()
  private lights: Array<{ light: THREE.DirectionalLight; base: number; canShadow: boolean }> = []
  private preset: LightPreset = 'threePoint'
  private intensity = 1
  private shadows = false
  private maxDim = 1

  constructor(scene: THREE.Scene) {
    scene.add(this.group)
    this.build()
  }

  setPreset(p: LightPreset): void {
    this.preset = p
    this.build()
  }

  setIntensity(v: number): void {
    this.intensity = v
    this.applyIntensity()
  }

  setShadows(on: boolean): void {
    this.shadows = on
    for (const entry of this.lights) {
      entry.light.castShadow = on && entry.canShadow
    }
  }

  /** Keep shadow cameras and light targets fitted to the model bounds. */
  setBounds(center: THREE.Vector3, maxDim: number): void {
    this.maxDim = Math.max(maxDim, 0.05)
    this.target.position.copy(center)
    this.target.updateMatrixWorld()
    const R = this.maxDim * 0.85
    for (const { light } of this.lights) {
      const d = light.position.distanceTo(center)
      const cam = light.shadow.camera
      cam.left = -R
      cam.right = R
      cam.top = R
      cam.bottom = -R
      cam.near = Math.max(0.01, d - this.maxDim)
      cam.far = d + this.maxDim * 2
      cam.updateProjectionMatrix()
      light.shadow.mapSize.set(2048, 2048)
      light.shadow.normalBias = this.maxDim * 0.002
    }
  }

  dispose(): void {
    this.group.parent?.remove(this.group)
    for (const { light } of this.lights) light.dispose()
    this.lights = []
  }

  private build(): void {
    for (const { light } of this.lights) {
      this.group.remove(light)
      light.dispose()
    }
    this.lights = []
    this.group.clear()
    this.group.add(this.ambient, this.target)
    for (const p of PRESETS[this.preset]) {
      const light = new THREE.DirectionalLight(0xffffff, p.intensity)
      light.position.set(p.pos[0], p.pos[1], p.pos[2])
      light.target = this.target
      light.castShadow = this.shadows && !!p.shadow
      this.group.add(light)
      this.lights.push({ light, base: p.intensity, canShadow: !!p.shadow })
    }
    this.applyIntensity()
  }

  private applyIntensity(): void {
    for (const { light, base } of this.lights) light.intensity = base * this.intensity
  }
}

// ---- ground helpers ---------------------------------------------------------

export class GroundGrid {
  readonly helper: THREE.GridHelper

  constructor(scene: THREE.Scene) {
    this.helper = new THREE.GridHelper(10, 40, 0x6b7480, 0x3d434c)
    const mat = this.helper.material as THREE.Material
    mat.transparent = true
    mat.opacity = 0.5
    mat.depthWrite = false
    this.helper.visible = false
    scene.add(this.helper)
  }

  fit(center: THREE.Vector3, size: THREE.Vector3, up: 'y' | 'z'): void {
    const maxDim = Math.max(size.x, size.y, size.z, 0.05)
    const s = (maxDim * 6) / 10
    this.helper.scale.set(s, 1, s)
    const eps = maxDim * 0.0005
    if (up === 'z') {
      this.helper.rotation.set(Math.PI / 2, 0, 0)
      this.helper.position.set(center.x, center.y, center.z - size.z / 2 + eps)
    } else {
      this.helper.rotation.set(0, 0, 0)
      this.helper.position.set(center.x, center.y - size.y / 2 + eps, center.z)
    }
  }

  setVisible(v: boolean): void {
    this.helper.visible = v
  }

  dispose(): void {
    this.helper.parent?.remove(this.helper)
    this.helper.geometry.dispose()
    ;(this.helper.material as THREE.Material).dispose()
  }
}

export class AxesMarker {
  readonly helper: THREE.AxesHelper

  constructor(scene: THREE.Scene) {
    this.helper = new THREE.AxesHelper(1)
    this.helper.visible = false
    scene.add(this.helper)
  }

  fit(center: THREE.Vector3, size: THREE.Vector3, up: 'y' | 'z'): void {
    const maxDim = Math.max(size.x, size.y, size.z, 0.05)
    this.helper.scale.setScalar(maxDim * 0.75)
    const eps = maxDim * 0.002
    if (up === 'z') this.helper.position.set(center.x, center.y, center.z - size.z / 2 + eps)
    else this.helper.position.set(center.x, center.y - size.y / 2 + eps, center.z)
  }

  setVisible(v: boolean): void {
    this.helper.visible = v
  }

  dispose(): void {
    this.helper.parent?.remove(this.helper)
    this.helper.geometry.dispose()
    ;(this.helper.material as THREE.Material).dispose()
  }
}

/** Shadow-catching ground disc for the stage view mode. */
export class StageFloor {
  readonly mesh: THREE.Mesh

  constructor(scene: THREE.Scene) {
    const geo = new THREE.CircleGeometry(1, 64)
    const mat = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.38 })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.receiveShadow = true
    this.mesh.visible = false
    scene.add(this.mesh)
  }

  fit(center: THREE.Vector3, size: THREE.Vector3, up: 'y' | 'z'): void {
    const maxDim = Math.max(size.x, size.y, size.z, 0.05)
    this.mesh.scale.setScalar(maxDim * 1.8)
    const eps = maxDim * 0.0008
    if (up === 'z') {
      this.mesh.rotation.set(0, 0, 0)
      this.mesh.position.set(center.x, center.y, center.z - size.z / 2 + eps)
    } else {
      this.mesh.rotation.set(-Math.PI / 2, 0, 0)
      this.mesh.position.set(center.x, center.y - size.y / 2 + eps, center.z)
    }
  }

  setVisible(v: boolean): void {
    this.mesh.visible = v
  }

  dispose(): void {
    this.mesh.parent?.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}

// ---- corner orientation gizmo (scissored overlay) ---------------------------

/**
 * A small XYZ axis triad drawn in the viewport corner, oriented from the main
 * camera. Rendered as a scissored overlay after the main scene so it sits on
 * top without disturbing the viewport.
 */
export class CornerGizmo {
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(42, 1, 0.05, 20)
  private disposables: Array<THREE.BufferGeometry | THREE.Material> = []

  constructor() {
    const mk = (dir: THREE.Vector3, color: number): THREE.Group => {
      const shaftLen = 0.74
      const headLen = 0.3
      const g = new THREE.Group()
      const mShaft = new THREE.MeshBasicMaterial({ color })
      const mHead = new THREE.MeshBasicMaterial({ color })
      const shaftGeo = new THREE.CylinderGeometry(0.045, 0.045, shaftLen, 10)
      const headGeo = new THREE.ConeGeometry(0.13, headLen, 14)
      this.disposables.push(mShaft, mHead, shaftGeo, headGeo)
      const shaft = new THREE.Mesh(shaftGeo, mShaft)
      shaft.position.y = shaftLen / 2
      const head = new THREE.Mesh(headGeo, mHead)
      head.position.y = shaftLen + headLen / 2
      g.add(shaft, head)
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      return g
    }
    const root = new THREE.Group()
    root.add(
      mk(new THREE.Vector3(1, 0, 0), 0xe0574f),
      mk(new THREE.Vector3(0, 1, 0), 0x54c96a),
      mk(new THREE.Vector3(0, 0, 1), 0x4f8cff),
    )
    const dotGeo = new THREE.SphereGeometry(0.08, 12, 12)
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1 })
    this.disposables.push(dotGeo, dotMat)
    root.add(new THREE.Mesh(dotGeo, dotMat))
    this.scene.add(root)
  }

  render(
    renderer: THREE.WebGLRenderer,
    mainCamera: THREE.PerspectiveCamera,
    target: THREE.Vector3,
    view: { size: number; margin: number; bottom: number },
  ): void {
    const vw = renderer.domElement.clientWidth
    const vh = renderer.domElement.clientHeight
    if (vw === 0 || vh === 0) return

    const dir = new THREE.Vector3().subVectors(mainCamera.position, target)
    if (dir.lengthSq() < 1e-10) dir.set(0, 0, 1)
    dir.normalize()
    const up = mainCamera.up.clone()
    if (Math.abs(dir.dot(up)) > 0.99) up.set(0, 1, 0)
    if (Math.abs(dir.dot(up)) > 0.99) up.set(1, 0, 0)
    this.camera.position.copy(dir.multiplyScalar(3.4))
    this.camera.up.copy(up)
    this.camera.lookAt(0, 0, 0)

    const s = view.size
    const x = vw - s - view.margin
    const y = view.bottom
    const prevAutoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.setScissorTest(true)
    renderer.setViewport(x, y, s, s)
    renderer.setScissor(x, y, s, s)
    renderer.clearDepth()
    renderer.render(this.scene, this.camera)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, vw, vh)
    renderer.setScissor(0, 0, vw, vh)
    renderer.autoClear = prevAutoClear
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose()
    this.disposables = []
  }
}

// ---- model statistics -------------------------------------------------------

export interface ModelStats {
  vertices: number
  triangles: number
  meshes: number
  materials: number
}

export function collectModelStats(root: THREE.Object3D): ModelStats {
  let vertices = 0
  let triangles = 0
  let meshes = 0
  const mats = new Set<string>()
  const collectMats = (obj: THREE.Object3D & { material?: THREE.Material | THREE.Material[] }): void => {
    const m = obj.material
    if (Array.isArray(m)) for (const x of m) x && mats.add(x.uuid)
    else if (m) mats.add(m.uuid)
  }
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      meshes++
      collectMats(obj)
      const geo = obj.geometry
      const p = geo?.getAttribute('position')
      if (!p) return
      vertices += p.count
      triangles += geo.index ? Math.floor(geo.index.count / 3) : Math.floor(p.count / 3)
    } else if (obj instanceof THREE.Points) {
      meshes++
      collectMats(obj)
      const p = obj.geometry?.getAttribute('position')
      if (p) vertices += p.count
    } else if (obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
      meshes++
      collectMats(obj)
      const p = obj.geometry?.getAttribute('position')
      if (p) vertices += p.count
    }
  })
  return { vertices, triangles, meshes, materials: mats.size }
}

/**
 * Estimated enclosed volume of a mesh model in world units (cubic metres for
 * our mm->m scale). Sums signed tetrahedron volumes against the origin -
 * exact for closed, watertight meshes, an approximation otherwise. Returns
 * null for point clouds or models above the triangle budget.
 */
export function estimateVolume(root: THREE.Object3D, maxTriangles = 1_500_000): number | null {
  let total = 0
  let count = 0
  let overflow = false
  root.updateWorldMatrix(false, true)
  const v0 = new THREE.Vector3()
  const v1 = new THREE.Vector3()
  const v2 = new THREE.Vector3()
  const cross = new THREE.Vector3()
  root.traverse((obj) => {
    if (overflow || !(obj instanceof THREE.Mesh)) return
    const geo = obj.geometry
    const pos = geo?.getAttribute('position')
    if (!pos) return
    const index = geo.index
    const triCount = index ? Math.floor(index.count / 3) : Math.floor(pos.count / 3)
    if (count + triCount > maxTriangles) {
      overflow = true
      return
    }
    count += triCount
    const m = obj.matrixWorld
    const read = (i: number, out: THREE.Vector3): void => {
      out.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m)
    }
    if (index) {
      for (let t = 0; t + 2 < index.count; t += 3) {
        read(index.getX(t), v0)
        read(index.getX(t + 1), v1)
        read(index.getX(t + 2), v2)
        total += v0.dot(cross.crossVectors(v1, v2))
      }
    } else {
      for (let t = 0; t + 2 < pos.count; t += 3) {
        read(t, v0)
        read(t + 1, v1)
        read(t + 2, v2)
        total += v0.dot(cross.crossVectors(v1, v2))
      }
    }
  })
  if (overflow || count === 0) return null
  return Math.abs(total) / 6
}

// ---- formatting -------------------------------------------------------------

/** Bounding-box dimensions with one auto-chosen unit for all three axes. */
export function formatDims(size: THREE.Vector3): string {
  const max = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(max) || max <= 0) return '—'
  const f = max >= 1 ? 1 : max >= 0.01 ? 100 : 1000
  const u = max >= 1 ? 'm' : max >= 0.01 ? 'cm' : 'mm'
  const d = (v: number): string => (v * f).toFixed(1)
  return `${d(size.x)} × ${d(size.y)} × ${d(size.z)} ${u}`
}

export function formatVolume(m3: number | null): string {
  if (m3 === null || !Number.isFinite(m3) || m3 <= 0) return '—'
  if (m3 >= 0.001) return `${m3.toFixed(4)} m³`
  const cm3 = m3 * 1e6
  if (cm3 >= 1) return `${cm3 >= 100 ? Math.round(cm3).toLocaleString() : cm3.toFixed(1)} cm³`
  return `${(m3 * 1e9).toFixed(1)} mm³`
}
