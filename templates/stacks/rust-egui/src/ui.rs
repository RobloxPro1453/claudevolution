//! Thin UI: draws the engine's state and turns clicks into engine calls. No rules and no disk here.
//! Design rules (desktop-design skill): one accent colour, spacing on a 4/8 grid, text contrast at
//! least 4.5:1, no reading files while drawing, no busy spinner that redraws forever.

use crate::engine::Engine;
use crate::storage;
use eframe::egui;
use std::path::PathBuf;
use std::sync::Arc;

pub struct App {
    pub engine: Engine,
    pub file: PathBuf,
    pub status: String,
    query: String,
    new_title: String,
    /// --screenshot: save the window's picture here after `frames` frames, then close.
    pub shot: Option<PathBuf>,
    /// How many frames to draw before saving (env CV_SHOT_FRAMES, 120 by default).
    shot_frames: u32,
    frames: u32,
    asked: bool,
}

impl App {
    pub fn new(engine: Engine, file: PathBuf, status: String, shot: Option<PathBuf>) -> Self {
        // A check may ask for another frame count: the layout must look the same at frame 360 as at 120.
        let shot_frames = std::env::var("CV_SHOT_FRAMES").ok().and_then(|v| v.trim().parse().ok()).unwrap_or(120);
        Self { engine, file, status, query: String::new(), new_title: String::new(), shot, shot_frames, frames: 0, asked: false }
    }

    fn save(&mut self) {
        // Disk first, memory after: a failed save keeps "unsaved" and says why where the person looks.
        match storage::save(&self.file, &self.engine.doc) {
            Ok(()) => {
                self.engine.dirty = false;
                self.status = "Kaydedildi".into();
            }
            Err(e) => self.status = format!("Kaydedilemedi: {e}"),
        }
    }

    fn screenshot_step(&mut self, ctx: &egui::Context) {
        let Some(path) = self.shot.clone() else { return };
        self.frames += 1;
        ctx.request_repaint(); // keep drawing while unfocused, or the picture never comes
        if self.frames >= self.shot_frames && !self.asked {
            self.asked = true;
            let closer = ctx.clone();
            ctx.request_screenshot(move |image: Arc<egui::ColorImage>| {
                let _ = storage::write_png(&path, image.size, &image.pixels.iter().flat_map(|c| c.to_array()).collect::<Vec<u8>>());
                closer.send_viewport_cmd(egui::ViewportCommand::Close);
            });
        }
    }
}

impl eframe::App for App {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        self.screenshot_step(&ctx);
        if ctx.input(|i| i.modifiers.command && i.key_pressed(egui::Key::S)) {
            self.save();
        }
        egui::Panel::top("bar").show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.heading("{{title}}");
                ui.separator();
                if ui.button("Kaydet (Ctrl+S)").clicked() {
                    self.save();
                }
                ui.label(if self.engine.dirty { "• kaydedilmemiş" } else { "" });
                ui.separator();
                ui.label(&self.status);
            });
        });
        egui::Panel::left("list").resizable(true).default_size(240.0).show(ui, |ui| {
            ui.add(egui::TextEdit::singleline(&mut self.query).hint_text("Ara…"));
            ui.horizontal(|ui| {
                ui.add(egui::TextEdit::singleline(&mut self.new_title).hint_text("Yeni başlık").desired_width(140.0));
                if ui.button("Ekle").clicked() && !self.new_title.trim().is_empty() {
                    self.engine.create(&self.new_title);
                    self.new_title.clear();
                }
            });
            ui.separator();
            let shown: Vec<usize> = if self.query.is_empty() { (0..self.engine.doc.items.len()).collect() } else { self.engine.search(&self.query) };
            for i in shown {
                let selected = self.engine.selected == Some(i);
                if ui.selectable_label(selected, &self.engine.doc.items[i].title).clicked() {
                    self.engine.selected = Some(i);
                }
            }
        });
        egui::CentralPanel::default().show(ui, |ui| match self.engine.selected {
            Some(i) if i < self.engine.doc.items.len() => {
                let mut body = self.engine.doc.items[i].body.clone();
                ui.heading(&self.engine.doc.items[i].title);
                if ui.add_sized(ui.available_size(), egui::TextEdit::multiline(&mut body)).changed() {
                    self.engine.edit(i, &body);
                }
            }
            _ => {
                ui.centered_and_justified(|ui| ui.label("Soldan bir öğe seçin ya da yenisini ekleyin."));
            }
        });
    }
}
