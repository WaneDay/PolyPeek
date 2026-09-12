#pragma once
// Shared constants for native components. Keep in sync with src/shared/formats.ts

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <string>
#include <vector>

// {B66E45DB-9A5C-4805-8D8B-CB84A1A1EBFB}
static constexpr wchar_t kClsid[] = L"{B66E45DB-9A5C-4805-8D8B-CB84A1A1EBFB}";
// IThumbnailProvider registration key under Software\\Classes\\.ext\\ShellEx
static constexpr wchar_t kThumbHandlerKey[] =
    L"Software\\Classes\\.ext\\ShellEx\\{e357fccd-a995-4576-b01f-234630154e96}";

static const wchar_t* kSupportedFormats[] = {
    L"glb", L"gltf", L"obj", L"fbx", L"stl", L"3mf", L"amf", L"ply", L"dae", L"3ds",
    L"lwo", L"wrl", L"vox", L"drc", L"usdz", L"xyz", L"pcd", L"gcode", L"nc", L"ncc",
    L"ngc", L"vtk", L"vtp", L"step", L"stp", L"iges", L"igs", L"brep", L"brp",
};

inline bool ext_in_list(const std::wstring& ext) {
    if (ext.empty() || ext[0] == L'.') return false;
    for (const wchar_t* e : kSupportedFormats) {
        if (lstrcmpiW(ext.c_str(), e) == 0) return true;
    }
    return false;
}

inline std::wstring file_ext(const std::wstring& path) {
    size_t dot = path.find_last_of(L'.');
    size_t slash = path.find_last_of(L"\\/");
    if (dot == std::wstring::npos || (slash != std::wstring::npos && dot < slash)) return L"";
    return path.substr(dot + 1);
}

inline bool is_supported_3d_file(const std::wstring& path) {
    return ext_in_list(file_ext(path));
}

// Returns true if the full path exists and is a regular file.
inline bool is_regular_file(const std::wstring& path) {
    DWORD attr = GetFileAttributesW(path.c_str());
    if (attr == INVALID_FILE_ATTRIBUTES) return false;
    return (attr & FILE_ATTRIBUTE_DIRECTORY) == 0;
}

// Compute a simple stable 64-bit hash of a string (FNV-1a).
inline unsigned __int64 fnv1a(const void* data, size_t len) {
    const unsigned char* p = static_cast<const unsigned char*>(data);
    unsigned __int64 h = 1469598103934665603ULL;
    for (size_t i = 0; i < len; ++i) {
        h ^= p[i];
        h *= 1099511628211ULL;
    }
    return h;
}

inline std::wstring str_lower(const std::wstring& s) {
    std::wstring r = s;
    for (auto& c : r) c = towlower(c);
    return r;
}