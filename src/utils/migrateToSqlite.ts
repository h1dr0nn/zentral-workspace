import { invoke } from "@tauri-apps/api/core";

/**
 * One-time migration from localStorage to SQLite backend.
 * Idempotent — safe to call on every app launch.
 */
export async function migrateLocalStorageToSqlite(): Promise<void> {
  try {
    const needsMigration: boolean = await invoke("check_needs_migration");
    if (!needsMigration) return;

    console.log("[migration] Starting localStorage → SQLite migration...");

    // Projects
    const projects = safeParse<any[]>("zentral:projects", []);
    if (projects.length) {
      const rows = projects.map((p) => ({
        id: p.id,
        name: p.name,
        path: p.path,
        context_badges: JSON.stringify(p.contextBadges ?? []),
        last_opened_at: p.lastOpenedAt ?? new Date().toISOString(),
      }));
      await invoke("import_projects", { projects: rows });
      console.log(`[migration] Imported ${rows.length} projects`);
    }

    // Agents (only custom + builtin overrides)
    const agents = safeParse<any[]>("zentral:agents", []);
    if (agents.length) {
      const rows = agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.status ?? "idle",
        skills: JSON.stringify(a.skills ?? []),
        is_secretary: a.isSecretary ?? false,
        project_ids: JSON.stringify(a.projectIds ?? []),
        is_builtin: a.id.startsWith("agent-") && !a.id.startsWith("agent-custom-"),
      }));
      await invoke("import_agents", { agents: rows });
      console.log(`[migration] Imported ${rows.length} agents`);
    }

    // Skills (only custom)
    const skills = safeParse<any[]>("zentral:skills", []);
    const customSkills = skills.filter((s) => !s.builtin);
    if (customSkills.length) {
      const rows = customSkills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? "",
        category: s.category ?? "",
        prompt: s.prompt ?? "",
        is_builtin: false,
      }));
      await invoke("import_skills", { skills: rows });
      console.log(`[migration] Imported ${rows.length} custom skills`);
    }

    // Chat messages
    const chatMessages = safeParse<Record<string, any[]>>("zentral:chat-messages", {});
    const chatKeys = Object.keys(chatMessages);
    if (chatKeys.length) {
      const allMessages: Record<string, any[]> = {};
      for (const key of chatKeys) {
        allMessages[key] = chatMessages[key].map((m) => ({
          id: m.id,
          chat_key: key,
          agent_id: m.agentId,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          source: m.source ?? "local",
        }));
      }
      await invoke("import_chat_messages", { messages: allMessages });
      console.log(`[migration] Imported chat messages for ${chatKeys.length} keys`);
    }

    // Schedules
    const schedules = safeParse<any[]>("zentral:schedules", []);
    if (schedules.length) {
      const rows = schedules.map((s) => ({
        id: s.id,
        name: s.name,
        agent_id: s.agentId,
        skill_id: s.skillId,
        project_id: s.projectId ?? null,
        frequency: s.frequency ?? "daily",
        cron_expression: s.cronExpression ?? "",
        prompt: s.prompt ?? "",
        description: s.description ?? "",
        status: s.status ?? "active",
        next_run_at: s.nextRunAt ?? new Date().toISOString(),
        last_run_at: s.lastRunAt ?? null,
        created_at: s.createdAt ?? new Date().toISOString(),
      }));
      await invoke("import_schedules", { schedules: rows });
      console.log(`[migration] Imported ${rows.length} schedules`);
    }

    // Workflows (send as JSON values — backend parses camelCase)
    const workflows = safeParse<any[]>("zentral:workflows", []);
    if (workflows.length) {
      await invoke("import_workflows", { workflows });
      console.log(`[migration] Imported ${workflows.length} workflows`);
    }

    // History
    const history = safeParse<any[]>("zentral:history", []);
    if (history.length) {
      const rows = history.map((e) => ({
        id: e.id,
        event_type: e.type,
        agent_id: e.agentId,
        project_id: e.projectId ?? null,
        skill_id: e.skillId ?? null,
        workflow_id: e.workflowId ?? null,
        summary: e.summary,
        details: e.details ?? null,
        status: e.status ?? "success",
        duration: e.duration ?? null,
        timestamp: e.timestamp ?? new Date().toISOString(),
      }));
      await invoke("import_history", { events: rows });
      console.log(`[migration] Imported ${rows.length} history events`);
    }

    // Knowledge
    const knowledge = safeParse<any[]>("zentral:knowledge", []);
    if (knowledge.length) {
      const rows = knowledge.map((d) => ({
        id: d.id,
        title: d.title,
        content: d.content ?? "",
        category: d.category ?? "notes",
        tags: JSON.stringify(d.tags ?? []),
        project_ids: JSON.stringify(d.projectIds ?? []),
        agent_ids: JSON.stringify(d.agentIds ?? []),
        created_at: d.createdAt ?? new Date().toISOString(),
        updated_at: d.updatedAt ?? new Date().toISOString(),
      }));
      await invoke("import_knowledge", { documents: rows });
      console.log(`[migration] Imported ${rows.length} knowledge documents`);
    }

    // Settings
    const settings = safeParse<Record<string, any>>("zentral:settings", {});
    if (Object.keys(settings).length) {
      // Map frontend camelCase to backend snake_case
      const mapped: Record<string, string> = {};
      const keyMap: Record<string, string> = {
        theme: "theme",
        fontSize: "font_size",
        chatFontSize: "chat_font_size",
        defaultShell: "default_shell",
        maxConcurrentAgents: "max_concurrent_agents",
        defaultAgentTimeout: "default_agent_timeout",
        autoRestartOnCrash: "auto_restart_on_crash",
        crashLoopThreshold: "crash_loop_threshold",
        telegramEnabled: "telegram_enabled",
        telegramBotToken: "telegram_bot_token",
        telegramAllowedChatIds: "telegram_allowed_chat_ids",
        chatTokenBudget: "chat_token_budget",
        chatRetention: "chat_retention",
        claudeCliPath: "claude_cli_path",
      };
      for (const [camel, snake] of Object.entries(keyMap)) {
        if (camel in settings) {
          mapped[snake] = String(settings[camel]);
        }
      }
      // Use update_settings with the SettingsDto format
      await invoke("update_settings", { settings: {
        theme: settings.theme ?? "",
        font_size: settings.fontSize ?? 14,
        chat_font_size: settings.chatFontSize ?? 14,
        default_shell: settings.defaultShell ?? "",
        max_concurrent_agents: settings.maxConcurrentAgents ?? 5,
        default_agent_timeout: settings.defaultAgentTimeout ?? 30,
        auto_restart_on_crash: settings.autoRestartOnCrash ?? true,
        crash_loop_threshold: settings.crashLoopThreshold ?? 3,
        telegram_enabled: settings.telegramEnabled ?? false,
        telegram_bot_token: settings.telegramBotToken ?? "",
        telegram_allowed_chat_ids: settings.telegramAllowedChatIds ?? "",
        chat_token_budget: settings.chatTokenBudget ?? 4000,
        chat_retention: settings.chatRetention ?? "all",
        claude_cli_path: settings.claudeCliPath ?? "",
      }});
      console.log("[migration] Imported settings");
    }

    await invoke("mark_migration_complete");
    console.log("[migration] Migration complete!");
  } catch (err) {
    console.error("[migration] Migration failed:", err);
    // Don't throw — app should still work with localStorage fallback
  }
}

function safeParse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
