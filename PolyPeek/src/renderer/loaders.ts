import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js'
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { AMFLoader } from 'three/examples/jsm/loaders/AMFLoader.js'
import { LWOLoader } from 'three/examples/jsm/loaders/LWOLoader.js'
import { VOXLoader } from 'three/examples/jsm/loaders/VOXLoader.js'
import { VRMLLoader } from 'three/examples/jsm/loaders/VRMLLoader.js'
import { XYZLoader } from 'three/examples/jsm/loaders/XYZLoader.js'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'
import { GCodeLoader } from 'three/examples/jsm/loaders/GCodeLoader.js'
import { VTKLoader } from 'three/examples/jsm/loaders/VTKLoader.js'
import { EXT_MAP, LoaderKind } from '../shared/formats'
import { createDefaultMaterial, Up } from './scene'

export interface LoadedModel {
  group: THREE.Group
  up: Up
  mixers: THREE.AnimationMixer[]
}

/** Same-origin file URL served by our vfdv://local/file/ protocol. */
export function fileUrl(absPath: string): string {
  const p = absPath.replace(/\\/g, '/')
  return 'vfdv://local/file/' + p.split('/').map((seg) => encodeURIComponent(seg)).join('/')
}

export function dirUrl(absDir: string): string {
  return fileUrl(absDir) + '/'
}

export function listUrl(absDir: string): string {
  const p = absDir.replace(/\\/g, '/')
  return 'vfdv://local/list/' + p.split('/').map((seg) => encodeURIComponent(seg)).join('/')
}

async function listEntries(absDir: string): Promise<Array<{ name: string; isDir: boolean }>> {
  const resp = await fetch(listUrl(absDir))
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for list ${absDir}`)
  return (await resp.json()) as Array<{ name: string; isDir: boolean }>
}

const MAX_FBX_TEXTURE_DEPTH = 6

// three's FBXLoader collapses texture references to their basename
// (FBXTreeParser.parseImages() calls split('\\').pop()), so textures stored in
// sub-folders next to the .fbx are looked up in the model directory only. Build
// a basename -> full-path index (BFS, shallowest first) plus the set of every
// existing file so the loading manager can re-resolve requests that point at
// missing paths (three prepends the FBX dir to the basename, which misses
// sub-folder textures) against the real file.
async function buildFbxTextureIndex(modelDir: string): Promise<{ basenames: Map<string, string>; files: Set<string> }> {
  const basenames = new Map<string, string>()
  const files = new Set<string>()
  let frontier: Array<{ dir: string; depth: number }> = [{ dir: modelDir, depth: 0 }]
  while (frontier.length > 0) {
    const next: Array<{ dir: string; depth: number }> = []
    for (const f of frontier) {
      let entries: Array<{ name: string; isDir: boolean }> = []
      try {
        entries = await listEntries(f.dir)
      } catch {
        continue
      }
      for (const e of entries) {
        const full = f.dir + '\\' + e.name
        if (e.isDir) {
          if (f.depth < MAX_FBX_TEXTURE_DEPTH) next.push({ dir: full, depth: f.depth + 1 })
        } else {
          files.add(full.toLowerCase())
          const key = e.name.toLowerCase()
          if (!basenames.has(key)) basenames.set(key, full)
        }
      }
    }
    frontier = next
  }
  return { basenames, files }
}

function extOf(p: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(p)
  return m ? m[1].toLowerCase() : ''
}

async function fetchText(url: string): Promise<string> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
  return resp.text()
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
  return resp.arrayBuffer()
}

async function loadViaUrl(loader: { loadAsync: (url: string) => Promise<unknown> }, url: string): Promise<unknown> {
  return loader.loadAsync(url)
}

async function fromUrlLoad(kind: LoaderKind, url: string, up: Up, dir: string): Promise<LoadedModel> {
  const group = new THREE.Group()
  const mixers: THREE.AnimationMixer[] = []
  const path = dirUrl(dir)

  switch (kind) {
    case 'gltf': {
      const loader = new GLTFLoader()
      const draco = new DRACOLoader()
      draco.setDecoderPath('./wasm/draco/')
      draco.setDecoderConfig({ type: 'js' })
      loader.setDRACOLoader(draco)
      const gltf = (await loadViaUrl(loader, url)) as { scene: THREE.Group; animations?: THREE.AnimationClip[] }
      group.add(gltf.scene)
      for (const clip of gltf.animations || []) {
        const mixer = new THREE.AnimationMixer(gltf.scene)
        mixer.clipAction(clip).play()
        mixers.push(mixer)
      }
      break
    }
    case 'obj': {
      const text = await fetchText(url)
      const objLoader = new OBJLoader()
      const mtlLibs = [...text.matchAll(/mtllib\s+(\S+)/gi)].map((m) => m[1])
      if (mtlLibs.length > 0) {
        for (const mtlName of mtlLibs) {
          try {
            const mtlLoader = new MTLLoader()
            const mtlText = await fetchText(path + mtlName)
            const materials = mtlLoader.parse(mtlText, path)
            materials.preload()
            objLoader.setMaterials(materials)
            break
          } catch {
            // missing MTL is not fatal
          }
        }
      }
      group.add(objLoader.parse(text))
      break
    }
    case 'fbx': {
      // FBX refits texture paths to basenames, and imports Phong/Lambert
      // materials that receive no environment-based (IBL) diffuse in our scene
      // - so they render much darker than the MeshStandardMaterials used by
      // every other format. Fix both: resolve textures against the model dir
      // tree via a dedicated LoadingManager, then convert FBX materials to
      // MeshStandardMaterial with matching maps/colors.
      const texIndex = await buildFbxTextureIndex(dir)
      const fbxManager = new THREE.LoadingManager()
      fbxManager.setURLModifier((url) => {
        // blob/data pass through untouched; three's ImageLoader already
        // prepends the FBX dir to the collapsed basename, so requests come in
        // as vfdv file URLs that point at a (maybe missing) path.
        if (url.startsWith('blob:') || url.startsWith('data:')) return url
        if (url.startsWith('vfdv://local/file/')) {
          const abs = decodeURIComponent(url.slice('vfdv://local/file/'.length)).replace(/\//g, '\\')
          if (texIndex.files.has(abs.toLowerCase())) return url
          const base = abs.split(/[\\/]/).pop() || abs
          const hit = texIndex.basenames.get(base.toLowerCase())
          return hit ? fileUrl(hit) : url
        }
        const base = url.split(/[\\/]/).pop() || url
        const hit = texIndex.basenames.get(base.toLowerCase())
        return hit ? fileUrl(hit) : url
      })
      const loader = new FBXLoader(fbxManager)
      const obj = (await loadViaUrl(loader, url)) as THREE.Object3D & { animations?: THREE.AnimationClip[] }
      normalizeFbxMaterials(obj)
      group.add(obj)
      for (const clip of obj.animations || []) {
        const mixer = new THREE.AnimationMixer(obj)
        mixer.clipAction(clip).play()
        mixers.push(mixer)
      }
      break
    }
    case 'stl': {
      const loader = new STLLoader()
      const geometry = (await loadViaUrl(loader, url)) as THREE.BufferGeometry
      group.add(new THREE.Mesh(geometry, createDefaultMaterial()))
      break
    }
    case 'ply': {
      const loader = new PLYLoader()
      const geometry = (await loadViaUrl(loader, url)) as THREE.BufferGeometry
      const hasColor = geometry.getAttribute('color') !== undefined
      const mat = hasColor
        ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.0 })
        : createDefaultMaterial()
      group.add(new THREE.Mesh(geometry, mat))
      break
    }
    case 'dae': {
      const loader = new ColladaLoader()
      const collada = (await loadViaUrl(loader, url)) as { scene: THREE.Object3D }
      group.add(collada.scene)
      break
    }
    case 'tds': {
      const loader = new TDSLoader()
      const obj = (await loadViaUrl(loader, url)) as THREE.Object3D
      group.add(obj)
      break
    }
    case 'usdz': {
      const loader = new USDLoader()
      const obj = (await loadViaUrl(loader, url)) as THREE.Object3D
      group.add(obj)
      break
    }
    case 'drc': {
      const loader = new DRACOLoader()
      loader.setDecoderPath('./wasm/draco/')
      loader.setDecoderConfig({ type: 'js' })
      const geometry = (await loadViaUrl(loader, url)) as THREE.BufferGeometry
      group.add(new THREE.Mesh(geometry, createDefaultMaterial()))
      break
    }
    case 'three3mf': {
      const loader = new ThreeMFLoader()
      const obj = (await loadViaUrl(loader, url)) as THREE.Object3D
      group.add(obj)
      break
    }
    case 'amf': {
      const loader = new AMFLoader()
      const obj = (await loadViaUrl(loader, url)) as THREE.Object3D
      group.add(obj)
      break
    }
    case 'lwo': {
      const loader = new LWOLoader()
      const result = (await loadViaUrl(loader, url)) as unknown
      const items = Array.isArray(result) ? result : [result]
      for (const it of items) group.add((it as THREE.Object3D) ?? new THREE.Group())
      break
    }
    case 'vox': {
      const loader = new VOXLoader()
      const models = (await loadViaUrl(loader, url)) as unknown
      const list = Array.isArray(models) ? models : [models]
      for (const model of list) group.add(model as THREE.Object3D)
      break
    }
    case 'xyz': {
      const loader = new XYZLoader()
      const geometry = (await loadViaUrl(loader, url)) as THREE.BufferGeometry
      const mat = new THREE.PointsMaterial({ color: 0x9fb0d4, size: 0.01, sizeAttenuation: true })
      group.add(new THREE.Points(geometry, mat))
      break
    }
    case 'pcd': {
      const loader = new PCDLoader()
      const obj = (await loadViaUrl(loader, url)) as THREE.Points
      group.add(obj)
      break
    }
    case 'gcode': {
      const loader = new GCodeLoader()
      const obj = (await loadViaUrl(loader, url)) as THREE.Object3D
      group.add(obj)
      break
    }
    case 'vtk': {
      const loader = new VTKLoader()
      const obj = (await loadViaUrl(loader, url)) as THREE.Object3D
      group.add(obj)
      break
    }
    default:
      throw new Error(`unhandled loader kind: ${kind}`)
  }

  return { group, up, mixers }
}

// ---- CAD via OCCT WASM -----------------------------------------------------

let occtModulePromise: Promise<any> | null = null

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as { occtimportjs?: unknown }).occtimportjs) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('failed to load ' + src))
    document.head.appendChild(s)
  })
}

async function getOcct(): Promise<any> {
  if (!occtModulePromise) {
    occtModulePromise = (async () => {
      await injectScript('./wasm/occt-import-js.cjs')
      // Emscripten's internal fetch does not support custom protocols, so the
      // wasm binary is fetched over our protocol and passed directly.
      const wasmBinary = await fetchArrayBuffer('./wasm/occt-import-js.wasm')
      const initFn = (window as { occtimportjs?: () => Promise<any> }).occtimportjs
      if (typeof initFn !== 'function') throw new Error('occt-import-js was not initialized')
      return initFn({ wasmBinary })
    })().catch((err) => {
      occtModulePromise = null
      throw err
    })
  }
  return occtModulePromise
}

async function loadCad(absPath: string, up: Up): Promise<LoadedModel> {
  const bytes = await fetchArrayBuffer(fileUrl(absPath))
  const occt = await getOcct()
  const data = new Uint8Array(bytes)
  let result: any
  const ext = extOf(absPath)
  if (ext === 'iges' || ext === 'igs') result = occt.ReadIgesFile(data, null)
  else if (ext === 'brep' || ext === 'brp') result = occt.ReadBrepFile(data, null)
  else result = occt.ReadStepFile(data, null)

  if (!result || !result.success) throw new Error(`${String(ext).toUpperCase()} import failed`)

  const group = new THREE.Group()
  const meshes: any[] = result.meshes || []

  const addNode = (node: any, parent: THREE.Object3D): void => {
    for (const meshIdx of node?.meshes || []) {
      const mesh = meshes[meshIdx]
      if (!mesh) continue
      const rawPos = mesh.attributes?.position?.array
      const rawNorm = mesh.attributes?.normal?.array
      const rawIdx = mesh.index?.array
      if (!rawPos || !rawPos.length) continue
      const pos = new Float32Array(rawPos)
      const norm = rawNorm && rawNorm.length ? new Float32Array(rawNorm) : undefined
      const idx = rawIdx && rawIdx.length ? new Uint32Array(rawIdx) : undefined
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      if (norm) geometry.setAttribute('normal', new THREE.BufferAttribute(norm, 3))
      if (idx) geometry.setIndex(new THREE.BufferAttribute(idx, 1))
      const mat = createDefaultMaterial()
      if (Array.isArray(mesh.color)) mat.color.setRGB(mesh.color[0], mesh.color[1], mesh.color[2])
      const meshObj = new THREE.Mesh(geometry, mat)
      meshObj.name = mesh.name || node?.name || 'cad-part'
      parent.add(meshObj)
    }
    for (const child of node?.children || []) addNode(child, parent)
  }

  addNode(result.root, group)
  group.scale.setScalar(0.001)

  if (group.children.length === 0) throw new Error('no geometry found in CAD model')

  return { group, up, mixers: [] }
}

// ---- main entry -------------------------------------------------------------

export async function loadModel(absPath: string): Promise<LoadedModel> {
  const ext = extOf(absPath)
  const entry = EXT_MAP.get(ext)
  if (!entry) throw new Error(`unsupported format: ${ext}`)
  const up = entry.up as Up

  if (entry.kind === 'cad') {
    return loadCad(absPath, up)
  }

  const lastSlash = Math.max(absPath.lastIndexOf('\\'), absPath.lastIndexOf('/'))
  const dir = lastSlash >= 0 ? absPath.slice(0, lastSlash) : ''
  return fromUrlLoad(entry.kind, fileUrl(absPath), up, dir)
}

export function normalizeFbxMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => toStandardMaterial(m) ?? m)
    } else {
      obj.material = toStandardMaterial(obj.material) ?? obj.material
    }
  })
}

// three's FBXLoader produces MeshPhongMaterial/MeshLambertMaterial. Particles
// (Maya/Blender) note that Phong materials do not receive diffuse image-based
// lighting, which makes FBX models look substantially darker than GLTF/STL/OBJ
// under identical scene lights. Converting to MeshStandardMaterial keeps all
// maps/colors/emissive and flattens shininess into roughness so lighting is
// consistent across formats. DoubleSide also avoids black faces from FBX
// winding/negative-scale exports.
function toStandardMaterial(m: THREE.Material | undefined): THREE.Material | undefined {
  if (!m) return m
  if (!(m instanceof THREE.MeshPhongMaterial) && !(m instanceof THREE.MeshLambertMaterial)) return m
  const src = m as THREE.MeshPhongMaterial
  const sm = new THREE.MeshStandardMaterial()
  sm.side = THREE.DoubleSide
  sm.color.copy(src.color)
  sm.vertexColors = src.vertexColors
  sm.map = src.map
  sm.alphaMap = src.alphaMap
  sm.transparent = src.transparent
  sm.opacity = src.opacity
  sm.depthWrite = src.depthWrite
  sm.depthTest = src.depthTest
  sm.bumpMap = src.bumpMap
  sm.bumpScale = src.bumpScale
  sm.normalMap = src.normalMap
  sm.normalScale = src.normalScale
  sm.displacementMap = src.displacementMap
  sm.displacementScale = src.displacementScale
  sm.aoMap = src.aoMap
  sm.emissive.copy(src.emissive ?? new THREE.Color(0, 0, 0))
  sm.emissiveMap = src.emissiveMap
  sm.emissiveIntensity = src.emissiveIntensity
  if (m instanceof THREE.MeshPhongMaterial) {
    sm.metalness = 0
    sm.roughness = Math.min(1, Math.max(0.05, 1 - m.shininess / 128))
  } else {
    sm.metalness = 0
    sm.roughness = 1
  }
  m.dispose()
  return sm
}

// After the texture wait window, drop slots whose image never loaded so the
// material falls back to its diffuse color instead of rendering black.
function pruneFailedTextures(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (!mat) continue
      for (const key of Object.keys(mat)) {
        const v = (mat as Record<string, unknown>)[key]
        if (v instanceof THREE.Texture) {
          const img = v.image as HTMLImageElement | undefined
          const broken =
            img === undefined || (img instanceof HTMLImageElement && !img.complete)
          if (broken && key !== 'envMap') {
            ;(mat as unknown as Record<string, unknown>)[key] = null
            v.dispose()
          }
        }
      }
    }
  })
}

export async function waitForTextures(root: THREE.Object3D, timeout = 4000): Promise<void> {
  const textures: THREE.Texture[] = []
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) {
        if (!mat) continue
        for (const key of Object.keys(mat)) {
          const v = (mat as Record<string, unknown>)[key]
          if (v instanceof THREE.Texture) textures.push(v)
        }
      }
    }
  })
  if (textures.length === 0) return

  await new Promise<void>((resolve) => {
    const start = Date.now()
    const poll = (): void => {
      const ready = textures.every((t) => {
        const img = t.image as HTMLImageElement | undefined
        if (!img) return false
        if (img instanceof HTMLImageElement) return img.complete
        return true
      })
      if (ready || Date.now() - start > timeout) {
        for (const t of textures) t.needsUpdate = true
        resolve()
      } else {
        requestAnimationFrame(poll)
      }
    }
    requestAnimationFrame(poll)
  })

  pruneFailedTextures(root)
}