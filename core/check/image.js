// Picture measures for app checks, ported from craft-anything crates/engine/src/tools/web_common.rs
// (resize, perceptual_similarity) and rebuild/kinds/screenshot.rs (is_blank, picture_likeness);
// MIT OR Apache-2.0, see THIRD_PARTY_NOTICES.md. Pure arithmetic on { width, height, rgba }.
import fs from "node:fs";
import path from "node:path";
import { decodePng } from "./png.js";

// Box-filter resize: each output pixel is the mean of the source pixels it covers.
export function resize(img, w, h) {
    w = Math.max(1, w); h = Math.max(1, h);
    const out = new Uint8Array(w * h * 4);
    if (!img.width || !img.height) return { width: w, height: h, rgba: out };
    for (let oy = 0; oy < h; oy++) {
        const y0 = Math.floor((oy * img.height) / h), y1 = Math.min(img.height, Math.max(y0 + 1, Math.ceil(((oy + 1) * img.height) / h)));
        for (let ox = 0; ox < w; ox++) {
            const x0 = Math.floor((ox * img.width) / w), x1 = Math.min(img.width, Math.max(x0 + 1, Math.ceil(((ox + 1) * img.width) / w)));
            const sum = [0, 0, 0, 0];
            let n = 0;
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * img.width + x) * 4; for (let k = 0; k < 4; k++) sum[k] += img.rgba[o + k]; n++; }
            const o = (oy * w + ox) * 4;
            for (let k = 0; k < 4; k++) out[o + k] = Math.round(sum[k] / Math.max(1, n));
        }
    }
    return { width: w, height: h, rgba: out };
}

const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// Nothing drawn: the picture brought to 64x36 has a brightness spread under 2 (one colour, give or take noise).
export function isBlank(img) {
    const s = resize(img, 64, 36), n = s.width * s.height;
    const l = new Float64Array(n);
    for (let i = 0; i < n; i++) l[i] = luma(s.rgba[i * 4], s.rgba[i * 4 + 1], s.rgba[i * 4 + 2]);
    const mean = l.reduce((a, b) => a + b, 0) / n;
    return Math.sqrt(l.reduce((a, b) => a + (b - mean) ** 2, 0) / n) < 2;
}

// Share (0..1) of pixels whose red, green or blue differs by more than 24 between two pictures: 0 = the
// same picture, 1 = every pixel moved (or the sizes differ: a layout that reflows the window is not still).
export function diffShare(a, b) {
    if (a.width !== b.width || a.height !== b.height || !a.width || !a.height) return 1;
    const n = a.width * a.height;
    let moved = 0;
    for (let i = 0; i < n; i++) {
        const o = i * 4;
        if (Math.abs(a.rgba[o] - b.rgba[o]) > 24 || Math.abs(a.rgba[o + 1] - b.rgba[o + 1]) > 24 || Math.abs(a.rgba[o + 2] - b.rgba[o + 2]) > 24) moved++;
    }
    return moved / n;
}

// Mean SSIM over 8x8 windows of brightness, both pictures shrunk by the same factor to at most 512 on
// the long side. 1 = the same, near 0 = unrelated. Pictures of different sizes score 0 (resize first).
export function similarity(a, b) {
    if (a.width !== b.width || a.height !== b.height || !a.width || !a.height) return 0;
    const f = Math.max(1, Math.ceil(Math.max(a.width, a.height) / 512));
    const w = Math.ceil(a.width / f), h = Math.ceil(a.height / f);
    const shrink = (img) => {
        const out = new Float64Array(w * h), n = new Uint32Array(w * h);
        for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
            const o = (y * img.width + x) * 4, i = Math.floor(y / f) * w + Math.floor(x / f);
            out[i] += luma(img.rgba[o], img.rgba[o + 1], img.rgba[o + 2]); n[i]++;
        }
        for (let i = 0; i < out.length; i++) out[i] /= Math.max(1, n[i]);
        return out;
    };
    const la = shrink(a), lb = shrink(b), c1 = (0.01 * 255) ** 2, c2 = (0.03 * 255) ** 2, WIN = 8;
    let total = 0, windows = 0;
    for (let y = 0; y < h; y += WIN) for (let x = 0; x < w; x += WIN) {
        const ye = Math.min(y + WIN, h), xe = Math.min(x + WIN, w), n = (ye - y) * (xe - x);
        let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
        for (let yy = y; yy < ye; yy++) for (let xx = x; xx < xe; xx++) { const p = la[yy * w + xx], q = lb[yy * w + xx]; sa += p; sb += q; saa += p * p; sbb += q * q; sab += p * q; }
        const ma = sa / n, mb = sb / n, va = Math.max(0, saa / n - ma * ma), vb = Math.max(0, sbb / n - mb * mb), cov = sab / n - ma * mb;
        total += ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2));
        windows++;
    }
    return windows ? Math.min(1, Math.max(0, total / windows)) : 0;
}

// How alike two pictures look, 0..100: perceptual detail (SSIM) and coarse layout (16x9 brightness
// grid), each after bringing both to 640x360. Layout catches "same screen, other theme" that SSIM misses.
export function likeness(a, b) {
    const A = resize(a, 640, 360), B = resize(b, 640, 360);
    const ga = resize(a, 16, 9), gb = resize(b, 16, 9);
    let diff = 0;
    for (let i = 0; i < 16 * 9; i++) diff += Math.abs(luma(ga.rgba[i * 4], ga.rgba[i * 4 + 1], ga.rgba[i * 4 + 2]) - luma(gb.rgba[i * 4], gb.rgba[i * 4 + 1], gb.rgba[i * 4 + 2]));
    const layout = 1 - diff / (16 * 9 * 255);
    return Math.round(((similarity(A, B) + layout) / 2) * 1000) / 10;
}

// The closest of the reference pictures (PNG only here) to `shot`: { score, name } or null.
export function closestReference(shot, files) {
    let best = null;
    for (const f of files) {
        let img;
        try { img = decodePng(fs.readFileSync(f)); } catch (_) { continue; }
        const score = likeness(shot, img);
        if (!best || score > best.score) best = { score, name: path.basename(f) };
    }
    return best;
}
