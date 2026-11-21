//! `--self-test <file.json>`: the app checks its own core use and writes what it measured
//! (contract: `cv check contract`). Each step is measured from the engine's state and from the disk,
//! never assumed. Runs without a window, in a temporary data folder: the person's data is never touched.
//! Add one step per thing the person must be able to do (config check.selfTest.steps names them).

use crate::engine::{DOC_VERSION, Doc, Engine};
use crate::storage::{FILE_NAME, Loaded, load, save};
use serde_json::json;
use std::path::Path;

pub fn run(out: &Path) -> std::io::Result<bool> {
    let dir = std::env::temp_dir().join(format!("{{crate}}-self-test-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    let file = dir.join(FILE_NAME);
    let mut steps = Vec::new();
    let mut step = |name: &str, passed: bool, detail: String| steps.push(json!({ "step": name, "passed": passed, "detail": detail }));

    let mut e = Engine::new(Doc { version: DOC_VERSION, items: Vec::new() });
    let i = e.create("Self-test");
    let edited = e.edit(i, "measured, not assumed");
    step("create", e.doc.items.len() == 1 && edited && e.dirty, format!("{} item(s), dirty={}", e.doc.items.len(), e.dirty));

    let saved = save(&file, &e.doc);
    let size = std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0);
    step("save", saved.is_ok() && size > 0, format!("{size} bytes on disk{}", saved.err().map(|x| format!(", error: {x}")).unwrap_or_default()));

    let reopened = matches!(load(&file), Loaded::Read(ref d) if *d == e.doc);
    step("reopen", reopened, if reopened { "the saved document reads back the same".into() } else { "what was read differs from what was saved".into() });

    let hits = e.search("MEASURED");
    step("search", hits == vec![i], format!("{} hit(s)", hits.len()));

    let _ = std::fs::remove_dir_all(&dir);
    let all = steps.iter().all(|s| s["passed"] == json!(true));
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(out, serde_json::to_vec_pretty(&json!({ "version": 1, "steps": steps }))?)?;
    Ok(all)
}
