; PolyPeek - Inno Setup script (per-user install, opt-in associations/thumbnails)
#define MyAppName "PolyPeek"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "PolyPeek"
#define MyAppExeName "PolyPeek.exe"
#define MyAppCLSID "{{B66E45DB-9A5C-4805-8D8B-CB84A1A1EBFB}"
#define ThumbProvId "{{e357fccd-a995-4576-b01f-234630154e96}"
#define ProgId "PolyPeek.Model"

[Setup]
AppId={{C4AE3E2A-E9A6-4B2F-85E4-503A215E1A31}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\{#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..
OutputBaseFilename=PolyPeek-Setup-{#MyAppVersion}-x64
SetupIconFile=..\build\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=force
RestartApplications=no
DiskSpanning=no
; default English wizard (Inno's built-in Default.isl always available)

[Tasks]
Name: "thumb"; Description: "在文件资源管理器中显示 3D 模型彩色缩略图"; GroupDescription: "附加选项:"; Flags: checkedonce
Name: "assoc"; Description: "将支持的 3D 模型文件格式设置为用 {#MyAppName} 打开（设为默认打开方式）"; GroupDescription: "附加选项:"; Flags: unchecked
Name: "autostart"; Description: "开机自启托盘服务（在资源管理器选中 3D 模型后按 ` 反引号键快速预览）"; GroupDescription: "附加选项:"
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加选项:"; Flags: unchecked

[Files]
Source: "..\dist-package\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; ---- CLSID (always registered; harmless without thumbnails enabled) ----
[Registry]
Root: HKCU; Subkey: "Software\Classes\CLSID\{#MyAppCLSID}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppName} Thumbnail Provider"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\CLSID\{#MyAppCLSID}\InprocServer32"; ValueType: string; ValueName: ""; ValueData: "{app}\ThumbProvider.dll"
Root: HKCU; Subkey: "Software\Classes\CLSID\{#MyAppCLSID}\InprocServer32"; ValueType: string; ValueName: "ThreadingModel"; ValueData: "Apartment"

; ---- thumbnail handlers (task "thumb", never override existing handlers) ----
Root: HKCU; Subkey: "Software\Classes\.glb\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.glb')
Root: HKCU; Subkey: "Software\Classes\.gltf\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.gltf')
Root: HKCU; Subkey: "Software\Classes\.obj\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.obj')
Root: HKCU; Subkey: "Software\Classes\.fbx\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.fbx')
Root: HKCU; Subkey: "Software\Classes\.stl\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.stl')
Root: HKCU; Subkey: "Software\Classes\.3mf\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.3mf')
Root: HKCU; Subkey: "Software\Classes\.amf\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.amf')
Root: HKCU; Subkey: "Software\Classes\.ply\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.ply')
Root: HKCU; Subkey: "Software\Classes\.dae\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.dae')
Root: HKCU; Subkey: "Software\Classes\.3ds\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.3ds')
Root: HKCU; Subkey: "Software\Classes\.lwo\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.lwo')
Root: HKCU; Subkey: "Software\Classes\.wrl\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.wrl')
Root: HKCU; Subkey: "Software\Classes\.vox\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.vox')
Root: HKCU; Subkey: "Software\Classes\.drc\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.drc')
Root: HKCU; Subkey: "Software\Classes\.usdz\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.usdz')
Root: HKCU; Subkey: "Software\Classes\.xyz\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.xyz')
Root: HKCU; Subkey: "Software\Classes\.pcd\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.pcd')
Root: HKCU; Subkey: "Software\Classes\.gcode\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.gcode')
Root: HKCU; Subkey: "Software\Classes\.nc\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.nc')
Root: HKCU; Subkey: "Software\Classes\.ncc\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.ncc')
Root: HKCU; Subkey: "Software\Classes\.ngc\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.ngc')
Root: HKCU; Subkey: "Software\Classes\.vtk\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.vtk')
Root: HKCU; Subkey: "Software\Classes\.vtp\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.vtp')
Root: HKCU; Subkey: "Software\Classes\.step\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.step')
Root: HKCU; Subkey: "Software\Classes\.stp\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.stp')
Root: HKCU; Subkey: "Software\Classes\.iges\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.iges')
Root: HKCU; Subkey: "Software\Classes\.igs\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.igs')
Root: HKCU; Subkey: "Software\Classes\.brep\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.brep')
Root: HKCU; Subkey: "Software\Classes\.brp\ShellEx\{#ThumbProvId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppCLSID}"; Flags: uninsdeletevalue; Tasks: thumb; Check: SafeThumb('.brp')

; ---- file associations (task "assoc", never override existing association) ----
Root: HKCU; Subkey: "Software\Classes\.glb"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.glb')
Root: HKCU; Subkey: "Software\Classes\.gltf"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.gltf')
Root: HKCU; Subkey: "Software\Classes\.obj"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.obj')
Root: HKCU; Subkey: "Software\Classes\.fbx"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.fbx')
Root: HKCU; Subkey: "Software\Classes\.stl"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.stl')
Root: HKCU; Subkey: "Software\Classes\.3mf"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.3mf')
Root: HKCU; Subkey: "Software\Classes\.amf"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.amf')
Root: HKCU; Subkey: "Software\Classes\.ply"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.ply')
Root: HKCU; Subkey: "Software\Classes\.dae"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.dae')
Root: HKCU; Subkey: "Software\Classes\.3ds"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.3ds')
Root: HKCU; Subkey: "Software\Classes\.lwo"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.lwo')
Root: HKCU; Subkey: "Software\Classes\.wrl"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.wrl')
Root: HKCU; Subkey: "Software\Classes\.vox"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.vox')
Root: HKCU; Subkey: "Software\Classes\.drc"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.drc')
Root: HKCU; Subkey: "Software\Classes\.usdz"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.usdz')
Root: HKCU; Subkey: "Software\Classes\.xyz"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.xyz')
Root: HKCU; Subkey: "Software\Classes\.pcd"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.pcd')
Root: HKCU; Subkey: "Software\Classes\.gcode"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.gcode')
Root: HKCU; Subkey: "Software\Classes\.nc"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.nc')
Root: HKCU; Subkey: "Software\Classes\.ncc"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.ncc')
Root: HKCU; Subkey: "Software\Classes\.ngc"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.ngc')
Root: HKCU; Subkey: "Software\Classes\.vtk"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.vtk')
Root: HKCU; Subkey: "Software\Classes\.vtp"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.vtp')
Root: HKCU; Subkey: "Software\Classes\.step"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.step')
Root: HKCU; Subkey: "Software\Classes\.stp"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.stp')
Root: HKCU; Subkey: "Software\Classes\.iges"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.iges')
Root: HKCU; Subkey: "Software\Classes\.igs"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.igs')
Root: HKCU; Subkey: "Software\Classes\.brep"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.brep')
Root: HKCU; Subkey: "Software\Classes\.brp"; ValueType: string; ValueName: ""; ValueData: "{#ProgId}"; Flags: uninsdeletevalue; Tasks: assoc; Check: SafeAssoc('.brp')

; ---- ProgID (only when "assoc" selected) ----
Root: HKCU; Subkey: "Software\Classes\{#ProgId}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppName} 3D 模型"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\{#ProgId}\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\{#ProgId}\FriendlyAppName"; ValueType: string; ValueName: ""; ValueData: "{#MyAppName}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\{#ProgId}\Application"; ValueType: string; ValueName: "ApplicationCompany"; ValueData: "{#MyAppPublisher}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\{#ProgId}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\{#ProgId}\shell\open\icon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"; Flags: uninsdeletekey; Tasks: assoc

; ---- modern per-user default-app registration (Windows 10/11) ----
; Registered application: surfaces the app in Settings > Default apps and
; lets the OS resolve candidates for "Open with".
Root: HKCU; Subkey: "Software\RegisteredApplications"; ValueType: string; ValueName: "{#MyAppName}"; ValueData: "Software\{#MyAppName}\Capabilities"; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities"; ValueType: string; ValueName: "ApplicationName"; ValueData: "{#MyAppName}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities"; ValueType: string; ValueName: "ApplicationDescription"; ValueData: "快速查看 3D 模型文件"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities"; ValueType: string; ValueName: "ApplicationIcon"; ValueData: "{app}\{#MyAppExeName},0"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".glb"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".gltf"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".obj"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".fbx"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".stl"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".3mf"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".amf"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".ply"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".dae"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".3ds"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".lwo"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".wrl"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".vox"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".drc"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".usdz"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".xyz"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".pcd"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".gcode"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".nc"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".ncc"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".ngc"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".vtk"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".vtp"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".step"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".stp"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".iges"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".igs"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".brep"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\{#MyAppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".brp"; ValueData: "{#ProgId}"; Flags: uninsdeletekey; Tasks: assoc
; Explorer "Open with" list + honest "supported types" for the shell.
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}"; ValueType: string; ValueName: "FriendlyAppName"; ValueData: "{#MyAppName}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}"; ValueType: string; ValueName: "ApplicationCompany"; ValueData: "{#MyAppPublisher}"; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".glb"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".gltf"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".obj"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".fbx"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".stl"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".3mf"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".amf"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".ply"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".dae"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".3ds"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".lwo"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".wrl"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".vox"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".drc"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".usdz"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".xyz"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".pcd"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".gcode"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".nc"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".ncc"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".ngc"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".vtk"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".vtp"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".step"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".stp"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".iges"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".igs"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".brep"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".brp"; ValueData: ""; Flags: uninsdeletekey; Tasks: assoc
; OpenWithProgids: makes the ProgId discoverable for each extension, both in
; the legacy HKCU\Software\Classes root and in FileExts (which Windows 8+
; "Open With"/default-apps UI actually reads).
; Software\Classes\<ext>\OpenWithProgids
Root: HKCU; Subkey: "Software\Classes\.glb\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.gltf\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.obj\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.fbx\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.stl\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.3mf\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.amf\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.ply\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.dae\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.3ds\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.lwo\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.wrl\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.vox\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.drc\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.usdz\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.xyz\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.pcd\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.gcode\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.nc\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.ncc\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.ngc\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.vtk\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.vtp\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.step\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.stp\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.iges\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.igs\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.brep\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Classes\.brp\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
; FileExts\<ext>\OpenWithProgids (what the modern "Open With / Default apps" UI reads)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.glb\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.gltf\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.obj\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.fbx\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.stl\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.3mf\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.amf\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.ply\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.dae\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.3ds\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.lwo\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.wrl\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.vox\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.drc\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.usdz\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.xyz\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.pcd\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.gcode\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.nc\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.ncc\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.ngc\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.vtk\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.vtp\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.step\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.stp\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.iges\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.igs\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.brep\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.brp\OpenWithProgids"; ValueType: string; ValueName: "{#ProgId}"; ValueData: ""; Flags: uninsdeletevalue; Tasks: assoc

; ---- tray autostart (task "autostart") ----
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "PolyPeekTray"; ValueData: """{app}\TrayHost.exe"""; Tasks: autostart; Flags: uninsdeletevalue

[Run]
; applies the (hash-protected) per-user UserChoice default for every extension
Filename: "{app}\TrayHost.exe"; Parameters: "assocset .glb .gltf .obj .fbx .stl .3mf .amf .ply .dae .3ds .lwo .wrl .vox .drc .usdz .xyz .pcd .gcode .nc .ncc .ngc .vtk .vtp .step .stp .iges .igs .brep .brp"; StatusMsg: "正在设置默认文件关联..."; Flags: runhidden waituntilterminated; Tasks: assoc
Filename: "{app}\TrayHost.exe"; Description: "启动快速预览托盘服务"; Flags: nowait skipifdoesntexist runhidden

[Icons]
Name: "{autoprograms}\{#MyAppName}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{autoprograms}\{#MyAppName}\卸载 {#MyAppName}"; Filename: "{uninstallexe}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[UninstallRun]
Filename: "{app}\TrayHost.exe"; Parameters: "assocdel .glb .gltf .obj .fbx .stl .3mf .amf .ply .dae .3ds .lwo .wrl .vox .drc .usdz .xyz .pcd .gcode .nc .ncc .ngc .vtk .vtp .step .stp .iges .igs .brep .brp"; Flags: runhidden waituntilterminated; Tasks: assoc
Filename: "{sys}\taskkill.exe"; Parameters: "/f /im TrayHost.exe"; Flags: runhidden
Filename: "{sys}\taskkill.exe"; Parameters: "/f /im {#MyAppExeName}"; Flags: runhidden

[Code]
function SafeAssoc(const Ext: String): Boolean;
var
  V: string;
begin
  V := '';
  if RegQueryStringValue(HKCU, 'Software\Classes\' + Ext, '', V) or
     RegQueryStringValue(HKLM, 'Software\Classes\' + Ext, '', V) then
  begin
    if V <> '' then
    begin
      Result := (V = 'PolyPeek.Model');
      Exit;
    end;
  end;
  { empty -> we may set (respect HKLM? we could not see) }
  Result := True;
end;

function SafeThumb(const Ext: String): Boolean;
var
  V: string;
  K: string;
begin
  K := 'Software\Classes\' + Ext + '\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}';
  V := '';
  if RegQueryStringValue(HKCU, K, '', V) then
  begin
    if V <> '' then
    begin
      Result := (V = '{B66E45DB-9A5C-4805-8D8B-CB84A1A1EBFB}');
      Exit;
    end;
  end;
  if RegQueryStringValue(HKLM, K, '', V) then
  begin
    if V <> '' then
    begin
      Result := (V = '{B66E45DB-9A5C-4805-8D8B-CB84A1A1EBFB}');
      Exit;
    end;
  end;
  Result := True;
end;