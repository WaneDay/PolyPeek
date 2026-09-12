# PolyPeek

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A lightweight 3D model preview viewer for Windows, with a clean modern UI.

---

## English

### Introduction

PolyPeek is a lightweight 3D model preview viewer for Windows. It features a clean, modern UI that follows the system light/dark theme, provides colored **thumbnail previews** for 3D files in File Explorer, and a **global quick-preview** hotkey: select a model file and press Backtick (`` ` ``) to preview instantly.

<img width="1182" height="765" alt="image" src="https://github.com/user-attachments/assets/b780bd46-f172-4d82-8a51-44fa2bd4757f" />

It ships as a per-user installer and optionally registers file associations so PolyPeek can be set as the default 3D model viewer.

### Features

- Clean modern UI that follows the Windows light/dark theme.
- Colored 3D thumbnails in File Explorer (native COM Shell Extension with on-disk cache).
- Global instant preview while browsing: select a file and press Backtick (`` ` ``), `Esc` closes the window.
- 30 supported 3D formats: `glb / gltf / obj / fbx / stl / 3mf / amf / ply / dae / 3ds / lwo / wrl / vox / drc / usdz / xyz / pcd / gcode / nc / ncc / ngc / vtk / vtp / step / stp / iges / igs / brep / brp`.
- GLTF textures & basic animations, OBJ + MTL materials, STL/PLY views; STEP/IGES triangulated via OCCT (WebAssembly).
- Orbit camera: left-drag rotate, right-drag pan, wheel zoom, double-click reset.
- Installer with optional thumbnail / file-association / autostart / desktop-shortcut options.
- Built-in tray service; no admin rights required.

### System Requirements

- Windows 10 or later (64-bit).
- No additional runtime needed (bundled Electron runtime).

### Release: Install & Use

1. Download `PolyPeek-Setup-1.0.0-x64.exe` from the **Releases** page.
2. Double-click to install (per-user, no admin rights).
3. Select a 3D model file in File Explorer and press Backtick (`` ` ``) to preview; press `Esc` to close. Double-click files to open them with PolyPeek.
4. Uninstall: "Uninstall PolyPeek" in the Start menu.

> Note: the installer is unsigned, so SmartScreen may show a warning ("More info" -> "Run anyway"). On Windows 11 some extensions (`.3mf/.fbx/.glb/.gltf/.obj/.ply/.step/.stl`) cannot be set as the default program programmatically because the OS protects the default entry; use "Open with" and pick PolyPeek once.

### Build from Source

Requirements: Node.js 24+, Windows SDK + Visual Studio 2022 (MSVC), Inno Setup 6 (auto-downloaded by the script).

```powershell
npm install
npm run build          # build JS bundle + native binaries
npm run pack:dir       # electron-builder win-x64 -> dist-package\win-unpacked
npm run pack:installer -- -Proxy http://127.0.0.1:7897   # build setup exe
```

Clone:
```bash
git clone https://gitee.com/[GITEE_USERNAME]/PolyPeek.git
```

### Known Limitations

- The installer is unsigned; SmartScreen / some antivirus tools may flag it.
- On Windows 11, the 8 extensions above keep their OS-locked default-program entries; a one-time manual "Open with" selection is required (same limitation as every third-party app).
- CAD formats (STEP/IGES) rely on OCCT(WebAssembly) triangulation; very large files may load slowly.
- Only 3D preview / thumbnails are supported: no editing, no export, no measurement.

### License

MIT License — see [LICENSE](LICENSE).

---

## 简体中文

### 项目简介

PolyPeek 是 Windows 平台轻量 3D 模型预览查看器，采用简洁现代界面（跟随系统明暗主题）。支持资源管理器 3D 文件**彩色缩略图**预览，以及**全局快速预览**：选中模型文件后按反引号键（`` ` ``）即时预览。

提供逐用户安装包，可选注册文件关联，将 PolyPeek 设为 3D 模型默认查看程序。

### 功能特性

- 简洁现代界面，跟随 Windows 明/暗色主题切换。
- 资源管理器 3D 彩色缩略图（原生 COM Shell Extension，带磁盘缓存）。
- 浏览时全局即时预览：选中文件按反引号键（`` ` ``），`Esc` 关闭窗口。
- 支持 30 种 3D 格式：`glb / gltf / obj / fbx / stl / 3mf / amf / ply / dae / 3ds / lwo / wrl / vox / drc / usdz / xyz / pcd / gcode / nc / ncc / ngc / vtk / vtp / step / stp / iges / igs / brep / brp`。
- GLTF 纹理与基础动画、OBJ+MTL 材质、STL/PLY 点线面显示；STEP/IGES 通过 OCCT(WebAssembly) 三角化。
- 轨道相机：左键旋转 / 右键平移 / 滚轮缩放 / 双击复位。
- 安装包可选缩略图 / 文件关联 / 开机自启 / 桌面图标。
- 内置托盘服务，全程无需管理员权限。

### 系统要求

- Windows 10 及以上（64 位）。
- 无需额外运行时（内置 Electron 运行时）。

### Release 安装与使用

1. 在 Releases 页面下载 `PolyPeek-Setup-1.0.0-x64.exe`。
2. 双击安装（逐用户安装，无需管理员权限）。
3. 在资源管理器中选中 3D 模型文件，按反引号键（`` ` ``）快速预览，按 `Esc` 关闭；双击文件可直接用 PolyPeek 打开。
4. 卸载：开始菜单「卸载 PolyPeek」。

> 注意：安装包未签名，SmartScreen 可能提示（点「更多信息」→「仍要运行」）。Windows 11 上部分扩展名（`.3mf/.fbx/.glb/.gltf/.obj/.ply/.step/.stl`）受系统保护，无法程序化写入默认程序，需在「打开方式」中手动选择一次 PolyPeek。

### 源码编译

环境要求：Node.js 24+、Windows SDK + Visual Studio 2022 (MSVC)、Inno Setup 6（脚本自动补齐）。

```powershell
npm install
npm run build          # 构建 JS + 原生二进制
npm run pack:dir       # electron-builder win-x64 -> dist-package\win-unpacked
npm run pack:installer -- -Proxy http://127.0.0.1:7897   # 生成安装包
```

克隆仓库：
```bash
git clone https://gitee.com/[GITEE_USERNAME]/PolyPeek.git
```

### 已知限制

- 安装包未签名，SmartScreen / 部分杀软可能报提醒。
- Windows 11 上上述 8 种扩展名的默认程序项被系统锁定，需手动「打开方式」选择一次（与所有第三方应用一致）。
- CAD 格式（STEP/IGES）依赖 OCCT(WebAssembly) 三角化，超大文件解析较慢。
- 仅支持 3D 预览/缩略图：不含编辑、导出、测量。

### 开源协议

MIT 协议 — 详见 [LICENSE](LICENSE)。

---

*Last updated: 2026-09*
