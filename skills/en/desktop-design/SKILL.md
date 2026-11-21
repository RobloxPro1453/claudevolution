---
name: desktop-design
description: How a desktop app looks and feels - one scale (type, spacing, corners, colour), two themes, measured contrast, component rules; loaded only in a desktop-app project (eframe/egui/tauri in Cargo.toml, or the owner asks for a desktop program).
---

Source: Craft Anything `docs/design-system.md` + `pitfalls.md` "Design" (MIT OR Apache-2.0), distilled.

**Feeling first:** `docs/INTENT.md` > the wanted feeling (calm/focused, fast/practical, professional, playful) drives every design decision. Missing? `cv intent "<request>" --apply`.

## One scale (screens never write a number)
- Type: headings 26/18/16, body 15, small 14, label 13, caption 12; below 12 only in dense lists. Paragraph line height 1.45×.
- Spacing: 2, 4, 8, 12, 16, 24, 32 (4/8 grid). Corners: 4 (list rows), 6 (controls), 8 (cards, windows).
- Control height: 24 (toolbars), 32 (default), 40 (main fields), 48 (the one thing a screen is for).
- Colours from theme tokens (`canvas` < `card` < `field`); a new number is a change to the scale, not to a screen. No literal `#hex`/pixel sizes left in screen code.

## Two themes, measured contrast
- Dark and light together; look at both (`cv check` picture + light theme).
- Text/background ≥ 4.5:1, control edges and scroll bars ≥ 3:1 (WCAG). Computed, not eyeballed: a theme change re-measures in the test.
- A visible focus ring on every control for keyboard users.

## Component rules
- The screen's one main action = primary button; the rest secondary/quiet. Cannot-undo = danger colour + confirmation.
- An empty screen is never blank: one sentence like "Pick an item on the left or add a new one".
- Messages: confirmations fade by themselves, errors stay until dismissed; shown where the owner is looking.
- A dropdown list is as wide as its widest row and scrolls after ~9 rows.

## A UI that never freezes
- No disk reads or folder scans while drawing (they repeat every frame). Heavy work in the background, results through a channel.
- egui's own `Spinner`/`ProgressBar::animate` redraw every frame: a paced animation of your own or a still "working" label.
- Something measured after drawing is a frame late: take its size from the previous frame.

## Mock-up approval (before writing code)
1. `cv stack new <stack> --name "<name>"` skeleton; screens empty but the layout real (1-2 min).
2. `cv check --self` → screenshot (`.evrim/state/checks/round-0/screenshot.png`); look at it yourself first.
3. Show the picture **together with** the `docs/INTENT.md` "what I understood" summary; the owner corrects once.
