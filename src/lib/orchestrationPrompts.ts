import type { Agent } from "@/stores/agentStore";

export interface DelegationRecord {
  agentId: string;
  agentName: string;
  instruction: string;
  reason: string;
  result: string;
}

export interface ZennisDecision {
  reply: string;
  delegate?: {
    agentId: string;
    instruction: string;
    reason: string;
  };
}

/**
 * Build the orchestration system prompt for Zennis.
 * Requires Zennis to respond with strict JSON.
 */
export function buildZennisPrompt(
  agents: Agent[],
  delegationHistory: DelegationRecord[],
): string {
  const agentList = agents
    .filter((a) => !a.isSecretary)
    .map((a) => `- ${a.id}: ${a.name} (${a.role}) — skills: ${a.skills.join(", ") || "none"}`)
    .join("\n");

  const historyBlock = delegationHistory.length > 0
    ? `\n\nPrevious delegation results in this session:\n${delegationHistory.map((d, i) =>
        `[Step ${i + 1}] Delegated to ${d.agentName}: "${d.instruction}"\nResult: ${d.result.slice(0, 500)}${d.result.length > 500 ? "..." : ""}`
      ).join("\n\n")}`
    : "";

  return `You are Zennis, the orchestrator of the Zentral workspace — a multi-agent desktop app created by h1dr0n.
Your job: analyze user requests, respond helpfully, and delegate tasks to specialized agents when appropriate.

You MUST respond ONLY with valid JSON matching this exact schema (no text before or after):
{
  "reply": "Your message to the user (markdown supported)",
  "delegate": {
    "agentId": "agent-id",
    "instruction": "Detailed instruction for the agent",
    "reason": "Why this agent was chosen"
  }
}

The "delegate" field is OPTIONAL. Omit it entirely if you can handle the request yourself or if the task is complete.

Available agents for delegation:
${agentList}

Rules:
- Always respond in the same language the user uses
- Only delegate when the task genuinely requires a specialist
- For simple questions, greetings, or conversation — reply directly without delegation
- Each delegation instruction must be self-contained (the agent has no prior context)
- If reviewing a completed delegation, decide: reply to user (done) or chain to another agent
${historyBlock}`;
}

/**
 * Build the system prompt for a delegated agent.
 */
export function buildDelegatePrompt(
  agentName: string,
  agentRole: string,
  instruction: string,
): string {
  return `You are ${agentName}, a specialized agent with the role: ${agentRole}, working inside the Zentral workspace created by h1dr0n.

You have been delegated the following task by Zennis (the orchestrator):
---
${instruction}
---

Complete this task thoroughly and concisely. Always respond in the same language as the instruction. When done, report your results clearly.`;
}

/**
 * Try to parse Zennis JSON response. Falls back to plain reply on failure.
 */
export function parseZennisResponse(text: string): ZennisDecision {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.reply !== "string") {
      return { reply: text };
    }
    return {
      reply: parsed.reply,
      delegate: parsed.delegate && typeof parsed.delegate.agentId === "string"
        ? parsed.delegate
        : undefined,
    };
  } catch {
    // Fallback: treat entire text as plain reply
    return { reply: text };
  }
}
