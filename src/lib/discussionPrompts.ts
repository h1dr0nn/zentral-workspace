import type { Agent } from "@/stores/agentStore";

export interface AgentSelection {
  agentIds: string[];
  reason: string;
}

export interface AgentOpinion {
  agentId: string;
  agentName: string;
  round: number;
  opinion: string;
}

export interface ConsensusCheck {
  consensus: boolean;
  summary: string;
  nextRoundFocus?: string;
}

/**
 * Zennis selects 2-4 agents to participate in the discussion.
 */
export function buildAgentSelectionPrompt(agents: Agent[], topic: string): string {
  const agentList = agents
    .filter((a) => !a.isSecretary)
    .map((a) => `- ${a.id}: ${a.name} (${a.role}) — skills: ${a.skills.join(", ") || "none"}`)
    .join("\n");

  return `You are Zennis, the orchestrator of the Zentral workspace created by h1dr0n.
A user wants a multi-agent discussion on a topic. Your job: select 2-4 agents best suited to discuss this topic.

You MUST respond ONLY with valid JSON:
{
  "agentIds": ["agent-id-1", "agent-id-2"],
  "reason": "Why these agents were chosen"
}

Available agents:
${agentList}

Topic: "${topic}"

Rules:
- Pick 2-4 agents with relevant expertise
- Choose agents that might have DIFFERENT perspectives for a richer discussion
- Always respond in the same language the user uses`;
}

/**
 * Agent gives their opinion on the topic.
 */
export function buildOpinionPrompt(
  agentName: string,
  agentRole: string,
  topic: string,
  previousOpinions: { name: string; opinion: string }[],
  round: number,
): string {
  const prevBlock = previousOpinions.length > 0
    ? `\n\nOther agents have shared their opinions:\n${previousOpinions.map((o) =>
        `**${o.name}**: ${o.opinion.slice(0, 600)}${o.opinion.length > 600 ? "..." : ""}`
      ).join("\n\n")}\n\n${round > 1 ? "Respond to their points — agree, disagree, or add nuance." : "Consider their perspective but form your own independent view."}`
    : "";

  return `You are ${agentName}, a specialist with the role: ${agentRole}, participating in a multi-agent discussion in the Zentral workspace.

Topic: "${topic}"
Round: ${round}
${prevBlock}

Share your expert opinion on this topic. Be concise but thorough:
- Take a clear position
- Cite specific technical reasoning
- If you disagree with others, explain why
- Always respond in the same language as the topic`;
}

/**
 * Zennis checks whether agents have reached consensus.
 */
export function buildConsensusCheckPrompt(
  topic: string,
  allOpinions: AgentOpinion[],
  round: number,
): string {
  const opinionsBlock = allOpinions
    .map((o) => `[Round ${o.round}] ${o.agentName}: ${o.opinion.slice(0, 500)}${o.opinion.length > 500 ? "..." : ""}`)
    .join("\n\n");

  return `You are Zennis, the orchestrator of the Zentral workspace.
You are moderating a multi-agent discussion. Review all opinions and determine if consensus has been reached.

Topic: "${topic}"
Current round: ${round}

All opinions so far:
${opinionsBlock}

You MUST respond ONLY with valid JSON:
{
  "consensus": true or false,
  "summary": "What they agree/disagree on",
  "nextRoundFocus": "If no consensus, what should the next round focus on (omit if consensus reached)"
}

Rules:
- Consensus = all agents broadly agree on the core recommendation (minor differences are OK)
- Always respond in the same language as the topic`;
}

/**
 * Zennis writes the final conclusion.
 */
export function buildConclusionPrompt(
  topic: string,
  allOpinions: AgentOpinion[],
  consensusSummary: string,
): string {
  const opinionsBlock = allOpinions
    .map((o) => `[Round ${o.round}] ${o.agentName}: ${o.opinion.slice(0, 400)}${o.opinion.length > 400 ? "..." : ""}`)
    .join("\n\n");

  return `You are Zennis, the orchestrator of the Zentral workspace created by h1dr0n.
Write a clear, well-structured conclusion for this discussion. This is shown directly to the user as markdown.

Topic: "${topic}"

Discussion summary: ${consensusSummary}

All opinions:
${opinionsBlock}

Write a conclusion that:
- Summarizes the key points of agreement and disagreement
- Gives a clear recommendation
- Credits specific agents for their contributions
- Is concise but comprehensive
- Responds in the same language as the topic

DO NOT respond with JSON. Write plain markdown.`;
}

/** Parse Zennis agent selection response */
export function parseAgentSelection(text: string): AgentSelection | null {
  try {
    let jsonStr = text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed.agentIds) || parsed.agentIds.length === 0) return null;
    return { agentIds: parsed.agentIds, reason: parsed.reason ?? "" };
  } catch {
    return null;
  }
}

/** Parse Zennis consensus check response */
export function parseConsensusCheck(text: string): ConsensusCheck | null {
  try {
    let jsonStr = text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.consensus !== "boolean") return null;
    return {
      consensus: parsed.consensus,
      summary: parsed.summary ?? "",
      nextRoundFocus: parsed.nextRoundFocus,
    };
  } catch {
    return null;
  }
}
