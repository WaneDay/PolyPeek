import { createRequire } from 'module'
const req = createRequire(import.meta.url)
const fs = await import('fs')
const path = await import('path')
const dir = path.join(process.cwd(), 'node_modules/three/examples/jsm/loaders')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
console.log('Loader files:', files.length)
for (const f of files) {
  try {
    const r = req(path.join(dir, f))
    console.log(f, '=>', Object.keys(r).join(','))
  } catch (e) {
    console.log(f, 'ERR', e.message.slice(0, 80))
  }
}