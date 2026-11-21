---
name: clean-architecture
description: Desktop app layers - Engine (rules) -> Tools/Storage (disk, outside world) -> thin UI; a saving scheme that never loses data and a versioned file format; loaded in a desktop-app project.
---

Source: Craft Anything architecture (`Engine -> Tools -> thin UI`) and the `pitfalls.md` file/saving lessons (MIT OR Apache-2.0).

## Three layers, one direction
- **Engine** (`src/engine.rs` or `src/engine/`): state and rules. **No** window library (`eframe`, `egui`, `tauri`) and no disk (`std::fs`). Everything the owner can do is a function here: the UI, `--self-test` and later tools call the same code.
- **Tools/Storage** (`src/storage.rs`, `src/tools/`): disk, network, outside programs. No UI.
- **UI** (`src/ui.rs`): draws the engine's state, turns clicks into engine calls. No rules, no disk.
- `cv check` measures the boundary (`layers` check): window or disk use in an engine file = fail.

## Saving and data
- One writer: temp file → flush to disk → rename (brief retry on Windows). Never a cut file.
- Disk first, memory after: a failed save stays "unsaved" and says why where the owner looks.
- An unreadable file is not "empty": keep it (copy beside), never overwrite it with defaults. Only "no file" is a fresh start.
- A `version` in the file format; a format change is version +1 and one upgrade step. A file from a newer version is refused, never silently broken.
- Every persisted file has one owner; if a second writer is unavoidable, merge what is on disk before writing.
- Unsaved work is asked about on close; after a crash or power cut the last save is intact.

## Testability
- Engine and storage are tested with `cargo test` without a window; `--self-test` steps measure from the engine's state and the disk, never assume.
- With a thin UI little is left for screen tests; the screen is checked by the `cv check` picture and optionally a headless egui test.

## Never
- Business rules in the UI, window calls in the engine, the same rule in two places (one goes stale).
- A "temporary" hard-coded path or user name: paths go through `storage::data_dir()` (portable mode included).
