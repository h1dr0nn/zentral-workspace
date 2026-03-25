mod agent;
mod automation;
mod commands;
mod config;
pub mod persistence;
mod process;
mod project;
mod telegram;

use tauri::Manager;
use commands::{
    agent as agent_cmd, auth as auth_cmd, chat as chat_cmd, config as config_cmd,
    history as history_cmd, knowledge as knowledge_cmd, migration as migration_cmd,
    project as project_cmd, schedule as schedule_cmd, session, skill as skill_cmd,
    telegram as telegram_cmd, terminal as terminal_cmd, workflow as workflow_cmd,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let db = persistence::Database::init().expect("Failed to initialize database");

    // Seed builtin agents and skills on startup
    {
        let conn = db.lock().expect("Failed to lock DB for seeding");
        seed::seed_builtins(&conn);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(config::AppSettings::default())
        .manage(db)
        .manage(process::pty::new_manager())
        .invoke_handler(tauri::generate_handler![
            // Auth
            auth_cmd::check_auth_status,
            auth_cmd::start_login,
            auth_cmd::logout,
            // Chat
            chat_cmd::send_chat_message,
            chat_cmd::save_chat_message,
            chat_cmd::get_chat_messages,
            chat_cmd::delete_chat_messages,
            // Agents
            agent_cmd::list_agents,
            agent_cmd::create_agent,
            agent_cmd::update_agent,
            agent_cmd::delete_agent,
            agent_cmd::send_message,
            // Projects
            project_cmd::list_projects,
            project_cmd::create_project,
            project_cmd::update_project,
            project_cmd::delete_project,
            project_cmd::switch_project,
            // Skills
            skill_cmd::list_skills,
            skill_cmd::create_skill,
            skill_cmd::update_skill,
            skill_cmd::delete_skill,
            // Config
            config_cmd::get_settings,
            config_cmd::update_settings,
            // Schedules
            schedule_cmd::list_schedules,
            schedule_cmd::create_schedule,
            schedule_cmd::update_schedule,
            schedule_cmd::delete_schedule,
            schedule_cmd::toggle_schedule_status,
            // Workflows
            workflow_cmd::list_workflows,
            workflow_cmd::create_workflow,
            workflow_cmd::update_workflow,
            workflow_cmd::delete_workflow,
            workflow_cmd::run_workflow,
            workflow_cmd::get_workflow_run,
            workflow_cmd::cancel_workflow_run,
            // History
            history_cmd::list_history,
            history_cmd::add_history_event,
            history_cmd::clear_history,
            // Knowledge
            knowledge_cmd::list_knowledge_documents,
            knowledge_cmd::create_knowledge_document,
            knowledge_cmd::update_knowledge_document,
            knowledge_cmd::delete_knowledge_document,
            // Terminal PTY
            terminal_cmd::pty_spawn,
            terminal_cmd::pty_write,
            terminal_cmd::pty_resize,
            terminal_cmd::pty_kill,
            // Telegram
            telegram_cmd::start_telegram_bot,
            telegram_cmd::stop_telegram_bot,
            // Session
            session::create_session,
            // Migration
            migration_cmd::check_needs_migration,
            migration_cmd::import_projects,
            migration_cmd::import_agents,
            migration_cmd::import_skills,
            migration_cmd::import_chat_messages,
            migration_cmd::import_schedules,
            migration_cmd::import_workflows,
            migration_cmd::import_history,
            migration_cmd::import_knowledge,
            migration_cmd::mark_migration_complete,
        ])
        .setup(|app| {
            // Start the schedule execution engine
            let db_for_scheduler = app.state::<persistence::Db>().inner().clone();
            let app_handle = app.handle().clone();
            let settings = app.state::<config::AppSettings>();
            let claude_path = {
                let p = settings.claude_cli_path.lock().unwrap().clone();
                if p.is_empty() { "claude".to_string() } else { p }
            };
            let model = settings.default_model.lock().unwrap().clone();
            automation::scheduler::start(db_for_scheduler, app_handle, claude_path, model);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Seed builtin agents and skills into the database on startup.
mod seed {
    use crate::persistence::models::{AgentRow, SkillRow};
    use rusqlite::Connection;

    pub fn seed_builtins(conn: &Connection) {
        seed_agents(conn);
        seed_skills(conn);
    }

    fn seed_agents(conn: &Connection) {
        let builtins = vec![
            AgentRow { id: "agent-zennis".into(), name: "Zennis".into(), role: "Orchestrator".into(), status: "online".into(), skills: "[]".into(), is_secretary: true, project_ids: "[]".into(), is_builtin: true },
            AgentRow { id: "agent-vex".into(), name: "Vex".into(), role: "Git & Version Control".into(), status: "idle".into(), skills: r#"["commit","review-pr","git-pushing","changelog","using-git-worktrees"]"#.into(), is_secretary: false, project_ids: "[]".into(), is_builtin: true },
            AgentRow { id: "agent-koda".into(), name: "Koda".into(), role: "Code & Architecture".into(), status: "idle".into(), skills: r#"["simplify","explain","fix","software-architecture","prompt-engineering","artifacts-builder","mcp-builder"]"#.into(), is_secretary: false, project_ids: "[]".into(), is_builtin: true },
            AgentRow { id: "agent-prova".into(), name: "Prova".into(), role: "Testing & QA".into(), status: "stopped".into(), skills: r#"["test","tdd","test-fixing","playwright","webapp-testing"]"#.into(), is_secretary: false, project_ids: "[]".into(), is_builtin: true },
            AgentRow { id: "agent-doxa".into(), name: "Doxa".into(), role: "Documentation".into(), status: "stopped".into(), skills: r#"["docs","api-docs","skill-creator"]"#.into(), is_secretary: false, project_ids: "[]".into(), is_builtin: true },
            AgentRow { id: "agent-nova".into(), name: "Nova".into(), role: "Research & Analysis".into(), status: "stopped".into(), skills: r#"["deep-research","brainstorming","root-cause-tracing"]"#.into(), is_secretary: false, project_ids: "[]".into(), is_builtin: true },
            AgentRow { id: "agent-datum".into(), name: "Datum".into(), role: "Data Processing".into(), status: "stopped".into(), skills: r#"["csv-summarizer","pdf","docx","xlsx"]"#.into(), is_secretary: false, project_ids: "[]".into(), is_builtin: true },
            AgentRow { id: "agent-flux".into(), name: "Flux".into(), role: "DevOps & Infrastructure".into(), status: "idle".into(), skills: r#"["aws-skills","finishing-branch","subagent-dev"]"#.into(), is_secretary: false, project_ids: "[]".into(), is_builtin: true },
            AgentRow { id: "agent-tempo".into(), name: "Tempo".into(), role: "Productivity & Workflow".into(), status: "stopped".into(), skills: r#"["kaizen","ship-learn-next","review-implementing"]"#.into(), is_secretary: false, project_ids: "[]".into(), is_builtin: true },
        ];
        for a in &builtins {
            let _ = crate::persistence::agents::upsert(conn, a);
        }
    }

    fn seed_skills(conn: &Connection) {
        let builtins = vec![
            SkillRow { id: "commit".into(), name: "commit".into(), description: "Create a git commit with a descriptive message".into(), category: "Git".into(), prompt: "Review staged changes and create a commit with a clear, conventional commit message.".into(), is_builtin: true },
            SkillRow { id: "review-pr".into(), name: "review-pr".into(), description: "Review a pull request for issues and improvements".into(), category: "Git".into(), prompt: "Review the given pull request. Check for bugs, security issues, and suggest improvements.".into(), is_builtin: true },
            SkillRow { id: "git-pushing".into(), name: "git-pushing".into(), description: "Automate git push operations safely".into(), category: "Git".into(), prompt: "Push changes to remote, handling conflicts and ensuring branch safety.".into(), is_builtin: true },
            SkillRow { id: "changelog".into(), name: "changelog".into(), description: "Generate changelogs from git commits".into(), category: "Git".into(), prompt: "Create a user-facing changelog from recent git commits, grouping by type.".into(), is_builtin: true },
            SkillRow { id: "using-git-worktrees".into(), name: "using-git-worktrees".into(), description: "Create isolated git worktrees safely".into(), category: "Git".into(), prompt: "Create and manage git worktrees for parallel development.".into(), is_builtin: true },
            SkillRow { id: "simplify".into(), name: "simplify".into(), description: "Review code for reuse, quality, and efficiency".into(), category: "Code".into(), prompt: "Review changed code for reuse opportunities, quality issues, and efficiency. Fix any issues found.".into(), is_builtin: true },
            SkillRow { id: "explain".into(), name: "explain".into(), description: "Explain how a piece of code works".into(), category: "Code".into(), prompt: "Explain the selected code in detail, covering what it does and important patterns.".into(), is_builtin: true },
            SkillRow { id: "fix".into(), name: "fix".into(), description: "Fix bugs or errors in the code".into(), category: "Code".into(), prompt: "Identify and fix any bugs or errors in the selected code. Explain what was wrong.".into(), is_builtin: true },
            SkillRow { id: "software-architecture".into(), name: "software-architecture".into(), description: "Design patterns, SOLID principles, architecture".into(), category: "Code".into(), prompt: "Implement appropriate design patterns and SOLID principles for the given problem.".into(), is_builtin: true },
            SkillRow { id: "prompt-engineering".into(), name: "prompt-engineering".into(), description: "Teach prompt engineering techniques".into(), category: "Code".into(), prompt: "Guide through prompt engineering techniques and patterns for effective AI usage.".into(), is_builtin: true },
            SkillRow { id: "artifacts-builder".into(), name: "artifacts-builder".into(), description: "Create multi-component HTML artifacts with React + Tailwind".into(), category: "Code".into(), prompt: "Create interactive HTML artifacts using React and Tailwind CSS.".into(), is_builtin: true },
            SkillRow { id: "mcp-builder".into(), name: "mcp-builder".into(), description: "Guide creation of MCP servers".into(), category: "Code".into(), prompt: "Guide the creation of Model Context Protocol servers step by step.".into(), is_builtin: true },
            SkillRow { id: "test".into(), name: "test".into(), description: "Generate tests for the selected code".into(), category: "Testing".into(), prompt: "Write comprehensive tests covering edge cases and expected behaviors.".into(), is_builtin: true },
            SkillRow { id: "tdd".into(), name: "tdd".into(), description: "Test-driven development approach".into(), category: "Testing".into(), prompt: "Implement features using TDD: write failing test first, then implementation.".into(), is_builtin: true },
            SkillRow { id: "test-fixing".into(), name: "test-fixing".into(), description: "Detect failing tests and propose fixes".into(), category: "Testing".into(), prompt: "Analyze failing tests, identify root causes, and propose fixes.".into(), is_builtin: true },
            SkillRow { id: "playwright".into(), name: "playwright".into(), description: "Browser automation and web app testing".into(), category: "Testing".into(), prompt: "Create Playwright tests for web application testing and automation.".into(), is_builtin: true },
            SkillRow { id: "webapp-testing".into(), name: "webapp-testing".into(), description: "Test local web apps end-to-end".into(), category: "Testing".into(), prompt: "Test local web applications using browser automation tools.".into(), is_builtin: true },
            SkillRow { id: "docs".into(), name: "docs".into(), description: "Generate documentation for code".into(), category: "Documentation".into(), prompt: "Generate clear documentation including usage examples.".into(), is_builtin: true },
            SkillRow { id: "api-docs".into(), name: "api-docs".into(), description: "Generate API documentation".into(), category: "Documentation".into(), prompt: "Generate API docs with endpoints, parameters, and response examples.".into(), is_builtin: true },
            SkillRow { id: "skill-creator".into(), name: "skill-creator".into(), description: "Guidance for creating effective Claude Skills".into(), category: "Documentation".into(), prompt: "Guide the creation of well-structured Claude Skills with proper formatting.".into(), is_builtin: true },
            SkillRow { id: "deep-research".into(), name: "deep-research".into(), description: "Multi-step deep research on a topic".into(), category: "Research".into(), prompt: "Execute multi-step research, synthesizing findings into a comprehensive report.".into(), is_builtin: true },
            SkillRow { id: "brainstorming".into(), name: "brainstorming".into(), description: "Transform ideas into fully-formed designs".into(), category: "Research".into(), prompt: "Take rough ideas and develop them into well-structured, actionable designs.".into(), is_builtin: true },
            SkillRow { id: "root-cause-tracing".into(), name: "root-cause-tracing".into(), description: "Trace errors back to original triggers".into(), category: "Research".into(), prompt: "Trace the given error or issue back to its root cause through systematic analysis.".into(), is_builtin: true },
            SkillRow { id: "csv-summarizer".into(), name: "csv-summarizer".into(), description: "Analyze CSV files and generate insights".into(), category: "Data".into(), prompt: "Analyze the CSV data, generate summary statistics and key insights.".into(), is_builtin: true },
            SkillRow { id: "pdf".into(), name: "pdf".into(), description: "Extract text, tables, metadata from PDFs".into(), category: "Data".into(), prompt: "Extract and process content from PDF files.".into(), is_builtin: true },
            SkillRow { id: "docx".into(), name: "docx".into(), description: "Create, edit, analyze Word documents".into(), category: "Data".into(), prompt: "Work with Word documents: create, edit, and analyze content.".into(), is_builtin: true },
            SkillRow { id: "xlsx".into(), name: "xlsx".into(), description: "Spreadsheet manipulation with formulas and charts".into(), category: "Data".into(), prompt: "Manipulate spreadsheets with formulas, charts, and data transformations.".into(), is_builtin: true },
            SkillRow { id: "aws-skills".into(), name: "aws-skills".into(), description: "AWS development with CDK and serverless patterns".into(), category: "DevOps".into(), prompt: "Develop AWS solutions using CDK best practices and serverless patterns.".into(), is_builtin: true },
            SkillRow { id: "finishing-branch".into(), name: "finishing-branch".into(), description: "Guide completion of development branch workflows".into(), category: "DevOps".into(), prompt: "Guide the completion of a development branch: cleanup, squash, rebase, merge.".into(), is_builtin: true },
            SkillRow { id: "subagent-dev".into(), name: "subagent-dev".into(), description: "Dispatch subagents for rapid parallel development".into(), category: "DevOps".into(), prompt: "Dispatch independent subagents for rapid parallel development tasks.".into(), is_builtin: true },
            SkillRow { id: "kaizen".into(), name: "kaizen".into(), description: "Apply continuous improvement methodology".into(), category: "Productivity".into(), prompt: "Apply kaizen continuous improvement methodology to the given process or workflow.".into(), is_builtin: true },
            SkillRow { id: "ship-learn-next".into(), name: "ship-learn-next".into(), description: "Iterate on what to build or learn next".into(), category: "Productivity".into(), prompt: "Help decide what to build or learn next based on current progress and goals.".into(), is_builtin: true },
            SkillRow { id: "review-implementing".into(), name: "review-implementing".into(), description: "Evaluate code implementation plans".into(), category: "Productivity".into(), prompt: "Evaluate a proposed implementation plan for completeness and feasibility.".into(), is_builtin: true },
        ];
        for s in &builtins {
            let _ = crate::persistence::skills::upsert(conn, s);
        }
    }
}
