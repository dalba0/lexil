// Don't open a console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod error;
mod models;
mod normalize;
mod user;

use std::collections::HashMap;
use std::sync::Mutex;

use tauri::Manager;

// Packs we know how to load. The frontend asks for them by id; only the
// ones whose .db file actually ships in the bundle end up open. Adding a
// new language is appending to this list (and shipping the .db).
const KNOWN_PACKS: &[&str] = &["spanish-en", "french-en"];

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Open every known pack whose file exists in resources/. Packs
            // missing on disk are silently skipped so dev builds still work
            // when only a subset is present.
            let mut conns: HashMap<String, rusqlite::Connection> = HashMap::new();
            for pack_id in KNOWN_PACKS {
                let resource = format!("resources/{}.db", pack_id);
                let path = match app
                    .path()
                    .resolve(&resource, tauri::path::BaseDirectory::Resource)
                {
                    Ok(p) => p,
                    Err(_) => continue,
                };
                if !path.exists() {
                    eprintln!("[lexil] pack not found, skipping: {}", path.display());
                    continue;
                }
                match db::open(&path) {
                    Ok(con) => {
                        eprintln!("[lexil] loaded pack: {} ({})", pack_id, path.display());
                        conns.insert((*pack_id).to_string(), con);
                    }
                    Err(e) => {
                        eprintln!("[lexil] failed to open {}: {}", path.display(), e);
                    }
                }
            }
            if conns.is_empty() {
                return Err("no dictionary packs found in resources/".into());
            }
            app.manage(db::DictState(Mutex::new(conns)));

            // User state lives next to other app data — recents + favorites.
            let user_dir = app.path().app_data_dir()?;
            let user_path = user_dir.join("lexil-user.db");
            let user_con = user::open(&user_path)
                .map_err(|e| Box::<dyn std::error::Error>::from(e.to_string()))?;
            app.manage(user::UserState(Mutex::new(user_con)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::list_packs,
            db::search,
            db::search_reverse,
            db::get_entry,
            db::pack_meta,
            user::add_recent,
            user::list_recents,
            user::clear_recents,
            user::toggle_favorite,
            user::is_favorite,
            user::list_favorites,
            user::export_favorites,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
