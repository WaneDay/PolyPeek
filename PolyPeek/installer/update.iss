; PolyPeek - UPDATE package (slim).
; Installs ONLY the changed files over an existing PolyPeek install using the
; same AppId / default dir as the full installer (installer\setup.iss), so Inno
; detects and reuses the previous install directory. Electron runtime stays on
; the machine; only app.asar / natives / version marker are re-delivered ->
; update exe stays a few MB. Payload is staged by scripts\make-update-package.ps1
; into dist-package\update\*.
#define MyAppName "PolyPeek"
#define MyAppVersion "1.0.0"
#define MyAppExeName "PolyPeek.exe"

[Setup]
; MUST match the full installer's AppId so upgrades land in the same app dir.
AppId={{C4AE3E2A-E9A6-4B2F-85E4-503A215E1A31}
AppName={#MyAppName} {#MyAppVersion}
AppVersion={#MyAppVersion}
VersionInfoVersion={#MyAppVersion}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\{#MyAppName}
UsePreviousAppDir=yes
DisableProgramGroupPage=yes
DisableDirPage=yes
DisableReadyMemo=no
Uninstallable=no
CloseApplications=force
RestartApplications=no
Compression=lzma2
SolidCompression=yes
DiskSpanning=no
WizardStyle=modern
OutputDir=..
OutputBaseFilename=PolyPeek-Update-{#MyAppVersion}-x64

[Files]
; payload staged by scripts\make-update-package.ps1 (abs-relative paths kept)
Source: "..\dist-package\update\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
Filename: "{sys}\taskkill.exe"; Parameters: "/f /im TrayHost.exe"; Flags: runhidden; StatusMsg: "正在停止旧版托盘服务..."
Filename: "{app}\TrayHost.exe"; Description: "启动快速预览托盘服务"; Flags: nowait skipifdoesntexist runhidden