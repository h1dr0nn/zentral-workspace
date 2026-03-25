use serde::{Deserialize, Serialize};

// ── Projects ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub path: String,
    pub context_badges: String, // JSON array
    pub last_opened_at: String,
}

// ── Agents ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRow {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub skills: String, // JSON array
    pub is_secretary: bool,
    pub project_ids: String, // JSON array
    pub is_builtin: bool,
}

// ── Skills ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillRow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub prompt: String,
    pub is_builtin: bool,
}

// ── Chat Messages ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageRow {
    pub id: String,
    pub chat_key: String,
    pub agent_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
    pub source: String,
}

// ── Schedules ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleRow {
    pub id: String,
    pub name: String,
    pub agent_id: String,
    pub skill_id: String,
    pub project_id: Option<String>,
    pub frequency: String,
    pub cron_expression: String,
    pub prompt: String,
    pub description: String,
    pub status: String,
    pub next_run_at: String,
    pub last_run_at: Option<String>,
    pub created_at: String,
}

// ── Workflows ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub project_id: Option<String>,
    pub status: String,
    pub created_at: String,
    pub last_run_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStepRow {
    pub id: String,
    pub workflow_id: String,
    pub agent_id: String,
    pub skill_id: String,
    pub label: String,
    pub step_order: i32,
    pub on_success: Option<String>,
    pub on_failure: Option<String>,
}

// ── History Events ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEventRow {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub agent_id: String,
    pub project_id: Option<String>,
    pub skill_id: Option<String>,
    pub workflow_id: Option<String>,
    pub summary: String,
    pub details: Option<String>,
    pub status: String,
    pub duration: Option<i64>,
    pub timestamp: String,
}

// ── Knowledge Documents ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeDocumentRow {
    pub id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub tags: String,        // JSON array
    pub project_ids: String, // JSON array
    pub agent_ids: String,   // JSON array
    pub created_at: String,
    pub updated_at: String,
}
