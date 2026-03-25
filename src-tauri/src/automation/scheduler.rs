use crate::persistence::Db;
use crate::persistence::{agents, history, schedules, skills};
use crate::persistence::models::HistoryEventRow;
use crate::automation::knowledge_injector;
use std::time::Instant;
use tauri::Emitter;

/// Start the background scheduler loop. Call once during Tauri setup.
pub fn start(db: Db, app: tauri::AppHandle, claude_path: String, model: String) {
    tokio::spawn(async move {
        log::info!("Scheduler started");
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            if let Err(e) = tick(&db, &app, &claude_path, &model) {
                log::error!("Scheduler tick error: {}", e);
            }
        }
    });
}

fn tick(db: &Db, app: &tauri::AppHandle, claude_path: &str, model: &str) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let conn = db.lock().map_err(|e| e.to_string())?;
    let due = schedules::list_due(&conn, &now).map_err(|e| e.to_string())?;
    drop(conn); // Release lock before executing

    for schedule in due {
        log::info!("Firing schedule: {} ({})", schedule.name, schedule.id);

        // Build system prompt
        let system_prompt = {
            let conn = db.lock().map_err(|e| e.to_string())?;
            let agent = agents::get(&conn, &schedule.agent_id).map_err(|e| e.to_string())?;
            let skill = skills::list(&conn).map_err(|e| e.to_string())?
                .into_iter().find(|s| s.id == schedule.skill_id);

            let agent_role = agent.map(|a| a.role).unwrap_or_default();
            let skill_prompt = skill.map(|s| s.prompt).unwrap_or_default();
            let knowledge = knowledge_injector::build_context(
                &conn,
                &schedule.agent_id,
                schedule.project_id.as_deref(),
            ).unwrap_or_default();

            format!("{}\n\n{}\n\n{}", knowledge, agent_role, skill_prompt)
        };

        // Execute agent synchronously
        let start = Instant::now();
        let result = run_agent_sync(claude_path, model, &schedule.prompt, &system_prompt);
        let duration = start.elapsed().as_millis() as i64;

        let (status, details) = match &result {
            Ok(output) => ("success".to_string(), Some(output.clone())),
            Err(err) => ("failure".to_string(), Some(err.clone())),
        };

        // Update schedule: last_run_at and next_run_at
        {
            let conn = db.lock().map_err(|e| e.to_string())?;
            let mut updated = schedule.clone();
            updated.last_run_at = Some(now.clone());
            updated.next_run_at = compute_next_run(&schedule.frequency, &now);
            schedules::update(&conn, &updated).map_err(|e| e.to_string())?;

            // Log history event
            let event = HistoryEventRow {
                id: format!("evt-{}", uuid::Uuid::new_v4()),
                event_type: "schedule_trigger".into(),
                agent_id: schedule.agent_id.clone(),
                project_id: schedule.project_id.clone(),
                skill_id: Some(schedule.skill_id.clone()),
                workflow_id: None,
                summary: format!("Schedule \"{}\" fired", schedule.name),
                details,
                status,
                duration: Some(duration),
                timestamp: chrono::Utc::now().to_rfc3339(),
            };
            let _ = history::insert(&conn, &event);
            let _ = app.emit("history:new-event", &event);
        }
    }

    Ok(())
}

/// Compute the next run time based on frequency.
fn compute_next_run(frequency: &str, from: &str) -> String {
    let base = chrono::DateTime::parse_from_rfc3339(from)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .unwrap_or_else(|_| chrono::Utc::now());

    let next = match frequency {
        "daily" => base + chrono::Duration::hours(24),
        "weekly" => base + chrono::Duration::days(7),
        "monthly" => base + chrono::Duration::days(30),
        _ => base + chrono::Duration::hours(24), // default to daily for custom
    };

    next.to_rfc3339()
}

/// Run Claude CLI synchronously — same pattern as workflow runner.
fn run_agent_sync(
    claude_path: &str,
    model: &str,
    message: &str,
    system_prompt: &str,
) -> Result<String, String> {
    use std::io::BufRead;
    use std::process::{Command, Stdio};

    let mut cmd = Command::new(claude_path);
    cmd.args(["-p", message])
        .args(["--output-format", "stream-json"])
        .args(["--verbose"])
        .args(["--model", model])
        .args(["--system-prompt", system_prompt])
        .args(["--tools", ""])
        .args(["--no-session-persistence"])
        .args(["--no-chrome"])
        .args(["--disable-slash-commands"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn claude: {}", e))?;
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let reader = std::io::BufReader::new(stdout);

    let mut last_text = String::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        if line.trim().is_empty() { continue; }

        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&line) {
            match parsed["type"].as_str() {
                Some("assistant") => {
                    if let Some(content) = parsed["message"]["content"].as_array() {
                        let text: String = content.iter()
                            .filter_map(|c| {
                                if c["type"].as_str() == Some("text") {
                                    c["text"].as_str().map(String::from)
                                } else {
                                    None
                                }
                            })
                            .collect::<Vec<_>>()
                            .join("");
                        if !text.is_empty() {
                            last_text = text;
                        }
                    }
                }
                Some("result") => {
                    if parsed["is_error"].as_bool() == Some(true) {
                        let error = parsed["result"].as_str().unwrap_or("Unknown error");
                        let _ = child.wait();
                        return Err(error.to_string());
                    }
                    if let Some(result) = parsed["result"].as_str() {
                        last_text = result.to_string();
                    }
                }
                _ => {}
            }
        }
    }

    let _ = child.wait();
    Ok(last_text)
}
