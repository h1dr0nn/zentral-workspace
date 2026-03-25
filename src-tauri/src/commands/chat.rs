use serde::{Deserialize, Serialize};
use std::io::BufRead;
use std::process::{Command, Stdio};
use tauri::{Emitter, Manager};

#[derive(Debug, Serialize, Clone)]
pub struct StreamChunk {
    pub agent_id: String,
    pub message_id: String,
    pub text: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct StreamDone {
    pub agent_id: String,
    pub message_id: String,
    pub full_text: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct StreamError {
    pub agent_id: String,
    pub message_id: String,
    pub error: String,
}

#[derive(Debug, Deserialize)]
struct CliMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[allow(dead_code)]
    subtype: Option<String>,
    message: Option<CliAssistantMessage>,
    result: Option<String>,
    is_error: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct CliAssistantMessage {
    content: Vec<CliContent>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum CliContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "thinking")]
    Thinking {
        #[allow(dead_code)]
        thinking: String,
    },
    #[serde(other)]
    Other,
}

fn get_claude_path(app: &tauri::AppHandle) -> String {
    let state = app.state::<crate::config::AppSettings>();
    let path = state.claude_cli_path.lock().unwrap().clone();
    if path.is_empty() { "claude".to_string() } else { path }
}

fn get_default_model(app: &tauri::AppHandle) -> String {
    let state = app.state::<crate::config::AppSettings>();
    let model = state.default_model.lock().unwrap().clone();
    model
}

#[tauri::command]
pub async fn send_chat_message(
    app: tauri::AppHandle,
    agent_id: String,
    message_id: String,
    message: String,
    system_prompt: String,
    model: Option<String>,
) -> Result<(), String> {
    let claude = get_claude_path(&app);
    let model = model.unwrap_or_else(|| get_default_model(&app));

    // Move blocking I/O off the async runtime
    tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&claude);
        cmd.args(["-p", &message])
            .args(["--output-format", "stream-json"])
            .args(["--verbose"])
            .args(["--model", &model])
            .args(["--system-prompt", &system_prompt])
            .args(["--tools", ""])
            .args(["--no-session-persistence"])
            .args(["--no-chrome"])
            .args(["--disable-slash-commands"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn claude: {}", e))?;
        let stdout = child.stdout.take().ok_or("Failed to capture stdout".to_string())?;
        let reader = std::io::BufReader::new(stdout);

        let mut last_emitted = String::new();

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };
            if line.trim().is_empty() {
                continue;
            }

            let parsed: CliMessage = match serde_json::from_str(&line) {
                Ok(m) => m,
                Err(_) => continue,
            };

            match parsed.msg_type.as_str() {
                "assistant" => {
                    if let Some(msg) = &parsed.message {
                        let full_text: String = msg.content.iter().filter_map(|c| {
                            if let CliContent::Text { text } = c { Some(text.as_str()) } else { None }
                        }).collect::<Vec<_>>().join("");

                        if !full_text.is_empty() && full_text != last_emitted {
                            let _ = app.emit("chat:stream-chunk", StreamChunk {
                                agent_id: agent_id.clone(),
                                message_id: message_id.clone(),
                                text: full_text.clone(),
                            });
                            last_emitted = full_text;
                        }
                    }
                }
                "result" => {
                    if parsed.is_error == Some(true) {
                        let error = parsed.result.unwrap_or_else(|| "Unknown error".to_string());
                        let _ = app.emit("chat:stream-error", StreamError {
                            agent_id: agent_id.clone(),
                            message_id: message_id.clone(),
                            error,
                        });
                    } else {
                        let full = parsed.result.unwrap_or(last_emitted.clone());
                        let _ = app.emit("chat:stream-done", StreamDone {
                            agent_id: agent_id.clone(),
                            message_id: message_id.clone(),
                            full_text: full,
                        });
                    }
                }
                _ => {}
            }
        }

        let _ = child.wait();
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
}
