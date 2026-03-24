import { invoke } from "@tauri-apps/api/core";
import type { Agent } from "@/stores/agentStore";
import type { Project } from "@/stores/projectStore";
import type { Settings } from "@/stores/settingsStore";

type Commands = {
  create_agent: [{ name: string; role: string; skills: string[] }, Agent];
  delete_agent: [{ id: string }, void];
  list_agents: [void, Agent[]];
  send_message: [{ agentId: string; message: string }, void];
  switch_project: [{ path: string }, Project];
  list_projects: [void, Project[]];
  get_settings: [void, Settings];
  update_settings: [Partial<Settings>, Settings];
  start_telegram_bot: [{ token: string }, void];
  stop_telegram_bot: [void, void];
};

export async function tauriInvoke<K extends keyof Commands>(
  command: K,
  ...args: Commands[K][0] extends void ? [] : [Commands[K][0]]
): Promise<Commands[K][1]> {
  return invoke(command, args[0] ?? {});
}
