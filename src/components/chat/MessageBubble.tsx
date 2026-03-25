import { Copy, RefreshCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/stores/chatStore";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";

interface MessageBubbleProps {
  message: ChatMessage;
}

// Single shared listener for dark mode — avoids one MutationObserver per MessageBubble
const darkListeners = new Set<() => void>();
let darkObserver: MutationObserver | null = null;

function subscribeDark(cb: () => void) {
  darkListeners.add(cb);
  if (!darkObserver) {
    darkObserver = new MutationObserver(() => darkListeners.forEach((fn) => fn()));
    darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
  return () => {
    darkListeners.delete(cb);
    if (darkListeners.size === 0 && darkObserver) {
      darkObserver.disconnect();
      darkObserver = null;
    }
  };
}

function getIsDark() {
  return document.documentElement.classList.contains("dark");
}

function useIsDark() {
  return useSyncExternalStore(subscribeDark, getIsDark);
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { role, content, isStreaming, agentId, timestamp } = message;
  const isDarkTheme = useIsDark();
  const chatLayout = useUiStore((s) => s.chatLayout);

  const date = new Date(timestamp);
  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (role === "system" || role === "delegation") {
    return (
      <div className="flex w-full justify-center my-4">
        <div className="rounded-full bg-muted/50 border px-3 py-1 text-xs font-medium text-muted-foreground w-fit">
          {content}
        </div>
      </div>
    );
  }

  const isUser = role === "user";
  const agentName = agentId === "agent-qa" ? "QA Lead" : "Secretary";
  const isBubbles = chatLayout === "bubbles";

  return (
    <div
      className={cn(
        "group flex w-full flex-col gap-1 mb-6 px-4",
        isBubbles && isUser && "items-end",
        isBubbles && !isUser && "items-start",
      )}
    >
      <div className={cn("flex flex-col gap-1 w-full", isBubbles && "max-w-[85%]")}>
        {/* Header */}
        <div className={cn("flex items-center justify-between mb-1", isBubbles && isUser && "flex-row-reverse")}>
          <div className={cn("flex items-center gap-2", isBubbles && isUser && "flex-row-reverse")}>
            <span className="font-semibold text-sm">
              {isUser ? "You" : agentName}
            </span>
            {message.source === "telegram" && (
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider text-blue-500">
                via Telegram
              </span>
            )}
            <span className="text-xs text-muted-foreground">{timeString}</span>
          </div>

          {/* Actions — opposite side of name */}
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Copy message" onClick={() => navigator.clipboard.writeText(content)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {isUser && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Retry">
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm border shadow-xs overflow-hidden",
            isUser
              ? "bg-muted text-foreground border-transparent"
              : "bg-card text-foreground",
            isBubbles && isUser && "rounded-tr-md",
            isBubbles && !isUser && "rounded-tl-md",
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  const inline = !match;
                  return !inline && match ? (
                    <SyntaxHighlighter
                      {...props}
                      language={match[1]}
                      PreTag="div"
                      style={isDarkTheme ? vscDarkPlus : vs}
                      customStyle={{ margin: 0, backgroundColor: "transparent" }}
                      className="rounded-md my-2! border bg-muted p-3 text-foreground"
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code {...props} className={cn("bg-muted/50 rounded px-1.5 py-0.5 font-mono text-xs", className)}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
            {isStreaming && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-primary align-middle" />}
          </div>
        </div>
      </div>
    </div>
  );
}
