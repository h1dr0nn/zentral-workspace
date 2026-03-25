import { describe, it, expect } from "vitest";
import { estimateTokens, buildContextFromBudget } from "../tokenBudget";
import type { ChatMessage } from "@/stores/chatStore";

function msg(role: "user" | "agent", content: string, id = "m"): ChatMessage {
  return { id, agentId: "a", role, content, timestamp: Date.now() };
}

describe("estimateTokens", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("hi")).toBe(1);
    expect(estimateTokens("hello world")).toBe(3); // 11 chars / 4 = 2.75 → 3
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });
});

describe("buildContextFromBudget", () => {
  it("returns empty for no messages", () => {
    expect(buildContextFromBudget([], 4000)).toBe("");
  });

  it("formats user and agent messages", () => {
    const messages = [
      msg("user", "hello"),
      msg("agent", "hi there"),
    ];
    const result = buildContextFromBudget(messages, 4000);
    expect(result).toContain("Human: hello");
    expect(result).toContain("Assistant: hi there");
  });

  it("fills from newest to oldest", () => {
    const messages = [
      msg("user", "first"),
      msg("user", "second"),
      msg("user", "third"),
    ];
    const result = buildContextFromBudget(messages, 4000);
    // All should be included, in order
    const idx1 = result.indexOf("first");
    const idx2 = result.indexOf("second");
    const idx3 = result.indexOf("third");
    expect(idx1).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx3);
  });

  it("respects token budget — drops old messages", () => {
    const messages = [
      msg("user", "OLD_MSG_1 " + "a".repeat(2000)), // ~500 tokens
      msg("user", "OLD_MSG_2 " + "b".repeat(2000)), // ~500 tokens
      msg("user", "OLD_MSG_3 " + "c".repeat(2000)), // ~500 tokens
      msg("user", "recent short message"),
    ];
    // Budget of 600 tokens — should fit recent + maybe one long
    const result = buildContextFromBudget(messages, 600);
    expect(result).toContain("recent short message");
    // Count how many OLD_MSG markers are present
    const oldCount = ["OLD_MSG_1", "OLD_MSG_2", "OLD_MSG_3"].filter((m) => result.includes(m)).length;
    expect(oldCount).toBeLessThan(3);
  });

  it("truncates a message that partially fits", () => {
    const messages = [
      msg("user", "a".repeat(800)), // ~200 tokens
    ];
    // Budget of 150 — message is 200 tokens, should be truncated
    const result = buildContextFromBudget(messages, 150);
    expect(result).toContain("[truncated]");
    expect(result.length).toBeLessThan(800);
  });

  it("stops when remaining budget is too small", () => {
    const messages = [
      msg("user", "a".repeat(2000)), // ~500 tokens
      msg("user", "recent"),
    ];
    // Budget of 20 — only "recent" fits (~5 tokens)
    const result = buildContextFromBudget(messages, 20);
    expect(result).toContain("recent");
    expect(result).not.toContain("aaa");
  });

  it("skips system and delegation messages", () => {
    const messages: ChatMessage[] = [
      { id: "1", agentId: "a", role: "system", content: "system msg", timestamp: Date.now() },
      msg("user", "hello"),
      { id: "2", agentId: "a", role: "delegation", content: "delegated", timestamp: Date.now() },
      msg("agent", "response"),
    ];
    const result = buildContextFromBudget(messages, 4000);
    expect(result).not.toContain("system msg");
    expect(result).not.toContain("delegated");
    expect(result).toContain("Human: hello");
    expect(result).toContain("Assistant: response");
  });
});
