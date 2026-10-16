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

export function computeModelBounds(object: THREE.Object3D): THREE.Box3 {
  // Skinned meshes only render correctly after bone transforms are applied,
  // so measure their true (posed) bounds - the raw geometry box can be far
  // off for rigged models and would make the fit too loose / off-centre.
  // The exact pass walks every vertex, so very heavy rigs fall back to the
  // raw geometry box (the sampled silhouette fit re-centres the view anyway).
  let skinned = false
  let vertices = 0
  object.traverse((o) => {
    const mesh = o as THREE.Mesh & { isSkinnedMesh?: boolean }
    if (mesh.isSkinnedMesh) skinned = true
    const count = mesh.geometry?.attributes?.position?.count
    if (count) vertices += count
  })
  const precise = skinned && vertices <= 500_000
  if (precise) {
    object.traverse((o) => {
      const sm = o as THREE.SkinnedMesh
      if ((sm as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) sm.skeleton?.update()
    })
  }
  const box = new THREE.Box3()
  box.expandByObject(object, precise)
  return box
}

function collectSamplePoints(object: THREE.Object3D, limit = 20000): THREE.Vector3[] {
  object.updateMatrixWorld(true)
  let total = 0
  object.traverse((o) => {
    const pos = (o as THREE.Mesh).geometry?.attributes?.position as THREE.BufferAttribute | undefined
    if (pos) total += pos.count
  })
  if (total === 0) return []
  const stride = Math.max(1, Math.ceil(total / limit))
  const pts: THREE.Vector3[] = []
  const v = new THREE.Vector3()
  object.traverse((o) => {
    const mesh = o as THREE.Mesh & { isSkinnedMesh?: boolean; skeleton?: THREE.Skeleton }
    const pos = mesh.geometry?.attributes?.position as THREE.BufferAttribute | undefined
    if (!pos) return
    const skinned = !!mesh.isSkinnedMesh && !!mesh.skeleton
    if (skinned) mesh.skeleton!.update()
    const sm = mesh as unknown as THREE.SkinnedMesh
    for (let i = 0; i < pos.count; i += stride) {
      if (skinned) {
        sm.getVertexPosition(i, v)
      } else {
        v.fromBufferAttribute(pos, i)
      }
      pts.push(v.clone().applyMatrix4(mesh.matrixWorld))
    }
  })
  return pts
}

export function fitCameraToObject(
  controls: { target: THREE.Vector3; update: () => void; saveState?: () => void } | null,
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  up: Up,
  boxIn?: THREE.Box3,
): THREE.Vector3 {
  // callers that already measured the model pass the box in - skinned bounds
  // are expensive to compute twice
  const box = boxIn && !boxIn.isEmpty() ? boxIn : computeModelBounds(object)
  if (box.isEmpty()) {
    const fallback = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1))
    box.copy(fallback)
  }
  const center = new THREE.Vector3()
  box.getCenter(center)
  const size = new THREE.Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z, 0.01)

  // Product-shot view: front-right three-quarter, low elevation (like the
  // familiar "hero angle"), then a projected-silhouette fit so the model
  // fills ~86% of the viewport height / ~90% of the width regardless of
  // shape. Real vertices (skinning applied) are sampled instead of bbox
  // corners - the corners of a loose AABB would leave the model small.
  const dir =
    up === 'y'
      ? new THREE.Vector3(0.62, 0.34, 1)
      : new THREE.Vector3(0.62, 1, 0.34)
  dir.normalize()

  const probe = collectSamplePoints(object)
  if (probe.length === 0) {
    for (let xi = 0; xi < 2; xi++) {
      for (let yi = 0; yi < 2; yi++) {
        for (let zi = 0; zi < 2; zi++) {
          probe.push(
            new THREE.Vector3(
              xi ? box.max.x : box.min.x,
              yi ? box.max.y : box.min.y,
              zi ? box.max.z : box.min.z,
            ),
          )
        }
      }
    }
  }

  const radius = Math.max(size.length() * 0.5, maxDim * 0.5, 1e-4)
  let dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) * 0.5)

  camera.up.set(up === 'z' ? 0 : 0, up === 'z' ? 0 : 1, up === 'z' ? 1 : 0)
  camera.near = Math.max(maxDim * 0.001, 1e-5)
  camera.far = Math.max(maxDim * 10, 100)
  camera.updateProjectionMatrix()

  const TARGET_Y = 0.86
  const TARGET_X = 0.9
  const p = new THREE.Vector3()
  const aim = center.clone()
  const right = new THREE.Vector3()
  const camUp = new THREE.Vector3()
  for (let iter = 0; iter < 6; iter++) {
    camera.position.copy(aim).addScaledVector(dir, dist)
    camera.lookAt(aim)
    camera.updateMatrixWorld()
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const pt of probe) {
      p.copy(pt).project(camera)
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    if (!isFinite(minX)) break
    // scale so the farthest vertex lands on the target envelope...
    const over = Math.max(
      Math.max(Math.abs(minY), Math.abs(maxY)) / TARGET_Y,
      Math.max(Math.abs(minX), Math.abs(maxX)) / TARGET_X,
    )
    // ...and shift the aim so the projected silhouette is centred (the 3D
    // bbox centre is often off from the visual centre of the outline)
    const cx = (minX + maxX) * 0.5
    const cy = (minY + maxY) * 0.5
    if (Math.abs(over - 1) < 0.01 && Math.abs(cx) < 0.01 && Math.abs(cy) < 0.01) break
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5)
    const halfW = halfH * camera.aspect
    right.setFromMatrixColumn(camera.matrixWorld, 0)
    camUp.setFromMatrixColumn(camera.matrixWorld, 1)
    aim.addScaledVector(right, cx * halfW * 0.85).addScaledVector(camUp, cy * halfH * 0.85)
    dist = Math.min(Math.max(dist * over, radius * 0.25), radius * 60)
  }
  camera.position.copy(aim).addScaledVector(dir, dist)
  camera.lookAt(aim)
  camera.updateMatrixWorld()

  if (controls) {
    controls.target.copy(aim)
    controls.update()
    // remember the fitted view so double-click can restore it
    controls.saveState?.()
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
        // Point sizes are absolute (PCD defaults to 0.005, XYZ to 0.01), which
        // is invisible for large scans and coarse for tiny models - derive the
        // size from the model bounds instead.
        mat.size = Math.max(maxDim * 0.008, 1e-4)
        mat.sizeAttenuation = true
      }
    } else if (obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
      const mat = obj.material as THREE.LineBasicMaterial
      if (mat && !mat.vertexColors) {
        mat.color.setHex(DEFAULT_COLOR)
      }
    }
  })
}