use serde_json::{json, Value};
use uuid::Uuid;
use crate::persistence::{skills, models::SkillRow};
use super::super::McpState;
use super::ToolDef;

pub fn tools() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "list_skills",
            description: "List all skills (builtin and custom)",
            input_schema: json!({ "type": "object", "properties": {} }),
        },
        ToolDef {
            name: "create_skill",
            description: "Create a new custom skill",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name":        { "type": "string" },
                    "description": { "type": "string" },
                    "category":    { "type": "string" },
                    "prompt":      { "type": "string" }
                },
                "required": ["name", "description", "prompt"]
            }),
        },
        ToolDef {
            name: "run_skill",
            description: "Run a skill by ID against a prompt using Claude CLI",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "skill_id":   { "type": "string", "description": "Skill ID" },
                    "prompt":     { "type": "string", "description": "Additional context or prompt" },
                    "project_path": { "type": "string", "description": "Working directory" }
                },
                "required": ["skill_id", "prompt"]
            }),
        },
    ]
}

pub fn list_skills(_args: Value, state: &McpState) -> Result<Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let rows = skills::list(&conn).map_err(|e| e.to_string())?;
    Ok(json!(rows))
}

pub fn create_skill(args: Value, state: &McpState) -> Result<Value, String> {
    let name = args["name"].as_str().ok_or("Missing name")?.to_string();
    let description = args["description"].as_str().ok_or("Missing description")?.to_string();
    let category = args.get("category").and_then(Value::as_str).unwrap_or("Custom").to_string();
    let prompt = args["prompt"].as_str().ok_or("Missing prompt")?.to_string();
    let row = SkillRow {
        id: Uuid::new_v4().to_string(),
        name,
        description,
        category,
        prompt,
        is_builtin: false,
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    skills::insert(&conn, &row).map_err(|e| e.to_string())?;
    Ok(json!(row))
}

pub fn run_skill(args: Value, state: &McpState) -> Result<Value, String> {
    let skill_id = args["skill_id"].as_str().ok_or("Missing skill_id")?;
    let user_prompt = args["prompt"].as_str().ok_or("Missing prompt")?;
    let project_path = args.get("project_path").and_then(Value::as_str);

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let skill = skills::list(&conn)
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| format!("Skill not found: {}", skill_id))?;
    drop(conn);

    let full_prompt = format!("{}\n\n{}", skill.prompt, user_prompt);
    let output = run_claude_sync(&state.claude_path, &full_prompt, project_path, &state.model)?;
    Ok(json!({ "output": output, "skill": skill.name }))
}

fn run_claude_sync(
    claude_path: &str,
    prompt: &str,
    cwd: Option<&str>,
    model: &str,
) -> Result<String, String> {
    let mut cmd = std::process::Command::new(claude_path);
    cmd.arg("--print")
        .arg("--model")
        .arg(model)
        .arg(prompt);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    let output = cmd.output().map_err(|e| format!("Failed to run claude: {}", e))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
