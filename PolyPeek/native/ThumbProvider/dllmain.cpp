// ThumbProvider.dll - Explorer thumbnail handler for 3D model files.
#include "thumbprovider.h"
#include "../formats.h"

#include <stdio.h>

#include <initguid.h>
DEFINE_GUID(CLSID_ThumbProvider,
            0xB66E45DB, 0x9A5C, 0x4805, 0x8D, 0x8B, 0xCB, 0x84, 0xA1, 0xA1, 0xEB, 0xFB);

HMODULE gDllModule = nullptr;

static LONG gLockCount = 0;

extern "C" {

STDAPI DllGetClassObject(REFCLSID rclsid, REFIID riid, void** ppv) {
    if (rclsid != CLSID_ThumbProvider) return CLASS_E_CLASSNOTAVAILABLE;
    CThumbClassFactory* f = new (std::nothrow) CThumbClassFactory();
    if (!f) return E_OUTOFMEMORY;
    HRESULT hr = f->QueryInterface(riid, ppv);
    f->Release();
    return hr;
}

STDAPI DllCanUnloadNow() { return gLockCount ? S_FALSE : S_OK; }

STDAPI DllRegisterServer() {
    // CLSID registration (per-user)
    wchar_t sub[MAX_PATH];
    swprintf_s(sub, L"Software\\Classes\\CLSID\\%s\\InprocServer32", kClsid);
    HKEY hk;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, sub, 0, nullptr, 0, KEY_SET_VALUE, nullptr, &hk, nullptr) !=
        ERROR_SUCCESS)
        return E_ACCESSDENIED;
    wchar_t dllPath[MAX_PATH];
    if (!GetModuleFileNameW(gDllModule, dllPath, MAX_PATH)) dllPath[0] = 0;
    RegSetValueExW(hk, nullptr, 0, REG_SZ, reinterpret_cast<const BYTE*>(dllPath),
                   (DWORD)((wcslen(dllPath) + 1) * sizeof(wchar_t)));
    RegSetValueExW(hk, L"ThreadingModel", 0, REG_SZ, reinterpret_cast<const BYTE*>(L"Apartment"),
                   (DWORD)(sizeof(L"Apartment")));
    RegCloseKey(hk);

    RegContext rc;
    rc.RegisterExtensions();
    return S_OK;
}

STDAPI DllUnregisterServer() {
    wchar_t sub[MAX_PATH];
    swprintf_s(sub, L"Software\\Classes\\CLSID\\%s", kClsid);
    RegDeleteTreeW(HKEY_CURRENT_USER, sub);
    RegContext rc;
    rc.UnregisterExtensions();
    return S_OK;
}

} // extern "C"

BOOL APIENTRY DllMain(HMODULE hModule, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) {
        gDllModule = hModule;
        DisableThreadLibraryCalls(hModule);
    }
    return TRUE;
}