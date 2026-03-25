import { describe, it, expect } from "vitest";
import {
  isOrchestrationEvent,
  isZennisEvent,
  isAgentEvent,
  parseOrchAgentId,
  orchAgentId,
} from "../orchestrationRouter";

describe("orchestrationRouter", () => {
  describe("isOrchestrationEvent", () => {
    it("returns true for orch- prefixed IDs", () => {
      expect(isOrchestrationEvent("orch-zennis-abc123")).toBe(true);
      expect(isOrchestrationEvent("orch-agent-koda-abc123")).toBe(true);
    });

    it("returns false for non-orch IDs", () => {
      expect(isOrchestrationEvent("agent-zennis")).toBe(false);
      expect(isOrchestrationEvent("disc-zennis-abc")).toBe(false);
      expect(isOrchestrationEvent("general")).toBe(false);
    });
  });

  describe("isZennisEvent", () => {
    it("detects zennis events", () => {
      expect(isZennisEvent("orch-zennis-abc123")).toBe(true);
      expect(isZennisEvent("orch-agent-koda-abc123")).toBe(false);
    });
  });

  describe("isAgentEvent", () => {
    it("detects agent events (orch but not zennis)", () => {
      expect(isAgentEvent("orch-agent-koda-abc123")).toBe(true);
      expect(isAgentEvent("orch-zennis-abc123")).toBe(false);
      expect(isAgentEvent("agent-koda")).toBe(false);
    });
  });

  describe("parseOrchAgentId", () => {
    it("parses zennis event ID", () => {
      const result = parseOrchAgentId("orch-zennis-abc123");
      expect(result).toEqual({
        type: "zennis",
        realAgentId: "agent-zennis",
        sessionId: "abc123",
      });
    });

    it("parses agent event ID", () => {
      const result = parseOrchAgentId("orch-agent-koda-abc123");
      expect(result).toEqual({
        type: "agent",
        realAgentId: "agent-koda",
        sessionId: "abc123",
      });
    });

    it("returns null for non-orch IDs", () => {
      expect(parseOrchAgentId("agent-koda")).toBeNull();
      expect(parseOrchAgentId("disc-zennis-abc")).toBeNull();
    });
  });

  describe("orchAgentId", () => {
    it("builds zennis ID", () => {
      expect(orchAgentId("zennis", "s123")).toBe("orch-zennis-s123");
    });

    it("builds agent ID", () => {
      expect(orchAgentId("agent-koda", "s123")).toBe("orch-agent-koda-s123");
    });
  });
});
