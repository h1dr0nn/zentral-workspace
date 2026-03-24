import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Square } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";

export function ChatInput() {
  const { activeAgentId, sendMessage, streamingByAgent, stopStream } = useChatStore();
  const [inputVal, setInputVal] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = activeAgentId ? streamingByAgent[activeAgentId] : false;

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleSend = () => {
    if (!inputVal.trim() || !activeAgentId) return;
    sendMessage(activeAgentId, inputVal.trim(), "user", "local");
    setInputVal("");
    
    // Simulate streaming response
    const msgId = `msg-${Date.now()}`;
    const chunks = ["Thinking...", " Here", " is", " the", " result", " of", " your", " query."];
    let i = 0;
    
    // Fake typing simulation
    const interval = setInterval(() => {
      // Check if streaming was stopped manually
      const stillStreaming = useChatStore.getState().streamingByAgent[activeAgentId];
      if (!stillStreaming && i > 0) { // Check if it was manually aborted
        clearInterval(interval);
        return;
      }
      
      if (i < chunks.length) {
        useChatStore.getState().appendStreamChunk(activeAgentId, msgId, chunks[i]);
        i++;
      } else {
        useChatStore.getState().stopStream(activeAgentId);
        clearInterval(interval);
      }
    }, 400);

    // Initial trigger to start streaming state immediately
    useChatStore.getState().appendStreamChunk(activeAgentId, msgId, "");
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleStop = () => {
    if (activeAgentId) {
      stopStream(activeAgentId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    handleInput(); // Resize on init
  }, [inputVal]);

  return (
    <div className="px-4 pb-4 pt-0 bg-background relative z-20">
      <div className="relative flex w-full max-w-3xl mx-auto flex-col rounded-xl border bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <textarea
          ref={textareaRef}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isStreaming}
          className="min-h-[60px] max-h-[200px] w-full resize-none rounded-xl bg-transparent px-4 py-3 pb-12 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 flex-1 overflow-x-hidden"
        />
        <div className="absolute bottom-2 right-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <Button size="icon" variant="destructive" onClick={handleStop} className="h-8 w-8 rounded-lg">
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <Button size="icon" onClick={handleSend} disabled={!inputVal.trim()} className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
