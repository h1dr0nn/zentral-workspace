import { describe, it, expect } from "vitest";
import {
  parseAgentSelection,
  parseConsensusCheck,
  buildAgentSelectionPrompt,
  buildOpinionPrompt,
  buildConsensusCheckPrompt,
  buildConclusionPrompt,
} from "../discussionPrompts";

describe("parseAgentSelection", () => {
  it("parses valid agent selection", () => {
    const input = JSON.stringify({
      agentIds: ["agent-koda", "agent-flux"],
      reason: "Relevant to code and infra",
    });
    const result = parseAgentSelection(input);
    expect(result).toEqual({
      agentIds: ["agent-koda", "agent-flux"],
      reason: "Relevant to code and infra",
    });
  });

  it("handles markdown code block", () => {
    const input = '```json\n{"agentIds": ["agent-nova"], "reason": "Research"}\n```';
    const result = parseAgentSelection(input);
    expect(result?.agentIds).toEqual(["agent-nova"]);
  });

  it("returns null for empty agentIds", () => {
    const input = JSON.stringify({ agentIds: [], reason: "none" });
    expect(parseAgentSelection(input)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseAgentSelection("not json")).toBeNull();
  });

  it("returns null for missing agentIds", () => {
    const input = JSON.stringify({ reason: "no agents field" });
    expect(parseAgentSelection(input)).toBeNull();
  });
});

describe("parseConsensusCheck", () => {
  it("parses consensus reached", () => {
    const input = JSON.stringify({
      consensus: true,
      summary: "All agents agree on Redis",
    });
    const result = parseConsensusCheck(input);
    expect(result).toEqual({
      consensus: true,
      summary: "All agents agree on Redis",
      nextRoundFocus: undefined,
    });
  });

  it("parses no consensus with focus", () => {
    const input = JSON.stringify({
      consensus: false,
      summary: "Koda prefers Redis, Flux prefers Memcached",
      nextRoundFocus: "Compare performance benchmarks",
    });
    const result = parseConsensusCheck(input);
    expect(result?.consensus).toBe(false);
    expect(result?.nextRoundFocus).toBe("Compare performance benchmarks");
  });

  it("handles markdown code block", () => {
    const input = '```\n{"consensus": true, "summary": "Agreed"}\n```';
    const result = parseConsensusCheck(input);
    expect(result?.consensus).toBe(true);
  });

  it("returns null for invalid JSON", () => {
    expect(parseConsensusCheck("maybe consensus")).toBeNull();
  });

  it("returns null for missing consensus field", () => {
    const input = JSON.stringify({ summary: "no consensus field" });
    expect(parseConsensusCheck(input)).toBeNull();
  });
});

describe("buildAgentSelectionPrompt", () => {
  const agents = [
    { id: "agent-koda", name: "Koda", role: "Code", status: "idle" as const, skills: ["fix"], isSecretary: false, projectIds: [] },
    { id: "agent-zennis", name: "Zennis", role: "Orchestrator", status: "online" as const, skills: [], isSecretary: true, projectIds: [] },
    { id: "agent-flux", name: "Flux", role: "DevOps", status: "idle" as const, skills: ["aws-skills"], isSecretary: false, projectIds: [] },
  ];

  it("lists non-secretary agents", () => {
    const prompt = buildAgentSelectionPrompt(agents, "Redis vs Memcached");
    expect(prompt).toContain("agent-koda");
    expect(prompt).toContain("agent-flux");
    expect(prompt).not.toContain("agent-zennis");
  });

  it("includes topic", () => {
    const prompt = buildAgentSelectionPrompt(agents, "Redis vs Memcached");
    expect(prompt).toContain("Redis vs Memcached");
  });

  it("requires JSON output", () => {
    const prompt = buildAgentSelectionPrompt(agents, "test");
    expect(prompt).toContain("agentIds");
    expect(prompt).toContain("valid JSON");
  });
});

describe("buildOpinionPrompt", () => {
  it("includes topic and agent info", () => {
    const prompt = buildOpinionPrompt("Koda", "Code", "Redis vs Memcached", [], 1);
    expect(prompt).toContain("Koda");
    expect(prompt).toContain("Code");
    expect(prompt).toContain("Redis vs Memcached");
    expect(prompt).toContain("Round: 1");
  });

  it("includes previous opinions", () => {
    const prev = [{ name: "Flux", opinion: "I prefer Redis for its data structures" }];
    const prompt = buildOpinionPrompt("Koda", "Code", "Redis vs Memcached", prev, 1);
    expect(prompt).toContain("Flux");
    expect(prompt).toContain("Redis for its data structures");
  });

  it("adjusts instruction for round 2+", () => {
    const prev = [{ name: "Flux", opinion: "Redis" }];
    const r1 = buildOpinionPrompt("Koda", "Code", "test", prev, 1);
    const r2 = buildOpinionPrompt("Koda", "Code", "test", prev, 2);
    expect(r1).toContain("independent view");
    expect(r2).toContain("Respond to their points");
  });
});

describe("buildConsensusCheckPrompt", () => {
  it("includes all opinions", () => {
    const opinions = [
      { agentId: "agent-koda", agentName: "Koda", round: 1, opinion: "Redis is better" },
      { agentId: "agent-flux", agentName: "Flux", round: 1, opinion: "Memcached is simpler" },
    ];
    const prompt = buildConsensusCheckPrompt("Redis vs Memcached", opinions, 1);
    expect(prompt).toContain("Koda");
    expect(prompt).toContain("Flux");
    expect(prompt).toContain("Redis is better");
    expect(prompt).toContain("Memcached is simpler");
    expect(prompt).toContain("consensus");
  });
});

describe("buildConclusionPrompt", () => {
  it("includes topic and summary", () => {
    const opinions = [
      { agentId: "a", agentName: "Koda", round: 1, opinion: "Redis" },
    ];
    const prompt = buildConclusionPrompt("Redis vs Memcached", opinions, "Both prefer Redis");
    expect(prompt).toContain("Redis vs Memcached");
    expect(prompt).toContain("Both prefer Redis");
    expect(prompt).toContain("DO NOT respond with JSON");
  });
});
