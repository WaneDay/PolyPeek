#include "thumbprovider.h"
#include "../formats.h"

#include <shlwapi.h>
#include <shlobj.h>
#include <wchar.h>
#include <memory>

#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")
#pragma comment(lib, "uuid.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "advapi32.lib")

std::mutex CThumbProvider::sCacheLock;
std::unordered_map<unsigned __int64, HBITMAP> CThumbProvider::sBitmaps;

// ---------------- GDI+ startup ---------------------------------------------

static GdiplusStartupInput gGdiplusStartupInput;
static ULONG_PTR gGdiplusToken = 0;
static std::once_flag gGdiplusOnce;

void EnsureGdiplus() {
    std::call_once(gGdiplusOnce, [] { GdiplusStartup(&gGdiplusToken, &gGdiplusStartupInput, nullptr); });
}

// ---------------- process spawn helper -------------------------------------

static bool SpawnAndWait(const std::wstring& exe, const std::wstring& argsLine, DWORD timeoutMs) {
    std::wstring cmd = L"\"" + exe + L"\" " + argsLine;

    STARTUPINFOW si{};
    si.cb = sizeof(si);
    PROCESS_INFORMATION pi{};
    if (!CreateProcessW(nullptr, &cmd[0], nullptr, nullptr, FALSE,
                        CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT, nullptr, nullptr, &si, &pi)) {
        return false;
    }
    CloseHandle(pi.hThread);
    bool ok = false;
    if (WaitForSingleObject(pi.hProcess, timeoutMs) == WAIT_OBJECT_0) {
        DWORD code = 1;
        if (GetExitCodeProcess(pi.hProcess, &code)) ok = (code == 0);
    } else {
        TerminateProcess(pi.hProcess, 2);
    }
    CloseHandle(pi.hProcess);
    return ok;
}

// ---------------- glue -----------------------------------------------------

static std::wstring GetAppExePath() {
    // 1) next to our DLL
    wchar_t dllPath[MAX_PATH]{};
    if (gDllModule) {
        GetModuleFileNameW(gDllModule, dllPath, MAX_PATH);
        if (dllPath[0]) {
            wchar_t dir[MAX_PATH];
            wcscpy_s(dir, dllPath);
            PathRemoveFileSpecW(dir);
            std::wstring a = std::wstring(dir) + L"\\PolyPeek.exe";
            if (is_regular_file(a)) return a;
            std::wstring b = std::wstring(dir) + L"\\..\\PolyPeek.exe";
            if (is_regular_file(b)) return b;
        }
    }

    // 2) per-user install path registry
    const wchar_t* roots[] = { L"HKCU", L"HKLM" };
    for (const wchar_t* r : roots) {
        HKEY hk;
        LONG ret = RegOpenKeyExW(r[0] == L'H' ? HKEY_CURRENT_USER : HKEY_LOCAL_MACHINE,
                                 L"Software\\PolyPeek", 0, KEY_READ, &hk);
        if (ret != ERROR_SUCCESS) continue;
        DWORD type = 0;
        wchar_t buf[MAX_PATH]{};
        DWORD cb = sizeof(buf);
        ret = RegQueryValueExW(hk, L"InstallPath", nullptr, &type, reinterpret_cast<LPBYTE>(buf), &cb);
        RegCloseKey(hk);
        if (ret == ERROR_SUCCESS && type == REG_SZ && buf[0]) {
            std::wstring candidate = std::wstring(buf);
            if (is_regular_file(candidate)) return candidate;
        }
    }

    // 3) common per-user / per-machine install locations
    const wchar_t* locs[] = {
        L"%LOCALAPPDATA%\\Programs\\PolyPeek\\PolyPeek.exe",
        L"%PROGRAMFILES%\\PolyPeek\\PolyPeek.exe",
        L"%PROGRAMFILES(x86)%\\PolyPeek\\PolyPeek.exe",
    };
    for (const wchar_t* l : locs) {
        wchar_t buf[MAX_PATH];
        if (ExpandEnvironmentStringsW(l, buf, MAX_PATH) == 0) continue;
        if (is_regular_file(buf)) return std::wstring(buf);
    }

    return L"";
}

static std::wstring GetCacheDir() {
    wchar_t base[MAX_PATH];
    if (FAILED(SHGetFolderPathW(nullptr, CSIDL_LOCAL_APPDATA, nullptr, SHGFP_TYPE_CURRENT, base)))
        base[0] = 0;
    std::wstring dir = (base[0] ? std::wstring(base) : std::wstring(L".")) + L"\\PolyPeek\\thumbcache";
    CreateDirectoryW(dir.c_str(), nullptr);
    return dir;
}

// ---------------- class ----------------------------------------------------

CThumbProvider::CThumbProvider() {
    EnsureGdiplus();
}

CThumbProvider::~CThumbProvider() = default;

STDMETHODIMP CThumbProvider::QueryInterface(REFIID riid, void** ppv) {
    if (!ppv) return E_POINTER;
    *ppv = nullptr;
    if (riid == IID_IUnknown || riid == IID_IThumbnailProvider) {
        *ppv = static_cast<IThumbnailProvider*>(this);
    } else if (riid == IID_IInitializeWithFile) {
        *ppv = static_cast<IInitializeWithFile*>(this);
    } else {
        return E_NOINTERFACE;
    }
    static_cast<IUnknown*>(*ppv)->AddRef();
    return S_OK;
}

STDMETHODIMP_(ULONG) CThumbProvider::AddRef() { return InterlockedIncrement(&refCount_); }

STDMETHODIMP_(ULONG) CThumbProvider::Release() {
    long r = InterlockedDecrement(&refCount_);
    if (r == 0) delete this;
    return r;
}

STDMETHODIMP CThumbProvider::Initialize(LPCWSTR pszFilePath, DWORD /*grfMode*/) {
    if (!pszFilePath || !pszFilePath[0]) return E_INVALIDARG;
    std::lock_guard<std::mutex> g(lock_);
    filePath_ = pszFilePath;
    return S_OK;
}

STDMETHODIMP CThumbProvider::GetThumbnail(UINT cx, HBITMAP* phbmp, WTS_ALPHATYPE* pdwAlpha) {
    if (!phbmp || !pdwAlpha) return E_POINTER;
    *phbmp = nullptr;
    *pdwAlpha = WTSAT_ARGB;

    std::wstring path;
    {
        std::lock_guard<std::mutex> g(lock_);
        path = filePath_;
    }
    if (path.empty()) return E_INVALIDARG;

    if (!is_supported_3d_file(path)) return E_NOTIMPL;
    if (!is_regular_file(path)) return HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND);

    const int size = (int)cx < 96 ? 96 : (int)cx > 512 ? 512 : (int)cx;

    // ---- derive cache key from file identity ----
    WIN32_FILE_ATTRIBUTE_DATA fad{};
    if (!GetFileAttributesExW(path.c_str(), GetFileExInfoStandard, &fad))
        return HRESULT_FROM_WIN32(GetLastError());

    std::wstring keyStr = path + L"|" + std::to_wstring(fad.nFileSizeLow) + L"|" +
                          std::to_wstring(fad.ftLastWriteTime.dwHighDateTime) + L"|" +
                          std::to_wstring(fad.ftLastWriteTime.dwLowDateTime) + L"|" + std::to_wstring(size);
    unsigned __int64 key = fnv1a(keyStr.c_str(), keyStr.size() * sizeof(wchar_t));

    // ---- check in-memory cache ----
    if (HBITMAP h = CacheLookup(key)) {
        *phbmp = h;
        return S_OK;
    }

    // ---- disk cache ----
    std::wstring cacheDir = GetCacheDir();
    wchar_t keyHex[32];
    swprintf_s(keyHex, L"%016llx.png", key);
    std::wstring pngPath = cacheDir + L"\\" + keyHex;

    const wchar_t* const kExePrompt = L"find-exe";
    (void)kExePrompt;

    if (!is_regular_file(pngPath)) {
        std::wstring exe = GetAppExePath();
        if (exe.empty()) {
            HBITMAP h = BuildPlaceholder(size);
            if (h) *phbmp = h;
            return S_OK;
        }
        std::wstring args = L"--render-thumbnail \"" + path + L"\" \"" + pngPath + L"\" " + std::to_wstring(size);
        bool ok = SpawnAndWait(exe, args, 60000);
        if (!ok) {
            // keep a placeholder result but do not cache a placeholder as stray files could
            // become stale. Render an in-memory placeholder instead.
            HBITMAP h = BuildPlaceholder(size);
            if (h) *phbmp = h;
            return S_OK;
        }
    }

    HBITMAP h = BuildBitmapFromPngFile(pngPath, size);
    if (h) {
        CacheStore(key, h);
        *phbmp = h;
        return S_OK;
    }
    HBITMAP ph = BuildPlaceholder(size);
    if (ph) *phbmp = ph;
    return S_OK;
}

// ---------------- cache ----------------------------------------------------

void CThumbProvider::CacheStore(unsigned __int64 key, HBITMAP hbmp) {
    std::lock_guard<std::mutex> g(sCacheLock);
    if (sBitmaps.size() > 96) {
        // simple reset to bound memory
        for (auto& p : sBitmaps) DeleteObject(p.second);
        sBitmaps.clear();
    }
    sBitmaps[key] = hbmp;
}

HBITMAP CThumbProvider::CacheLookup(unsigned __int64 key) {
    std::lock_guard<std::mutex> g(sCacheLock);
    auto it = sBitmaps.find(key);
    if (it == sBitmaps.end()) return nullptr;
    HMODULE unused = nullptr;
    HBITMAP copy = nullptr;
    // return a duplicate so the shell can free its own handle
    HDC dc = GetDC(nullptr);
    if (dc) {
        BITMAP bmp{};
        if (GetObjectW(it->second, sizeof(bmp), &bmp) && bmp.bmWidth > 0 && bmp.bmHeight > 0) {
            HDC mem = CreateCompatibleDC(dc);
            if (mem) {
                copy = CreateCompatibleBitmap(dc, bmp.bmWidth, bmp.bmHeight);
                if (copy) {
                    HGDIOBJ o = SelectObject(mem, it->second);
                    HDC out = CreateCompatibleDC(dc);
                    if (out) {
                        HGDIOBJ o2 = SelectObject(out, copy);
                        BitBlt(out, 0, 0, bmp.bmWidth, bmp.bmHeight, mem, 0, 0, SRCCOPY);
                        SelectObject(out, o2);
                        DeleteDC(out);
                    }
                    SelectObject(mem, o);
                }
                DeleteDC(mem);
            }
        }
        (void)unused;
        ReleaseDC(nullptr, dc);
    }
    return copy;
}

// ---------------- bitmap builders ------------------------------------------

HBITMAP CThumbProvider::BuildBitmapFromPngFile(const std::wstring& pngPath, int size) {
    Bitmap bmp(pngPath.c_str(), FALSE);
    if (bmp.GetLastStatus() != Ok) return nullptr;

    // Build a 32bpp top-down DIB with premultiplied? Shell wants straight alpha.
    BITMAPINFO bmi{};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = size;
    bmi.bmiHeader.biHeight = -size; // top-down
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;

    void* bits = nullptr;
    HBITMAP hbmp = CreateDIBSection(nullptr, &bmi, DIB_RGB_COLORS, &bits, nullptr, 0);
    if (!hbmp) return nullptr;

    // read GDI+ bitmap pixels
    std::vector<unsigned> pixels(size * size, 0);
    BitmapData bd{};
    Rect rc(0, 0, size, size);
    if (bmp.LockBits(&rc, ImageLockModeRead, PixelFormat32bppARGB, &bd) == Ok) {
        for (int y = 0; y < size; ++y) {
            const unsigned* src = static_cast<const unsigned*>(bd.Scan0) + (size_t)y * (bd.Stride / 4);
            memcpy(&pixels[(size_t)y * size], src, size * 4);
        }
        bmp.UnlockBits(&bd);
    } else {
        DeleteObject(hbmp);
        return nullptr;
    }

    // premultiply alpha (GDI+ gives straight alpha in many cases; Documents say ARGB)
    unsigned* out = static_cast<unsigned*>(bits);
    for (int i = 0; i < size * size; ++i) {
        unsigned p = pixels[i];
        unsigned a = (p >> 24) & 0xff;
        unsigned r = ((p >> 16) & 0xff) * a / 255;
        unsigned g = ((p >> 8) & 0xff) * a / 255;
        unsigned b = (p & 0xff) * a / 255;
        out[i] = (a << 24) | (r << 16) | (g << 8) | b;
    }
    return hbmp;
}

HBITMAP CThumbProvider::BuildPlaceholder(int size) {
    void* bits = nullptr;
    BITMAPINFO bmi{};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = size;
    bmi.bmiHeader.biHeight = -size;
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;
    HBITMAP hbmp = CreateDIBSection(nullptr, &bmi, DIB_RGB_COLORS, &bits, nullptr, 0);
    if (!hbmp) return nullptr;

    unsigned* px = static_cast<unsigned*>(bits);
    for (int i = 0; i < size * size; ++i) px[i] = 0xFF14161C; // dark bg

    // draw text using GDI+
    HDC hdc = CreateCompatibleDC(nullptr);
    if (hdc) {
        HGDIOBJ old = SelectObject(hdc, hbmp);
        Graphics g(hdc);
        g.SetSmoothingMode(SmoothingModeAntiAlias);
        FontFamily ff(L"Segoe UI");
        Font f(&ff, (REAL)(size * 0.14f), FontStyleBold, UnitPixel);
        SolidBrush textBrush(Color(150, 190, 210, 255));
        StringFormat sf;
        sf.SetAlignment(StringAlignmentCenter);
        sf.SetLineAlignment(StringAlignmentCenter);
        RectF rc(0, 0, (REAL)size, (REAL)size);
        g.DrawString(L"3D", -1, &f, rc, &sf, &textBrush);
        SelectObject(hdc, old);
        DeleteDC(hdc);
    }
    return hbmp;
}

// ---------------- class factory --------------------------------------------

CThumbClassFactory::CThumbClassFactory() = default;
CThumbClassFactory::~CThumbClassFactory() = default;

STDMETHODIMP CThumbClassFactory::QueryInterface(REFIID riid, void** ppv) {
    if (!ppv) return E_POINTER;
    *ppv = nullptr;
    if (riid == IID_IUnknown || riid == IID_IClassFactory) {
        *ppv = static_cast<IClassFactory*>(this);
    } else {
        return E_NOINTERFACE;
    }
    static_cast<IUnknown*>(*ppv)->AddRef();
    return S_OK;
}

STDMETHODIMP_(ULONG) CThumbClassFactory::AddRef() { return InterlockedIncrement(&refCount_); }

STDMETHODIMP_(ULONG) CThumbClassFactory::Release() {
    long r = InterlockedDecrement(&refCount_);
    if (r == 0) delete this;
    return r;
}

STDMETHODIMP CThumbClassFactory::CreateInstance(IUnknown* pUnkOuter, REFIID riid, void** ppv) {
    if (pUnkOuter) return CLASS_E_NOAGGREGATION;
    CThumbProvider* inst = new (std::nothrow) CThumbProvider();
    if (!inst) return E_OUTOFMEMORY;
    HRESULT hr = inst->QueryInterface(riid, ppv);
    inst->Release();
    return hr;
}

STDMETHODIMP CThumbClassFactory::LockServer(BOOL) { return S_OK; }

// ---------------- registration ---------------------------------------------

void RegContext::RegisterExtensions() {
    for (const wchar_t* ext : kSupportedFormats) {
        wchar_t sub[MAX_PATH];
        swprintf_s(sub, L"Software\\Classes\\.%s\\ShellEx\\{e357fccd-a995-4576-b01f-234630154e96}", ext);
        HKEY hk = nullptr;
        // do not override an existing thumbnail handler
        DWORD disp;
        if (RegCreateKeyExW(HKEY_CURRENT_USER, sub, 0, nullptr, 0, KEY_SET_VALUE, nullptr, &hk, &disp) ==
            ERROR_SUCCESS) {
            if (disp == REG_CREATED_NEW_KEY) {
                RegSetValueExW(hk, nullptr, 0, REG_SZ, reinterpret_cast<const BYTE*>(kClsid),
                               (DWORD)(wcslen(kClsid) * sizeof(wchar_t)));
            }
            RegCloseKey(hk);
        }
    }
    // force explorer to reload thumbnail handlers
    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_FLUSH, nullptr, nullptr);
}

void RegContext::UnregisterExtensions() {
    for (const wchar_t* ext : kSupportedFormats) {
        wchar_t sub[MAX_PATH];
        swprintf_s(sub, L"Software\\Classes\\.%s\\ShellEx\\{e357fccd-a995-4576-b01f-234630154e96}", ext);
        RegDeleteKeyW(HKEY_CURRENT_USER, sub);
    }
    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_FLUSH, nullptr, nullptr);
}