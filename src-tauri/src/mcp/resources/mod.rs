pub mod providers;

use serde_json::Value;
use super::McpState;

pub struct ResourceDef {
    pub uri: &'static str,
    pub name: &'static str,
    pub description: &'static str,
}

pub fn all_resources() -> Vec<ResourceDef> {
    vec![
        ResourceDef { uri: "zentral://agents",           name: "Agents",          description: "All agents" },
        ResourceDef { uri: "zentral://projects",         name: "Projects",        description: "All projects" },
        ResourceDef { uri: "zentral://projects/active",  name: "Active Project",  description: "The currently active project" },
        ResourceDef { uri: "zentral://skills",           name: "Skills",          description: "All skills" },
        ResourceDef { uri: "zentral://schedules",        name: "Schedules",       description: "All schedules" },
        ResourceDef { uri: "zentral://workflows",        name: "Workflows",       description: "All workflows with steps" },
        ResourceDef { uri: "zentral://knowledge",        name: "Knowledge",       description: "All knowledge documents" },
        ResourceDef { uri: "zentral://history/recent",   name: "Recent History",  description: "Last 50 history events" },
        ResourceDef { uri: "zentral://settings",         name: "Settings",        description: "All app settings" },
        ResourceDef { uri: "zentral://status",           name: "Status",          description: "Quick overview of Zentral state" },
    ]
}

pub fn read_resource(uri: &str, state: &McpState) -> Result<Value, String> {
    // Handle parameterized URIs first
    if let Some(id) = uri.strip_prefix("zentral://agents/") {
        return providers::agent_by_id(id, state);
    }
    if let Some(id) = uri.strip_prefix("zentral://knowledge/") {
        return providers::document_by_id(id, state);
    }

    match uri {
        "zentral://agents"          => providers::agents(state),
        "zentral://projects"        => providers::projects(state),
        "zentral://projects/active" => providers::active_project(state),
        "zentral://skills"          => providers::skills(state),
        "zentral://schedules"       => providers::schedules(state),
        "zentral://workflows"       => providers::workflows(state),
        "zentral://knowledge"       => providers::knowledge(state),
        "zentral://history/recent"  => providers::history_recent(state),
        "zentral://settings"        => providers::settings(state),
        "zentral://status"          => providers::status(state),
        other => Err(format!("Unknown resource URI: {}", other)),
    }
}
