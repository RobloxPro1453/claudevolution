//! Disk: where data lives, atomic saves, and reading old files. No UI here.
//!
//! - Portable mode: a `portable.txt` beside the .exe keeps the data in a `data` folder next to it
//!   (a USB stick); otherwise the user's data folder (%APPDATA%\{{title}} on Windows).
//! - A save never leaves a cut file: write a new temp file beside the target, flush it, then rename
//!   over it; on Windows the rename is retried briefly (an antivirus scan holds fresh files).
//! - A file that exists but cannot be read is never replaced by an empty document: it is kept
//!   (copied aside) and the app says so, instead of saving defaults over the person's data.

use crate::engine::{DOC_VERSION, Doc};
use std::io::Write;
use std::path::{Path, PathBuf};

pub const FILE_NAME: &str = "data.json";

pub fn data_dir() -> PathBuf {
    if let Ok(exe) = std::env::current_exe()
        && let Some(dir) = exe.parent()
        && dir.join("portable.txt").is_file()
    {
        return dir.join("data");
    }
    let base = std::env::var_os("APPDATA")
        .or_else(|| std::env::var_os("XDG_DATA_HOME"))
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local").join("share")))
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("{{title}}")
}

/// Atomic write: temp file in the same folder, flushed, renamed over the target.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let dir = path.parent().unwrap_or(Path::new("."));
    std::fs::create_dir_all(dir)?;
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("file");
    let tmp = dir.join(format!(".{name}.{}.tmp", std::process::id()));
    {
        let mut f = std::fs::OpenOptions::new().write(true).create_new(true).open(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    let mut tries = 0;
    loop {
        match std::fs::rename(&tmp, path) {
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied && tries < 12 => {
                tries += 1;
                std::thread::sleep(std::time::Duration::from_millis(10u64 << tries.min(4)));
            }
            Err(e) => {
                let _ = std::fs::remove_file(&tmp);
                return Err(e);
            }
            Ok(()) => return Ok(()),
        }
    }
}

pub enum Loaded {
    /// No file yet: a fresh, empty document.
    New(Doc),
    Read(Doc),
    /// The file is there but unreadable; it was copied to `kept` and must not be overwritten silently.
    Unreadable { kept: PathBuf, why: String },
}

pub fn load(path: &Path) -> Loaded {
    let bytes = match std::fs::read(path) {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Loaded::New(Doc { version: DOC_VERSION, items: Vec::new() }),
        Err(e) => return Loaded::Unreadable { kept: path.to_path_buf(), why: e.to_string() },
    };
    match serde_json::from_slice::<serde_json::Value>(&bytes).map_err(|e| e.to_string()).and_then(upgrade) {
        Ok(doc) => Loaded::Read(doc),
        Err(why) => {
            let kept = path.with_extension(format!("unreadable-{}.json", std::process::id()));
            let _ = std::fs::copy(path, &kept);
            Loaded::Unreadable { kept, why }
        }
    }
}

/// Brings an older saved file to the current format, one numbered step at a time; a newer one is refused.
pub fn upgrade(mut raw: serde_json::Value) -> Result<Doc, String> {
    let from = raw.get("version").and_then(|v| v.as_u64()).unwrap_or(1) as u32;
    if from > DOC_VERSION {
        return Err(format!("saved by a newer version (format {from}, this one reads {DOC_VERSION})"));
    }
    // Steps go here: `if from < 2 { /* rewrite raw from 1 to 2 */ }` ...
    raw["version"] = serde_json::json!(DOC_VERSION);
    serde_json::from_value(raw).map_err(|e| e.to_string())
}

/// The window's picture for --screenshot (RGBA, 8 bits), written by the storage layer like any file.
pub fn write_png(path: &Path, size: [usize; 2], rgba: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let file = std::fs::File::create(path)?;
    let mut enc = png::Encoder::new(std::io::BufWriter::new(file), size[0] as u32, size[1] as u32);
    enc.set_color(png::ColorType::Rgba);
    enc.set_depth(png::BitDepth::Eight);
    let mut writer = enc.write_header().map_err(std::io::Error::other)?;
    writer.write_image_data(rgba).map_err(std::io::Error::other)
}

pub fn save(path: &Path, doc: &Doc) -> std::io::Result<()> {
    let text = serde_json::to_vec_pretty(doc).map_err(std::io::Error::other)?;
    write_atomic(path, &text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_reopen_and_keep_unreadable() {
        let dir = std::env::temp_dir().join(format!("tmpl-storage-{}", std::process::id()));
        let file = dir.join(FILE_NAME);
        let _ = std::fs::remove_dir_all(&dir);
        assert!(matches!(load(&file), Loaded::New(_)));
        let doc = Doc { version: DOC_VERSION, items: vec![crate::engine::Item { title: "a".into(), body: "b".into() }] };
        save(&file, &doc).unwrap();
        assert!(matches!(load(&file), Loaded::Read(d) if d == doc));
        std::fs::write(&file, b"{broken").unwrap();
        assert!(matches!(load(&file), Loaded::Unreadable { .. }), "a broken file is never read as empty");
        assert_eq!(std::fs::read(&file).unwrap(), b"{broken", "and it is left as it was");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
