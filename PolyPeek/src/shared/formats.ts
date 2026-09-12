// Shared 3D format registry. Used by the Electron main process (CLI parsing,
// protocol), the renderer (loader selection), and to keep the native
// components' extension list in sync (native/formats.h).

export type LoaderKind =
  | 'gltf'
  | 'obj'
  | 'fbx'
  | 'stl'
  | 'ply'
  | 'dae'
  | 'tds'
  | 'usdz'
  | 'drc'
  | 'three3mf'
  | 'amf'
  | 'lwo'
  | 'vox'
  | 'wrl'
  | 'xyz'
  | 'pcd'
  | 'gcode'
  | 'vtk'
  | 'cad'
  | 'points'

export interface FormatEntry {
  ext: string
  kind: LoaderKind
  group: 'mesh' | 'cad' | 'point' | 'other'
  up: 'y' | 'z'
}

export const FORMATS: FormatEntry[] = [
  // glTF family (textures, PBR materials, animations, Draco)
  { ext: 'glb', kind: 'gltf', group: 'mesh', up: 'y' },
  { ext: 'gltf', kind: 'gltf', group: 'mesh', up: 'y' },

  // Wavefront OBJ (+ MTL)
  { ext: 'obj', kind: 'obj', group: 'mesh', up: 'y' },

  // Autodesk FBX
  { ext: 'fbx', kind: 'fbx', group: 'mesh', up: 'y' },

  // 3D printing
  { ext: 'stl', kind: 'stl', group: 'mesh', up: 'z' },
  { ext: '3mf', kind: 'three3mf', group: 'mesh', up: 'z' },
  { ext: 'amf', kind: 'amf', group: 'mesh', up: 'z' },

  // Mesh clouds / geometry
  { ext: 'ply', kind: 'ply', group: 'mesh', up: 'y' },
  { ext: 'dae', kind: 'dae', group: 'mesh', up: 'y' },
  { ext: '3ds', kind: 'tds', group: 'mesh', up: 'y' },
  { ext: 'lwo', kind: 'lwo', group: 'mesh', up: 'y' },
  { ext: 'wrl', kind: 'wrl', group: 'other', up: 'y' },
  { ext: 'vox', kind: 'vox', group: 'other', up: 'y' },

  // Compressed meshes
  { ext: 'drc', kind: 'drc', group: 'mesh', up: 'y' },
  { ext: 'usdz', kind: 'usdz', group: 'mesh', up: 'y' },

  // Point clouds
  { ext: 'xyz', kind: 'xyz', group: 'point', up: 'y' },
  { ext: 'pcd', kind: 'pcd', group: 'point', up: 'y' },

  // Toolpath / scientific
  { ext: 'gcode', kind: 'gcode', group: 'other', up: 'z' },
  { ext: 'nc', kind: 'gcode', group: 'other', up: 'z' },
  { ext: 'ncc', kind: 'gcode', group: 'other', up: 'z' },
  { ext: 'ngc', kind: 'gcode', group: 'other', up: 'z' },
  { ext: 'vtk', kind: 'vtk', group: 'other', up: 'y' },
  { ext: 'vtp', kind: 'vtk', group: 'other', up: 'y' },

  // CAD (OCCT wasm conversion)
  { ext: 'step', kind: 'cad', group: 'cad', up: 'z' },
  { ext: 'stp', kind: 'cad', group: 'cad', up: 'z' },
  { ext: 'iges', kind: 'cad', group: 'cad', up: 'z' },
  { ext: 'igs', kind: 'cad', group: 'cad', up: 'z' },
  { ext: 'brep', kind: 'cad', group: 'cad', up: 'z' },
  { ext: 'brp', kind: 'cad', group: 'cad', up: 'z' },
]

/** All supported extensions (lowercase, without dot). */
export const ALL_EXTS: string[] = FORMATS.map((f) => f.ext)

export const ALL_EXTS_SET: ReadonlySet<string> = new Set(ALL_EXTS)

/** Extension (without dot, lowercase) -> FormatEntry */
export const EXT_MAP: ReadonlyMap<string, FormatEntry> = new Map(
  FORMATS.map((f) => [f.ext, f]),
)

/** File extensions with a leading dot, for native components & dialogs. */
export const EXTENSIONS_WITH_DOT: string[] = ALL_EXTS.map((e) => '.' + e)

/** Human readable label for a format (used on dialog filters). */
export function formatLabel(ext: string): string {
  switch (EXT_MAP.get(ext)?.kind) {
    case 'cad': return 'CAD Model'
    case 'point': return 'Point Cloud'
    case 'gcode': return 'GCode Toolpath'
    case 'vtk': return 'Scientific Data'
    case 'vox': return 'Voxel Model'
    case 'wrl': return 'VRML World'
    default: return '3D Model'
  }
}