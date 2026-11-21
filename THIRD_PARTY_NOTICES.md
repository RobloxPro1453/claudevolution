# Üçüncü taraf kaynakları

claudevolution bazı parçaları izin verici lisanslı açık kaynak projelerden uyarlar (kod JavaScript'e çevrilip yapımıza uyarlandı; birebir kopya değil). Uyarlanan dosyanın başında kaynak yazılıdır. Markalar ve logolar alınmaz.

| Kaynak | Lisans | Uyarlanan |
|---|---|---|
| Anthropic skills (frontend-design) | Apache-2.0 | `skills/library/frontend-design-anthropic/` (değiştirilmeden; lisans metni yanında `LICENSE.txt`). Türkçe tasarım becerileri `skills/library/*-tr` bu paket için özgün yazıldı (Manus araştırması, 2026-11-21) |
| Craft Anything (storytold) | MIT OR Apache-2.0 | `core/lib/util.js` atomik yazıcı (`platform/src/fs.rs`), `core/cli/migrate.js` sürümlü adımlar (`engine/src/versioned.rs`) ve işlemsel uygulama (`setup/src/plan.rs`), `core/delegate/agent.js` hata türleri (`ai/src/failure.rs`) ve başarısız koşu günlüğü (`ai/src/failure_log.rs`), `core/delegate/context.js` dönem sıkıştırması (`ai/src/context.rs`) ve `docs/pitfalls.md` dersleri |
| Craft Anything (storytold), M3 | MIT OR Apache-2.0 | `core/check/` — `--self-test`/`--screenshot` sözleşmeleri ve hüküm (`rebuild/kinds/{self_test,screenshot}.rs`, `engine/src/self_test.rs`), boş ekran + SSIM + küçültme (`engine/src/tools/web_common.rs`), program seçimi (`engine/src/outputs.rs`), konsol vakaları (`rebuild/kinds/runs.rs`), saklanan tur (`rebuild/kept_check.rs`) |
| craft-libs (storytold) | MIT OR Apache-2.0 | `core/lib/util.js` Windows kilit geri çekilmesi (`crates/atomic`) |
| OMK | MIT (Copyright (c) 2025 Mario Zechner, (c) 2026 ClassicMate) | `core/delegate/edit-diff.js` bulanık düzenleme (`tools/edit-diff.ts`, `edit-occurrences.ts`); `core/delegate/context.js` baş+son kesimi ve önbellek öneki testi (`deepseek-harness.ts`, `specs/051,066,113`); okumadan yazmama (`specs/115`); `core/lib/util.js` atomik yazıcı (`atomic-session-file.ts`), `core/delegate/agent.js` kota hatasında beklemeden devir (`specs/090-quota-no-retry`) ve `reasoning_content` kuralı (`openai-completions.ts`) |
| LoopTroop | MIT | `core/lib/util.js` etkileşimsiz git ortamı (`server/git/runCommand.ts`) |
| LoopTroop | MIT | `core/intent/` görüşme ilkeleri (1-3'lük partiler, örtük cevaplananı sormama, kapsam denetimi; `server/prompts/index.ts` PROM4/PROM5) |
| Craft Anything (storytold), M4 | MIT OR Apache-2.0 | `templates/stacks/rust-egui/` (konsolsuz exe, `+crt-static`, DX12/WARP ve açılış izi `apps/craft-anything/src/{main,start_guard}.rs`; sözleşmeler), `skills/*/{desktop-design,clean-architecture,rust-desktop}` (`docs/design-system.md`, `docs/pitfalls.md`) |
| Craft Anything (storytold), M5 | MIT OR Apache-2.0 | `core/lib/process.js` (npm `.cmd` kısayolu çözümü, gizli bayrak maskeleme: `platform/src/{which,process}.rs`), sahip notu (`rebuild/notes.rs`, `engine/src/inbox.rs`) |
| OMK + LoopTroop, M5 | MIT | `core/lib/filelock.js` (`durable-file-lock-*.ts`), makbuz–komut bağı (`specs/099`), trende test dosya etkisi denetimi (LoopTroop `finalTest/fileEffectsAudit.ts`) |
| metaswarm | MIT | teslim kapsamı ilkesi (`guides/delivery-scope.md`) `cv-init` §2b; `cv update` önizleme dili ("hiçbir şey kaybolmaz", geri alınabilir) (`skills/migrate`) |
| consilium, zeroshot, mco, bottleneck, ccusage | MIT | önceki sürümlerdeki fikirler (bkz. `docs/DECISIONS.md` K29–K32) |
| ccusage, M6 | MIT | `core/metrics/blocks.js` blok algoritması, `--token-limit max` tabanı (`calibrate.js`); `core/metrics/usage.js` Codex ve Antigravity okuyucuları (`rust/adapters/{codex,antigravity}`) |
| consilium + zeroshot, M6 | MIT | "limit reached" döküm izi biçimleri (`core/adapters/claude.rs` sınıflandırıcı, zeroshot bağdaştırıcı testleri) → `LIMIT_HIT_RE`; zeroshot `active_memory` kaynak bekçisi ve tek güçlü eşleşme (`source_guard.rs`, `retrieval.rs`), `auto_research` rolleri → `core/autonomy/{knowledge,autotune}.js` |
| metaswarm, M6 | MIT | bilgi şeması (`knowledge/*.jsonl`) → `.evrim/knowledge.jsonl` |

MIT ve Apache-2.0 lisans metinleri: https://opensource.org/license/mit , https://www.apache.org/licenses/LICENSE-2.0
