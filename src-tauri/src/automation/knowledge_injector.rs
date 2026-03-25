use rusqlite::Connection;
use crate::persistence::knowledge;

const MAX_DOCS: usize = 10;
const MAX_CHARS: usize = 16384;

/// Build a knowledge context string to prepend to an agent's system prompt.
/// Selects documents that are linked to the agent, the project, or are guidelines.
pub fn build_context(
    conn: &Connection,
    agent_id: &str,
    project_id: Option<&str>,
) -> Result<String, rusqlite::Error> {
    let all_docs = knowledge::list(conn)?;

    // Filter relevant documents
    let relevant: Vec<_> = all_docs
        .into_iter()
        .filter(|doc| {
            // Guidelines are always included
            if doc.category == "guidelines" {
                return true;
            }
            // Check agent linkage (JSON array stored as string)
            if doc.agent_ids.contains(agent_id) {
                return true;
            }
            // Check project linkage
            if let Some(pid) = project_id {
                if doc.project_ids.contains(pid) {
                    return true;
                }
            }
            false
        })
        .take(MAX_DOCS)
        .collect();

    if relevant.is_empty() {
        return Ok(String::new());
    }

    let mut context = String::from("--- Knowledge Context ---\n\n");
    let mut total_len = context.len();

    for doc in &relevant {
        let entry = format!("[{}]\n{}\n\n", doc.title, doc.content);
        if total_len + entry.len() > MAX_CHARS {
            break;
        }
        context.push_str(&entry);
        total_len += entry.len();
    }

    context.push_str("--- End Knowledge Context ---\n\n");
    Ok(context)
}
