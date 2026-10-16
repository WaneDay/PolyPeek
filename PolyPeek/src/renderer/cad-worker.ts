// OCCT (STEP/IGES/BREP) tessellation worker. Built as a classic script so the
// emscripten bundle can be loaded via importScripts from ./wasm/. Geometry is
// converted to typed arrays here (off the UI thread) and the buffers are
// transferred back to the main thread - the window stays responsive and shows
// the loading spinner while OCCT crunches.
declare function importScripts(...urls: string[]): void

interface CadJob {
  id: number
  ext: string
  buffer: ArrayBuffer
}

const ctx = self as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void
  onmessage: ((ev: MessageEvent<CadJob>) => void) | null
}

let occtPromise: Promise<any> | null = null

function getOcct(): Promise<any> {
  if (!occtPromise) {
    occtPromise = (async () => {
      importScripts('./wasm/occt-import-js.cjs')
      const g = globalThis as unknown as {
        occtimportjs?: (opts?: { wasmBinary?: ArrayBuffer }) => Promise<any>
      }
      if (typeof g.occtimportjs !== 'function') throw new Error('occt-import-js was not initialized')
      // Emscripten's internal fetch does not support custom protocols, so the
      // wasm binary is fetched over our protocol and passed directly.
      const resp = await fetch('./wasm/occt-import-js.wasm')
      if (!resp.ok) throw new Error(`wasm fetch failed: ${resp.status}`)
      return g.occtimportjs({ wasmBinary: await resp.arrayBuffer() })
    })().catch((err) => {
      occtPromise = null
      throw err
    })
  }
  return occtPromise
}

async function handle(job: CadJob): Promise<void> {
  try {
    const occt = await getOcct()
    const data = new Uint8Array(job.buffer)
    let result: any
    if (job.ext === 'iges' || job.ext === 'igs') result = occt.ReadIgesFile(data, null)
    else if (job.ext === 'brep' || job.ext === 'brp') result = occt.ReadBrepFile(data, null)
    else result = occt.ReadStepFile(data, null)
    if (!result || !result.success) throw new Error(`${job.ext.toUpperCase()} import failed`)

    const meshes: unknown[] = []
    const transfer: Transferable[] = []
    for (const mesh of (result.meshes || []) as any[]) {
      const rawPos = mesh.attributes?.position?.array as ArrayLike<number> | undefined
      if (!rawPos || rawPos.length === 0) continue
      const position = new Float32Array(rawPos)
      const rawNorm = mesh.attributes?.normal?.array as ArrayLike<number> | undefined
      const normal = rawNorm && rawNorm.length ? new Float32Array(rawNorm) : null
      const rawIdx = mesh.index?.array as ArrayLike<number> | undefined
      const index = rawIdx && rawIdx.length ? new Uint32Array(rawIdx) : null
      transfer.push(position.buffer)
      if (normal) transfer.push(normal.buffer)
      if (index) transfer.push(index.buffer)
      meshes.push({
        name: String(mesh.name || ''),
        color: Array.isArray(mesh.color) ? (mesh.color as number[]).slice(0, 3) : null,
        attributes: {
          position: { array: position },
          normal: normal ? { array: normal } : null,
        },
        index: index ? { array: index } : null,
      })
    }

    ctx.postMessage({ id: job.id, ok: true, root: result.root, meshes }, transfer)
  } catch (err) {
    ctx.postMessage({
      id: job.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

ctx.onmessage = (ev) => {
  void handle(ev.data)
}
