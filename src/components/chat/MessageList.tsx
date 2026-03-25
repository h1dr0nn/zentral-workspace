import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { MessageBubble } from "./MessageBubble";

export function MessageList() {
  const { activeAgentId, getMessages, sendMessage } = useChatStore();
  const messages = activeAgentId ? getMessages(activeAgentId) : [];
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  
  // Track auto-scroll preference
  const isAutoScrollEnabled = useRef(true);

  const scrollToBottom = (smooth = false) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  };

  useEffect(() => {
    if (isAutoScrollEnabled.current) {
      scrollToBottom();
    }
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    isAutoScrollEnabled.current = isAtBottom;
    setShowJumpToBottom(!isAtBottom);
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <h3 className="mb-2 font-semibold text-lg text-foreground">Start a conversation</h3>
        <p className="mb-6 max-w-sm text-sm">Ask your agent to perform tasks, run queries, or orchestrate workflows.</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => activeAgentId && sendMessage(activeAgentId, "What can you do for me?")}>What can you do?</Button>
          <Button variant="outline" size="sm" onClick={() => activeAgentId && sendMessage(activeAgentId, "Show me the project status")}>Project Status</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <ScrollArea className="h-full px-6" onScrollCapture={handleScroll}>
        <div className="flex flex-col py-6">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} className="h-4" /> {/* Sentinel */}
        </div>
      </ScrollArea>

      {showJumpToBottom && (
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-6 right-8 h-8 w-8 rounded-full shadow-md z-10"
          onClick={() => {
            isAutoScrollEnabled.current = true;
            scrollToBottom(true);
            setShowJumpToBottom(false);
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
