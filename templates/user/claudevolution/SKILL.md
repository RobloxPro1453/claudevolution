---
name: claudevolution
description: claudevolution (self-evolving work system for Claude Code projects) is installed on this machine at {{pkg}}. Use it at the start of a session when the project folder contains a claudevolution package folder but no .evrim/ yet (the owner dropped it in to have it set up), when the owner asks to install or set up claudevolution, or when a project with .evrim/ needs the package location. Bu makinede claudevolution kurulu; paket klasörü projeye atılmışsa ya da sahibi isterse projeye kurar.
---

# claudevolution: makinede kurulu

Paket: `{{pkg}}` (bu dosyayı `cv setup` yazdı; paket taşınırsa orada `cv setup` yeniden çalıştırılır). Sistemin tamamı `{{pkg}}/README.md` içinde. Sahibiyle onun dilinde, sade konuş.

## Bu projede ne yapmalı

1. **`.evrim/config.json` varsa** proje zaten kurulu: projenin `AGENTS.md`'sine uy. `.evrim/version` paketin sürümünden eskiyse sahibine `cv update` öner. Başka bir şey yapma.
2. **Proje klasöründe bir paket kopyası varsa** (içinde `bin/cv.js` ve `templates/project/` olan bir alt klasör, genelde `claudevolution/`) ve `.evrim/` yoksa: sahibi onu kurulsun diye attı, **sormadan kur**:
   1. Git deposu değilse `git init`.
   2. `<o klasör>/bin/cv.cmd init --name <proje klasörünün adı>` (Windows; macOS/Linux `<o klasör>/bin/cv init`). Sahibi İngilizce konuşuyorsa `--lang en`. Komut paket klasörünü `.gitignore`'a ekler, var olan dosyayı ezmez.
   3. Yeni beceriler bu oturumda henüz yüklü değildir: `.claude/skills/cv-init/SKILL.md` dosyasını oku ve uygula (yapılandırma, VISION, ilk yol haritası, `cv doctor`).
   4. Bitince sahibine üç satır: ne kuruldu, artık ne yazarsa ne olur ("durum", "çalış", gözetimsiz çalışma), kalan elle ayarlar.
3. **İkisi de yoksa** kendiliğinden hiçbir şey kurma. Sahibi "claudevolution kur" derse 2. adımı bu makinedeki paketle (`{{pkg}}`) uygula.
