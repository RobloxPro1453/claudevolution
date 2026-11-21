// Reads a Windows .exe's import table: "one .exe, no install" holds only while every DLL it needs is one
// Windows itself carries (a MinGW build silently needed libunwind.dll). No dependencies; a file that is not
// a PE, or is cut short, gives null instead of an exception.

// Names Windows ships (image loader, system DLLs, API sets are handled by prefix below).
export const SYSTEM_DLLS = new Set([
    "kernel32.dll", "user32.dll", "gdi32.dll", "ntdll.dll", "advapi32.dll", "shell32.dll", "ole32.dll",
    "oleaut32.dll", "comctl32.dll", "comdlg32.dll", "uxtheme.dll", "dwmapi.dll", "imm32.dll", "shlwapi.dll",
    "ws2_32.dll", "bcrypt.dll", "bcryptprimitives.dll", "crypt32.dll", "secur32.dll", "userenv.dll",
    "winmm.dll", "version.dll", "setupapi.dll", "opengl32.dll", "d3d11.dll", "d3d12.dll", "dxgi.dll",
    "d3dcompiler_47.dll", "propsys.dll", "uiautomationcore.dll", "msimg32.dll", "winspool.drv", "ncrypt.dll",
    "powrprof.dll", "dbghelp.dll", "cfgmgr32.dll", "hid.dll", "netapi32.dll", "iphlpapi.dll", "oleacc.dll",
    "windowscodecs.dll", "dwrite.dll", "d2d1.dll", "shcore.dll", "wininet.dll", "winhttp.dll", "msvcrt.dll",
    "ucrtbase.dll",
]);

// A null-terminated ASCII name at a file offset, lower case.
function nameAt(b, at) {
    if (at < 0 || at >= b.length) return "";
    const zero = b.indexOf(0, at);
    return b.toString("latin1", at, zero < 0 ? b.length : zero).toLowerCase();
}

// The section table as {virtual, size, raw}: an RVA is looked up through these to reach the bytes.
function sectionTable(b, at, count) {
    const list = [];
    for (let i = 0; i < count; i++) {
        const s = at + i * 40;
        list.push({ virtual: b.readUInt32LE(s + 12), size: Math.max(b.readUInt32LE(s + 8), b.readUInt32LE(s + 16)), raw: b.readUInt32LE(s + 20) });
    }
    return list;
}

// The file offset of an RVA, or -1 when no section holds it.
function offsetOf(sections, rva) {
    for (const s of sections) if (rva >= s.virtual && rva < s.virtual + s.size) return s.raw + (rva - s.virtual);
    return -1;
}

// The DLL names a PE32 or PE32+ image imports, lower case; null when the bytes are not a PE (never throws).
export function importedDlls(buffer) {
    try {
        const b = buffer;
        if (!b || typeof b.readUInt32LE !== "function" || b.length < 0x40) return null;
        if (b.readUInt16LE(0) !== 0x5a4d) return null; // "MZ"
        const pe = b.readUInt32LE(0x3c);
        if (b.toString("latin1", pe, pe + 4) !== "PE\0\0") return null;
        const count = b.readUInt16LE(pe + 6); // sections
        const opt = pe + 24;
        const magic = b.readUInt16LE(opt);
        // Optional header: PE32 puts NumberOfRvaAndSizes at +92 and the directories at +96, PE32+ at +108/+112.
        const dirs = magic === 0x10b ? opt + 96 : magic === 0x20b ? opt + 112 : -1;
        if (dirs < 0) return null;
        if (b.readUInt32LE(dirs - 4) < 2) return []; // no import directory listed
        const impRva = b.readUInt32LE(dirs + 8); // data directory 1 = imports
        if (!impRva) return [];
        const sections = sectionTable(b, opt + b.readUInt16LE(pe + 20), count);
        let at = offsetOf(sections, impRva);
        if (at < 0) return null;
        const names = [];
        // Import descriptors: 20 bytes each, ended by an all-zero one; Name (a DLL) sits at +12.
        for (let i = 0; i < 4096 && at + 20 <= b.length; i++, at += 20) {
            const nameRva = b.readUInt32LE(at + 12);
            if (!nameRva) break;
            const name = nameAt(b, offsetOf(sections, nameRva));
            if (name) names.push(name);
        }
        return names;
    } catch (_) { return null; }
}

// The names Windows does not ship: these must sit next to the .exe, or not exist at all.
export function strayDlls(names) {
    if (!Array.isArray(names)) return [];
    const out = [];
    for (const raw of names) {
        const name = String(raw).toLowerCase();
        if (SYSTEM_DLLS.has(name) || name.startsWith("api-ms-win-") || name.startsWith("ext-ms-")) continue;
        out.push(name);
    }
    return out;
}
