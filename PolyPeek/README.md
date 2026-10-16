# PolyPeek (3D 极速查看器)

极轻量 Windows 3D 模型查看器（Electron + three.js + TypeScript，无框架），配套：
- 资源管理器 3D 模型**彩色缩略图**（原生 COM Shell Extension，带磁盘缓存）
- 托盘常驻**全局反引号键预览**（在资源管理器中选中模型文件，按 `` ` `` 即可快速预览，Esc/再按 `` ` `` 关闭；不吞掉其它程序的按键）
- **Inno Setup 安装包**（逐用户安装，关联与缩略图均为可选）

无模型编辑、无导出、无测量（柱状图需求之外的功能均不在范围）。

## 效果
- 支持的格式（31 种）：`glb / gltf / obj / fbx / stl / 3mf / amf / ply / dae / 3ds / lwo / wrl / vox / drc / usdz / xyz / pcd / gcode / nc / ncc / ngc / vtk / vtp / step / stp / iges / igs / brep / brp / sldprt / sldasm`
- GLTF 纹理、GLTF/FBX/DAE 动画（内置时间轴：播放/暂停/拖拽进度/倍速选择栏，空格切换）、形态键（Morph）多选叠加切换、OBJ+MTL 材质、STL/PLY 网格与点云、STP/IGES 通过 OCCT(WebAssembly) 三角化。
- **打开即显**：模型解析完立即显示（贴图后台异步补足、不再阻塞首帧）；STEP/IGES/BREP 解析在后台 Web Worker 内进行，打开大文件时窗口保持流畅；模型文件流式读取，不占用主进程内存。
- **SOLIDWORKS 零件/装配体**（.sldprt/.sldasm）：直接解码文件内缓存的三角网格，无需安装 SolidWorks 或联网。
- **信息与视图面板**（标题栏 ⓘ / P 键）：顶点 / 三角面 / 网格 / 材质 / 包围尺寸 / 体积估算；视角模式（自由环绕 / 展台 / 舞台）；灯光预设（三点 / 正面 / 轮廓 / 顶光 / 无）与强度；地面网格（G）/ 坐标轴（X）/ 方向坐标 / 自动旋转 / 帧率浮层的开关。**面板选项自动记住**（含 `` ` `` 快速预览窗口，重启保持）；窗口最小化时自动暂停渲染省资源。
- 轨道相机：左键旋转 / 右键平移 / 滚轮缩放 / 双击复位（展台模式下拖拽旋转、松手回弹）。

## 目录结构
```
src/main      Electron 主进程（自定义 vfdv:// 协议、缩略图/预览模式、窗口）
src/renderer  three.js 渲染页、loaders、UI
src/preload   预加载脚本
native        原生 C++：ThumbProvider.dll + TrayHost.exe + formats.h
scripts       build.mjs(esbuild) / build-native.ps1 / make-icons.ps1 / package-installer.ps1 / smoke.mjs
installer     Inno Setup *.iss
tests         smoke 脚本与样例模型（samples/）
```

## 构建
```powershell
# 1) JS 打包 + 原生二进制（需 VS2022 + Windows SDK）
npm run build

# 2) 目录包（electron-builder win-x64，生成 dist-package\win-unpacked）
npm run pack:dir

# 3) 一键打包安装包（自动补齐 Inno Setup，国内网络可 -Proxy http://127.0.0.1:7897）
npm run pack:installer -- -Proxy http://127.0.0.1:7897
# 产物：dist-package\PolyPeek-Setup-1.1.0-x64.exe
```

## 更新包机制（PolyPeek-Update-<版本>-x64.exe）
- 完整安装包约 120MB（内含 Electron 运行时），**日常发布用“更新包”代替**：
  每次改动源码后先 `npm run pack:installer`（刷新 `dist-package\win-unpacked`），再
  `npm run pack:update` 生成 **几 MB** 的 `PolyPeek-Update-<版本>-x64.exe`（只含
  `resources\app.asar`、`TrayHost.exe`、`ThumbProvider.dll`、`PolyPeekVersion.txt`）。
- 老用户直接运行更新包即可原地升级（Inno 同 AppId 自动识别已安装目录，会先结束
  旧版 TrayHost 再写文件并重新拉起托盘）；无需重新分发整套 Electron。
- 发新版前先在 `package.json` 里 `version` 递增，更新包文件名与
  `PolyPeekVersion.txt` 会自动跟随。

开发运行：`npm run build:js && npm start [模型文件]`

## 安装 / 使用
- 安装为**逐用户**（无需管理员），默认仅注册缩略图（不覆盖系统已有的其它 3D 查看器缩略图）。
- 安装时可选项：
  - **彩色缩略图**（默认勾选）— 在资源管理器中预览 3D 模型图标；
  - **关联 3D 文件**（默认不勾选）— 不覆盖已有默认打开程序，仅在无关联时设置；
  - **开机自启托盘**（默认勾选）、桌面快捷方式。
- 启用托盘后：在资源管理器/桌面选中模型文件，按 **` 反引号键** 快速居中预览（再按 `` ` `` 或按 **Esc** 关闭；预览窗口聚焦时按 `` ` `` 也关闭）；选中另一个模型再按 `` ` `` 会自动替换。Shift+` 的 `~` 与所有其它按键一律不拦截。
- 托盘调试日志：`%LOCALAPPDATA%\PolyPeek\trayhost.log`。
- 缩略图/预览渲染失败时自动回退为「3D」占位图。

## 裁剪/运行方式
- Electron 运行入口见 `src/main/index.ts`：`--render-thumbnail <in> <out> <px>` 与 `--preview <file>`。
- 渲染页自 `vfdv://local/renderer/index.html` 加载，模型通过 `vfdv://local/file/<绝对路径>` 同源读取，规避 CORS。

## 依赖与工具链
- Node 24 + esbuild + electron-builder 26；three ^0.186。
- C++：VS2022 (MSVC + Windows SDK 10.0.22621) ，`scripts/build-native.ps1` 自动定位 VsDevCmd。
- Inno Setup 6（缺失时由打包脚本自动下载安装到 `%LOCALAPPDATA%\PolyPeek\cache\inno`）。