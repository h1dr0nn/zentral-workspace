/**
 * Discussion Room event routing — detects disc-prefixed agent IDs.
 * Mirrors orchestrationRouter.ts pattern with "disc-" prefix.
 */

export function isDiscussionEvent(agentId: string): boolean {
  return agentId.startsWith("disc-");
}

export function isDiscZennisEvent(agentId: string): boolean {
  return agentId.startsWith("disc-zennis-");
}

export function isDiscAgentEvent(agentId: string): boolean {
  return isDiscussionEvent(agentId) && !isDiscZennisEvent(agentId);
}

export function parseDiscAgentId(agentId: string): {
  type: "zennis" | "agent";
  realAgentId: string;
  sessionId: string;
} | null {
  if (!isDiscussionEvent(agentId)) return null;

  if (agentId.startsWith("disc-zennis-")) {
    return {
      type: "zennis",
      realAgentId: "agent-zennis",
      sessionId: agentId.slice("disc-zennis-".length),
    };
  }

  const withoutPrefix = agentId.slice("disc-".length);
  const lastDash = withoutPrefix.lastIndexOf("-");
  if (lastDash === -1) return null;

  return {
    type: "agent",
    realAgentId: withoutPrefix.slice(0, lastDash),
    sessionId: withoutPrefix.slice(lastDash + 1),
  };
}

export function discAgentId(type: "zennis" | string, sessionId: string): string {
  if (type === "zennis") return `disc-zennis-${sessionId}`;
  return `disc-${type}-${sessionId}`;
}
