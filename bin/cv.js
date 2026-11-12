#!/usr/bin/env node
// claudevolution CLI. Each command lives in core/cli/<name>.js and exports run(args, ctx) -> exit code.
// Runs on Node >= 18 or Deno 2 (bin/cv.cmd, bin/cv.ps1 and bin/cv pick whichever is installed).
import process from "node:process";
import { parseArgs } from "../core/lib/util.js";
import { VERSION } from "../core/lib/config.js";

const COMMANDS = {
    init: "iskeleti kur (var olanı ezmez, yanına .new bırakır)",
    adopt: "var olan düzen için eşleme planı üret (--apply ile uygula)",
    doctor: "gözetimsiz çalışma önkoşullarını denetle (hiçbir şeyi değiştirmez)",
    status: "tur, kota, şeritler, hafıza özeti",
    distill: "damıtma için yeni dersler, adaylar, ölçüler (--mark: damıtıldı işaretle)",
    update: "paket sürümüyle projedeki farkı göster (--apply ile uygula)",
    gate: "kota kapısı: --five N --week N [--five-resets ISO] [--week-resets ISO]",
    lock: "çevrim kilidi: status | acquire --session ID | release [--session ID]",
    cycle: "otonom çevrim: begin | end | sleep",
    recover: "takılma bulguları (--fix: güvenli olanları düzelt)",
    delegate: "ucuz model: batch | status | stop | run | fix | ask | scout | auto",
    round: "tur ölçümü: start | end | show | table",
    probe: "çalışan uygulamayı yokla: --preset AD | --script JS | --list",
    ref: "referans karşılaştırma: name | index | compare"
};

const [name, ...rest] = process.argv.slice(2);
if (!name || name === "help" || name === "--help" || name === "-h") {
    console.log(`claudevolution ${VERSION}\n\nKullanım: cv <komut> [seçenekler]\n`);
    for (const [k, v] of Object.entries(COMMANDS)) console.log(`  ${k.padEnd(9)} ${v}`);
    process.exit(name ? 0 : 1);
}
if (name === "version" || name === "--version") { console.log(VERSION); process.exit(0); }
if (!COMMANDS[name]) { console.error(`Bilinmeyen komut: ${name} (cv help)`); process.exit(1); }

try {
    const mod = await import(`../core/cli/${name}.js`);
    const code = await mod.run(parseArgs(rest), { argv: rest });
    process.exit(typeof code === "number" ? code : 0);
} catch (error) {
    // No stack traces for the owner; CV_DEBUG=1 shows them.
    console.error("HATA: " + error.message);
    if (process.env.CV_DEBUG) console.error(error.stack);
    process.exit(1);
}
