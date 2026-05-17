// Don't open a console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod error;
mod models;
mod normalize;
mod pack_manager;
mod user;

use std::collections::HashMap;
use std::sync::Mutex;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Open every pack the user has downloaded into the app data
            // dir. Empty on first launch (user picks packs in onboarding).
            let mut conns: HashMap<String, rusqlite::Connection> = HashMap::new();
            match pack_manager::scan_installed(&app.handle()) {
                Ok(installed) => {
                    for pack in installed {
                        let path = std::path::PathBuf::from(&pack.path);
                        match db::open(&path) {
                            Ok(con) => {
                                eprintln!(
                                    "[lexil] loaded pack: {} ({})",
                                    pack.id,
                                    path.display()
                                );
                                conns.insert(pack.id, con);
                            }
                            Err(e) => eprintln!(
                                "[lexil] failed to open {}: {}",
                                path.display(),
                                e
                            ),
                        }
                    }
                }
                Err(e) => eprintln!("[lexil] could not scan packs dir: {}", e),
            }
            if conns.is_empty() {
                eprintln!(
                    "[lexil] no packs installed yet — frontend will prompt to download one"
                );
            }
            app.manage(db::DictState(Mutex::new(conns)));

            // Pack download in-flight tracker.
            app.manage(pack_manager::DownloadState(Mutex::new(
                std::collections::HashMap::new(),
            )));

            // User state (recents, favorites, tags, notes).
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
            pack_manager::available_packs,
            pack_manager::installed_packs,
            pack_manager::download_pack,
            pack_manager::cancel_download,
            pack_manager::remove_pack,
            pack_manager::refresh_packs,
            user::add_recent,
            user::list_recents,
            user::clear_recents,
            user::toggle_favorite,
            user::is_favorite,
            user::list_favorites,
            user::export_favorites,
            user::list_tags,
            user::entry_tags,
            user::add_entry_tag,
            user::remove_entry_tag,
            user::set_tag_color,
            user::rename_tag,
            user::delete_tag,
            user::list_notes,
            user::add_note,
            user::delete_note,
            user::list_lists,
            user::create_list,
            user::rename_list,
            user::set_list_glyph,
            user::set_list_color,
            user::delete_list,
            user::list_list_entries,
            user::add_to_list,
            user::remove_from_list,
            user::lists_for_entry,
            user::entries_with_tag,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
