# Üçüncü taraf kaynakları

claudevolution bazı parçaları izin verici lisanslı açık kaynak projelerden uyarlar (kod JavaScript'e çevrilip yapımıza uyarlandı; birebir kopya değil). Uyarlanan dosyanın başında kaynak yazılıdır. Markalar ve logolar alınmaz.

| Kaynak | Lisans | Uyarlanan |
|---|---|---|
| Craft Anything (storytold) | MIT OR Apache-2.0 | `core/lib/util.js` atomik yazıcı (`platform/src/fs.rs`), `core/cli/migrate.js` sürümlü adımlar (`engine/src/versioned.rs`) ve işlemsel uygulama (`setup/src/plan.rs`), `core/delegate/agent.js` hata türleri (`ai/src/failure.rs`) ve `docs/pitfalls.md` dersleri |
| craft-libs (storytold) | MIT OR Apache-2.0 | `core/lib/util.js` Windows kilit geri çekilmesi (`crates/atomic`) |
| OMK | MIT | `core/lib/util.js` atomik yazıcı (`atomic-session-file.ts`), `core/delegate/agent.js` kota hatasında beklemeden devir (`specs/090-quota-no-retry`) ve `reasoning_content` kuralı (`openai-completions.ts`) |
| LoopTroop | MIT | `core/lib/util.js` etkileşimsiz git ortamı (`server/git/runCommand.ts`) |
| metaswarm | MIT | `cv update` önizleme dili ("hiçbir şey kaybolmaz", geri alınabilir) (`skills/migrate`) |
| consilium, zeroshot, mco, bottleneck, ccusage | MIT | önceki sürümlerdeki fikirler (bkz. `docs/DECISIONS.md` K29–K32) |

MIT ve Apache-2.0 lisans metinleri: https://opensource.org/license/mit , https://www.apache.org/licenses/LICENSE-2.0
