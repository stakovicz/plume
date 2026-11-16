//! MCP (Model Context Protocol): an agent reads the document open in the window. Two halves of one executable:
//! - in the app, [`mcp_start`] listens on 127.0.0.1 (a free port) and hands each JSON-RPC request to the web view
//!   (`mcp-call`), whose answer comes back through [`mcp_reply`]. What the protocol says lives in src/lib/app/mcp.ts:
//!   this side only carries messages, one JSON object per line;
//! - `Plume --mcp`, launched by the agent, relays its stdin/stdout to that port ([`relay`]).
//!
//! The port and a random token are in `mcp.json`, in the app's data folder, readable by the user only: a relay must
//! send the token first. Nothing listens unless the user turns the server on (Plume › Turn On MCP Server).

use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

const IDENTIFIER: &str = "cz.stakovi.plume"; // tauri.conf.json: the relay runs without Tauri, so it can't ask
const TIMEOUT: Duration = Duration::from_secs(30);
const NOT_RUNNING: &str = "Plume is not open, or its MCP server is off. Ask the user to open Plume and choose \
Plume › Turn On MCP Server (French: Activer le serveur MCP), then reconnect this server.";

/// `mcp.json`, in the app's data folder (Tauri's app_data_dir, computed by hand for the relay).
fn info_path() -> Option<PathBuf> {
    let home = || std::env::var_os("HOME").map(PathBuf::from);
    let dir = if cfg!(target_os = "macos") {
        home()?.join("Library/Application Support")
    } else if cfg!(windows) {
        PathBuf::from(std::env::var_os("APPDATA")?)
    } else {
        std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).or_else(|| home().map(|h| h.join(".local/share")))?
    };
    Some(dir.join(IDENTIFIER).join("mcp.json"))
}

/// 128 random bits as hex: std's hasher keys are drawn from the OS's random source.
fn new_token() -> String {
    use std::hash::BuildHasher;
    let half = |n: u8| std::collections::hash_map::RandomState::new().hash_one(n);
    format!("{:016x}{:016x}", half(1), half(2))
}

/// Written for the user only (0600 on Unix; per-user %APPDATA% on Windows).
fn write_private(path: &PathBuf, text: &str) -> Result<(), String> {
    let err = |e: std::io::Error| format!("{}: {e}", path.display());
    std::fs::create_dir_all(path.parent().unwrap()).map_err(err)?;
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    options.open(path).and_then(|mut f| f.write_all(text.as_bytes())).map_err(err)
}

struct Running {
    port: u16,
    stop: Arc<AtomicBool>,
}

/// The server's state in the app: whether it runs, and the requests waiting for the web view's answer.
#[derive(Default)]
pub struct Mcp {
    running: Mutex<Option<Running>>,
    pending: Arc<Mutex<HashMap<u64, mpsc::Sender<String>>>>,
    next: Arc<AtomicU64>,
}

#[tauri::command]
pub fn mcp_start(app: AppHandle, mcp: tauri::State<Mcp>) -> Result<(), String> {
    let mut running = mcp.running.lock().unwrap();
    if running.is_some() {
        return Ok(());
    }
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let token = new_token();
    write_private(&info_path().ok_or("no data folder")?, &json!({ "port": port, "token": token }).to_string())?;
    let stop = Arc::new(AtomicBool::new(false));
    *running = Some(Running { port, stop: stop.clone() });
    let (pending, next) = (mcp.pending.clone(), mcp.next.clone());
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            if stop.load(Ordering::Relaxed) {
                break;
            }
            let Ok(stream) = stream else { continue };
            let (app, token, stop, pending, next) = (app.clone(), token.clone(), stop.clone(), pending.clone(), next.clone());
            std::thread::spawn(move || serve(stream, &app, &token, &stop, &pending, &next));
        }
    });
    Ok(())
}

#[tauri::command]
pub fn mcp_stop(mcp: tauri::State<Mcp>) {
    if let Some(r) = mcp.running.lock().unwrap().take() {
        r.stop.store(true, Ordering::Relaxed);
        let _ = TcpStream::connect(("127.0.0.1", r.port)); // wakes the accept loop so it sees `stop`
        if let Some(path) = info_path() {
            let _ = std::fs::remove_file(path);
        }
    }
}

/// Plume is quitting: the server stops with it, its `mcp.json` removed, so relays answer "not open" at once.
/// ponytail: a crash or a forced quit still leaves the file; the relay then finds no one at the port and answers the same.
pub fn shutdown(app: &AppHandle) {
    use tauri::Manager;
    mcp_stop(app.state::<Mcp>());
}

/// The web view's answer to request `id` (a JSON-RPC response, as text).
#[tauri::command]
pub fn mcp_reply(id: u64, response: String, mcp: tauri::State<Mcp>) {
    if let Some(tx) = mcp.pending.lock().unwrap().remove(&id) {
        let _ = tx.send(response);
    }
}

/// One relay connection: the token, then requests answered in order. A connection open when the server is
/// turned off ends at its next request. ponytail: requests are answered one at a time; overlap them if agents need it.
fn serve(
    stream: TcpStream,
    app: &AppHandle,
    token: &str,
    stop: &AtomicBool,
    pending: &Mutex<HashMap<u64, mpsc::Sender<String>>>,
    next: &AtomicU64,
) {
    let Ok(read) = stream.try_clone() else { return };
    let mut lines = BufReader::new(read).lines();
    let mut out = stream;
    if lines.next().and_then(Result::ok).as_deref() != Some(token) {
        return;
    }
    for line in lines.map_while(Result::ok) {
        if stop.load(Ordering::Relaxed) {
            break;
        }
        let response = match serde_json::from_str::<Value>(&line) {
            Err(e) => error(Value::Null, -32700, &format!("Parse error: {e}")),
            Ok(message) => {
                let Some(id) = message.get("id").cloned() else { continue }; // a notification: nothing to answer
                ask(app, pending, next, message).unwrap_or_else(|e| error(id, -32603, &e))
            }
        };
        if writeln!(out, "{response}").is_err() {
            break;
        }
    }
}

/// Sends `message` to the web view and waits for its answer.
fn ask(app: &AppHandle, pending: &Mutex<HashMap<u64, mpsc::Sender<String>>>, next: &AtomicU64, message: Value) -> Result<String, String> {
    let n = next.fetch_add(1, Ordering::Relaxed);
    let (tx, rx) = mpsc::channel();
    pending.lock().unwrap().insert(n, tx);
    let answer = app
        .emit("mcp-call", json!({ "id": n, "message": message }))
        .map_err(|e| e.to_string())
        .and_then(|_| rx.recv_timeout(TIMEOUT).map_err(|_| "Plume did not answer within 30 s.".to_string()));
    pending.lock().unwrap().remove(&n);
    answer
}

fn error(id: Value, code: i32, message: &str) -> String {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } }).to_string()
}

/// The answer to a request when Plume can't be reached: the agent still connects, and learns what to ask the user.
fn offline(message: &Value) -> Option<String> {
    let id = message.get("id")?.clone();
    let result = match message.get("method").and_then(Value::as_str) {
        Some("initialize") => json!({
            "protocolVersion": message.pointer("/params/protocolVersion").cloned().unwrap_or(json!("2025-06-18")),
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "plume", "title": "Plume", "version": env!("CARGO_PKG_VERSION") },
            "instructions": NOT_RUNNING,
        }),
        Some("ping") => json!({}),
        Some("tools/list") => json!({ "tools": [] }),
        Some("tools/call") => json!({ "content": [{ "type": "text", "text": NOT_RUNNING }], "isError": true }),
        _ => return Some(error(id, -32601, NOT_RUNNING)),
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }).to_string())
}

/// Connects to the running app, sends the token, and copies its answers to stdout. When the connection ends, the
/// requests still waiting get an error, so the agent never hangs.
fn connect(in_flight: &Arc<Mutex<HashSet<String>>>) -> Option<TcpStream> {
    let info: Value = serde_json::from_str(&std::fs::read_to_string(info_path()?).ok()?).ok()?;
    let port = u16::try_from(info["port"].as_u64()?).ok()?;
    let mut stream = TcpStream::connect(("127.0.0.1", port)).ok()?;
    writeln!(stream, "{}", info["token"].as_str()?).ok()?;
    let read = stream.try_clone().ok()?;
    let in_flight = in_flight.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(read).lines().map_while(Result::ok) {
            if let Some(id) = serde_json::from_str::<Value>(&line).ok().and_then(|v| v.get("id").cloned()) {
                in_flight.lock().unwrap().remove(&id.to_string());
            }
            let _ = writeln!(std::io::stdout().lock(), "{line}");
        }
        for id in in_flight.lock().unwrap().drain() {
            let id: Value = serde_json::from_str(&id).unwrap_or(Value::Null);
            let _ = writeln!(std::io::stdout().lock(), "{}", error(id, -32603, "Plume was closed, or its MCP server turned off."));
        }
    });
    Some(stream)
}

/// `Plume --mcp`: the MCP server an agent launches (stdio transport). It holds no logic: it forwards each line to the
/// app, (re)connecting as needed, and answers by itself only while the app can't be reached.
pub fn relay() {
    let in_flight = Arc::new(Mutex::new(HashSet::new()));
    let mut app: Option<TcpStream> = None;
    for line in std::io::stdin().lock().lines().map_while(Result::ok) {
        if line.trim().is_empty() {
            continue;
        }
        let message: Value = serde_json::from_str(&line).unwrap_or(Value::Null);
        let id = message.get("id").map(Value::to_string);
        if let Some(id) = &id {
            in_flight.lock().unwrap().insert(id.clone());
        }
        let mut sent = false;
        for _ in 0..2 {
            if app.is_none() {
                app = connect(&in_flight);
            }
            match app.as_mut().map(|s| writeln!(s, "{line}")) {
                Some(Ok(())) => {
                    sent = true;
                    break;
                }
                Some(Err(_)) => app = None, // the app went away: try once more, then answer offline
                None => break,
            }
        }
        if !sent {
            if let Some(id) = &id {
                in_flight.lock().unwrap().remove(id);
            }
            if let Some(answer) = offline(&message) {
                let _ = writeln!(std::io::stdout().lock(), "{answer}");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offline_answers_requests_not_notifications() {
        let init = offline(&json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": { "protocolVersion": "2025-03-26" } })).unwrap();
        let init: Value = serde_json::from_str(&init).unwrap();
        assert_eq!(init["result"]["protocolVersion"], "2025-03-26");
        assert!(init["result"]["instructions"].as_str().unwrap().contains("MCP Server"));
        let call: Value = serde_json::from_str(&offline(&json!({ "id": "a", "method": "tools/call" })).unwrap()).unwrap();
        assert_eq!(call["id"], "a");
        assert_eq!(call["result"]["isError"], true);
        assert!(offline(&json!({ "method": "notifications/initialized" })).is_none());
    }

    #[test]
    fn tokens_are_random_hex() {
        let (a, b) = (new_token(), new_token());
        assert_eq!(a.len(), 32);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
    }
}
