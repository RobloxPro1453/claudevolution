//! {{title}}: entry point. Arguments first (the checks start the app this way), then the window.
//!   --version                 prints the version
//!   --self-test <file.json>   checks the core use without a window, writes the steps, exits 0/1
//!   --screenshot <file.png>   opens without taking focus, draws ~120 frames, saves a PNG, exits
// No console window behind the app in a release build (double-click starts only the window).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine;
mod selftest;
mod storage;
mod ui;

use eframe::egui;
use std::path::PathBuf;

fn arg_after(args: &[String], flag: &str) -> Option<PathBuf> {
    args.iter().position(|a| a == flag).and_then(|i| args.get(i + 1)).map(PathBuf::from)
}

/// A start that never reached a window leaves this mark (a graphics driver that crashes takes the
/// whole process); the next start then draws with the software renderer (WARP) instead of the GPU.
/// craft-anything apps/craft-anything/src/start_guard.rs idea (MIT OR Apache-2.0).
fn start_mark(dir: &std::path::Path) -> PathBuf {
    dir.join("starting")
}

fn main() -> eframe::Result {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.iter().any(|a| a == "--version" || a == "-V") {
        println!("{{crate}} {}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    if let Some(out) = arg_after(&args, "--self-test") {
        let passed = selftest::run(&out).unwrap_or(false);
        std::process::exit(if passed { 0 } else { 1 });
    }
    let shot = arg_after(&args, "--screenshot");

    let dir = storage::data_dir();
    let file = dir.join(storage::FILE_NAME);
    let (engine, status) = match storage::load(&file) {
        storage::Loaded::New(doc) => (engine::Engine::new(doc), "Yeni belge".to_string()),
        storage::Loaded::Read(doc) => (engine::Engine::new(doc), String::new()),
        storage::Loaded::Unreadable { kept, why } => (
            engine::Engine::new(engine::Doc { version: engine::DOC_VERSION, items: Vec::new() }),
            format!("Kayıt okunamadı ({why}); dosyanız korundu: {}", kept.display()),
        ),
    };
    let last_failed = shot.is_none() && start_mark(&dir).is_file();
    if shot.is_none() {
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(start_mark(&dir), b"");
    }

    let mut viewport = egui::ViewportBuilder::default().with_title("{{title}}").with_inner_size([1100.0, 720.0]).with_min_inner_size([640.0, 420.0]);
    if shot.is_some() {
        // A check must never take the person's focus: open inactive, and on Windows behind other windows.
        viewport = viewport.with_active(false);
        if cfg!(windows) {
            viewport = viewport.with_window_level(egui::WindowLevel::AlwaysOnBottom);
        }
    }
    let mut options = eframe::NativeOptions { viewport, ..Default::default() };
    #[cfg(windows)]
    if let eframe::egui_wgpu::WgpuSetup::CreateNew(setup) = &mut options.wgpu_options.wgpu_setup {
        // DX12 only: starting GL or Vulkan loads drivers that crash on some Intel systems before any window.
        setup.instance_descriptor.backends = eframe::wgpu::Backends::DX12;
        if last_failed || std::env::var("APP_RENDERER").is_ok_and(|v| v == "software") {
            setup.native_adapter_selector = Some(std::sync::Arc::new(|adapters: &[eframe::wgpu::Adapter], _surface: Option<&eframe::wgpu::Surface<'_>>| {
                adapters
                    .iter()
                    .find(|a| a.get_info().device_type == eframe::wgpu::DeviceType::Cpu)
                    .or_else(|| adapters.first())
                    .cloned()
                    .ok_or_else(|| "no graphics adapter".to_string())
            }));
        }
    }
    #[cfg(not(windows))]
    let _ = (&mut options, last_failed);

    let mark_dir = dir.clone();
    let result = eframe::run_native(
        "{{title}}",
        options,
        Box::new(move |_cc| {
            // The window is up: the start worked, clear the mark.
            let _ = std::fs::remove_file(start_mark(&mark_dir));
            Ok(Box::new(ui::App::new(engine, file, status, shot)))
        }),
    );
    result
}
