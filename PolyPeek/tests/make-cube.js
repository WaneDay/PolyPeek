const fs = require('fs')
const pts = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
]
const faces = [
  [4, 5, 6], [4, 6, 7], [0, 3, 2], [0, 2, 1],
  [1, 2, 6], [1, 6, 5], [0, 4, 7], [0, 7, 3],
  [3, 7, 6], [3, 6, 2], [0, 1, 5], [0, 5, 4],
]
function normal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
}
let out = 'solid cube\n'
for (const f of faces) {
  const a = pts[f[0]], b = pts[f[1]], c = pts[f[2]]
  const n = normal(a, b, c)
  out += `  facet normal ${n[0]} ${n[1]} ${n[2]}\n    outer loop\n`
  for (const p of [a, b, c]) out += `      vertex ${p[0]} ${p[1]} ${p[2]}\n`
  out += '    endloop\n  endfacet\n'
}
out += 'endsolid cube\n'
const target = process.argv[2]
fs.writeFileSync(target, out)
console.log('wrote', target, out.length, 'bytes')