import { contextBridge, ipcRenderer, webUtils } from 'electron'

export interface LaunchInfo {
  mode: 'main' | 'preview' | 'thumbnail'
  file: string | null
}

const api = {
  getLaunch: (): Promise<LaunchInfo> => ipcRenderer.invoke('get-launch'),
  readFile: (path: string): Promise<ArrayBuffer | null> => ipcRenderer.invoke('read-file', path),
  openFile: (): Promise<{ canceled: boolean; files: string[] }> => ipcRenderer.invoke('open-file'),
  closeWindow: (): Promise<boolean> => ipcRenderer.invoke('close-window'),
  setTitle: (t: string): Promise<boolean> => ipcRenderer.invoke('set-title', t),
  thumbComplete: (base64: string): Promise<boolean> => ipcRenderer.invoke('thumb-complete', base64),
  exists: (p: string): Promise<boolean> => ipcRenderer.invoke('exists', p),
  getTheme: (): Promise<{ dark: boolean }> => ipcRenderer.invoke('get-theme'),
  getAccentColor: (): Promise<{ r: number; g: number; b: number } | null> =>
    ipcRenderer.invoke('get-accent-color'),
  winControl: (action: string, value?: unknown): Promise<boolean> =>
    ipcRenderer.invoke('win-control', action, value),
  onThemeChanged: (cb: (e: { dark: boolean }) => void): (() => void) => {
    const listener = (_e: unknown, d: { dark: boolean }) => cb(d)
    ipcRenderer.on('theme-changed', listener)
    return () => ipcRenderer.removeListener('theme-changed', listener)
  },
  onWinState: (cb: (e: { maximized: boolean }) => void): (() => void) => {
    const listener = (_e: unknown, s: { maximized: boolean }) => cb(s)
    ipcRenderer.on('win-state', listener)
    return () => ipcRenderer.removeListener('win-state', listener)
  },
  onOpenFile: (cb: (path: string) => void): (() => void) => {
    const listener = (_e: unknown, p: string) => cb(p)
    ipcRenderer.on('open-file', listener)
    return () => ipcRenderer.removeListener('open-file', listener)
  },
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api