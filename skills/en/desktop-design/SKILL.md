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

## When "like X" is asked: extract the reference first
Before writing code, write the reference's (Obsidian, VS Code, Notion, Figma...) layout as 8-10 items and build the screen to it. Example (an Obsidian-style notes app):
- A thin **icon strip** on the left (files, search, tags), next to it a fixed-width tree; a tree row is arrow + name, no box or frame.
- **Flat tabs** on top (the selected tab merges into the background), the close × only on hover.
- A centred, narrow reading column (~700 px); scaled headings, body 15-16 px, line height 1.5.
- Buttons are **icons without frames** (a light background on hover); a text button only for the primary job.
- A collapsible right panel (outline, backlinks); a thin, quiet status bar.
- Colour: one accent (selection, links); the rest shades of grey.

## How these rules are applied in egui
- Side panel: `SidePanel::left(..).resizable(true).default_width(250.0).width_range(180.0..=420.0)`; its rows are drawn with `ui.set_max_width(..)` or a fixed width. Otherwise the content grows the panel every frame ("the sidebar widens forever").
- Frameless button: `Button::new(..).frame(false)` or your own `ghost` button; icons are drawn as vectors (`Painter` lines/circles) or from an embedded icon font; never emoji or ASCII arrows ("v", "<", ">").
- Font: on Windows load the system font (Segoe UI for text, Consolas for code); try Turkish letters.
- Long text is wrapped with `LayoutJob`; a label inside `ui.horizontal` does not wrap, it overflows.
- Built-in design skills (in the package, read when needed): `design-foundations-tr`, `beautiful-ui-builder-tr`, `ui-design-review-tr`, `frontend-design-anthropic`.

## Scored self-review (no eyeballing)
Score the `cv check --self` picture (and the narrow-window picture) **item by item, yes/no** against the reference items above; write only the count ("8 of 10"). Free verdicts like "near perfect" or "looks great" are not written. Where possible a separate reviewer (subagent / cheap model) scores it: do not grade your own work.

When the owner reports a visual bug, first **reproduce it** (resize the window, wait a few seconds, click); never tell the owner "I don't see it".

## Mock-up (only for a vague request)
For a concrete job there is no mock-up; the first delivery is a working slice (`cv-init` §0b). If the request is vague and the owner will choose a look: skeleton + made-up sample data, the picture and "what I understood" shown together; a mock-up is never offered as a delivery.
