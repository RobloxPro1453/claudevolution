// PE import table: which DLLs an .exe needs. `cv check` uses it for the single-exe gate (a stray DLL means
// the build must use the static C runtime). The images below are built by hand: no fixture file needed.
import { Buffer } from "node:buffer";
import { importedDlls, strayDlls } from "../core/check/pe.js";
import { eq, test } from "./harness.js";

// Optional header layout: size, NumberOfRvaAndSizes offset, data directories offset — for both magics.
const FORMAT = { 0x20b: { size: 240, count: 108, dirs: 112 }, 0x10b: { size: 224, count: 92, dirs: 96 } };

// A minimal image: DOS header, one section at RVA 0x1000 (raw 0x200), an import directory with two names.
function peImage(magic = 0x20b) {
    const f = FORMAT[magic];
    const b = Buffer.alloc(0x300);
    b.write("MZ", 0, "latin1");
    b.writeUInt32LE(0x40, 0x3c); // e_lfanew
    b.write("PE\0\0", 0x40, "latin1");
    b.writeUInt16LE(1, 0x46); // one section
    b.writeUInt16LE(f.size, 0x54); // SizeOfOptionalHeader
    b.writeUInt16LE(magic, 0x58); // PE32 / PE32+
    b.writeUInt32LE(16, 0x58 + f.count); // NumberOfRvaAndSizes
    b.writeUInt32LE(0x1040, 0x58 + f.dirs + 8); // data directory 1 (imports) RVA
    b.writeUInt32LE(40, 0x58 + f.dirs + 12); // ... and size
    const sec = 0x58 + f.size; // section table
    b.write("data", sec, "latin1");
    b.writeUInt32LE(0x200, sec + 8); // VirtualSize
    b.writeUInt32LE(0x1000, sec + 12); // VirtualAddress
    b.writeUInt32LE(0x200, sec + 16); // SizeOfRawData
    b.writeUInt32LE(0x200, sec + 20); // PointerToRawData
    // Import descriptors at 0x240 (RVA 0x1040), name strings after them; the third descriptor stays all zero.
    b.writeUInt32LE(0x1080, 0x240 + 12);
    b.writeUInt32LE(0x10a0, 0x240 + 20 + 12);
    b.write("KERNEL32.dll\0", 0x280, "latin1");
    b.write("libunwind.dll\0", 0x2a0, "latin1");
    return b;
}

test("pe: PE32 ve PE32+ içe aktarma tablosu — DLL adları küçük harf", () => {
    for (const magic of [0x20b, 0x10b]) eq(importedDlls(peImage(magic)), ["kernel32.dll", "libunwind.dll"], `magic 0x${magic.toString(16)}`);
});

test("pe: sistem DLL'i olmayanlar ayıklanır (api-ms-win- ve ext-ms- sistem sayılır)", () => {
    const names = importedDlls(peImage());
    eq(strayDlls(names), ["libunwind.dll"]);
    eq(strayDlls(["libgcc_s_seh-1.dll", "libstdc++-6.dll", "vcruntime140.dll", "api-ms-win-core-synch-l1-2-0.dll", "ext-ms-win-ntuser-window-l1-1-0.dll", "ucrtbase.dll", "WINSPOOL.DRV"]), ["libgcc_s_seh-1.dll", "libstdc++-6.dll", "vcruntime140.dll"]);
    eq(strayDlls([]), []);
});

test("pe: PE olmayan ya da kesik dosya null döner, hata atmaz", () => {
    eq(importedDlls(Buffer.from(Array.from({ length: 300 }, (_, i) => (i * 37 + 11) & 255))), null, "rastgele 300 bayt");
    eq(importedDlls(Buffer.alloc(10)), null, "çok kısa");
    eq(importedDlls(null), null, "boş");
    const cut = peImage().subarray(0, 0x150); // PE header there, import directory cut off
    eq(importedDlls(cut), null);
    const noPe = peImage();
    noPe.write("PE\0\x01", 0x40, "latin1");
    eq(importedDlls(noPe), null, "PE imzası yok");
});
