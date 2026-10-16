// Generates tests/samples/morph-anim.gltf - a small cube with two morph
// targets ("Inflate" / "Stretch") and a 3s spin animation. Used by the hidden
// --capture smoke tests to verify the morph chips, timeline bar and speed menu.
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'samples', 'morph-anim.gltf')

const positions = []
const normals = []
const faces = [
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
]
for (const f of faces) {
  const [a, b, c, d] = f.v
  for (const v of [a, b, c, a, c, d]) {
    positions.push(...v.map((x) => x * 0.5))
    normals.push(...f.n)
  }
}
const vertCount = positions.length / 3
const t1 = normals.map((x) => x * 0.35) // Inflate: along the normal
const t2 = []
for (let i = 0; i < vertCount; i++) {
  const y = positions[i * 3 + 1]
  t2.push(0, y > 0 ? 0.7 : 0, 0) // Stretch: pull the top face up
}

const times = [0, 1, 2, 3]
const quats = []
for (const angle of [0, 90, 180, 270]) {
  const half = (angle * Math.PI) / 360
  quats.push(0, Math.sin(half), 0, Math.cos(half))
}

const chunks = []
function pushFloats(arr) {
  const buf = Buffer.alloc(arr.length * 4)
  arr.forEach((v, i) => buf.writeFloatLE(v, i * 4))
  chunks.push(buf)
  return buf
}
const posBuf = pushFloats(positions)
const nrmBuf = pushFloats(normals)
const t1Buf = pushFloats(t1)
const t2Buf = pushFloats(t2)
const timeBuf = pushFloats(times)
const quatBuf = pushFloats(quats)
const blob = Buffer.concat(chunks)

const views = []
let offset = 0
function addView(buf) {
  views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length })
  offset += buf.length
  return views.length - 1
}
const posView = addView(posBuf)
const nrmView = addView(nrmBuf)
const t1View = addView(t1Buf)
const t2View = addView(t2Buf)
const timeView = addView(timeBuf)
const quatView = addView(quatBuf)

const min = [-0.5, -0.5, -0.5]
const max = [0.5, 0.5, 0.5]
const gltf = {
  asset: { version: '2.0', generator: 'PolyPeek test generator' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'MorphCube', mesh: 0 }],
  meshes: [
    {
      name: 'Cube',
      weights: [0, 0],
      extras: { targetNames: ['Inflate', 'Stretch'] },
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1 },
          targets: [{ POSITION: 2 }, { POSITION: 3 }],
          material: 0,
        },
      ],
    },
  ],
  materials: [
    {
      name: 'Orange',
      pbrMetallicRoughness: {
        baseColorFactor: [0.85, 0.45, 0.15, 1],
        metallicFactor: 0.1,
        roughnessFactor: 0.6,
      },
    },
  ],
  animations: [
    {
      name: 'spin',
      channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }],
      samplers: [{ input: 4, output: 5, interpolation: 'LINEAR' }],
    },
  ],
  accessors: [
    { bufferView: posView, componentType: 5126, count: vertCount, type: 'VEC3', min, max },
    { bufferView: nrmView, componentType: 5126, count: vertCount, type: 'VEC3' },
    { bufferView: t1View, componentType: 5126, count: vertCount, type: 'VEC3' },
    { bufferView: t2View, componentType: 5126, count: vertCount, type: 'VEC3' },
    { bufferView: timeView, componentType: 5126, count: times.length, type: 'SCALAR', min: [0], max: [3] },
    { bufferView: quatView, componentType: 5126, count: quats.length / 4, type: 'VEC4' },
  ],
  bufferViews: views,
  buffers: [
    {
      byteLength: blob.length,
      uri: 'data:application/octet-stream;base64,' + blob.toString('base64'),
    },
  ],
}

writeFileSync(out, JSON.stringify(gltf, null, 1))
console.log('written', out, blob.length, 'bytes, verts', vertCount)
