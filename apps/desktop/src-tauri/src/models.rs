//! Wire types shared between the Rust commands and the React frontend.
//!
//! The frontend has a mirror of these in `src/lib/types.ts`; keep them in
//! sync. Field names match exactly because serde serializes with no rename
//! convention and TS reads them as-is.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub entry_id: i64,
    pub headword: String,
    pub pos: Option<String>,
    pub gender: Option<String>,
    pub gloss_preview: Option<String>,
    /// Set when the user's query matched an inflected form rather than the
    /// headword itself — e.g. typing "corro" yields correr with
    /// matched_form = "corro".
    pub matched_form: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub id: i64,
    pub headword: String,
    pub headword_normalized: String,
    pub pos: Option<String>,
    pub gender: Option<String>,
    pub ipa: Option<String>,
    pub senses: Vec<Sense>,
    pub inflections: Vec<Inflection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sense {
    pub id: i64,
    pub sense_number: i64,
    pub definition: String,
    pub register: Option<String>,
    pub domain: Option<String>,
    pub examples: Vec<Example>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Example {
    pub text: String,
    pub translation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Inflection {
    pub form: String,
    pub tags: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserEntry {
    pub entry_id: i64,
    pub headword: String,
    pub pos: Option<String>,
    pub timestamp: String,
}
