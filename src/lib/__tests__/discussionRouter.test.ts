import { describe, it, expect } from "vitest";
import {
  isDiscussionEvent,
  isDiscZennisEvent,
  isDiscAgentEvent,
  parseDiscAgentId,
  discAgentId,
} from "../discussionRouter";

describe("discussionRouter", () => {
  describe("isDiscussionEvent", () => {
    it("returns true for disc- prefixed IDs", () => {
      expect(isDiscussionEvent("disc-zennis-abc123")).toBe(true);
      expect(isDiscussionEvent("disc-agent-koda-abc123")).toBe(true);
    });

    it("returns false for non-disc IDs", () => {
      expect(isDiscussionEvent("orch-zennis-abc")).toBe(false);
      expect(isDiscussionEvent("agent-koda")).toBe(false);
    });
  });

  describe("isDiscZennisEvent", () => {
    it("detects zennis events", () => {
      expect(isDiscZennisEvent("disc-zennis-abc123")).toBe(true);
      expect(isDiscZennisEvent("disc-agent-koda-abc123")).toBe(false);
    });
  });

  describe("isDiscAgentEvent", () => {
    it("detects agent events", () => {
      expect(isDiscAgentEvent("disc-agent-koda-abc123")).toBe(true);
      expect(isDiscAgentEvent("disc-zennis-abc123")).toBe(false);
    });
  });

  describe("parseDiscAgentId", () => {
    it("parses zennis event ID", () => {
      const result = parseDiscAgentId("disc-zennis-abc123");
      expect(result).toEqual({
        type: "zennis",
        realAgentId: "agent-zennis",
        sessionId: "abc123",
      });
    });

    it("parses agent event ID", () => {
      const result = parseDiscAgentId("disc-agent-koda-abc123");
      expect(result).toEqual({
        type: "agent",
        realAgentId: "agent-koda",
        sessionId: "abc123",
      });
    });

    it("returns null for non-disc IDs", () => {
      expect(parseDiscAgentId("orch-zennis-abc")).toBeNull();
      expect(parseDiscAgentId("agent-koda")).toBeNull();
    });
  });

  describe("discAgentId", () => {
    it("builds zennis ID", () => {
      expect(discAgentId("zennis", "s123")).toBe("disc-zennis-s123");
    });

    it("builds agent ID", () => {
      expect(discAgentId("agent-koda", "s123")).toBe("disc-agent-koda-s123");
    });
  });
});
