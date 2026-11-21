//! Engine: the app's state and rules, with no window and no disk. Everything the person can do is a
//! method here, so the self-test, the UI and future tools call the same code (Engine -> Tools -> thin UI).

use serde::{Deserialize, Serialize};

/// One item the app keeps. Replace with the app's own model; keep it plain data.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Item {
    pub title: String,
    pub body: String,
}

/// The whole document: what is saved and reopened.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Doc {
    /// Format version of the saved file; bump it and add a step in `storage::upgrade` to change the format.
    pub version: u32,
    pub items: Vec<Item>,
}

pub const DOC_VERSION: u32 = 1;

#[derive(Debug, Default)]
pub struct Engine {
    pub doc: Doc,
    /// Unsaved changes: closing asks to keep them (never lose work silently).
    pub dirty: bool,
    pub selected: Option<usize>,
}

impl Engine {
    pub fn new(doc: Doc) -> Self {
        Self { doc, dirty: false, selected: None }
    }

    pub fn create(&mut self, title: &str) -> usize {
        self.doc.items.push(Item { title: title.trim().to_string(), body: String::new() });
        self.dirty = true;
        self.selected = Some(self.doc.items.len() - 1);
        self.doc.items.len() - 1
    }

    pub fn edit(&mut self, index: usize, body: &str) -> bool {
        match self.doc.items.get_mut(index) {
            Some(item) if item.body != body => {
                item.body = body.to_string();
                self.dirty = true;
                true
            }
            _ => false,
        }
    }

    pub fn search(&self, query: &str) -> Vec<usize> {
        let q = query.to_lowercase();
        self.doc
            .items
            .iter()
            .enumerate()
            .filter(|(_, i)| i.title.to_lowercase().contains(&q) || i.body.to_lowercase().contains(&q))
            .map(|(n, _)| n)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_edit_search() {
        let mut e = Engine::default();
        let i = e.create("Alışveriş");
        assert!(e.edit(i, "süt, ekmek"));
        assert!(!e.edit(i, "süt, ekmek"), "same text is no change");
        assert_eq!(e.search("EKMEK"), vec![i]);
        assert!(e.dirty);
    }
}
