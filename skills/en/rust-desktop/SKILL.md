---
name: rust-desktop
description: Rules for building, checking and delivering a Rust desktop app as an install-free double-click single .exe (egui by default, Tauri only when web content is needed); loaded only in a Rust desktop project.
---

Source: Craft Anything `pitfalls.md` "Building and running" + `packaging/windows/` (MIT OR Apache-2.0). The skeleton already carries most of this: `cv stack new rust-egui --name "<name>"`.

## Start
- Stack: `cv stack suggest "<request>"` (the owner's word beats the default). egui by default; Tauri only when the app needs real web content inside (WebView2; installed with one approval if missing).
- Multi-pane/tabbed layout: `templates/stacks.json` > `craftLibs` map (craft-ui docking etc.); the version is **pinned** (`tag` or full `rev`), never `main`, and checked with `cargo check` in a trial project first.

## One .exe and start-up
- `windows_subsystem = "windows"` (no console window), `+crt-static` (no Visual C++ needed), release profile LTO + strip.
- DX12 only on Windows; merely starting GL/Vulkan crashed old Intel drivers silently at start. If the last start never reached a window, the software renderer (WARP).
- Child processes open no console window (`CREATE_NO_WINDOW`).
- Portable mode: with `portable.txt` beside the exe, data lives in the `data/` folder next to it.

## Building and trying
- Never guess the API: read the source of the version you use (`~/.cargo/registry/src/*/egui-<version>/`); method names shift between versions.
- A running exe cannot be rebuilt ("Access is denied"): close the program while trying, or a separate `CARGO_TARGET_DIR`.
- The program to start is declared by `Cargo.toml` `default-run`; the newest file in `target/` is not the app.
- Every round: `cargo test` (engine, storage) + `cv check` (does the window draw, `--self-test` steps). Not "done" before `cv check` passes.
- Long inputs through a file, not the command line (Windows 32,767-character limit); Windows paths with `\`.

## Delivery (to the owner)
- `cargo build --release` → `target/release/<name>.exe` (this path is `finalForm.deliverable`).
- The "one exe" promise is checked: the `cv check` `single-exe` step reads the DLLs the exe needs; a DLL Windows does not ship (e.g. `libunwind.dll` from a MinGW toolchain) fails it. The fix is the static C runtime (`-C target-feature=+crt-static` in `.cargo/config.toml`).
- Windows SmartScreen warns on an unsigned exe: the delivery note says in plain words "More info → Run anyway"; code signing is optional.
- Delivery note: what was built, how to open it, where the data lives, portable mode; no technical terms.
