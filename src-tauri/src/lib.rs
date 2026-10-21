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

/// `Plume file.svg` / `Plume file.json` opens that file at launch.
#[tauri::command]
fn launch_file() -> Option<String> {
    std::env::args().skip(1).find(|a| !a.starts_with('-'))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_text, write_text, write_bytes, launch_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
