# Üçüncü taraf kaynakları

claudevolution bazı parçaları izin verici lisanslı açık kaynak projelerden uyarlar (kod JavaScript'e çevrilip yapımıza uyarlandı; birebir kopya değil). Uyarlanan dosyanın başında kaynak yazılıdır. Markalar ve logolar alınmaz.

| Kaynak | Lisans | Uyarlanan |
|---|---|---|
| Craft Anything (storytold) | MIT OR Apache-2.0 | `core/lib/util.js` atomik yazıcı (`platform/src/fs.rs`), `core/cli/migrate.js` sürümlü adımlar (`engine/src/versioned.rs`) ve işlemsel uygulama (`setup/src/plan.rs`), `core/delegate/agent.js` hata türleri (`ai/src/failure.rs`) ve başarısız koşu günlüğü (`ai/src/failure_log.rs`), `core/delegate/context.js` dönem sıkıştırması (`ai/src/context.rs`) ve `docs/pitfalls.md` dersleri |
| Craft Anything (storytold), M3 | MIT OR Apache-2.0 | `core/check/` — `--self-test`/`--screenshot` sözleşmeleri ve hüküm (`rebuild/kinds/{self_test,screenshot}.rs`, `engine/src/self_test.rs`), boş ekran + SSIM + küçültme (`engine/src/tools/web_common.rs`), program seçimi (`engine/src/outputs.rs`), konsol vakaları (`rebuild/kinds/runs.rs`), saklanan tur (`rebuild/kept_check.rs`) |
| craft-libs (storytold) | MIT OR Apache-2.0 | `core/lib/util.js` Windows kilit geri çekilmesi (`crates/atomic`) |
| OMK | MIT (Copyright (c) 2025 Mario Zechner, (c) 2026 ClassicMate) | `core/delegate/edit-diff.js` bulanık düzenleme (`tools/edit-diff.ts`, `edit-occurrences.ts`); `core/delegate/context.js` baş+son kesimi ve önbellek öneki testi (`deepseek-harness.ts`, `specs/051,066,113`); okumadan yazmama (`specs/115`); `core/lib/util.js` atomik yazıcı (`atomic-session-file.ts`), `core/delegate/agent.js` kota hatasında beklemeden devir (`specs/090-quota-no-retry`) ve `reasoning_content` kuralı (`openai-completions.ts`) |
| LoopTroop | MIT | `core/lib/util.js` etkileşimsiz git ortamı (`server/git/runCommand.ts`) |
| metaswarm | MIT | `cv update` önizleme dili ("hiçbir şey kaybolmaz", geri alınabilir) (`skills/migrate`) |
| consilium, zeroshot, mco, bottleneck, ccusage | MIT | önceki sürümlerdeki fikirler (bkz. `docs/DECISIONS.md` K29–K32) |

MIT ve Apache-2.0 lisans metinleri: https://opensource.org/license/mit , https://www.apache.org/licenses/LICENSE-2.0
