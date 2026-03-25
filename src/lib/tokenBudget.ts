import type { ChatMessage } from "@/stores/chatStore";

/** Estimate token count from text (~4 chars per token) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build conversation context string from messages, filling up to a token budget.
 * Iterates from newest → oldest, formatting each as "Human: ..." / "Assistant: ...".
 * Messages that exceed remaining budget are truncated with "[...truncated]".
 */
export function buildContextFromBudget(
  messages: ChatMessage[],
  budget: number,
): string {
  const relevant = messages.filter((m) => m.role === "user" || m.role === "agent");
  if (relevant.length === 0) return "";

  const formatted: string[] = [];
  let remaining = budget;

  // Fill from newest → oldest
  for (let i = relevant.length - 1; i >= 0 && remaining > 0; i--) {
    const msg = relevant[i];
    const prefix = msg.role === "user" ? "Human" : "Assistant";
    const full = `${prefix}: ${msg.content}`;
    const tokens = estimateTokens(full);

    if (tokens <= remaining) {
      formatted.unshift(full);
      remaining -= tokens;
    } else if (remaining >= 100) {
      // Truncate to fit remaining budget
      const charBudget = remaining * 4;
      const truncated = `${prefix}: ${msg.content.slice(0, charBudget - 30)}...[truncated]`;
      formatted.unshift(truncated);
      remaining = 0;
    } else {
      // Not enough room — stop
      break;
    }
  }

  return formatted.join("\n\n");
}
