//! User-local state — recents and favorites — stored in a separate SQLite
//! file in the app's data directory. Never mixed with the dictionary pack.
//!
//! Each row is namespaced by `pack_id` so that entries from `spanish-en`
//! and `french-en` (whose entry_ids are not globally unique) don't
//! collide. Existing single-pack data is migrated to `pack_id='spanish-en'`
//! the first time the new schema is loaded.

use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection};

use crate::error::{AppError, AppResult};
use crate::models::UserEntry;

pub struct UserState(pub Mutex<Connection>);

const RECENTS_CAP: i64 = 50;

pub fn open(path: &Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let con = Connection::open(path)?;
    migrate(&con)?;
    Ok(con)
}

/// Ensure the recents/favorites tables exist with the current schema. If
/// they exist with the legacy schema (no pack_id column), copy their rows
/// into the new schema, labeling every existing row as 'spanish-en'
/// (since that's the only pack that existed before this change).
fn migrate(con: &Connection) -> AppResult<()> {
    let recents_has_pack = column_exists(con, "recents", "pack_id")?;
    let favs_has_pack = column_exists(con, "favorites", "pack_id")?;
    let recents_exists = table_exists(con, "recents")?;
    let favs_exists = table_exists(con, "favorites")?;

    // If a table is missing entirely OR already on the new schema, we don't
    // need to migrate it. Only rename + copy when the legacy table is present.
    let mut sql = String::new();

    if recents_exists && !recents_has_pack {
        // Renaming the legacy table preserves its indexes by name, so we
        // must drop the legacy index before creating the new one with the
        // same name on the new table.
        sql.push_str(
            "ALTER TABLE recents RENAME TO recents_v1;
             DROP INDEX IF EXISTS idx_recents_opened;
             CREATE TABLE recents (
                 pack_id    TEXT NOT NULL,
                 entry_id   INTEGER NOT NULL,
                 headword   TEXT NOT NULL,
                 pos        TEXT,
                 opened_at  TEXT NOT NULL,
                 PRIMARY KEY (pack_id, entry_id)
             );
             CREATE INDEX idx_recents_opened ON recents(opened_at DESC);
             INSERT INTO recents (pack_id, entry_id, headword, pos, opened_at)
               SELECT 'spanish-en', entry_id, headword, pos, opened_at FROM recents_v1;
             DROP TABLE recents_v1;",
        );
    } else if !recents_exists {
        sql.push_str(
            "CREATE TABLE recents (
                 pack_id    TEXT NOT NULL,
                 entry_id   INTEGER NOT NULL,
                 headword   TEXT NOT NULL,
                 pos        TEXT,
                 opened_at  TEXT NOT NULL,
                 PRIMARY KEY (pack_id, entry_id)
             );
             CREATE INDEX idx_recents_opened ON recents(opened_at DESC);",
        );
    }

    if favs_exists && !favs_has_pack {
        sql.push_str(
            "ALTER TABLE favorites RENAME TO favorites_v1;
             DROP INDEX IF EXISTS idx_favorites_added;
             CREATE TABLE favorites (
                 pack_id   TEXT NOT NULL,
                 entry_id  INTEGER NOT NULL,
                 headword  TEXT NOT NULL,
                 pos       TEXT,
                 added_at  TEXT NOT NULL,
                 PRIMARY KEY (pack_id, entry_id)
             );
             CREATE INDEX idx_favorites_added ON favorites(added_at DESC);
             INSERT INTO favorites (pack_id, entry_id, headword, pos, added_at)
               SELECT 'spanish-en', entry_id, headword, pos, added_at FROM favorites_v1;
             DROP TABLE favorites_v1;",
        );
    } else if !favs_exists {
        sql.push_str(
            "CREATE TABLE favorites (
                 pack_id   TEXT NOT NULL,
                 entry_id  INTEGER NOT NULL,
                 headword  TEXT NOT NULL,
                 pos       TEXT,
                 added_at  TEXT NOT NULL,
                 PRIMARY KEY (pack_id, entry_id)
             );
             CREATE INDEX idx_favorites_added ON favorites(added_at DESC);",
        );
    }

    if !sql.is_empty() {
        con.execute_batch(&format!("BEGIN; {} COMMIT;", sql))?;
    }
    Ok(())
}

fn table_exists(con: &Connection, name: &str) -> AppResult<bool> {
    let r: rusqlite::Result<i64> = con.query_row(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        params![name],
        |row| row.get(0),
    );
    Ok(r.is_ok())
}

fn column_exists(con: &Connection, table: &str, column: &str) -> AppResult<bool> {
    if !table_exists(con, table)? {
        return Ok(false);
    }
    let mut stmt = con.prepare(&format!("PRAGMA table_info({})", table))?;
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(Result::ok)
        .collect();
    Ok(cols.iter().any(|c| c == column))
}

fn lock(state: &UserState) -> AppResult<std::sync::MutexGuard<'_, Connection>> {
    state.0.lock().map_err(|e| AppError::Lock(e.to_string()))
}

fn now_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let (y, mo, d) = days_to_ymd(days as i64);
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, mo, d, h, m, s)
}

/// Convert a count of days since 1970-01-01 to (year, month, day).
/// Howard Hinnant's algorithm; portable and avoids leap-year edge cases.
fn days_to_ymd(days: i64) -> (i32, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m, d)
}

#[tauri::command]
pub fn add_recent(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    entry_id: i64,
    headword: String,
    pos: Option<String>,
) -> AppResult<()> {
    let con = lock(&state)?;
    let now = now_iso();
    con.execute(
        "INSERT INTO recents (pack_id, entry_id, headword, pos, opened_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(pack_id, entry_id) DO UPDATE SET opened_at = excluded.opened_at",
        params![pack_id, entry_id, headword, pos, now],
    )?;
    // Trim to the cap *per pack* so each language pack keeps its own ring.
    con.execute(
        "DELETE FROM recents WHERE pack_id = ?
           AND entry_id NOT IN (
               SELECT entry_id FROM recents
                WHERE pack_id = ?
                ORDER BY opened_at DESC
                LIMIT ?
           )",
        params![pack_id, pack_id, RECENTS_CAP],
    )?;
    Ok(())
}

#[tauri::command]
pub fn list_recents(
    state: tauri::State<'_, UserState>,
    pack_id: String,
) -> AppResult<Vec<UserEntry>> {
    let con = lock(&state)?;
    let mut stmt = con.prepare(
        "SELECT entry_id, headword, pos, opened_at
           FROM recents
          WHERE pack_id = ?
          ORDER BY opened_at DESC LIMIT ?",
    )?;
    let rows = stmt
        .query_map(params![pack_id, RECENTS_CAP], |row| {
            Ok(UserEntry {
                entry_id: row.get(0)?,
                headword: row.get(1)?,
                pos: row.get(2)?,
                timestamp: row.get(3)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn clear_recents(
    state: tauri::State<'_, UserState>,
    pack_id: String,
) -> AppResult<()> {
    lock(&state)?.execute("DELETE FROM recents WHERE pack_id = ?", params![pack_id])?;
    Ok(())
}

#[tauri::command]
pub fn toggle_favorite(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    entry_id: i64,
    headword: String,
    pos: Option<String>,
) -> AppResult<bool> {
    let con = lock(&state)?;
    let exists: bool = con
        .query_row(
            "SELECT 1 FROM favorites WHERE pack_id = ? AND entry_id = ?",
            params![pack_id, entry_id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if exists {
        con.execute(
            "DELETE FROM favorites WHERE pack_id = ? AND entry_id = ?",
            params![pack_id, entry_id],
        )?;
        Ok(false)
    } else {
        con.execute(
            "INSERT INTO favorites (pack_id, entry_id, headword, pos, added_at)
             VALUES (?, ?, ?, ?, ?)",
            params![pack_id, entry_id, headword, pos, now_iso()],
        )?;
        Ok(true)
    }
}

#[tauri::command]
pub fn is_favorite(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    entry_id: i64,
) -> AppResult<bool> {
    let con = lock(&state)?;
    let exists: bool = con
        .query_row(
            "SELECT 1 FROM favorites WHERE pack_id = ? AND entry_id = ?",
            params![pack_id, entry_id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    Ok(exists)
}

#[tauri::command]
pub fn list_favorites(
    state: tauri::State<'_, UserState>,
    pack_id: String,
) -> AppResult<Vec<UserEntry>> {
    let con = lock(&state)?;
    let mut stmt = con.prepare(
        "SELECT entry_id, headword, pos, added_at
           FROM favorites
          WHERE pack_id = ?
          ORDER BY added_at DESC",
    )?;
    let rows = stmt
        .query_map(params![pack_id], |row| {
            Ok(UserEntry {
                entry_id: row.get(0)?,
                headword: row.get(1)?,
                pos: row.get(2)?,
                timestamp: row.get(3)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn export_favorites(
    state: tauri::State<'_, UserState>,
    dict_state: tauri::State<'_, crate::db::DictState>,
    pack_id: String,
    path: String,
    format: String,
) -> AppResult<usize> {
    let favs = list_favorites(state, pack_id.clone())?;

    let conns = dict_state
        .0
        .lock()
        .map_err(|e| AppError::Lock(e.to_string()))?;
    let dict = conns
        .get(&pack_id)
        .ok_or_else(|| AppError::Invalid(format!("unknown pack: {}", pack_id)))?;

    let mut out = String::new();
    match format.as_str() {
        "csv" => {
            out.push_str("headword,pos,gloss\n");
            for f in &favs {
                let gloss = first_gloss(dict, f.entry_id).unwrap_or_default();
                out.push_str(&csv_row(&[&f.headword, f.pos.as_deref().unwrap_or(""), &gloss]));
                out.push('\n');
            }
        }
        "tsv-anki" => {
            for f in &favs {
                let gloss = first_gloss(dict, f.entry_id).unwrap_or_default();
                let back = match f.pos.as_deref() {
                    Some(p) if !p.is_empty() => format!("({}) {}", p, gloss),
                    _ => gloss,
                };
                out.push_str(&f.headword.replace('\t', " "));
                out.push('\t');
                out.push_str(&back.replace('\t', " ").replace('\n', " "));
                out.push('\n');
            }
        }
        other => return Err(AppError::Invalid(format!("unknown format: {}", other))),
    }
    let bytes = out.as_bytes();
    std::fs::write(&path, bytes)?;
    Ok(bytes.len())
}

fn first_gloss(con: &Connection, entry_id: i64) -> Option<String> {
    con.query_row(
        "SELECT definition FROM senses WHERE entry_id = ? ORDER BY sense_number LIMIT 1",
        params![entry_id],
        |row| row.get::<_, String>(0),
    )
    .ok()
}

fn csv_row(cells: &[&str]) -> String {
    cells
        .iter()
        .map(|c| {
            if c.contains(',') || c.contains('"') || c.contains('\n') {
                format!("\"{}\"", c.replace('"', "\"\""))
            } else {
                (*c).to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(",")
}
