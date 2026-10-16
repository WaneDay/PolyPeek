import * as THREE from 'three'
import { toThree } from '@wintaru/part-viewer/three'
// The package's exports map only exposes ".", "./three" and "./2d", so the
// decode engine is imported by file path - a bare deep specifier
// (@wintaru/part-viewer/dist/...) is rejected by esbuild/Node package-exports
// resolution. pako (the engine's only runtime dependency for SLDPRT/SLDASM)
// is bundled by esbuild like every other renderer dependency.
import { SolidWorksDecodeEngine } from '../../node_modules/@wintaru/part-viewer/dist/engine/SolidWorksDecodeEngine.js'
import type { DecodedModel } from '../../node_modules/@wintaru/part-viewer/dist/common/DecodedModel.js'
import { DEFAULT_MATERIAL } from './scene'

// toThree() gives uncoloured meshes the package's own neutral grey
// (0x9a9a9a); restyle those to PolyPeek's default material so parts without
// CAD colours match the STL/STEP appearance.
const PKG_DEFAULT_COLOR = 0x9a9a9a

/**
 * Decodes a SolidWorks part (.sldprt) or assembly (.sldasm) from raw file
 * bytes. The engine recovers SolidWorks's own cached tessellation - no
 * SolidWorks installation, no wasm, synchronous (2-95 ms on real files).
 * Geometry arrives in millimetres, so the returned group is scaled to metres
 * exactly like the OCCT STEP/IGES path.
 */
export function loadSolidWorks(bytes: Uint8Array): THREE.Group {
  const engine = new SolidWorksDecodeEngine()
  let model: DecodedModel
  try {
    model = engine.transform(bytes)
  } catch (err) {
    throw new Error(`SolidWorks 解析失败: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (model.meshes.length === 0) {
    const diag = model.diagnostics.find((d) => d.severity === 'error')
    throw new Error(diag ? diag.message : 'SolidWorks 文件中未找到几何数据')
  }
  const group = toThree(model)
  group.scale.setScalar(0.001)
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const m of mats) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue
      m.roughness = DEFAULT_MATERIAL.roughness
      m.metalness = DEFAULT_MATERIAL.metalness
      if (m.color.getHex() === PKG_DEFAULT_COLOR) m.color.copy(DEFAULT_MATERIAL.color)
    }
  })
  return group
}
