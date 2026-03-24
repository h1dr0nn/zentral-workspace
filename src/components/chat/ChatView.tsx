import { AgentHeader } from "./AgentHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export function ChatView() {
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
