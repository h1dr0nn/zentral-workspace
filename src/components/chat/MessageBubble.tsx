import { Copy, RefreshCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/stores/chatStore";
import { Button } from "@/components/ui/button";

interface MessageBubbleProps {
  message: ChatMessage;
}

function useIsDark() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") return;
    
    // Initial check
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));

    // Watch for class changes on <html>
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { role, content, isStreaming, agentId, timestamp } = message;
  const isDarkTheme = useIsDark();

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

  return (
    <div className={cn("group flex w-full flex-col gap-1 mb-6 max-w-3xl mx-auto px-4")}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            {isUser ? "You" : agentName}
          </span>
          {message.source === "telegram" && (
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] uppercase font-semibold tracking-wider text-blue-500">
              via Telegram
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{timeString}</span>
      </div>

      <div className="relative flex w-full flex-col gap-2">
        <div 
          className={cn(
            "rounded-2xl px-4 py-3 text-sm border shadow-xs overflow-hidden",
            isUser 
              ? "bg-muted text-foreground border-transparent" 
              : "bg-card text-foreground"
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
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

        {/* Hover Actions Toolbar */}
        <div className="absolute top-0 -right-10 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Copy message" onClick={() => navigator.clipboard.writeText(content)}>
            <Copy className="h-4 w-4" />
          </Button>
          {isUser && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Retry">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
