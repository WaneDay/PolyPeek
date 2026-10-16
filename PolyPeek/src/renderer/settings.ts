import type { LightPreset } from './viewfx'

export type ViewerMode = 'orbit' | 'presentation' | 'stage'

export interface ViewSettings {
  mode: ViewerMode
  grid: boolean
  axes: boolean
  gizmo: boolean
  autoRotate: boolean
  perf: boolean
  preset: LightPreset
  intensity: number
}

const STORAGE_KEY = 'polypeek.view.v1'

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  mode: 'orbit',
  grid: false,
  axes: false,
  gizmo: false,
  autoRotate: false,
  perf: false,
  preset: 'threePoint',
  intensity: 1,
}

const MODES: ViewerMode[] = ['orbit', 'presentation', 'stage']
const PRESETS: LightPreset[] = ['threePoint', 'front', 'rim', 'top', 'none']

/**
 * Restores the persisted info-panel state (view mode, ground grid, axes,
 * gizmo, turntable, lighting preset/intensity). Storage is shared by every
 * window (same origin), so a `~` preview opens with the same setup the panel
 * was left in - settings stick instead of resetting to all-unchecked.
 */
export function loadViewSettings(): ViewSettings {
  const out: ViewSettings = { ...DEFAULT_VIEW_SETTINGS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return out
    const p = JSON.parse(raw) as Partial<ViewSettings>
    if (typeof p.mode === 'string' && (MODES as string[]).includes(p.mode)) out.mode = p.mode as ViewerMode
    if (typeof p.grid === 'boolean') out.grid = p.grid
    if (typeof p.axes === 'boolean') out.axes = p.axes
    if (typeof p.gizmo === 'boolean') out.gizmo = p.gizmo
    if (typeof p.autoRotate === 'boolean') out.autoRotate = p.autoRotate
    if (typeof p.perf === 'boolean') out.perf = p.perf
    if (typeof p.preset === 'string' && (PRESETS as string[]).includes(p.preset)) {
      out.preset = p.preset as LightPreset
    }
    if (typeof p.intensity === 'number' && Number.isFinite(p.intensity)) {
      out.intensity = Math.min(2, Math.max(0.2, p.intensity))
    }
  } catch {
    /* storage unavailable or corrupt: defaults apply */
  }
  return out
}

export function saveViewSettings(s: ViewSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable: settings stay session-only */
  }
}
