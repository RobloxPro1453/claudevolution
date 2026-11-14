---
name: claudevolution
description: claudevolution (self-evolving work system for Claude Code projects) is installed on this machine; package at {{pkg}}. Use it at the start of a session when the project has .evrim/config.json with "kurulum" "bekliyor" (a new project waiting for its discovery conversation, whatever the first message is, even "merhaba"), when a claudevolution package folder sits in the project without .evrim/, or when the owner asks to install claudevolution. Bu makinede claudevolution kurulu; yeni projede ilk mesajda kurulum görüşmesini başlatır.
---

# claudevolution: bu makinede kurulu

Paket: `{{pkg}}`; sistemin tamamı `{{pkg}}/README.md`. Sahibiyle onun dilinde, sade konuş.

1. **`.evrim/config.json` var ve `"kurulum": "bekliyor"`:** sahibinin ilk mesajı ne olursa olsun (merhaba bile) `.claude/skills/cv-init/SKILL.md` becerisini uygula: keşif görüşmesi.
2. **`.evrim/config.json` var, kurulum tamam:** projenin `AGENTS.md`'sine uy. Selamlaşmaya `durum` becerisiyle kısa durum ver. `.evrim/version` paketten eskiyse `claudevrim guncelle` öner.
3. **`.evrim/` yok ama klasörde bir paket kopyası var** (içinde `bin/cv.js` olan alt klasör): sahibi kurulsun diye attı; sormadan kur: git deposu değilse `git init`, sonra `<o klasör>/bin/cv.cmd init` (ya da `claudevrim init`), sonra 1. adım.
4. **Hiçbiri:** kendiliğinden hiçbir şey kurma. Sahibi isterse `claudevrim init` (kurulu değilse `{{pkg}}/bin/cv.cmd init`), sonra 1. adım.
