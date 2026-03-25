import { describe, it, expect } from "vitest";
import {
  parseZennisResponse,
  buildZennisPrompt,
  buildDelegatePrompt,
} from "../orchestrationPrompts";

describe("parseZennisResponse", () => {
  it("parses valid JSON with reply only", () => {
    const input = JSON.stringify({ reply: "Hello! How can I help?" });
    const result = parseZennisResponse(input);
    expect(result.reply).toBe("Hello! How can I help?");
    expect(result.delegate).toBeUndefined();
  });

  it("parses valid JSON with reply and delegate", () => {
    const input = JSON.stringify({
      reply: "I'll delegate to Koda",
      delegate: {
        agentId: "agent-koda",
        instruction: "Write the function",
        reason: "Code task",
      },
    });
    const result = parseZennisResponse(input);
    expect(result.reply).toBe("I'll delegate to Koda");
    expect(result.delegate).toEqual({
      agentId: "agent-koda",
      instruction: "Write the function",
      reason: "Code task",
    });
  });

  it("handles JSON inside markdown code block", () => {
    const input = '```json\n{"reply": "Done!", "delegate": null}\n```';
    const result = parseZennisResponse(input);
    expect(result.reply).toBe("Done!");
    expect(result.delegate).toBeUndefined();
  });

  it("falls back to plain text on invalid JSON", () => {
    const input = "I'm not sure how to help with that. Let me try again.";
    const result = parseZennisResponse(input);
    expect(result.reply).toBe(input);
    expect(result.delegate).toBeUndefined();
  });

  it("falls back when JSON missing reply field", () => {
    const input = JSON.stringify({ message: "no reply field" });
    const result = parseZennisResponse(input);
    expect(result.reply).toBe(input);
  });

  it("ignores delegate with missing agentId", () => {
    const input = JSON.stringify({
      reply: "OK",
      delegate: { instruction: "do stuff" },
    });
    const result = parseZennisResponse(input);
    expect(result.reply).toBe("OK");
    expect(result.delegate).toBeUndefined();
  });
});

describe("buildZennisPrompt", () => {
  const agents = [
    { id: "agent-koda", name: "Koda", role: "Code", status: "idle" as const, skills: ["fix", "explain"], isSecretary: false, projectIds: [] },
    { id: "agent-zennis", name: "Zennis", role: "Orchestrator", status: "online" as const, skills: [], isSecretary: true, projectIds: [] },
  ];

  it("includes non-secretary agents", () => {
    const prompt = buildZennisPrompt(agents, []);
    expect(prompt).toContain("agent-koda");
    expect(prompt).toContain("Koda");
    expect(prompt).not.toContain("agent-zennis"); // secretary excluded from delegation list
  });

  it("includes delegation history", () => {
    const history = [{
      agentId: "agent-koda",
      agentName: "Koda",
      instruction: "Write the function",
      reason: "Code task",
      result: "Done! Here is the code...",
    }];
    const prompt = buildZennisPrompt(agents, history);
    expect(prompt).toContain("Step 1");
    expect(prompt).toContain("Koda");
    expect(prompt).toContain("Done! Here is the code");
  });

  it("requires JSON output", () => {
    const prompt = buildZennisPrompt(agents, []);
    expect(prompt).toContain("valid JSON");
    expect(prompt).toContain('"reply"');
    expect(prompt).toContain('"delegate"');
  });
});

describe("buildDelegatePrompt", () => {
  it("includes agent name, role, and instruction", () => {
    const prompt = buildDelegatePrompt("Koda", "Code & Architecture", "Write a helper function");
    expect(prompt).toContain("Koda");
    expect(prompt).toContain("Code & Architecture");
    expect(prompt).toContain("Write a helper function");
    expect(prompt).toContain("h1dr0n");
  });
});
