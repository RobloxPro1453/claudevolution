# Göç planı: Fotosop

`cv adopt` ile 2026-11-12 tarihinde üretildi. Hiçbir dosya taşınmaz ya da silinmez; `--apply` yalnız yeni dosya yazar (var olanı ezmez, farklıysa yanına `.new` bırakır).

Eylemler: **config** = alanları `.evrim/config.json`'a · **kopya** = yeni yere kopyalanır, eskisi kalır · **birleştir** = paket şablonu yanına `.new`, elle birleştirilir · **yeni** = şablondan · **emekli** = paket komutu yerini alır, eski dosya sahibi silene kadar kalır · **eklenti** = projeye özgü parça yerel eklenti olur · **kalır** = yerinde, config gösterir · **dokunulmaz** = ürün kodu, okunmadı.

Özet: config 1 · kopya 6 · birleştir 4 · emekli 7 · eklenti 2 · kalır 41 · dokunulmaz 9

## Eşleme

| Kaynak | Hedef | Eylem | Neden |
|---|---|---|---|
| `docs/workflow/config.json` | `.evrim/config.json` | config | alan alan eşleme aşağıda; eski dosya eski betikler için kalır |
| `docs/workflow/metrics.jsonl` | `.evrim/metrics.jsonl` | kopya | tur satırları; eski 'deepseek' alanı cv round tarafından okunur |
| `build/otonom/DERSLER.md` | `.evrim/otonom/DERSLER.md` | kopya | otonom hafıza artık git'te (K9); kopya, eski dosya kalır |
| `build/otonom/GUNLUK.md` | `.evrim/otonom/GUNLUK.md` | kopya | otonom hafıza artık git'te (K9); kopya, eski dosya kalır |
| `build/otonom/HATALAR.md` | `.evrim/otonom/HATALAR.md` | kopya | otonom hafıza artık git'te (K9); kopya, eski dosya kalır |
| `build/otonom/OZET.md` | `.evrim/otonom/OZET.md` | kopya | otonom hafıza artık git'te (K9); kopya, eski dosya kalır |
| `build/ds/*.json (48)` | `.evrim/state/delegate/` | kopya | ucuz model çalıştırma kayıtları (günlük bütçe ve tur ölçümü okur) |
| `AGENTS.md` | `AGENTS.md` | birleştir | projenin kuralları kalır; şablonun 'nereye bakmalı', hafıza tablosu ve belge diyeti bölümleri AGENTS.md.new olarak yanına, elle birleştirilir |
| `docs/tasks/README.md` | `docs/tasks/README.md` | birleştir | ucuz ajan kuralları: genel kısım paket şablonuyla karşılaştırılır (.new), 'Project rules' bölümü projede kalır |
| `.claude/skills/calis/` | `.claude/skills/calis/` | birleştir | paket becerisi yanına .new olarak gelir; projeye özgü adımlar AGENTS/config'e taşınır |
| `.claude/skills/durum/` | `.claude/skills/durum/` | birleştir | paket becerisi yanına .new olarak gelir; projeye özgü adımlar AGENTS/config'e taşınır |
| `scripts/ds/agent.js` | paket: core/delegate/agent.js (cv delegate run\|fix\|ask\|scout\|auto) | emekli | genel ajan pakette; eski betik yedek olarak kalır |
| `scripts/capture/ref_index.py` | paket: cv ref index | emekli | referans indeksi genel |
| `scripts/ds.ps1` | paket: cv delegate batch\|status\|stop | emekli | şeritler ayrık süreç (K12); worktree yolu delegate.worktreeRoot |
| `scripts/round.js` | paket: cv round | emekli | aynı ölçüm, aynı formül (K17) |
| `scripts/round.ps1` | paket: cv round | emekli | aynı ölçüm, aynı formül (K17) |
| `.claude/skills/fullotonom/` | `.claude/skills/otonom/` | emekli | paket 'otonom' becerisi yerini alır; faz içerikleri ROADMAP'e |
| `.claude/loop.md` | paket: otonom becerisi + zamanlanmış görev | emekli | eski /loop istemi (ders 9) |
| `(ajan içindeki engine_search)` | `.evrim/plugins/engine-search.js` | eklenti | projeye özgü arama aracı; core/delegate eklenti arayüzüyle yazılacak |
| `scripts/probe.ps1` | `probe.plugin (.evrim/plugins/probe.js)` | eklenti | uygulamayı yoklama projeye özgü; arayüz core/probe/README.md |
| `GEMINI.md` | `GEMINI.md` | kalır | başka modele devir notu; şablonu yok, olduğu gibi kalır |
| `README.md` | `README.md` | kalır | projenin tanıtımı |
| `CHANGELOG.md` | `CHANGELOG.md` | kalır | config docs.changelog |
| `docs/VISION.md` | `docs/VISION.md` | kalır | config docs.vision; şablonu yalnız eksikse yazılır |
| `docs/PROGRESS.md` | `docs/PROGRESS.md` | kalır | config docs.progress; şablonu yalnız eksikse yazılır |
| `docs/ROADMAP.md` | `docs/ROADMAP.md` | kalır | config docs.roadmap; şablonu yalnız eksikse yazılır |
| `docs/CHECKUP.md` | `docs/CHECKUP.md` | kalır | config docs.checkup; şablonu yalnız eksikse yazılır |
| `docs/KNOWLEDGE.md` | `docs/KNOWLEDGE.md` | kalır | config docs.knowledge; şablonu yalnız eksikse yazılır |
| `docs/ARCHITECTURE.md` | `docs/ARCHITECTURE.md` | kalır | config docs.architecture; şablonu yalnız eksikse yazılır |
| `docs/DEVELOPMENT.md` | `docs/DEVELOPMENT.md` | kalır | config docs.development; şablonu yalnız eksikse yazılır |
| `docs/WORKER.md` | `docs/WORKER.md` | kalır | config docs.worker; şablonu yalnız eksikse yazılır |
| `docs/ENGINE.md` | `docs/ENGINE.md` | kalır | projeye özgü bilgi (ürün, motor, hukuk, kaynaklar) |
| `docs/FEATURES.md` | `docs/FEATURES.md` | kalır | projeye özgü bilgi (ürün, motor, hukuk, kaynaklar) |
| `docs/LEGAL.md` | `docs/LEGAL.md` | kalır | projeye özgü bilgi (ürün, motor, hukuk, kaynaklar) |
| `docs/REFERENCES.md` | `docs/REFERENCES.md` | kalır | projeye özgü bilgi (ürün, motor, hukuk, kaynaklar) |
| `docs/REVERSE_ENGINEERING.md` | `docs/REVERSE_ENGINEERING.md` | kalır | projeye özgü bilgi (ürün, motor, hukuk, kaynaklar) |
| `docs/STATS_USAGE.md` | `docs/STATS_USAGE.md` | kalır | projeye özgü bilgi (ürün, motor, hukuk, kaynaklar) |
| `docs/prompts/` | `docs/prompts/` | kalır | projeye özgü belge klasörü |
| `docs/re/` | `docs/re/` | kalır | projeye özgü belge klasörü |
| `docs/workflow/ENGINE_IDEA.md` | paket: docs/METHOD.md | kalır | yöntem pakete damıtıldı; yerel kopya tarihçe olarak kalır |
| `docs/workflow/EXPERIMENTS.md` | `docs/workflow/EXPERIMENTS.md` | kalır | deney kaydı / raporlar: yerel veri |
| `docs/workflow/METRICS.md` | `docs/workflow/METRICS.md` | kalır | cv round table aynı yere üretir (metrics.table) |
| `docs/workflow/OPTIMIZATION.md` | paket: docs/METHOD.md | kalır | yöntem pakete damıtıldı; yerel kopya tarihçe olarak kalır |
| `docs/workflow/README.md` | paket: docs/METHOD.md | kalır | yöntem pakete damıtıldı; yerel kopya tarihçe olarak kalır |
| `docs/workflow/reports/` | `docs/workflow/reports/` | kalır | deney kaydı / raporlar: yerel veri |
| `docs/tasks/TEMPLATE.md` | `docs/tasks/TEMPLATE.md` | kalır | tarif şablonu |
| `docs/tasks/DS-*.md (47 tarif, 47 rapor)` | `docs/tasks/` | kalır | tarifler ve raporlar; tasks.pattern ile tanınır, numaralama devam eder |
| `docs/tasks/{AURA.md,FABLE-001.md}` | `docs/tasks/` | kalır | büyük model briefleri / diğer |
| `scripts/build_kernel.ps1` | `scripts/build_kernel.ps1` | kalır | projeye özgü betik |
| `scripts/capture/Yakalama.cmd` | `scripts/capture/Yakalama.cmd` | kalır | referans uygulamadan yakalama projeye/makineye özgü; çıktısı reference.dir'e |
| `scripts/capture/capture.ps1` | `scripts/capture/capture.ps1` | kalır | referans uygulamadan yakalama projeye/makineye özgü; çıktısı reference.dir'e |
| `scripts/capture/menus.txt` | `scripts/capture/menus.txt` | kalır | referans uygulamadan yakalama projeye/makineye özgü; çıktısı reference.dir'e |
| `scripts/pack_ui.py` | `scripts/pack_ui.py` | kalır | projeye özgü betik |
| `scripts/re/` | `scripts/re/` | kalır | projeye özgü betik |
| `scripts/re.ps1` | `scripts/re.ps1` | kalır | projeye özgü betik |
| `scripts/re_extract.py` | `scripts/re_extract.py` | kalır | projeye özgü betik |
| `.claude/skills/test/` | `.claude/skills/test/` | kalır | projeye özgü beceri |
| `build/otonom/compare/` | `build/otonom/compare/` | kalır | geçici çıktı |
| `~/.claude/projects/<proje>/memory/` | `.evrim/otonom/DERSLER.md (aday)` | kalır | Claude'un kendi hafızası; ilk damıtmada dersler oradan okunur, dosyalara dokunulmaz |
| `build.ps1` | `build.ps1` | kalır | derleme komutu (config build) |
| `stats.ps1` | `stats.ps1` | kalır | proje betiği |
| `.tools/` | `.tools/` | dokunulmaz | bağımlılık / üçüncü taraf / çıktı: okunmadı |
| `assets/` | `assets/` | dokunulmaz | ürün kodu ya da verisi |
| `dist/` | `dist/` | dokunulmaz | bağımlılık / üçüncü taraf / çıktı: okunmadı |
| `original/` | `original/` | dokunulmaz | bağımlılık / üçüncü taraf / çıktı: okunmadı |
| `photopea-readable/` | `photopea-readable/` | dokunulmaz | bağımlılık / üçüncü taraf / çıktı: okunmadı |
| `references/` | `references/` | dokunulmaz | ürün kodu ya da verisi |
| `src/` | `src/` | dokunulmaz | ürün kodu ya da verisi |
| `tests/` | `tests/` | dokunulmaz | ürün kodu ya da verisi |
| `vendor/` | `vendor/` | dokunulmaz | bağımlılık / üçüncü taraf / çıktı: okunmadı |

## Config eşlemesi

Kaynak: `docs/workflow/config.json`.

| Alan | Not |
|---|---|
| `build` | derleme komutu aynen |
| `test` | test komutu aynen |
| `testMinutes` | süre sınırı aynen |
| `codePaths` | ölçümde kod sayılan klasörler aynen |
| `forbiddenWrite` | projenin listesi aynen + ^\.evrim/, ^\.claude/ |
| `skipDirs` | aynen |
| `tasks.dir` | tarif klasörü aynen |
| `tasks.rules` | ajan kuralları aynen |
| `tasks.pattern` | tarif adı kalıbı aynen |
| `tasks.prefix` | kalıptan çıkarıldı |
| `delegate.intro` | ajanın tanıtım cümlesi aynen |
| `delegate.worktreeRoot` | eski göreli yol ev klasörüne göre yazıldı (makineye özgü değil) |
| `delegate.commitTrailer` | eski commit'ler ölçümde ucuz modelin sayılsın diye aynı imza |
| `delegate.engineSearch` | projeye özgü arama aracının ayarları; eklenti .evrim/plugins/engine-search.js yazılınca delegate.plugins'e eklenir |
| `metrics.weights` | ağırlıklar aynen (eski turlar karşılaştırılabilir kalsın) |
| `metrics.table` | tablo eski yerinde üretilmeye devam eder |
| `metrics.claudeProjectDir` | alınmadı: makineye özgü; proje yolundan türetilir |
| `probe` | eski yoklama ayarları probe.legacy altında; eklenti yazılınca probe.plugin doldurulur |

## `--apply` ne yapar

1. `cv init`: eksik belge, şablon, beceri yazılır; var olan farklıysa yanına `.new`.
2. Yukarıdaki config `.evrim/config.json` yoksa yazılır.
3. **kopya** satırları hedef yoksa kopyalanır.
4. Bu plan `.evrim/adopt-plan.md`'ye yazılır.

Sonra elle: `.new` dosyalarını birleştir, **eklenti** satırlarını yaz, `cv doctor`, bir deneme turu (`cv round start` → `cv round end`). **emekli** dosyalar ancak yeni komut bir tur sorunsuz çalıştıktan sonra silinir.
