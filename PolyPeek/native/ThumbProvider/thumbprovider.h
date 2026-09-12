#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <thumbcache.h>
#include <shlwapi.h>
#include <gdiplus.h>
#include <string>
#include <mutex>
#include <unordered_map>
#include <vector>

// PolyPeek thumbnail provider.
// gdiplus.lib user32.lib gdi32.lib shell32.lib ole32.lib uuid.lib shlwapi.lib

using namespace Gdiplus;

extern HMODULE gDllModule; // set in dllmain.cpp

class CThumbProvider final : public IThumbnailProvider, public IInitializeWithFile {
public:
    CThumbProvider();
    ~CThumbProvider();

    // IUnknown
    STDMETHODIMP QueryInterface(REFIID riid, void** ppv) override;
    STDMETHODIMP_(ULONG) AddRef() override;
    STDMETHODIMP_(ULONG) Release() override;

    // IInitializeWithFile
    STDMETHODIMP Initialize(LPCWSTR pszFilePath, DWORD grfMode) override;

    // IThumbnailProvider
    STDMETHODIMP GetThumbnail(UINT cx, HBITMAP* phbmp, WTS_ALPHATYPE* pdwAlpha) override;

private:
    long          refCount_ = 1;
    std::wstring  filePath_;
    std::mutex    lock_;

    // small LRU-ish cache shared across instances (module scope)
    static std::mutex                       sCacheLock;
    static std::unordered_map<unsigned __int64, HBITMAP> sBitmaps;

    HBITMAP BuildBitmapFromPngFile(const std::wstring& pngPath, int size);
    HBITMAP BuildPlaceholder(int size);
    void    RenderAndCapture(const std::wstring& pngPath, int size);
    void    CacheStore(unsigned __int64 key, HBITMAP hbmp);
    HBITMAP CacheLookup(unsigned __int64 key);
};

class CThumbClassFactory final : public IClassFactory {
public:
    CThumbClassFactory();
    ~CThumbClassFactory();

    // IUnknown
    STDMETHODIMP QueryInterface(REFIID riid, void** ppv) override;
    STDMETHODIMP_(ULONG) AddRef() override;
    STDMETHODIMP_(ULONG) Release() override;

    // IClassFactory
    STDMETHODIMP CreateInstance(IUnknown* pUnkOuter, REFIID riid, void** ppv) override;
    STDMETHODIMP LockServer(BOOL fLock) override;

private:
    long refCount_ = 1;
};

// registry helpers used by DllRegisterServer/DllUnregisterServer
struct RegContext {
    void RegisterExtensions();
    void UnregisterExtensions();
};