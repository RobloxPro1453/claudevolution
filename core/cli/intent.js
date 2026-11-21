// cv intent "<istek>" [--kind <tür>] [--apply] [--json] | coverage [--delivered] | kinds
// The subtext engine (core/intent/README.md): the unsaid part of a short request, as a card.
// --apply writes docs/INTENT.md (never over an existing one: .new beside it) and fills check.selfTest.steps
// and finalForm.criteria in .evrim/config.json only where they are empty (the owner's values stay).
import path from "node:path";
import process from "node:process";
import { exists, readJson, writeJson, writeText } from "../lib/util.js";
import { CONFIG_REL, findRoot } from "../lib/config.js";
import { project } from "./_project.js";
import { card, coverage, delivered, kinds, renderDelivered, renderIntent } from "../intent/intent.js";
import { lastRound } from "../check/check.js";
import { suggest } from "../stack/stack.js";

export async function run(args) {
    const [sub, ...rest] = args._;
    if (sub === "kinds") { for (const k of kinds()) console.log(`${k.id.padEnd(8)} ${k.title} — ${k.expectations.length} beklenti, ${k.questions.length} soru`); return 0; }
    if (sub === "coverage") {
        const cfg = project(args);
        // --delivered is a report, not a gate: exit 0 always.
        if (args.delivered) {
            const round = lastRound(cfg);
            const d = delivered(cfg, round);
            if (args.json) { console.log(JSON.stringify(d)); return 0; }
            if (!round) console.log("Henüz denetim turu yok: cv check (aşağıdaki ölçütlerin hepsi denenmedi)");
            console.log(renderDelivered(d));
            return 0;
        }
        const c = coverage(cfg);
        if (!c.hasIntent) { console.log("docs/INTENT.md yok: önce cv intent \"<istek>\" --apply"); return 1; }
        console.log(c.missing.length ? `KAPSAM EKSİK: ${c.missing.length}/${c.ids.length} madde planda yok → ${c.missing.map((m) => `[E:${m}]`).join(", ")}\nPlan (ROADMAP ya da tarifler) bu maddeleri anmadan onaylanmaz.` : `KAPSAM TAMAM: ${c.ids.length}/${c.ids.length} madde planda.`);
        return c.missing.length ? 1 : 0;
    }
    const request = [sub, ...rest].filter(Boolean).join(" ");
    if (!request) throw new Error("kullanım: cv intent \"<istek>\" [--kind tür] [--apply] | coverage | kinds");
    const c = card(request, { kind: typeof args.kind === "string" ? args.kind : null });
    const s = suggest(request);
    if (args.json) { console.log(JSON.stringify({ ...c, stack: s })); return 0; }
    console.log(renderIntent(c));
    console.log(`Yığın önerisi: ${s.stack} — ${s.why}`);
    const ask = c.questions.filter((q) => q.answered === null);
    console.log(ask.length ? `\nSorulacak (${ask.length}, seçenekli, 1-3'lük partiler): ${ask.map((q) => q.id).join(", ")}` : "\nSorulacak soru yok: hepsi istekte cevaplı ya da varsayılanla.");
    if (!args.apply) { console.log("Yazmak için: --apply"); return 0; }
    const root = findRoot(typeof args.dir === "string" ? path.resolve(args.dir) : process.cwd());
    if (!root) throw new Error("burada claudevolution kurulu değil: önce cv init");
    const file = path.join(root, "docs", "INTENT.md");
    const target = exists(file) ? file + ".new" : file;
    writeText(target, renderIntent(c));
    const cfgFile = path.join(root, CONFIG_REL), own = readJson(cfgFile, null);
    if (own) {
        own.check = own.check || {};
        own.check.selfTest = own.check.selfTest && typeof own.check.selfTest === "object" ? own.check.selfTest : {};
        if (!(own.check.selfTest.steps || []).length) own.check.selfTest.steps = c.selfTestSteps;
        own.finalForm = own.finalForm || {};
        if (!(own.finalForm.criteria || []).length) own.finalForm.criteria = [...c.acceptance, "cv check geçer (pencere çizer, --self-test adımlarının hepsi geçer)", "Tek .exe çift tıkla açılır, kurulum istemez"];
        writeJson(cfgFile, own);
    }
    console.log(`\nYazıldı: ${path.relative(root, target)}${target !== file ? " (var olan INTENT.md'ye dokunulmadı)" : ""}; config: check.selfTest.steps ve finalForm.criteria (boşsa) dolduruldu.`);
    return 0;
}
