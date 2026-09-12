// TrayHost.exe - resident tray process with a global backtick-key preview hook.
// When Explorer or the desktop has focus and a supported 3D file is selected,
// pressing ` opens a quick preview (the key is consumed only in that exact
// case); pressing ` again on the same file closes it. All other keys and apps
// are completely unaffected (Shift+` produces ~ and is left alone).

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <exdisp.h>
#include <shlwapi.h>
#include <ShlDisp.h>
#include <bcrypt.h>
#include <wincrypt.h>
#include <sddl.h>
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <cstdio>
#include <cstring>

#include "../formats.h"

#pragma comment(lib, "user32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "bcrypt.lib")
#pragma comment(lib, "crypt32.lib")

#define WM_TRAY (WM_APP + 1)
#define WM_POLL (WM_APP + 3)
#define WM_TRAYMENU (WM_APP + 4)
#define IDM_OPEN 1001
#define IDM_EXIT 1002

static const wchar_t kMutexName[] = L"Local\\PolyPeek.TrayHost.Mutex";
static const wchar_t kClassName[] = L"PolyPeekTrayHost";

// ---------------------------------------------------------------------------
// lightweight diagnostics log (appended, last ~256KB)
// ---------------------------------------------------------------------------
static void LogLine(const wchar_t* fmt, ...) {
    static wchar_t path[MAX_PATH] = {};
    if (!path[0]) {
        wchar_t base[MAX_PATH];
        if (SHGetFolderPathW(nullptr, CSIDL_LOCAL_APPDATA, nullptr, 0, base) != S_OK) return;
        wsprintfW(path, L"%s\\PolyPeek\\trayhost.log", base);
        CreateDirectoryW((std::wstring(base) + L"\\PolyPeek").c_str(), nullptr);
    }
    SYSTEMTIME st;
    GetLocalTime(&st);
    wchar_t line[4096];
    va_list ap;
    va_start(ap, fmt);
    int n = wsprintfW(line, L"%04d-%02d-%02d %02d:%02d:%02d.%03d  ", st.wYear, st.wMonth, st.wDay, st.wHour,
                      st.wMinute, st.wSecond, st.wMilliseconds);
    vswprintf_s(line + n, 4096 - n, fmt, ap);
    va_end(ap);
    HANDLE h = CreateFileW(path, FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_ALWAYS,
                           FILE_ATTRIBUTE_NORMAL, nullptr);
    if (h == INVALID_HANDLE_VALUE) return;
    DWORD len = (DWORD)(wcslen(line) * sizeof(wchar_t));
    DWORD wrote = 0;
    if (len) {
        WriteFile(h, line, len, &wrote, nullptr);
        WriteFile(h, L"\r\n", 2 * sizeof(wchar_t), &wrote, nullptr);
    }
    CloseHandle(h);
}

static HWND g_hwnd = nullptr;
static HHOOK g_hook = nullptr;
static NOTIFYICONDATAW g_nid{};
static HICON g_hTrayIcon = nullptr;

struct PreviewProc {
    DWORD pid = 0;
    HWND  hwnd = nullptr;
    std::wstring file;
};

static std::unordered_map<DWORD, PreviewProc> g_previews; // keyed by pid
static std::wstring g_appExe;
static HANDLE g_job = nullptr;

// ---------------------------------------------------------------------------
// app exe resolution
// ---------------------------------------------------------------------------
static std::wstring ResolveAppExe() {
    // 1) next to TrayHost
    wchar_t self[MAX_PATH]{};
    GetModuleFileNameW(nullptr, self, MAX_PATH);
    wchar_t dir[MAX_PATH];
    wcscpy_s(dir, self);
    PathRemoveFileSpecW(dir);
    std::wstring a = std::wstring(dir) + L"\\PolyPeek.exe";
    if (is_regular_file(a)) return a;

    // 2) registry InstallPath
    HKEY hk;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\PolyPeek", 0, KEY_READ, &hk) == ERROR_SUCCESS) {
        wchar_t buf[MAX_PATH]{};
        DWORD cb = sizeof(buf);
        DWORD type = 0;
        if (RegQueryValueExW(hk, L"InstallPath", nullptr, &type, reinterpret_cast<LPBYTE>(buf), &cb) ==
                ERROR_SUCCESS &&
            type == REG_SZ && buf[0])
            if (is_regular_file(buf)) {
                RegCloseKey(hk);
                return std::wstring(buf);
            }
        RegCloseKey(hk);
    }

    // 3) common install locations
    const wchar_t* locs[] = {
        L"%LOCALAPPDATA%\\Programs\\PolyPeek\\PolyPeek.exe",
        L"%PROGRAMFILES%\\PolyPeek\\PolyPeek.exe",
    };
    for (const wchar_t* l : locs) {
        wchar_t buf[MAX_PATH];
        if (ExpandEnvironmentStringsW(l, buf, MAX_PATH) && is_regular_file(buf)) return std::wstring(buf);
    }
    return L"";
}

// ---------------------------------------------------------------------------
// foreground classification
// ---------------------------------------------------------------------------
static bool ClassEquals(HWND hwnd, const wchar_t* cls) {
    wchar_t buf[64];
    if (!GetClassNameW(hwnd, buf, 64)) return false;
    return lstrcmpiW(buf, cls) == 0;
}

static HWND FindChildByClassRecursive(HWND parent, const wchar_t* cls) {
    HWND child = GetWindow(parent, GW_CHILD);
    while (child) {
        if (ClassEquals(child, cls)) return child;
        // Win11 Explorer tabs nest SHELLDLL_DefView deep inside the window
        // (ShellTabWindowClass / DUIViewWndClassName), so search recursively.
        HWND sub = FindChildByClassRecursive(child, cls);
        if (sub) return sub;
        child = GetWindow(child, GW_HWNDNEXT);
    }
    return nullptr;
}

static bool WindowHasShellTree(HWND hwnd) {
    // Just the shell view matters: on recent Win11 the file list inside the
    // view is DirectUI-based (no SysListView32 anymore), but SHELLDLL_DefView
    // itself is always present and holds the selection.
    return FindChildByClassRecursive(hwnd, L"SHELLDLL_DefView") != nullptr;
}

// Find the destination HWND that owns the selection:
//  - Explorer foreground windows themselves have SHELLDLL_DefView/SysListView32
//  - the desktop is hosted in Progman/WorkerW
static HWND FindSelectionTarget() {
    HWND fg = GetForegroundWindow();
    if (!fg) return nullptr;

    // Our own apps must never trigger.
    DWORD pid = 0;
    GetWindowThreadProcessId(fg, &pid);
    wchar_t name[MAX_PATH]{};
    HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (h) {
        DWORD cb = MAX_PATH;
        QueryFullProcessImageNameW(h, 0, name, &cb);
        CloseHandle(h);
    }
    std::wstring lower = str_lower(std::wstring(name));
    if (lower.find(L"polypeek") != std::wstring::npos ||
        lower.find(L"trayhost") != std::wstring::npos) {
        return nullptr;
    }
    LogLine(L"find: fg=%d name=%s", (DWORD)(DWORD_PTR)fg, name[0] ? name : L"(none)");

    // Explorer windows
    bool shellTree = WindowHasShellTree(fg);
    LogLine(L"find: shellTree=%d", shellTree ? 1 : 0);
    if (shellTree) return fg;

    // Desktop
    if (ClassEquals(fg, L"Progman") || ClassEquals(fg, L"WorkerW")) {
        HWND probe = fg;
        for (int i = 0; i < 8; ++i) {
            HWND def = FindWindowExW(probe, nullptr, L"SHELLDLL_DefView", nullptr);
            if (!def) break;
            // focus the desktop view so selection reads consistently
            SetFocus(def);
            return def;
        }
    }
    return nullptr;
}

// ---------------------------------------------------------------------------
// selection via IShellWindows automation (raw IDispatch, avoids dual vtable)
// ---------------------------------------------------------------------------
static VARIANT DispInvoke(IDispatch* d, const wchar_t* name, VARIANT* arg = nullptr) {
    VARIANT r;
    VariantInit(&r);
    DISPID id;
    wchar_t* nm = const_cast<wchar_t*>(name);
    if (FAILED(d->GetIDsOfNames(IID_NULL, &nm, 1, LOCALE_USER_DEFAULT, &id))) return r;
    DISPPARAMS dp{};
    if (arg) {
        dp.cArgs = 1;
        dp.rgvarg = arg;
    }
    HRESULT hr = d->Invoke(id, IID_NULL, LOCALE_USER_DEFAULT, DISPATCH_PROPERTYGET, &dp, &r, nullptr, nullptr);
    if (FAILED(hr)) {
        // SelectedItems/Item are methods and reject DISPATCH_PROPERTYGET
        VariantClear(&r);
        VariantInit(&r);
        d->Invoke(id, IID_NULL, LOCALE_USER_DEFAULT, DISPATCH_METHOD, &dp, &r, nullptr, nullptr);
    }
    return r;
}

static std::vector<std::wstring> GetSelectedPathsFromDocument(IDispatch* doc) {
    std::vector<std::wstring> out;
    if (!doc) return out;
    VARIANT items = DispInvoke(doc, L"SelectedItems");
    LogLine(L"sel: SelectedItems vt=%d", items.vt);
    if (items.vt == VT_DISPATCH && items.pdispVal) {
        IDispatch* itemsDisp = items.pdispVal;
        VARIANT cnt = DispInvoke(itemsDisp, L"Count");
        long n = 0;
        if (cnt.vt == VT_I4) n = cnt.lVal;
        else if (cnt.vt == VT_UI4) n = static_cast<long>(cnt.ulVal);
        LogLine(L"sel: Count vt=%d n=%d", cnt.vt, n);
        VariantClear(&cnt);
        for (long i = 0; i < n; ++i) {
            VARIANT idx;
            VariantInit(&idx);
            idx.vt = VT_I4;
            idx.lVal = i;
            VARIANT it = DispInvoke(itemsDisp, L"Item", &idx);
            VariantClear(&idx);
            if (it.vt == VT_DISPATCH && it.pdispVal) {
                VARIANT p = DispInvoke(it.pdispVal, L"Path");
                if (p.vt == VT_BSTR && p.bstrVal && p.bstrVal[0]) out.push_back(std::wstring(p.bstrVal));
                VariantClear(&p);
            }
            VariantClear(&it);
        }
    }
    VariantClear(&items);
    return out;
}

static std::vector<std::wstring> GetSelectedPaths(HWND target) {
    std::vector<std::wstring> out;
    if (!target) return out;

    IShellWindows* windows = nullptr;
    HRESULT hcc = CoCreateInstance(CLSID_ShellWindows, nullptr, CLSCTX_ALL, IID_IShellWindows,
                                   reinterpret_cast<void**>(&windows));
    LogLine(L"sel: CoCreateInstance=0x%08x", hcc);
    if (FAILED(hcc))
        return out;

    long count = 0;
    HRESULT hc = windows->get_Count(&count);
    LogLine(L"sel: shellWindows count hr=0x%08x n=%d", hc, count);
    if (SUCCEEDED(hc)) {
        for (long i = 0; i < count; ++i) {
            VARIANT vi;
            VariantInit(&vi);
            vi.vt = VT_I4;
            vi.lVal = i;
            IDispatch* disp = nullptr;
            if (SUCCEEDED(windows->Item(vi, &disp)) && disp) {
                IWebBrowserApp* web = nullptr;
                if (SUCCEEDED(disp->QueryInterface(IID_IWebBrowserApp, reinterpret_cast<void**>(&web)))) {
                    SHANDLE_PTR h = 0;
                    if (SUCCEEDED(web->get_HWND(&h)) && reinterpret_cast<HWND>(h) == target) {
                        LogLine(L"sel: hwnd match=%d", (DWORD)(DWORD_PTR)h);
                        IDispatch* doc = nullptr;
                        HRESULT hd = web->get_Document(&doc);
                        LogLine(L"sel: get_Document hr=0x%08x", hd);
                        if (SUCCEEDED(hd) && doc) {
                            std::vector<std::wstring> got = GetSelectedPathsFromDocument(doc);
                            out.insert(out.end(), got.begin(), got.end());
                            doc->Release();
                        }
                    }
                    web->Release();
                }
                disp->Release();
            }
            VariantClear(&vi);
        }
    }
    windows->Release();
    return out;
}

// ---------------------------------------------------------------------------
// spawn / manage preview processes
// ---------------------------------------------------------------------------
static void SpawnPreview(const std::wstring& file) {
    if (g_appExe.empty()) return;
    std::wstring cmd = L"\"" + g_appExe + L"\" --preview \"" + file + L"\"";

    STARTUPINFOW si{};
    si.cb = sizeof(si);
    PROCESS_INFORMATION pi{};
    if (!CreateProcessW(nullptr, &cmd[0], nullptr, nullptr, FALSE, CREATE_UNICODE_ENVIRONMENT, nullptr,
                        nullptr, &si, &pi))
        return;
    CloseHandle(pi.hThread);
    if (g_job) AssignProcessToJobObject(g_job, pi.hProcess);
    DWORD pid = GetProcessId(pi.hProcess);
    PreviewProc pp;
    pp.pid = pid;
    pp.file = file;
    g_previews[pid] = pp;
    CloseHandle(pi.hProcess);
}

static void ClosePreview(DWORD pid) {
    auto it = g_previews.find(pid);
    if (it == g_previews.end()) return;
    if (it->second.hwnd && IsWindow(it->second.hwnd)) PostMessageW(it->second.hwnd, WM_CLOSE, 0, 0);
    g_previews.erase(it);
}

static void CloseAllPreviews() {
    for (auto& kv : g_previews) {
        if (kv.second.hwnd && IsWindow(kv.second.hwnd)) PostMessageW(kv.second.hwnd, WM_CLOSE, 0, 0);
    }
}

// ---------------------------------------------------------------------------
// backtick handling: returns true if the key event was consumed by us.
// ---------------------------------------------------------------------------
static bool HandlePreviewToggle() {
    DWORD fgPid = 0;
    wchar_t fgCls[64] = L"?";
    HWND fgw = GetForegroundWindow();
    if (fgw) GetClassNameW(fgw, fgCls, 64);
    HWND target = FindSelectionTarget();
    LogLine(L"toggle: fg_class=%s handle=%d", fgCls, target ? 1 : 0);
    if (!target) {
        // preview window itself is focused: backtick closes it
        HWND fg = GetForegroundWindow();
        for (auto& kv : g_previews) {
            if (kv.second.hwnd == fg) {
                ClosePreview(kv.first);
                return true;
            }
        }
        return false;
    }

    std::vector<std::wstring> paths = GetSelectedPaths(target);
    LogLine(L"toggle: selected=%d", (int)paths.size());
    std::wstring chosen;
    for (auto& p : paths) {
        if (is_supported_3d_file(p) && is_regular_file(p)) {
            chosen = p;
            break;
        }
    }
    if (chosen.empty()) return false;

    for (auto& kv : g_previews) {
        if (lstrcmpiW(kv.second.file.c_str(), chosen.c_str()) == 0) {
            HWND owner = target;
            ClosePreview(kv.first);
            // give focus back to Explorer so the next Tab toggles again
            if (IsWindow(owner)) SetForegroundWindow(owner);
            return true; // toggle off
        }
    }

    // switching: close the currently open preview first
    if (!g_previews.empty()) CloseAllPreviews();

    SpawnPreview(chosen);
    return true;
}

static void UpdatePreviewHwnds() {
    struct Match {
        DWORD pid;
        HWND hwnd;
    };
    for (auto& kv : g_previews) {
        Match m{ kv.first, nullptr };
        EnumWindows([](HWND h, LPARAM lp) -> BOOL {
            Match* mm = reinterpret_cast<Match*>(lp);
            DWORD wpid = 0;
            GetWindowThreadProcessId(h, &wpid);
            if (wpid == mm->pid && IsWindowVisible(h)) {
                mm->hwnd = h;
                return FALSE;
            }
            return TRUE;
        }, reinterpret_cast<LPARAM>(&m));
        kv.second.hwnd = m.hwnd;
    }
}

static void PollProcesses() {
    std::vector<DWORD> dead;
    for (auto& kv : g_previews) {
        HANDLE h = OpenProcess(PROCESS_QUERY_INFORMATION | SYNCHRONIZE, FALSE, kv.first);
        if (!h) {
            dead.push_back(kv.first);
            continue;
        }
        DWORD code = 0;
        if (WaitForSingleObject(h, 0) == WAIT_OBJECT_0) dead.push_back(kv.first);
        else if (!GetExitCodeProcess(h, &code) || code != STILL_ACTIVE) dead.push_back(kv.first);
        CloseHandle(h);
    }
    for (DWORD pid : dead) g_previews.erase(pid);
    UpdatePreviewHwnds();
}

// ---------------------------------------------------------------------------
// tray
// ---------------------------------------------------------------------------
static HMENU CreateTrayMenu() {
    HMENU m = CreatePopupMenu();
    AppendMenuW(m, MF_STRING, IDM_OPEN, L"打开 PolyPeek");
    AppendMenuW(m, MF_SEPARATOR, 0, nullptr);
    AppendMenuW(m, MF_STRING, IDM_EXIT, L"退出");
    return m;
}

static void ShowTrayMenu() {
    HMENU m = CreateTrayMenu();
    POINT pt;
    GetCursorPos(&pt);
    SetForegroundWindow(g_hwnd);
    int cmd = TrackPopupMenu(m, TPM_RETURNCMD | TPM_NONOTIFY | TPM_RIGHTBUTTON, pt.x, pt.y, 0, g_hwnd, nullptr);
    DestroyMenu(m);
    if (cmd == IDM_OPEN) {
        if (!g_appExe.empty()) {
            std::wstring w = L"\"" + g_appExe + L"\"";
            STARTUPINFOW si{};
            si.cb = sizeof(si);
            PROCESS_INFORMATION pi{};
            CreateProcessW(nullptr, &w[0], nullptr, nullptr, FALSE, CREATE_UNICODE_ENVIRONMENT, nullptr,
                           nullptr, &si, &pi);
            if (pi.hProcess) CloseHandle(pi.hThread);
        }
    } else if (cmd == IDM_EXIT) {
        PostMessageW(g_hwnd, WM_CLOSE, 0, 0);
    }
}

static void AddTrayIcon() {
    if (!g_hTrayIcon) {
        wchar_t self[MAX_PATH];
        GetModuleFileNameW(nullptr, self, MAX_PATH);
        g_hTrayIcon = reinterpret_cast<HICON>(LoadImageW(nullptr, self, IMAGE_ICON, 32, 32, LR_LOADFROMFILE));
        if (!g_hTrayIcon) {
            wchar_t exe[MAX_PATH];
            if (g_appExe.size() < MAX_PATH) {
                wcscpy_s(exe, g_appExe.c_str());
                g_hTrayIcon = ExtractIconW(GetModuleHandleW(nullptr), exe, 0);
            }
        }
        if (!g_hTrayIcon) g_hTrayIcon = LoadIconW(nullptr, IDI_APPLICATION);
    }
    ZeroMemory(&g_nid, sizeof(g_nid));
    g_nid.cbSize = sizeof(g_nid);
    g_nid.hWnd = g_hwnd;
    g_nid.uID = 1;
    g_nid.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    g_nid.uCallbackMessage = WM_TRAY;
    g_nid.hIcon = g_hTrayIcon;
    lstrcpynW(g_nid.szTip, L"PolyPeek 快速预览", 64);
    Shell_NotifyIconW(NIM_ADD, &g_nid);
}

// ---------------------------------------------------------------------------
// keyboard hook
// ---------------------------------------------------------------------------
// The low-level hook runs inside the system's input callout, where COM
// calls fail with RPC_E_CANTCALLOUT_INASYNCCALL. So the hook only does the
// cheap foreground-class check and queues real work to a worker thread.
static HANDLE g_toggleEvent = nullptr;

static bool ForegroundEligible(HWND fg) {
    wchar_t cls[64];
    if (!fg || !GetClassNameW(fg, cls, 64)) return false;
    if (lstrcmpiW(cls, L"CabinetWClass") == 0 || lstrcmpiW(cls, L"WorkerW") == 0 ||
        lstrcmpiW(cls, L"Progman") == 0)
        return true;
    // a running preview (our own window) - backtick closes it
    if (lstrcmpiW(cls, L"Chrome_WidgetWin_1") == 0) {
        DWORD pid = 0;
        GetWindowThreadProcessId(fg, &pid);
        wchar_t name[MAX_PATH]{};
        HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
        if (h) {
            DWORD cb = MAX_PATH;
            QueryFullProcessImageNameW(h, 0, name, &cb);
            CloseHandle(h);
        }
        if (str_lower(std::wstring(name)).find(L"polypeek") != std::wstring::npos) return true;
    }
    return false;
}

// does the actual work (never runs inside the hook callout)
static DWORD WINAPI ToggleWorker(LPVOID) {
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    while (WaitForSingleObject(g_toggleEvent, INFINITE) == WAIT_OBJECT_0) {
        bool handled = HandlePreviewToggle();
        LogLine(L"backtick: handled=%d", handled ? 1 : 0);
    }
    CoUninitialize();
    return 0;
}

static LRESULT CALLBACK LowLevelHookProc(int nCode, WPARAM wParam, LPARAM lParam) {
    // Observe global input. The ONLY key we ever consume is the backtick key
    // (`) while Explorer or the desktop actually has a supported 3D file
    // selected - everything else (other apps, typing, Explorer without a 3D
    // selection) passes through untouched. Shift+` (~) is left alone.
    if (nCode == HC_ACTION && (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN)) {
        KBDLLHOOKSTRUCT* kb = reinterpret_cast<KBDLLHOOKSTRUCT*>(lParam);
        if (kb->vkCode == VK_OEM_3) {
            const bool alt   = (GetAsyncKeyState(VK_MENU) & 0x8000) != 0;
            const bool shift = (GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0;
            const bool ctrl  = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;
            if (!alt && !shift && !ctrl && ForegroundEligible(GetForegroundWindow())) {
                if (g_toggleEvent) SetEvent(g_toggleEvent); // consumed; actual work is deferred
                return 1;
            }
        }
    }
    return CallNextHookEx(g_hook, nCode, wParam, lParam);
}

static DWORD WINAPI HookThread(LPVOID) {
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    g_hook = SetWindowsHookExW(WH_KEYBOARD_LL, LowLevelHookProc, GetModuleHandleW(nullptr), 0);
    LogLine(g_hook ? L"hook installed" : L"hook FAILED, error=%d", GetLastError());
    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    CoUninitialize();
    return 0;
}

// ---------------------------------------------------------------------------
// modern per-user file associations (assocset / assocdel)
// ---------------------------------------------------------------------------
// Windows 8+ ignores the legacy HKCU\Software\Classes\<ext> ProgId when a
// UserChoice key exists under Explorer\FileExts, so installers must write the
// protected UserChoice hash themselves. This is a direct port of Mozilla's
// WindowsUserChoice.cpp (MPL-2.0), which reproduces the hash Windows 10/11
// expects, including the constant "User Experience" string.
static const wchar_t kAssocProgId[] = L"PolyPeek.Model";
static const wchar_t kAssocExp[] =
    L"user choice set via windows user experience {d18b6dd5-6124-4341-9318-804003bafa0b}";

static std::wstring AssocCurrentUserSid() {
    HANDLE token = nullptr;
    if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) return L"";
    DWORD size = 0;
    GetTokenInformation(token, TokenUser, nullptr, 0, &size);
    std::vector<BYTE> buf(size);
    BOOL ok = GetTokenInformation(token, TokenUser, buf.data(), size, &size);
    CloseHandle(token);
    if (!ok || buf.empty()) return L"";
    wchar_t* raw = nullptr;
    if (!ConvertSidToStringSidW(reinterpret_cast<PTOKEN_USER>(buf.data())->User.Sid, &raw)) return L"";
    std::wstring out = raw;
    LocalFree(raw);
    return out;
}

static DWORD AssocWordSwap(DWORD v) { return (v >> 16) | (v << 16); }

// inputLower must already be fully lowercased (Firefox CharLowerW's the whole
// formatted string before hashing).
static std::wstring AssocHash(const std::wstring& inputLower) {
    const unsigned char* bytes = reinterpret_cast<const unsigned char*>(inputLower.c_str());
    int byteCount = (int)((inputLower.size() + 1) * sizeof(wchar_t)); // include trailing NUL
    int blockCount = byteCount / 8;
    if (blockCount == 0) return L"";

    BCRYPT_ALG_HANDLE alg = nullptr;
    BCRYPT_HASH_HANDLE hash = nullptr;
    BYTE md5[16] = {};
    if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_MD5_ALGORITHM, nullptr, 0) != 0) return L"";
    bool good = BCryptCreateHash(alg, &hash, nullptr, 0, nullptr, 0, 0) == 0 &&
                BCryptHashData(hash, const_cast<unsigned char*>(bytes), (ULONG)byteCount, 0) == 0 &&
                BCryptFinishHash(hash, md5, sizeof(md5), 0) == 0;
    if (hash) BCryptDestroyHash(hash);
    BCryptCloseAlgorithmProvider(alg, 0);
    if (!good) return L"";

    DWORD md5d[4];
    memcpy(md5d, md5, sizeof(md5));
    DWORD C0a[5] = {md5d[0] | 1, 0xCF98B111uL, 0x87085B9FuL, 0x12CEB96DuL, 0x257E1D83uL};
    DWORD C0b[5] = {md5d[1] | 1, 0xA27416F5uL, 0xD38396FFuL, 0x7C932B89uL, 0xBFA49F69uL};
    DWORD C1a[5] = {md5d[0] | 1, 0xEF0569FBuL, 0x689B6B9FuL, 0x79F8A395uL, 0xC3EFEA97uL};
    DWORD C1b[5] = {md5d[1] | 1, 0xC31713DBuL, 0xDDCD1F0FuL, 0x59C3AF2DuL, 0x35BD1EC9uL};
    const DWORD* C0s[2] = {C0a, C0b};
    const DWORD* C1s[2] = {C1a, C1b};

    DWORD h0 = 0, h1 = 0, h0Acc = 0, h1Acc = 0;
    for (int i = 0; i < blockCount; ++i) {
        for (int j = 0; j < 2; ++j) {
            DWORD input;
            memcpy(&input, &bytes[(i * 2 + j) * 4], sizeof(DWORD));
            const DWORD* C0 = C0s[j];
            const DWORD* C1 = C1s[j];
            h0 += input;
            h0 *= C0[0];
            h0 = AssocWordSwap(h0) * C0[1];
            h0 = AssocWordSwap(h0) * C0[2];
            h0 = AssocWordSwap(h0) * C0[3];
            h0 = AssocWordSwap(h0) * C0[4];
            h0Acc += h0;
            h1 += input;
            h1 = AssocWordSwap(h1) * C1[1] + h1 * C1[0];
            h1 = (h1 >> 16) * C1[2] + h1 * C1[3];
            h1 = AssocWordSwap(h1) * C1[4] + h1;
            h1Acc += h1;
        }
    }
    DWORD out[2] = {h0 ^ h1, h0Acc ^ h1Acc};
    DWORD b64Len = 0;
    if (!CryptBinaryToStringW(reinterpret_cast<const BYTE*>(out), sizeof(out),
                              CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, nullptr, &b64Len))
        return L"";
    std::wstring b64(b64Len, L'\0');
    if (!CryptBinaryToStringW(reinterpret_cast<const BYTE*>(out), sizeof(out),
                              CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, &b64[0], &b64Len))
        return L"";
    b64.resize(b64Len);
    while (!b64.empty() && b64.back() == L'\0') b64.pop_back();
    return b64;
}

// Builds the (already lowercase) input string for the hash:
// "<ext><sid><progid><dwHighLower8><dwLowLower8><experience>"
static std::wstring AssocEnvW16(const std::wstring& ext, const std::wstring& sid,
                                const std::wstring& progId, const FILETIME& ft) {
    wchar_t hex[40];
    swprintf_s(hex, L"%08lx%08lx", ft.dwHighDateTime, ft.dwLowDateTime);
    std::wstring s = ext + sid + progId + hex + kAssocExp;
    CharLowerBuffW(&s[0], (DWORD)s.size()); // Firefox CharLowerW's the whole string
    return s;
}

static bool AssocWriteUserChoice(const std::wstring& ext, const std::wstring& progId,
                                 const std::wstring& basePath) {
    std::wstring sid = AssocCurrentUserSid();
    if (sid.empty()) return false;
    SYSTEMTIME st;
    GetSystemTime(&st);
    st.wSecond = 0;
    st.wMilliseconds = 0;
    FILETIME ft{};
    SystemTimeToFileTime(&st, &ft);
    std::wstring hash = AssocHash(AssocEnvW16(ext, sid, progId, ft));
    if (hash.empty()) return false;

    HKEY hk = nullptr;
    LONG rc = RegCreateKeyExW(HKEY_CURRENT_USER, basePath.c_str(), 0, nullptr, 0, KEY_SET_VALUE, nullptr, &hk,
                              nullptr);
    if (rc != ERROR_SUCCESS)
        return false;
    LONG r1 = RegSetValueExW(hk, L"ProgId", 0, REG_SZ, reinterpret_cast<const BYTE*>(progId.c_str()),
                             (DWORD)((progId.size() + 1) * sizeof(wchar_t)));
    LONG r2 = RegSetValueExW(hk, L"Hash", 0, REG_SZ, reinterpret_cast<const BYTE*>(hash.c_str()),
                             (DWORD)((hash.size() + 1) * sizeof(wchar_t)));
    RegCloseKey(hk);
    return r1 == ERROR_SUCCESS && r2 == ERROR_SUCCESS;
}

// Recomputes the hash for an existing UserChoice key and compares it to the
// stored one. Used to validate the algorithm against this Windows build.
static bool AssocVerifyUserChoice(const std::wstring& ext) {
    std::wstring sid = AssocCurrentUserSid();
    if (sid.empty()) return false;
    std::wstring base = std::wstring(L"Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\") + ext;
    HKEY hk = nullptr;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, base.c_str(), 0, KEY_READ, &hk) != ERROR_SUCCESS) return false;
    wchar_t prog[256] = {};
    DWORD cb = sizeof(prog);
    LONG pr = RegGetValueW(hk, L"UserChoice", L"ProgId", RRF_RT_REG_SZ, nullptr, prog, &cb);
    wchar_t hash[128] = {};
    cb = sizeof(hash);
    LONG hr = RegGetValueW(hk, L"UserChoice", L"Hash", RRF_RT_REG_SZ, nullptr, hash, &cb);
    FILETIME lw{};
    bool hasTime = false;
    HKEY uc = nullptr;
    if (RegOpenKeyExW(hk, L"UserChoice", 0, KEY_READ, &uc) == ERROR_SUCCESS) {
        if (RegQueryInfoKeyW(uc, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
                             nullptr, &lw) == ERROR_SUCCESS)
            hasTime = true;
        RegCloseKey(uc);
    }
    RegCloseKey(hk);
    if (pr != ERROR_SUCCESS || hr != ERROR_SUCCESS || !hasTime) return false;

    SYSTEMTIME st{};
    if (!FileTimeToSystemTime(&lw, &st)) return false;
    st.wSecond = 0;
    st.wMilliseconds = 0;
    FILETIME ft{};
    SystemTimeToFileTime(&st, &ft);
    std::wstring computed = AssocHash(AssocEnvW16(ext, sid, prog, ft));
    if (computed.empty()) return false;
    return lstrcmpiW(computed.c_str(), hash) == 0;
}

static void AssocNotifyChange() { SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, nullptr, nullptr); }

static int RunAssocSet(const std::vector<std::wstring>& exts) {
    int ok = 0;
    for (const auto& e : exts) {
        if (e.empty() || e[0] != L'.') continue;
        std::wstring base = std::wstring(L"Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\") + e;
        HKEY hk = nullptr;
        RegCreateKeyExW(HKEY_CURRENT_USER, base.c_str(), 0, nullptr, 0, KEY_READ, nullptr, &hk, nullptr);
        if (hk) RegCloseKey(hk);
        std::wstring uc = base + L"\\UserChoice";
        bool done = AssocWriteUserChoice(e, kAssocProgId, uc);
        done = done && AssocVerifyUserChoice(e);
        LogLine(L"assocset: %s %s", e.c_str(), done ? L"OK" : L"FAILED");
        if (done) ++ok;
    }
    AssocNotifyChange();
    LogLine(L"assocset: done %d/%d", ok, (int)exts.size());
    return ok ? 0 : 1;
}

static int RunAssocDel(const std::vector<std::wstring>& exts) {
    for (const auto& e : exts) {
        if (e.empty() || e[0] != L'.') continue;
        std::wstring base = std::wstring(L"Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\") + e;
        HKEY hk = nullptr;
        if (RegOpenKeyExW(HKEY_CURRENT_USER, base.c_str(), 0, KEY_READ, &hk) == ERROR_SUCCESS) {
            wchar_t v[256] = {};
            DWORD cb = sizeof(v);
            bool ours = RegGetValueW(hk, L"UserChoice", L"ProgId", RRF_RT_REG_SZ, nullptr, v, &cb) ==
                            ERROR_SUCCESS &&
                        lstrcmpiW(v, kAssocProgId) == 0;
            RegCloseKey(hk);
            if (ours) {
                std::wstring uc = base + L"\\UserChoice";
                bool gone = RegDeleteTreeW(HKEY_CURRENT_USER, uc.c_str()) == ERROR_SUCCESS;
                LogLine(L"assocdel: %s %s", e.c_str(), gone ? L"removed" : L"not-present");
            }
        }
    }
    AssocNotifyChange();
    return 0;
}

// ---------------------------------------------------------------------------
// window + main
// ---------------------------------------------------------------------------
static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
        case WM_POLL:
            PollProcesses();
            return 0;
        case WM_TRAY:
            if (LOWORD(lp) == WM_RBUTTONUP || LOWORD(lp) == WM_LBUTTONDOWN) ShowTrayMenu();
            return 0;
        case WM_TIMER:
            if (wp == 1) PollProcesses();
            return 0;
        case WM_CLOSE: {
            CloseAllPreviews();
            if (g_hook) {
                UnhookWindowsHookEx(g_hook);
                g_hook = nullptr;
            }
            Shell_NotifyIconW(NIM_DELETE, &g_nid);
            DestroyWindow(hwnd);
            return 0;
        }
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
        default:
            break;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

int WINAPI wWinMain(HINSTANCE hInst, HINSTANCE, PWSTR, int) {
    // Association helper mode: "assocset .glb .fbx ..." / "assocdel .glb ...".
    // Runs before the single-instance mutex so the resident tray instance never
    // swallows installer/uninstaller calls.
    {
        int argc = 0;
        LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
        std::vector<std::wstring> args;
        if (argv) {
            for (int i = 1; i < argc; ++i) args.push_back(argv[i]);
            LocalFree(argv);
        }
        if (!args.empty() && (args[0] == L"assocset" || args[0] == L"assocdel")) {
            std::vector<std::wstring> exts(args.begin() + 1, args.end());
            int rc = (args[0] == L"assocset") ? RunAssocSet(exts) : RunAssocDel(exts);
            return rc;
        }
        if (!args.empty() && args[0] == L"assocreport") {
            for (size_t i = 1; i < args.size(); ++i) {
                if (args[i].empty() || args[i][0] != L'.') continue;
                LogLine(L"assocreport: %s verify=%d", args[i].c_str(), AssocVerifyUserChoice(args[i]) ? 1 : 0);
            }
            return 0;
        }
    }

    // single instance
    HANDLE mutex = CreateMutexW(nullptr, TRUE, kMutexName);
    if (mutex && GetLastError() == ERROR_ALREADY_EXISTS) {
        // another instance is running; nothing to do
        CloseHandle(mutex);
        return 0;
    }

    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    // hide auto-start splash by starting hidden
    g_appExe = ResolveAppExe();
    LogLine(L"TrayHost start, app=%s", g_appExe.empty() ? L"(not found)" : g_appExe.c_str());

    g_toggleEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr); // auto-reset
    CreateThread(nullptr, 0, ToggleWorker, nullptr, 0, nullptr);

    // kill children when we die
    g_job = CreateJobObjectW(nullptr, nullptr);
    if (g_job) {
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION jli{};
        jli.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(g_job, JobObjectExtendedLimitInformation, &jli, sizeof(jli));
    }

    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInst;
    wc.lpszClassName = kClassName;
    RegisterClassExW(&wc);

    g_hwnd = CreateWindowExW(0, kClassName, L"PolyPeek TrayHost", 0, 0, 0, 1, 1, nullptr, nullptr, hInst,
                             nullptr);

    AddTrayIcon();
    SetTimer(g_hwnd, 1, 3000, nullptr);

    CreateThread(nullptr, 0, HookThread, nullptr, 0, nullptr);

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    if (g_hook) UnhookWindowsHookEx(g_hook);
    Shell_NotifyIconW(NIM_DELETE, &g_nid);
    if (g_job) {
        // KILL_ON_JOB_CLOSE cleans up previews
        CloseHandle(g_job);
        g_job = nullptr;
    }
    if (g_hTrayIcon) DestroyIcon(g_hTrayIcon);
    CoUninitialize();
    if (mutex) {
        ReleaseMutex(mutex);
        CloseHandle(mutex);
    }
    return 0;
}