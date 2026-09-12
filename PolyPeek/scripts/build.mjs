import { build, context } from 'esbuild'
import { copyFileSync, mkdirSync, rmSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

function copyDirRecursive(src, dst) {
  mkdirSync(dst, { recursive: true })
  for (const entry of readdirSync(src)) {
    const s = join(src, entry)
    const d = join(dst, entry)
    if (statSync(s).isDirectory()) copyDirRecursive(s, d)
    else copyFileSync(s, d)
  }
}

async function bundle(name, entryPoints, outfile, platform, format, external = []) {
  const common = {
    entryPoints,
    outfile,
    bundle: true,
    platform,
    format,
    target: ['es2022'],
    sourcemap: false,
    minify: true,
    external,
    logLevel: 'info',
  }
  if (process.env.WATCH) {
    const ctx2 = await context(common)
    await ctx2.watch()
    console.log(`[watch] ${name}`)
    return
  }
  await build(common)
  console.log(`[build] ${name} -> ${outfile}`)
}

mkdirSync(dist, { recursive: true })

await bundle('main', [join(root, 'src/main/index.ts')], join(dist, 'main/index.cjs'), 'node', 'cjs', ['electron'])
await bundle('preload', [join(root, 'src/preload/preload.ts')], join(dist, 'preload/preload.cjs'), 'node', 'cjs', ['electron'])
await bundle('renderer', [join(root, 'src/renderer/index.ts')], join(dist, 'renderer/renderer.js'), 'browser', 'esm')

// static assets
const rendererDst = join(dist, 'renderer')
copyFileSync(join(root, 'src/renderer/index.html'), join(rendererDst, 'index.html'))
copyDirRecursive(join(root, 'src/renderer/wasm'), join(rendererDst, 'wasm'))

console.log('[build] OK')