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
    let tags_exists = table_exists(con, "tags")?;
    let notes_exists = table_exists(con, "notes")?;
    let lists_exists = table_exists(con, "lists")?;

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

    // Tags: per-pack named tags with an optional color from the curated
    // palette. entry_tags is the many-to-many mapping. No migration needed
    // — these tables are new in v0.2.
    if !tags_exists {
        sql.push_str(
            "CREATE TABLE tags (
                 pack_id     TEXT NOT NULL,
                 name        TEXT NOT NULL,
                 color       TEXT,
                 created_at  TEXT NOT NULL,
                 PRIMARY KEY (pack_id, name)
             );
             CREATE TABLE entry_tags (
                 pack_id   TEXT NOT NULL,
                 entry_id  INTEGER NOT NULL,
                 tag_name  TEXT NOT NULL,
                 attached_at TEXT NOT NULL,
                 PRIMARY KEY (pack_id, entry_id, tag_name)
             );
             CREATE INDEX idx_entry_tags_lookup ON entry_tags(pack_id, entry_id);",
        );
    }

    // Notes: each entry can have N notes, ordered by created_at.
    if !notes_exists {
        sql.push_str(
            "CREATE TABLE notes (
                 id          INTEGER PRIMARY KEY AUTOINCREMENT,
                 pack_id     TEXT NOT NULL,
                 entry_id    INTEGER NOT NULL,
                 text        TEXT NOT NULL,
                 created_at  TEXT NOT NULL
             );
             CREATE INDEX idx_notes_entry ON notes(pack_id, entry_id, created_at DESC);",
        );
    }

    // Lists: user-created collections of entries with a glyph + color.
    if !lists_exists {
        sql.push_str(
            "CREATE TABLE lists (
                 id          INTEGER PRIMARY KEY AUTOINCREMENT,
                 pack_id     TEXT NOT NULL,
                 name        TEXT NOT NULL,
                 glyph       TEXT,
                 color       TEXT,
                 created_at  TEXT NOT NULL
             );
             CREATE INDEX idx_lists_pack ON lists(pack_id);
             CREATE TABLE list_entries (
                 list_id     INTEGER NOT NULL,
                 pack_id     TEXT NOT NULL,
                 entry_id    INTEGER NOT NULL,
                 headword    TEXT NOT NULL,
                 pos         TEXT,
                 added_at    TEXT NOT NULL,
                 PRIMARY KEY (list_id, entry_id)
             );
             CREATE INDEX idx_list_entries_list ON list_entries(list_id, added_at DESC);",
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

// -----------------------------------------------------------------
// Tags
// -----------------------------------------------------------------

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Tag {
    pub name: String,
    pub color: Option<String>,
    pub count: i64,
}

/// All tags defined for a pack, with how many entries each one is
/// attached to. Sorted alphabetically.
#[tauri::command]
pub fn list_tags(
    state: tauri::State<'_, UserState>,
    pack_id: String,
) -> AppResult<Vec<Tag>> {
    let con = lock(&state)?;
    let mut stmt = con.prepare(
        "SELECT t.name, t.color,
                (SELECT COUNT(*) FROM entry_tags et
                  WHERE et.pack_id = t.pack_id AND et.tag_name = t.name) AS count
           FROM tags t
          WHERE t.pack_id = ?
          ORDER BY t.name COLLATE NOCASE",
    )?;
    let rows = stmt
        .query_map(params![pack_id], |row| {
            Ok(Tag {
                name: row.get(0)?,
                color: row.get(1)?,
                count: row.get(2)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
}

/// Tags attached to a specific entry (in alphabetical order).
#[tauri::command]
pub fn entry_tags(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    entry_id: i64,
) -> AppResult<Vec<Tag>> {
    let con = lock(&state)?;
    let mut stmt = con.prepare(
        "SELECT t.name, t.color, 0
           FROM entry_tags et
           JOIN tags t ON t.pack_id = et.pack_id AND t.name = et.tag_name
          WHERE et.pack_id = ? AND et.entry_id = ?
          ORDER BY t.name COLLATE NOCASE",
    )?;
    let rows = stmt
        .query_map(params![pack_id, entry_id], |row| {
            Ok(Tag {
                name: row.get(0)?,
                color: row.get(1)?,
                count: row.get(2)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
}

/// Attach an existing or new tag to an entry. Creates the tag in the
/// tags table on first use (with the supplied color).
#[tauri::command]
pub fn add_entry_tag(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    entry_id: i64,
    name: String,
    color: Option<String>,
) -> AppResult<()> {
    let con = lock(&state)?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::Invalid("tag name is empty".into()));
    }
    let now = now_iso();
    con.execute(
        "INSERT INTO tags (pack_id, name, color, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(pack_id, name) DO UPDATE SET color = COALESCE(excluded.color, tags.color)",
        params![pack_id, name, color, now],
    )?;
    con.execute(
        "INSERT OR IGNORE INTO entry_tags (pack_id, entry_id, tag_name, attached_at)
         VALUES (?, ?, ?, ?)",
        params![pack_id, entry_id, name, now],
    )?;
    Ok(())
}

/// Detach a tag from one entry. The tag itself remains so its color
/// sticks if you re-attach it later.
#[tauri::command]
pub fn remove_entry_tag(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    entry_id: i64,
    name: String,
) -> AppResult<()> {
    let con = lock(&state)?;
    con.execute(
        "DELETE FROM entry_tags WHERE pack_id = ? AND entry_id = ? AND tag_name = ?",
        params![pack_id, entry_id, name],
    )?;
    Ok(())
}

#[tauri::command]
pub fn set_tag_color(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    name: String,
    color: Option<String>,
) -> AppResult<()> {
    lock(&state)?.execute(
        "UPDATE tags SET color = ? WHERE pack_id = ? AND name = ?",
        params![color, pack_id, name],
    )?;
    Ok(())
}

#[tauri::command]
pub fn rename_tag(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    old_name: String,
    new_name: String,
) -> AppResult<()> {
    let con = lock(&state)?;
    let new_name = new_name.trim().to_string();
    if new_name.is_empty() {
        return Err(AppError::Invalid("new tag name is empty".into()));
    }
    con.execute_batch("BEGIN;")?;
    let result: AppResult<()> = (|| {
        con.execute(
            "UPDATE tags SET name = ? WHERE pack_id = ? AND name = ?",
            params![new_name, pack_id, old_name],
        )?;
        con.execute(
            "UPDATE entry_tags SET tag_name = ? WHERE pack_id = ? AND tag_name = ?",
            params![new_name, pack_id, old_name],
        )?;
        Ok(())
    })();
    if result.is_err() {
        let _ = con.execute_batch("ROLLBACK;");
    } else {
        con.execute_batch("COMMIT;")?;
    }
    result
}

#[tauri::command]
pub fn delete_tag(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    name: String,
) -> AppResult<()> {
    let con = lock(&state)?;
    con.execute_batch("BEGIN;")?;
    let result: AppResult<()> = (|| {
        con.execute(
            "DELETE FROM entry_tags WHERE pack_id = ? AND tag_name = ?",
            params![pack_id, name],
        )?;
        con.execute(
            "DELETE FROM tags WHERE pack_id = ? AND name = ?",
            params![pack_id, name],
        )?;
        Ok(())
    })();
    if result.is_err() {
        let _ = con.execute_batch("ROLLBACK;");
    } else {
        con.execute_batch("COMMIT;")?;
    }
    result
}

// -----------------------------------------------------------------
// Notes
// -----------------------------------------------------------------

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Note {
    pub id: i64,
    pub text: String,
    pub created_at: String,
}

#[tauri::command]
pub fn list_notes(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    entry_id: i64,
) -> AppResult<Vec<Note>> {
    let con = lock(&state)?;
    let mut stmt = con.prepare(
        "SELECT id, text, created_at
           FROM notes
          WHERE pack_id = ? AND entry_id = ?
          ORDER BY created_at DESC",
    )?;
    let rows = stmt
        .query_map(params![pack_id, entry_id], |row| {
            Ok(Note {
                id: row.get(0)?,
                text: row.get(1)?,
                created_at: row.get(2)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn add_note(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    entry_id: i64,
    text: String,
) -> AppResult<i64> {
    let con = lock(&state)?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err(AppError::Invalid("note text is empty".into()));
    }
    con.execute(
        "INSERT INTO notes (pack_id, entry_id, text, created_at) VALUES (?, ?, ?, ?)",
        params![pack_id, entry_id, trimmed, now_iso()],
    )?;
    Ok(con.last_insert_rowid())
}

#[tauri::command]
pub fn delete_note(
    state: tauri::State<'_, UserState>,
    id: i64,
) -> AppResult<()> {
    lock(&state)?.execute("DELETE FROM notes WHERE id = ?", params![id])?;
    Ok(())
}

// -----------------------------------------------------------------
// Lists
// -----------------------------------------------------------------

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct List {
    pub id: i64,
    pub name: String,
    pub glyph: Option<String>,
    pub color: Option<String>,
    pub count: i64,
    pub created_at: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct ListEntry {
    pub entry_id: i64,
    pub headword: String,
    pub pos: Option<String>,
    pub added_at: String,
}

#[tauri::command]
pub fn list_lists(
    state: tauri::State<'_, UserState>,
    pack_id: String,
) -> AppResult<Vec<List>> {
    let con = lock(&state)?;
    let mut stmt = con.prepare(
        "SELECT l.id, l.name, l.glyph, l.color, l.created_at,
                (SELECT COUNT(*) FROM list_entries le WHERE le.list_id = l.id) AS count
           FROM lists l
          WHERE l.pack_id = ?
          ORDER BY l.created_at ASC",
    )?;
    let rows = stmt
        .query_map(params![pack_id], |row| {
            Ok(List {
                id: row.get(0)?,
                name: row.get(1)?,
                glyph: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
                count: row.get(5)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn create_list(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    name: String,
    glyph: Option<String>,
    color: Option<String>,
) -> AppResult<i64> {
    let con = lock(&state)?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::Invalid("list name is empty".into()));
    }
    con.execute(
        "INSERT INTO lists (pack_id, name, glyph, color, created_at) VALUES (?, ?, ?, ?, ?)",
        params![pack_id, name, glyph, color, now_iso()],
    )?;
    Ok(con.last_insert_rowid())
}

#[tauri::command]
pub fn rename_list(
    state: tauri::State<'_, UserState>,
    list_id: i64,
    name: String,
) -> AppResult<()> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::Invalid("list name is empty".into()));
    }
    lock(&state)?.execute(
        "UPDATE lists SET name = ? WHERE id = ?",
        params![name, list_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn set_list_glyph(
    state: tauri::State<'_, UserState>,
    list_id: i64,
    glyph: Option<String>,
) -> AppResult<()> {
    lock(&state)?.execute(
        "UPDATE lists SET glyph = ? WHERE id = ?",
        params![glyph, list_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn set_list_color(
    state: tauri::State<'_, UserState>,
    list_id: i64,
    color: Option<String>,
) -> AppResult<()> {
    lock(&state)?.execute(
        "UPDATE lists SET color = ? WHERE id = ?",
        params![color, list_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn delete_list(
    state: tauri::State<'_, UserState>,
    list_id: i64,
) -> AppResult<()> {
    let con = lock(&state)?;
    con.execute_batch("BEGIN;")?;
    let result: AppResult<()> = (|| {
        con.execute("DELETE FROM list_entries WHERE list_id = ?", params![list_id])?;
        con.execute("DELETE FROM lists WHERE id = ?", params![list_id])?;
        Ok(())
    })();
    if result.is_err() {
        let _ = con.execute_batch("ROLLBACK;");
    } else {
        con.execute_batch("COMMIT;")?;
    }
    result
}

#[tauri::command]
pub fn list_list_entries(
    state: tauri::State<'_, UserState>,
    list_id: i64,
) -> AppResult<Vec<ListEntry>> {
    let con = lock(&state)?;
    let mut stmt = con.prepare(
        "SELECT entry_id, headword, pos, added_at
           FROM list_entries
          WHERE list_id = ?
          ORDER BY added_at DESC",
    )?;
    let rows = stmt
        .query_map(params![list_id], |row| {
            Ok(ListEntry {
                entry_id: row.get(0)?,
                headword: row.get(1)?,
                pos: row.get(2)?,
                added_at: row.get(3)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn add_to_list(
    state: tauri::State<'_, UserState>,
    list_id: i64,
    pack_id: String,
    entry_id: i64,
    headword: String,
    pos: Option<String>,
) -> AppResult<()> {
    lock(&state)?.execute(
        "INSERT OR REPLACE INTO list_entries (list_id, pack_id, entry_id, headword, pos, added_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![list_id, pack_id, entry_id, headword, pos, now_iso()],
    )?;
    Ok(())
}

#[tauri::command]
pub fn remove_from_list(
    state: tauri::State<'_, UserState>,
    list_id: i64,
    entry_id: i64,
) -> AppResult<()> {
    lock(&state)?.execute(
        "DELETE FROM list_entries WHERE list_id = ? AND entry_id = ?",
        params![list_id, entry_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn lists_for_entry(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    entry_id: i64,
) -> AppResult<Vec<i64>> {
    let con = lock(&state)?;
    let mut stmt = con.prepare(
        "SELECT list_id FROM list_entries
           WHERE pack_id = ? AND entry_id = ?",
    )?;
    let ids = stmt
        .query_map(params![pack_id, entry_id], |row| row.get::<_, i64>(0))?
        .filter_map(Result::ok)
        .collect();
    Ok(ids)
}

// -----------------------------------------------------------------
// Tag-filtered entry lookup
// -----------------------------------------------------------------

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct TaggedEntry {
    pub entry_id: i64,
    pub headword: String,
    pub pos: Option<String>,
    pub attached_at: String,
}

#[tauri::command]
pub fn entries_with_tag(
    state: tauri::State<'_, UserState>,
    pack_id: String,
    name: String,
) -> AppResult<Vec<TaggedEntry>> {
    let con = lock(&state)?;
    // We need headword + pos for each entry; pull from the recents +
    // favorites + list_entries tables (everywhere we've stored them).
    // Tags don't carry headword themselves to keep the schema minimal.
    let mut stmt = con.prepare(
        "WITH known(entry_id, headword, pos) AS (
             SELECT entry_id, headword, pos FROM recents WHERE pack_id = ?1
             UNION
             SELECT entry_id, headword, pos FROM favorites WHERE pack_id = ?1
             UNION
             SELECT entry_id, headword, pos FROM list_entries WHERE pack_id = ?1
         )
         SELECT et.entry_id,
                COALESCE(k.headword, '#' || et.entry_id) AS headword,
                k.pos,
                et.attached_at
           FROM entry_tags et
           LEFT JOIN known k ON k.entry_id = et.entry_id
          WHERE et.pack_id = ?1 AND et.tag_name = ?2
          ORDER BY et.attached_at DESC",
    )?;
    let rows = stmt
        .query_map(params![pack_id, name], |row| {
            Ok(TaggedEntry {
                entry_id: row.get(0)?,
                headword: row.get(1)?,
                pos: row.get(2)?,
                attached_at: row.get(3)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();
    Ok(rows)
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
