use std::fs;
use std::sync::Mutex;

/// Reads a text file chosen by the user (open panel, recents, command line).
#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("{path}: {e}"))
}

/// Documents (.plm) and exports (PNG, JPG, PDF), written atomically: a temp file next to the target, then a
/// rename, so a failed save never leaves a half-written file. The raw request body is the UTF-8 path, a NUL byte, then the
/// file's bytes: no JSON encoding of megabytes of image data.
#[tauri::command]
fn write_bytes(request: tauri::ipc::Request) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(body) = request.body() else {
        return Err("write_bytes expects a raw body".into());
    };
    let split = body.iter().position(|&b| b == 0).ok_or("write_bytes: no path")?;
    let path = std::str::from_utf8(&body[..split]).map_err(|e| e.to_string())?;
    let tmp = format!("{path}.tmp");
    fs::write(&tmp, &body[split + 1..])
        .and_then(|_| fs::rename(&tmp, path))
        .map_err(|e| format!("{path}: {e}"))
}

/// One upright face of an installed font: `index` is its face in a collection file (.ttc).
#[derive(serde::Serialize)]
struct SystemFont {
    family: String,
    weight: u16,
    path: String,
    index: u32,
}

/// The installed fonts (upright faces only: text has no italic yet; hidden `.` system families left out).
/// Async: scanning the font folders stays off the main thread.
#[tauri::command]
async fn system_fonts() -> Vec<SystemFont> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    db.faces()
        .filter(|f| f.style == fontdb::Style::Normal && f.families.first().is_some_and(|n| !n.0.starts_with('.')))
        .filter_map(|f| match &f.source {
            fontdb::Source::File(path) | fontdb::Source::SharedFile(path, _) => Some(SystemFont {
                family: f.families[0].0.clone(),
                weight: f.weight.0,
                path: path.to_string_lossy().into_owned(),
                index: f.index,
            }),
            fontdb::Source::Binary(_) => None,
        })
        .collect()
}

/// A font file's bytes, as a raw response (no JSON array of numbers).
#[tauri::command]
async fn read_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    fs::read(&path).map(tauri::ipc::Response::new).map_err(|e| format!("{path}: {e}"))
}

/// Help › Plume Documentation: a web page in the default browser. https only: nothing else gets launched.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err(format!("not a web page: {url}"));
    }
    let opener = if cfg!(target_os = "macos") { "open" } else if cfg!(windows) { "explorer" } else { "xdg-open" };
    std::process::Command::new(opener).arg(&url).spawn().map(|_| ()).map_err(|e| format!("{url}: {e}"))
}

/// A file the Finder asked to open before the window could listen for `open-file` (macOS double-click at launch).
#[derive(Default)]
struct OpenedAtLaunch(Mutex<Option<String>>);

/// `Plume file.svg` / `Plume file.plm` (or a Finder double-click) opens that file at launch.
#[tauri::command]
fn launch_file(opened: tauri::State<OpenedAtLaunch>) -> Option<String> {
    opened.0.lock().unwrap().take().or_else(|| std::env::args().skip(1).find(|a| !a.starts_with('-')))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(OpenedAtLaunch::default())
        .invoke_handler(tauri::generate_handler![read_text, write_bytes, launch_file, system_fonts, read_bytes, open_url])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app, _event| {
            // Finder › Open With / double-click on a .plm: stored for `launch_file`, and sent to a running window.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                use tauri::{Emitter, Manager};
                if let Some(path) = urls.iter().find_map(|u| u.to_file_path().ok()) {
                    let path = path.to_string_lossy().into_owned();
                    *_app.state::<OpenedAtLaunch>().0.lock().unwrap() = Some(path.clone());
                    let _ = _app.emit("open-file", path);
                }
            }
        });
}
