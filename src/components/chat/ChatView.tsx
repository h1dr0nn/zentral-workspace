import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { AgentHeader } from "./AgentHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { useChatStore } from "@/stores/chatStore";
import { useOrchestrationStore } from "@/stores/orchestrationStore";
import { useDiscussionStore } from "@/stores/discussionStore";
import { isOrchestrationEvent, isZennisEvent, parseOrchAgentId } from "@/lib/orchestrationRouter";
import { isDiscussionEvent, isDiscZennisEvent, parseDiscAgentId } from "@/lib/discussionRouter";

interface StreamChunkPayload {
  agent_id: string;
  message_id: string;
  text: string;
}

interface StreamDonePayload {
  agent_id: string;
  message_id: string;
  full_text: string;
}

interface StreamErrorPayload {
  agent_id: string;
  message_id: string;
  error: string;
}

export function ChatView() {
  const unlistenRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const fns = await Promise.all([
        listen<StreamChunkPayload>("chat:stream-chunk", (event) => {
          try {
            if (cancelled) return;
            const { agent_id, message_id, text } = event.payload;

            if (isDiscussionEvent(agent_id)) {
              if (isDiscZennisEvent(agent_id)) {
                useDiscussionStore.getState().handleZennisChunk(text);
              } else {
                const parsed = parseDiscAgentId(agent_id);
                if (parsed) {
                  useChatStore.getState().setStreamContent(parsed.realAgentId, message_id, text, "discussion");
                }
              }
              return;
            }

            if (isOrchestrationEvent(agent_id)) {
              if (isZennisEvent(agent_id)) {
                useOrchestrationStore.getState().handleZennisChunk(text);
              } else {
                const parsed = parseOrchAgentId(agent_id);
                if (parsed) {
                  useChatStore.getState().setStreamContent(parsed.realAgentId, message_id, text, "command");
                }
              }
              return;
            }

            useChatStore.getState().setStreamContent(agent_id, message_id, text);
          } catch (e) {
            console.error("[chat:stream-chunk] handler error:", e);
          }
        }),

        listen<StreamDonePayload>("chat:stream-done", (event) => {
          try {
            if (cancelled) return;
            const { agent_id, full_text } = event.payload;

            if (isDiscussionEvent(agent_id)) {
              if (isDiscZennisEvent(agent_id)) {
                useDiscussionStore.getState().handleZennisDone(full_text);
              } else {
                useDiscussionStore.getState().handleAgentDone(full_text);
              }
              return;
            }

            if (isOrchestrationEvent(agent_id)) {
              if (isZennisEvent(agent_id)) {
                useOrchestrationStore.getState().handleZennisDone(full_text);
              } else {
                useOrchestrationStore.getState().handleAgentDone(full_text);
              }
              return;
            }

            useChatStore.getState().stopStream(agent_id);
          } catch (e) {
            console.error("[chat:stream-done] handler error:", e);
          }
        }),

        listen<StreamErrorPayload>("chat:stream-error", (event) => {
          try {
            if (cancelled) return;
            const { agent_id, message_id, error } = event.payload;

            if (isDiscussionEvent(agent_id)) {
              useDiscussionStore.getState().handleError(error);
              return;
            }

            if (isOrchestrationEvent(agent_id)) {
              useOrchestrationStore.getState().handleError(error);
              return;
            }

            useChatStore.getState().appendStreamChunk(agent_id, message_id, `\n\n**Error:** ${error}`);
            useChatStore.getState().stopStream(agent_id);
          } catch (e) {
            console.error("[chat:stream-error] handler error:", e);
          }
        }),
      ]);

      if (cancelled) {
        fns.forEach((fn) => fn());
      } else {
        unlistenRef.current = fns;
      }
    }

    setup();

    return () => {
      cancelled = true;
      unlistenRef.current.forEach((fn) => fn());
      unlistenRef.current = [];
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      <AgentHeader />
      <MessageList />
      <div className="shrink-0 relative">
        <div className="absolute bottom-full left-0 right-0 h-24 bg-linear-to-t from-background to-transparent pointer-events-none z-10" />
        <ChatInput />
      </div>
    </div>
  );
}
