/**
 * Orchestration event routing — detects orch-prefixed agent IDs
 * and routes Tauri stream events to the correct handler.
 */

export function isOrchestrationEvent(agentId: string): boolean {
  return agentId.startsWith("orch-");
}

export function isZennisEvent(agentId: string): boolean {
  return agentId.startsWith("orch-zennis-");
}

export function isAgentEvent(agentId: string): boolean {
  return isOrchestrationEvent(agentId) && !isZennisEvent(agentId);
}

/**
 * Extract the real agent ID and session ID from an orchestration agent ID.
 * Format: "orch-zennis-{sessionId}" or "orch-{agentId}-{sessionId}"
 */
export function parseOrchAgentId(agentId: string): {
  type: "zennis" | "agent";
  realAgentId: string;
  sessionId: string;
} | null {
  if (!isOrchestrationEvent(agentId)) return null;

  if (agentId.startsWith("orch-zennis-")) {
    return {
      type: "zennis",
      realAgentId: "agent-zennis",
      sessionId: agentId.slice("orch-zennis-".length),
    };
  }

  // "orch-agent-koda-abc123" → realAgentId = "agent-koda", sessionId = "abc123"
  const withoutPrefix = agentId.slice("orch-".length); // "agent-koda-abc123"
  const lastDash = withoutPrefix.lastIndexOf("-");
  if (lastDash === -1) return null;

  return {
    type: "agent",
    realAgentId: withoutPrefix.slice(0, lastDash),
    sessionId: withoutPrefix.slice(lastDash + 1),
  };
}

/** Build an orchestration agent ID */
export function orchAgentId(type: "zennis" | string, sessionId: string): string {
  if (type === "zennis") return `orch-zennis-${sessionId}`;
  return `orch-${type}-${sessionId}`;
}
