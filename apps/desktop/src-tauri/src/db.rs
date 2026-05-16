//! Read-only access to bundled dictionary packs.
//!
//! Multiple packs (e.g. spanish-en, french-en) can be loaded at once; each
//! lives behind a stable string id matched to the filename without the
//! `.db` suffix. Every command takes the pack_id explicitly so the
//! backend stays stateless — the frontend always knows which pack it
//! wants and there's no implicit "active" mode to drift.

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection, OpenFlags};

use crate::error::{AppError, AppResult};
use crate::models::{Entry, Example, Inflection, SearchResult, Sense};
use crate::normalize::normalize;

pub struct DictState(pub Mutex<HashMap<String, Connection>>);

pub fn open(path: &Path) -> AppResult<Connection> {
    let con = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    con.execute_batch("PRAGMA query_only = ON;")?;
    Ok(con)
}

/// Look up a pack by id and run `f` with its connection. Centralizes the
/// "pack_id not found" error path so every command reports it the same way.
fn with_pack<T>(
    state: &tauri::State<'_, DictState>,
    pack_id: &str,
    f: impl FnOnce(&Connection) -> AppResult<T>,
) -> AppResult<T> {
    let conns = state
        .0
        .lock()
        .map_err(|e| AppError::Lock(e.to_string()))?;
    let con = conns
        .get(pack_id)
        .ok_or_else(|| AppError::Invalid(format!("unknown pack: {}", pack_id)))?;
    f(con)
}

#[tauri::command]
pub fn list_packs(state: tauri::State<'_, DictState>) -> AppResult<Vec<String>> {
    let conns = state.0.lock().map_err(|e| AppError::Lock(e.to_string()))?;
    let mut ids: Vec<String> = conns.keys().cloned().collect();
    ids.sort();
    Ok(ids)
}

#[tauri::command]
pub fn search(
    state: tauri::State<'_, DictState>,
    pack_id: String,
    query: String,
    limit: i64,
) -> AppResult<Vec<SearchResult>> {
    with_pack(&state, &pack_id, |con| {
        let q_norm = normalize(&query);
        if q_norm.is_empty() {
            return Ok(vec![]);
        }
        let limit = limit.clamp(1, 100);

        let fts_query = format!("headword_normalized:{}*", q_norm);
        let mut stmt = con.prepare_cached(
            "SELECT e.id, e.headword, e.pos, e.gender,
                    (SELECT s.definition FROM senses s
                      WHERE s.entry_id = e.id
                      ORDER BY s.sense_number LIMIT 1) AS gloss
               FROM entries_fts f
               JOIN entries e ON e.id = f.rowid
              WHERE entries_fts MATCH ?
              ORDER BY rank
              LIMIT ?",
        )?;
        let direct: Vec<SearchResult> = stmt
            .query_map(params![fts_query, limit], |row| {
                Ok(SearchResult {
                    entry_id: row.get(0)?,
                    headword: row.get(1)?,
                    pos: row.get(2)?,
                    gender: row.get(3)?,
                    gloss_preview: row.get(4)?,
                    matched_form: None,
                })
            })?
            .filter_map(Result::ok)
            .collect();

        let mut seen: HashSet<i64> = direct.iter().map(|r| r.entry_id).collect();

        let mut stmt = con.prepare_cached(
            "SELECT e.id, e.headword, e.pos, e.gender, i.form,
                    (SELECT s.definition FROM senses s
                      WHERE s.entry_id = e.id
                      ORDER BY s.sense_number LIMIT 1) AS gloss
               FROM inflections i
               JOIN entries e ON e.id = i.entry_id
              WHERE i.form_normalized = ?
              ORDER BY e.id
              LIMIT ?",
        )?;
        let inflected: Vec<SearchResult> = stmt
            .query_map(params![q_norm, limit], |row| {
                Ok(SearchResult {
                    entry_id: row.get(0)?,
                    headword: row.get(1)?,
                    pos: row.get(2)?,
                    gender: row.get(3)?,
                    matched_form: row.get(4)?,
                    gloss_preview: row.get(5)?,
                })
            })?
            .filter_map(Result::ok)
            .collect();

        let mut out = direct;
        for r in inflected {
            if seen.insert(r.entry_id) {
                out.push(r);
            }
        }
        out.truncate(limit as usize);
        Ok(out)
    })
}

/// Build an FTS5 query for reverse lookup. We strip anything that isn't a
/// word character, then append `*` to every token so an incomplete word
/// ("hous") still matches "house". Multi-word queries become an implicit
/// AND ("to run" → "to* run*").
fn build_reverse_fts_query(q: &str) -> String {
    q.split_whitespace()
        .filter_map(|w| {
            let cleaned: String = w
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '\'')
                .collect();
            if cleaned.is_empty() {
                None
            } else {
                Some(format!("{}*", cleaned))
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[tauri::command]
pub fn search_reverse(
    state: tauri::State<'_, DictState>,
    pack_id: String,
    query: String,
    limit: i64,
) -> AppResult<Vec<SearchResult>> {
    with_pack(&state, &pack_id, |con| {
        let q = query.trim();
        if q.is_empty() {
            return Ok(vec![]);
        }
        let limit = limit.clamp(1, 100);

        let fts_query = build_reverse_fts_query(q);
        if fts_query.is_empty() {
            return Ok(vec![]);
        }

        let pull_limit = (limit * 4).min(400);

        let mut stmt = con.prepare_cached(
            "SELECT e.id, e.headword, e.pos, e.gender, s.definition, rank
               FROM senses_fts f
               JOIN senses s ON s.id = f.rowid
               JOIN entries e ON e.id = s.entry_id
              WHERE senses_fts MATCH ?
              ORDER BY rank
              LIMIT ?",
        )?;
        let rows: Vec<(SearchResult, f64)> = stmt
            .query_map(params![fts_query, pull_limit], |row| {
                Ok((
                    SearchResult {
                        entry_id: row.get(0)?,
                        headword: row.get(1)?,
                        pos: row.get(2)?,
                        gender: row.get(3)?,
                        gloss_preview: row.get(4)?,
                        matched_form: None,
                    },
                    row.get::<_, f64>(5).unwrap_or(0.0),
                ))
            })?
            .filter_map(Result::ok)
            .collect();

        let mut seen: HashSet<i64> = HashSet::new();
        let mut out: Vec<SearchResult> = Vec::new();
        for (r, _rank) in rows {
            if seen.insert(r.entry_id) {
                out.push(r);
                if out.len() >= limit as usize {
                    break;
                }
            }
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn get_entry(
    state: tauri::State<'_, DictState>,
    pack_id: String,
    id: i64,
) -> AppResult<Entry> {
    with_pack(&state, &pack_id, |con| {
        let mut entry: Entry = con
            .query_row(
                "SELECT id, headword, headword_normalized, pos, gender, ipa
                   FROM entries WHERE id = ?",
                params![id],
                |row| {
                    Ok(Entry {
                        id: row.get(0)?,
                        headword: row.get(1)?,
                        headword_normalized: row.get(2)?,
                        pos: row.get(3)?,
                        gender: row.get(4)?,
                        ipa: row.get(5)?,
                        senses: Vec::new(),
                        inflections: Vec::new(),
                    })
                },
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => AppError::NotFound,
                other => AppError::Sqlite(other),
            })?;

        let mut stmt = con.prepare_cached(
            "SELECT id, sense_number, definition, register, domain
               FROM senses WHERE entry_id = ? ORDER BY sense_number",
        )?;
        let mut senses: Vec<Sense> = stmt
            .query_map(params![id], |row| {
                Ok(Sense {
                    id: row.get(0)?,
                    sense_number: row.get(1)?,
                    definition: row.get(2)?,
                    register: row.get(3)?,
                    domain: row.get(4)?,
                    examples: Vec::new(),
                })
            })?
            .filter_map(Result::ok)
            .collect();

        let mut ex_stmt = con.prepare_cached(
            "SELECT text, translation FROM examples WHERE sense_id = ?",
        )?;
        for s in senses.iter_mut() {
            s.examples = ex_stmt
                .query_map(params![s.id], |row| {
                    Ok(Example {
                        text: row.get(0)?,
                        translation: row.get(1)?,
                    })
                })?
                .filter_map(Result::ok)
                .collect();
        }
        entry.senses = senses;

        let mut stmt = con.prepare_cached(
            "SELECT form, tags FROM inflections WHERE entry_id = ?",
        )?;
        entry.inflections = stmt
            .query_map(params![id], |row| {
                Ok(Inflection {
                    form: row.get(0)?,
                    tags: row.get(1)?,
                })
            })?
            .filter_map(Result::ok)
            .collect();

        Ok(entry)
    })
}

#[tauri::command]
pub fn pack_meta(
    state: tauri::State<'_, DictState>,
    pack_id: String,
) -> AppResult<HashMap<String, String>> {
    with_pack(&state, &pack_id, |con| {
        let mut stmt = con.prepare("SELECT key, value FROM pack_meta")?;
        let pairs: HashMap<String, String> = stmt
            .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?
            .filter_map(Result::ok)
            .collect();
        Ok(pairs)
    })
}
