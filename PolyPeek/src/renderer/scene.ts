import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export type Up = 'y' | 'z'

export interface ViewerHandles {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  root: THREE.Group
  setBackground: (color: THREE.ColorRepresentation, alpha?: number) => void
  dispose: () => void
}

const DEFAULT_COLOR = 0x9fb0d4
export const DEFAULT_MATERIAL = new THREE.MeshStandardMaterial({
  color: DEFAULT_COLOR,
  roughness: 0.55,
  metalness: 0.08,
  side: THREE.DoubleSide,
})

export function createDefaultMaterial(): THREE.MeshStandardMaterial {
  return DEFAULT_MATERIAL.clone()
}

export function isPlaceholderMaterial(mat: THREE.Material | undefined | null): boolean {
  if (!mat) return true
  if (mat instanceof THREE.MeshBasicMaterial && mat.color.getHex() === 0xffffff) return true
  if (mat instanceof THREE.MeshPhongMaterial && mat.color.getHex() === 0xffffff) return true
  if (mat instanceof THREE.MeshStandardMaterial && !mat.map && mat.color.getHex() === 0xffffff) return true
  return false
}

export function createViewer(
  container: HTMLElement,
  opts: { bg?: string; antialias?: boolean } = {},
): ViewerHandles {
  const width = container.clientWidth || 800
  const height = container.clientHeight || 600

  const bg = new THREE.Color(opts.bg ?? 0x424242)
  const renderer = new THREE.WebGLRenderer({ antialias: opts.antialias !== false, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.setClearColor(bg, 0.8)
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100000)
  camera.position.set(3, 2.5, 4)

  const hemi = new THREE.HemisphereLight(0xffffff, 0x555566, 0.55)
  const dir = new THREE.DirectionalLight(0xffffff, 0.7)
  dir.position.set(5, 8, 4)
  scene.add(hemi, dir)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = true
  controls.target.set(0, 0, 0)

  const root = new THREE.Group()
  scene.add(root)

  function setBackground(color: THREE.ColorRepresentation, alpha = 0.92): void {
    renderer.setClearColor(color, alpha)
    const c = new THREE.Color(color)
    scene.background = null
    void c
  }

  function dispose(): void {
    controls.dispose()
    cleanupScene(scene)
    envTex.dispose()
    renderer.dispose()
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement)
    }
  }

  return { renderer, scene, camera, controls, root, setBackground, dispose }
}

export function cleanupScene(scene: THREE.Scene): void {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) {
      mat.forEach((m) => m?.dispose())
    } else if (mat) {
      mat.dispose()
    }
  })
}

export function fitCameraToObject(
  controls: { target: THREE.Vector3; update: () => void } | null,
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  up: Up,
): THREE.Vector3 {
  const box = new THREE.Box3()
  box.expandByObject(object)
  if (box.isEmpty()) {
    const fallback = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1))
    box.copy(fallback)
  }
  const center = new THREE.Vector3()
  box.getCenter(center)
  const size = new THREE.Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z, 0.01)

  const dist = maxDim * 1.8

  const camPos = new THREE.Vector3(
    0,
    up === 'y' ? dist : -dist * 0.6,
    up === 'y' ? dist * 0.6 : dist,
  )
  camPos.add(center)

  camera.up.set(up === 'z' ? 0 : 0, up === 'z' ? 0 : 1, up === 'z' ? 1 : 0)
  camera.position.copy(camPos)
  camera.lookAt(center)
  camera.near = Math.max(maxDim * 0.001, 1e-5)
  camera.far = Math.max(maxDim * 10, 100)
  camera.updateProjectionMatrix()

  if (controls) {
    controls.target.copy(center)
    controls.update()
  }

  return box.getSize(new THREE.Vector3())
}

export function collectStats(object: THREE.Object3D): { vertices: number; triangles: number } {
  let vertices = 0
  let triangles = 0
  object.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry && mesh.geometry.attributes.position) {
      const p = mesh.geometry.attributes.position
      vertices += p.count
      if (mesh.geometry.index) {
        triangles += Math.floor(mesh.geometry.index.count / 3)
      } else {
        triangles += Math.floor(p.count / 3)
      }
    }
  })
  return { vertices, triangles }
}

export function applyDefaultAppearance(root: THREE.Object3D, maxDim: number): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mat = obj.material as THREE.Material
      if (isPlaceholderMaterial(mat)) {
        const replacement = createDefaultMaterial()
        obj.material = replacement
      } else if (Array.isArray(obj.material)) {
        obj.material = obj.material.map((m) => (isPlaceholderMaterial(m) ? createDefaultMaterial() : m))
      }
    } else if (obj instanceof THREE.Points) {
      const mat = obj.material as THREE.PointsMaterial
      if (mat instanceof THREE.PointsMaterial) {
        if (mat.color.getHex() === 0xffffff && !mat.vertexColors) {
          mat.color.setHex(DEFAULT_COLOR)
        }
        if (!mat.size || mat.size <= 0) mat.size = Math.max(maxDim * 0.008, 0.002)
        mat.sizeAttenuation = true
      }
    } else if (obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
      const mat = obj.material as THREE.LineBasicMaterial
      if (mat && !(mat as THREE.LineBasicMaterial & { vertexColors: number }).vertexColors) {
        mat.color.setHex(DEFAULT_COLOR)
      }
    }
  })
}