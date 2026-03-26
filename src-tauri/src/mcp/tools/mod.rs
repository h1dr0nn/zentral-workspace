pub mod agents;
pub mod chat;
pub mod history;
pub mod knowledge;
pub mod projects;
pub mod schedules;
pub mod skills;
pub mod workflows;

use serde_json::Value;
use super::McpState;

pub struct ToolDef {
    pub name: &'static str,
    pub description: &'static str,
    pub input_schema: Value,
}

pub fn all_tools() -> Vec<ToolDef> {
    let mut tools = Vec::new();
    tools.extend(agents::tools());
    tools.extend(projects::tools());
    tools.extend(skills::tools());
    tools.extend(schedules::tools());
    tools.extend(workflows::tools());
    tools.extend(knowledge::tools());
    tools.extend(chat::tools());
    tools.extend(history::tools());
    tools
}

pub fn call_tool(name: &str, args: Value, state: &McpState) -> Result<Value, String> {
    match name {
        // Agents
        "list_agents"     => agents::list_agents(args, state),
        "get_agent"       => agents::get_agent(args, state),
        "create_agent"    => agents::create_agent(args, state),
        "update_agent"    => agents::update_agent(args, state),
        "delete_agent"    => agents::delete_agent(args, state),
        // Projects
        "list_projects"       => projects::list_projects(args, state),
        "get_active_project"  => projects::get_active_project(args, state),
        "create_project"      => projects::create_project(args, state),
        "switch_project"      => projects::switch_project(args, state),
        // Skills
        "list_skills"   => skills::list_skills(args, state),
        "create_skill"  => skills::create_skill(args, state),
        "run_skill"     => skills::run_skill(args, state),
        // Schedules
        "list_schedules"    => schedules::list_schedules(args, state),
        "create_schedule"   => schedules::create_schedule(args, state),
        "update_schedule"   => schedules::update_schedule(args, state),
        "toggle_schedule"   => schedules::toggle_schedule(args, state),
        "delete_schedule"   => schedules::delete_schedule(args, state),
        // Workflows
        "list_workflows"        => workflows::list_workflows(args, state),
        "create_workflow"       => workflows::create_workflow(args, state),
        "run_workflow"          => workflows::run_workflow(args, state),
        "get_workflow_status"   => workflows::get_workflow_status(args, state),
        // Knowledge
        "list_documents"    => knowledge::list_documents(args, state),
        "create_document"   => knowledge::create_document(args, state),
        "get_document"      => knowledge::get_document(args, state),
        "update_document"   => knowledge::update_document(args, state),
        "delete_document"   => knowledge::delete_document(args, state),
        // Chat
        "send_message"      => chat::send_message(args, state),
        "get_chat_history"  => chat::get_chat_history(args, state),
        // History
        "get_history"   => history::get_history(args, state),
        "get_stats"     => history::get_stats(args, state),
        other => Err(format!("Unknown tool: {}", other)),
    }
}
