export {}

declare global {
  interface Window {
    api: {
      getLaunch: () => Promise<{ mode: 'main' | 'preview' | 'thumbnail'; file: string | null }>
      readFile: (path: string) => Promise<ArrayBuffer | null>
      openFile: () => Promise<{ canceled: boolean; files: string[] }>
      closeWindow: () => Promise<boolean>
      setTitle: (t: string) => Promise<boolean>
      thumbComplete: (base64: string) => Promise<boolean>
      exists: (p: string) => Promise<boolean>
      getTheme: () => Promise<{ dark: boolean }>
      getAccentColor: () => Promise<{ r: number; g: number; b: number } | null>
      winControl: (action: string, value?: unknown) => Promise<boolean>
      onThemeChanged: (cb: (e: { dark: boolean }) => void) => () => void
      onWinState: (cb: (e: { maximized: boolean }) => void) => () => void
      onOpenFile: (cb: (path: string) => void) => () => void
      getPathForFile: (file: File) => string
    }
    occtimportjs?: () => Promise<any>
  }
}