import type { ViewerHandles } from './scene'

function canvasBg(dark: boolean): number {
  return dark ? 0x2b2b2b : 0xffffff
}

const c = (v: number): string => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')

function applyAccent(accent: { r: number; g: number; b: number } | null): void {
  const root = document.documentElement
  if (accent) root.style.setProperty('--accent', `#${c(accent.r)}${c(accent.g)}${c(accent.b)}`)
  else root.style.removeProperty('--accent')
}

export function applyTheme(dark: boolean, handles?: ViewerHandles): void {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  if (handles) handles.setBackground(canvasBg(dark), dark ? 0.9 : 0.92)
}

export async function initTheme(handles?: ViewerHandles): Promise<void> {
  const theme = await window.api.getTheme()
  applyTheme(theme.dark, handles)
  window.api.onThemeChanged((e) => applyTheme(e.dark, handles))
  applyAccent(await window.api.getAccentColor())
}