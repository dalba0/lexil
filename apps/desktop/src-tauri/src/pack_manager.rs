//! On-demand dictionary pack management.
//!
//! Packs live in `<app-data>/packs/<pack_id>.db` on the user's machine.
//! At startup, main.rs scans that directory for any `.db` files and opens
//! them; this module handles fetching the manifest, downloading new
//! packs with progress events, verifying their hash, and uninstalling
//! packs the user no longer wants.
//!
//! The remote manifest lives at a stable URL (raw.githubusercontent.com
//! of the project repo). Pack files themselves are uploaded as GitHub
//! Release assets so the CDN handles delivery.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{Emitter, Manager};

use crate::db;
use crate::error::{AppError, AppResult};

const MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/dalba0/lexil/main/packs/manifest.json";

/// Tracks in-flight downloads so the user can't double-trigger one. The
/// stored value is the AppHandle-relative cancel flag; toggling it
/// signals the worker thread to abort.
pub struct DownloadState(pub Mutex<std::collections::HashMap<String, std::sync::Arc<std::sync::atomic::AtomicBool>>>);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ManifestPack {
    pub id: String,
    pub name: String,
    pub source: String,
    pub target: String,
    pub version: String,
    pub size_bytes: u64,
    pub entries: u64,
    pub download_url: String,
    pub sha256: String,
    pub license: Option<String>,
    pub attribution: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Manifest {
    pub manifest_version: u32,
    pub updated_at: String,
    pub packs: Vec<ManifestPack>,
}

#[derive(Debug, Serialize, Clone)]
pub struct InstalledPack {
    pub id: String,
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct PackDownloadProgress {
    pub pack_id: String,
    pub bytes_downloaded: u64,
    pub bytes_total: u64,
    pub state: String, // "downloading" | "verifying" | "installing" | "done" | "error" | "cancelled"
    pub message: Option<String>,
}

/// Where installed packs live on disk for the current OS user.
pub fn packs_dir(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let dir = app.path().app_data_dir()?.join("packs");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Scan the packs dir and return pack ids derived from `<pack_id>.db`
/// filenames.
pub fn scan_installed(app: &tauri::AppHandle) -> AppResult<Vec<InstalledPack>> {
    let dir = packs_dir(app)?;
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map(|e| e == "db").unwrap_or(false) {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                out.push(InstalledPack {
                    id: stem.to_string(),
                    path: path.to_string_lossy().into_owned(),
                    size_bytes: size,
                });
            }
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

#[tauri::command]
pub fn available_packs() -> AppResult<Manifest> {
    let body = reqwest::blocking::get(MANIFEST_URL)
        .map_err(|e| AppError::Invalid(format!("manifest fetch failed: {e}")))?
        .text()
        .map_err(|e| AppError::Invalid(format!("manifest read failed: {e}")))?;
    let manifest: Manifest = serde_json::from_str(&body)
        .map_err(|e| AppError::Invalid(format!("manifest parse failed: {e}")))?;
    Ok(manifest)
}

#[tauri::command]
pub fn installed_packs(app: tauri::AppHandle) -> AppResult<Vec<InstalledPack>> {
    scan_installed(&app)
}

/// Spawn a background thread that streams the pack to a temporary file,
/// verifies its sha256, then atomically swaps it into place and
/// registers the connection with DictState. Progress is emitted via the
/// "pack-download-progress" event so the UI can show a smooth bar.
#[tauri::command]
pub fn download_pack(
    app: tauri::AppHandle,
    download_state: tauri::State<'_, DownloadState>,
    pack: ManifestPack,
) -> AppResult<()> {
    // Block double-trigger by checking the in-flight map. If a download
    // for this pack is already running, return early so the UI can show
    // its existing progress.
    let cancel_flag = {
        let mut m = download_state
            .0
            .lock()
            .map_err(|e| AppError::Lock(e.to_string()))?;
        if m.contains_key(&pack.id) {
            return Err(AppError::Invalid(format!(
                "{} is already downloading",
                pack.id
            )));
        }
        let flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        m.insert(pack.id.clone(), flag.clone());
        flag
    };

    let app_handle = app.clone();
    let packs_dir_path = packs_dir(&app_handle)?;

    std::thread::spawn(move || {
        let result = run_download(&app_handle, &pack, &packs_dir_path, cancel_flag);

        // Always clean up the in-flight slot so a retry can start.
        if let Some(state) = app_handle.try_state::<DownloadState>() {
            if let Ok(mut m) = state.0.lock() {
                m.remove(&pack.id);
            }
        }

        // On success, open the new pack and register it with DictState
        // so search commands can use it immediately.
        if result.is_ok() {
            let pack_path = packs_dir_path.join(format!("{}.db", pack.id));
            if let Ok(con) = db::open(&pack_path) {
                if let Some(dict) = app_handle.try_state::<db::DictState>() {
                    if let Ok(mut conns) = dict.0.lock() {
                        conns.insert(pack.id.clone(), con);
                    }
                }
            }
            emit_progress(
                &app_handle,
                &pack.id,
                pack.size_bytes,
                pack.size_bytes,
                "done",
                None,
            );
        } else if let Err(e) = result {
            emit_progress(
                &app_handle,
                &pack.id,
                0,
                pack.size_bytes,
                "error",
                Some(format!("{e}")),
            );
        }
    });

    Ok(())
}

fn run_download(
    app: &tauri::AppHandle,
    pack: &ManifestPack,
    packs_dir_path: &Path,
    cancel: std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> AppResult<()> {
    let tmp_path = packs_dir_path.join(format!("{}.db.part", pack.id));
    let final_path = packs_dir_path.join(format!("{}.db", pack.id));

    // Clean up any leftover partial from a previous run.
    let _ = fs::remove_file(&tmp_path);

    emit_progress(app, &pack.id, 0, pack.size_bytes, "downloading", None);

    let response = reqwest::blocking::get(&pack.download_url)
        .map_err(|e| AppError::Invalid(format!("HTTP fetch failed: {e}")))?;
    if !response.status().is_success() {
        return Err(AppError::Invalid(format!(
            "HTTP {} from {}",
            response.status(),
            pack.download_url
        )));
    }
    let total_from_header = response.content_length().unwrap_or(pack.size_bytes);

    let mut file = File::create(&tmp_path)?;
    let mut hasher = Sha256::new();
    let mut bytes_read: u64 = 0;
    let mut last_emit: u64 = 0;
    let mut buf = [0u8; 64 * 1024];
    let mut reader = response;

    loop {
        if cancel.load(std::sync::atomic::Ordering::Relaxed) {
            let _ = fs::remove_file(&tmp_path);
            emit_progress(
                app,
                &pack.id,
                bytes_read,
                total_from_header,
                "cancelled",
                None,
            );
            return Err(AppError::Invalid("download cancelled".into()));
        }
        let n = reader.read(&mut buf).map_err(AppError::Io)?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n])?;
        hasher.update(&buf[..n]);
        bytes_read += n as u64;
        // Throttle event emission to every 256 KB so we don't flood the
        // event loop.
        if bytes_read - last_emit >= 256 * 1024 {
            emit_progress(
                app,
                &pack.id,
                bytes_read,
                total_from_header,
                "downloading",
                None,
            );
            last_emit = bytes_read;
        }
    }

    file.sync_all()?;
    drop(file);

    emit_progress(
        app,
        &pack.id,
        bytes_read,
        total_from_header,
        "verifying",
        None,
    );
    let actual_hash = hex::encode(hasher.finalize());
    if !pack.sha256.is_empty() && actual_hash.to_lowercase() != pack.sha256.to_lowercase() {
        let _ = fs::remove_file(&tmp_path);
        return Err(AppError::Invalid(format!(
            "sha256 mismatch: expected {}, got {}",
            pack.sha256, actual_hash
        )));
    }

    emit_progress(
        app,
        &pack.id,
        bytes_read,
        total_from_header,
        "installing",
        None,
    );

    // If a previous version exists, close its connection first so we can
    // overwrite the file on Windows (where open handles block deletes).
    if let Some(dict) = app.try_state::<db::DictState>() {
        if let Ok(mut conns) = dict.0.lock() {
            conns.remove(&pack.id);
        }
    }

    fs::rename(&tmp_path, &final_path)?;
    Ok(())
}

fn emit_progress(
    app: &tauri::AppHandle,
    pack_id: &str,
    downloaded: u64,
    total: u64,
    state: &str,
    message: Option<String>,
) {
    let _ = app.emit(
        "pack-download-progress",
        PackDownloadProgress {
            pack_id: pack_id.to_string(),
            bytes_downloaded: downloaded,
            bytes_total: total,
            state: state.to_string(),
            message,
        },
    );
}

#[tauri::command]
pub fn cancel_download(
    download_state: tauri::State<'_, DownloadState>,
    pack_id: String,
) -> AppResult<()> {
    let m = download_state
        .0
        .lock()
        .map_err(|e| AppError::Lock(e.to_string()))?;
    if let Some(flag) = m.get(&pack_id) {
        flag.store(true, std::sync::atomic::Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub fn remove_pack(
    app: tauri::AppHandle,
    dict_state: tauri::State<'_, db::DictState>,
    pack_id: String,
) -> AppResult<()> {
    // Close the connection so we can delete the file on Windows.
    {
        let mut conns = dict_state
            .0
            .lock()
            .map_err(|e| AppError::Lock(e.to_string()))?;
        conns.remove(&pack_id);
    }
    let path = packs_dir(&app)?.join(format!("{}.db", pack_id));
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}

/// Re-scan the packs dir and refresh DictState with whatever's there.
/// Useful after a manual file drop or if the user wants to retry after
/// a failed download.
#[tauri::command]
pub fn refresh_packs(
    app: tauri::AppHandle,
    dict_state: tauri::State<'_, db::DictState>,
) -> AppResult<Vec<InstalledPack>> {
    let installed = scan_installed(&app)?;
    let mut conns = dict_state
        .0
        .lock()
        .map_err(|e| AppError::Lock(e.to_string()))?;
    let installed_ids: std::collections::HashSet<String> =
        installed.iter().map(|p| p.id.clone()).collect();

    // Drop connections for packs no longer on disk.
    conns.retain(|id, _| installed_ids.contains(id));

    // Open any installed pack we haven't loaded yet.
    for pack in &installed {
        if !conns.contains_key(&pack.id) {
            if let Ok(con) = db::open(Path::new(&pack.path)) {
                conns.insert(pack.id.clone(), con);
            }
        }
    }
    Ok(installed)
}
