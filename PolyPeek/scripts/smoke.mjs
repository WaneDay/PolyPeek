// smoke.mjs - fast structural checks that need no Electron window:
//   1. dist build outputs exist (script bundles, html, wasm assets)
//   2. extension lists stay in sync across formats.ts / formats.h / setup.iss
//   3. every LoaderKind used in formats.ts has a case in the renderer loader
// Exits non-zero on the first failed check. Run: npm run smoke
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.error(`  FAIL ${name}${detail ? ' - ' + detail : ''}`)
  }
}

console.log('[1] dist outputs')
for (const rel of [
  'dist/main/index.cjs',
  'dist/preload/preload.cjs',
  'dist/renderer/renderer.js',
  'dist/renderer/index.html',
  'dist/renderer/wasm/occt-import-js.cjs',
  'dist/renderer/wasm/occt-import-js.wasm',
  'dist/renderer/wasm/draco/draco_decoder.wasm',
]) {
  check(rel, existsSync(join(root, rel)))
}

console.log('[2] extension lists in sync')
const formatsTs = readFileSync(join(root, 'src/shared/formats.ts'), 'utf8')
const formatsH = readFileSync(join(root, 'native/formats.h'), 'utf8')
const iss = readFileSync(join(root, 'installer/setup.iss'), 'utf8')

const extsTs = new Set([...formatsTs.matchAll(/\{\s*ext:\s*'([a-z0-9]+)'/g)].map((m) => m[1]))
const extsH = new Set([...formatsH.matchAll(/L"([a-z0-9]+)"/g)].map((m) => m[1]))
const issThumb = new Set([...iss.matchAll(/SafeThumb\('\.([a-z0-9]+)'\)/g)].map((m) => m[1]))

check('formats.ts has extensions', extsTs.size > 0, `got ${extsTs.size}`)
for (const e of extsTs) check(`formats.h has '${e}'`, extsH.has(e))
for (const e of extsH) check(`formats.ts has '${e}'`, extsTs.has(e))
for (const e of extsTs) check(`setup.iss thumb entry for '${e}'`, issThumb.has(e))

console.log('[3] loader kinds covered')
const kinds = new Set([...formatsTs.matchAll(/kind:\s*'([a-zA-Z0-9]+)'/g)].map((m) => m[1]))
const loaders = readFileSync(join(root, 'src/renderer/loaders.ts'), 'utf8')
for (const k of kinds) {
  if (k === 'cad') continue // handled by loadCad, not the switch
  check(`loaders.ts case '${k}'`, loaders.includes(`case '${k}'`))
}

if (failed > 0) {
  console.error(`\nsmoke FAILED: ${failed} check(s)`)
  process.exit(1)
}
console.log(`\nsmoke OK (${extsTs.size} extensions)`)
