// PNG read and write with the standard library only (node:zlib), enough for app screenshots: 8- and
// 16-bit (16 kept to its high byte) grey, grey+alpha, RGB, RGBA and palette images, all five filters,
// non-interlaced. Output is always { width, height, rgba } with 4 bytes a pixel.
import zlib from "node:zlib";
import { Buffer } from "node:buffer";

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const MAX_PIXELS = 40e6; // bigger than any screen; refuses absurd headers before allocating

export function isPng(buf) { return Buffer.isBuffer(buf) && buf.length > 8 && buf.subarray(0, 8).equals(SIG); }

export function pngSize(buf) {
    if (!isPng(buf) || buf.toString("latin1", 12, 16) !== "IHDR") throw new Error("not a PNG");
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export function decodePng(input) {
    const buf = Buffer.from(input);
    if (!isPng(buf)) throw new Error("not a PNG (bad signature)");
    let off = 8, ihdr = null, palette = null, trns = null;
    const idat = [];
    while (off + 8 <= buf.length) {
        const len = buf.readUInt32BE(off), type = buf.toString("latin1", off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (data.length < len) throw new Error("PNG cut short");
        if (type === "IHDR") ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
        else if (type === "PLTE") palette = data;
        else if (type === "tRNS") trns = data;
        else if (type === "IDAT") idat.push(data);
        else if (type === "IEND") break;
        off += 12 + len;
    }
    if (!ihdr) throw new Error("PNG without IHDR");
    const { width, height, depth, color, interlace } = ihdr;
    if (!width || !height || width * height > MAX_PIXELS) throw new Error(`PNG size not supported (${width}x${height})`);
    if (interlace) throw new Error("interlaced PNG not supported (save without interlacing)");
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
    if (!channels || !(depth === 8 || depth === 16 || (color === 3 && depth <= 8) || (color === 0 && depth < 8))) throw new Error(`PNG colour type ${color} / depth ${depth} not supported`);
    const bitsPerPixel = channels * depth, bpp = Math.max(1, bitsPerPixel >> 3), stride = Math.ceil((width * bitsPerPixel) / 8);
    const raw = zlib.inflateSync(Buffer.concat(idat));
    if (raw.length < (stride + 1) * height) throw new Error("PNG data cut short");
    const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
    const rgba = new Uint8Array(width * height * 4);
    const sample = (row, i) => {
        if (depth === 16) return row[i * 2];
        if (depth === 8) return row[i];
        const perByte = 8 / depth, b = row[Math.floor(i / perByte)], shift = 8 - depth * (1 + (i % perByte));
        return (b >> shift) & ((1 << depth) - 1);
    };
    for (let y = 0; y < height; y++) {
        const at = y * (stride + 1), filter = raw[at];
        for (let x = 0; x < stride; x++) {
            const r = raw[at + 1 + x], a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
            let v;
            switch (filter) {
                case 0: v = r; break;
                case 1: v = r + a; break;
                case 2: v = r + b; break;
                case 3: v = r + ((a + b) >> 1); break;
                case 4: { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = r + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break; }
                default: throw new Error(`PNG filter ${filter} unknown`);
            }
            cur[x] = v & 255;
        }
        for (let x = 0; x < width; x++) {
            const o = (y * width + x) * 4;
            if (color === 3) {
                const idx = sample(cur, x);
                rgba[o] = palette ? palette[idx * 3] : 0; rgba[o + 1] = palette ? palette[idx * 3 + 1] : 0; rgba[o + 2] = palette ? palette[idx * 3 + 2] : 0;
                rgba[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
                continue;
            }
            const s = (k) => sample(cur, x * channels + k);
            const scale = depth < 8 ? 255 / ((1 << depth) - 1) : 1;
            if (channels === 1 || channels === 2) { const g = Math.round(s(0) * scale); rgba[o] = rgba[o + 1] = rgba[o + 2] = g; rgba[o + 3] = channels === 2 ? s(1) : 255; }
            else { rgba[o] = s(0); rgba[o + 1] = s(1); rgba[o + 2] = s(2); rgba[o + 3] = channels === 4 ? s(3) : 255; }
        }
        prev.set(cur);
    }
    return { width, height, rgba };
}

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC_TABLE[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0); out.write(type, 4, "latin1"); data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "latin1"), data])), 8 + data.length);
    return out;
}
// RGBA PNG, filter 0 (tests, contact sheets, diff pictures).
export function encodePng({ width, height, rgba }) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
    return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
