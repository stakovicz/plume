use std::fs;

/// Reads a text file chosen by the user (open panel, recents, command line).
#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("{path}: {e}"))
}

/// Writes atomically: a temp file next to the target, then a rename, so a failed save never
/// leaves a half-written document.
#[tauri::command]
fn write_text(path: String, contents: String) -> Result<(), String> {
    let tmp = format!("{path}.tmp");
    fs::write(&tmp, contents)
        .and_then(|_| fs::rename(&tmp, &path))
        .map_err(|e| format!("{path}: {e}"))
}

/// Binary exports (PNG, JPG, PDF). The raw request body is the UTF-8 path, a NUL byte, then the
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
    let opener = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    std::process::Command::new(opener).arg(&url).spawn().map(|_| ()).map_err(|e| format!("{url}: {e}"))
}

/// `Plume file.svg` / `Plume file.json` opens that file at launch.
#[tauri::command]
fn launch_file() -> Option<String> {
    std::env::args().skip(1).find(|a| !a.starts_with('-'))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_text, write_text, write_bytes, launch_file, system_fonts, read_bytes, open_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
