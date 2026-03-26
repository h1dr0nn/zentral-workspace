use serde_json::{json, Value};
use crate::persistence::chat;
use super::super::McpState;
use super::ToolDef;

pub fn tools() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "send_message",
            description: "Send a message to an agent using Claude CLI and get a response",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "agent_id":     { "type": "string", "description": "Agent ID to chat with" },
                    "message":      { "type": "string", "description": "The message to send" },
                    "project_path": { "type": "string", "description": "Working directory (optional)" }
                },
                "required": ["agent_id", "message"]
            }),
        },
        ToolDef {
            name: "get_chat_history",
            description: "Get chat message history for a specific agent",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "agent_id": { "type": "string" },
                    "project_id": { "type": "string", "description": "Optional project ID to scope the chat" }
                },
                "required": ["agent_id"]
            }),
        },
    ]
}

pub fn send_message(args: Value, state: &McpState) -> Result<Value, String> {
    let agent_id = args["agent_id"].as_str().ok_or("Missing agent_id")?;
    let message = args["message"].as_str().ok_or("Missing message")?;
    let project_path = args.get("project_path").and_then(Value::as_str);

    let mut cmd = std::process::Command::new(&state.claude_path);
    cmd.arg("--print")
        .arg("--model")
        .arg(&state.model)
        .arg(message);
    if let Some(dir) = project_path {
        cmd.current_dir(dir);
    }

    let output = cmd.output().map_err(|e| format!("Failed to run claude: {}", e))?;
    let response = if output.status.success() {
        String::from_utf8_lossy(&output.stdout).to_string()
    } else {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    };

    Ok(json!({
        "agent_id": agent_id,
        "message": message,
        "response": response
    }))
}

pub fn get_chat_history(args: Value, state: &McpState) -> Result<Value, String> {
    let agent_id = args["agent_id"].as_str().ok_or("Missing agent_id")?;
    let project_id = args.get("project_id").and_then(Value::as_str).unwrap_or("default");
    let chat_key = format!("{}-{}", agent_id, project_id);

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let messages = chat::get_by_key(&conn, &chat_key).map_err(|e| e.to_string())?;
    Ok(json!(messages))
}
