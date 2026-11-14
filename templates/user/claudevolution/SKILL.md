---
name: claudevolution
description: claudevolution (self-evolving work system for Claude Code, Codex, and Antigravity projects) is installed on this machine; package at {{pkg}}. Use it at the start of a session when the project has .evrim/config.json with "kurulum" "bekliyor" (a new project waiting for its discovery conversation, whatever the first message is, even "merhaba"), when a claudevolution package folder sits in the project without .evrim/, or when the owner asks to install or adopt claudevolution. Bu makinede claudevolution kurulu; Claude, Codex ve Antigravity'de yeni projede ilk mesajda kurulum görüşmesini başlatır.
---

# claudevolution: bu makinede kurulu

Paket: `{{pkg}}`; sistemin tamamı `{{pkg}}/README.md`. Claude Code, Codex ve Antigravity için hazırdır. Sahibiyle onun dilinde, sade konuş.

1. **`.evrim/config.json` var ve `"kurulum": "bekliyor"`:** sahibinin ilk mesajı ne olursa olsun (merhaba bile) proje becerilerinden `cv-init` becerisini uygula (`.claude/skills/cv-init/SKILL.md`, `.codex/skills/cv-init/SKILL.md` veya `.agent/skills/cv-init/SKILL.md`): keşif görüşmesi.
2. **`.evrim/config.json` var, kurulum tamam:** projenin `AGENTS.md`'sine uy. Selamlaşmaya `durum` becerisiyle kısa durum ver. `.evrim/version` paketten eskiyse `claudevrim guncelle` öner.
3. **`.evrim/` yok ama klasörde bir paket kopyası var** (içinde `bin/cv.js` olan alt klasör): sahibi kurulsun diye attı; sormadan kur: git deposu değilse `git init`, sonra `<o klasör>/bin/cv.cmd init` (ya da `claudevrim init`), sonra 1. adım.
4. **Hiçbiri:** kendiliğinden hiçbir şey kurma. Sahibi isterse yeni proje için `claudevrim init` (kurulu değilse `{{pkg}}/bin/cv.cmd init`), var olan düzeni geçirmek için `claudevrim adopt` (veya `{{pkg}}/bin/cv.cmd adopt --apply`), sonra 1. adım.
