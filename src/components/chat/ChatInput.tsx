import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  Square,
  ShieldCheck,
  ShieldOff,
  FileEdit,
  Map,
  Check,
  X,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "@/stores/chatStore";
import { useAgentStore } from "@/stores/agentStore";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { buildContextFromBudget } from "@/lib/tokenBudget";
import { useOrchestrationStore } from "@/stores/orchestrationStore";
import { useDiscussionStore } from "@/stores/discussionStore";

const PERMISSION_OPTIONS: readonly { id: string; label: string; desc: string; icon: typeof ShieldCheck; warning?: boolean }[] = [
  { id: "ask", label: "Ask permissions", desc: "Always ask before making changes", icon: ShieldCheck },
  { id: "auto", label: "Auto accept edits", desc: "Automatically accept all file edits", icon: FileEdit },
  { id: "plan", label: "Plan mode", desc: "Create a plan before making changes", icon: Map },
  { id: "bypass", label: "Bypass permissions", desc: "Accepts all permissions", icon: ShieldOff, warning: true },
];

const MODEL_OPTIONS = [
  { id: "opus-4.6-1m", label: "Opus 4.6 (1M context)", desc: "Most capable for ambitious work" },
  { id: "opus-4.6", label: "Opus 4.6", desc: "Most capable for ambitious work" },
  { id: "sonnet-4.6", label: "Sonnet 4.6", desc: "Most efficient for everyday tasks" },
  { id: "haiku-4.5", label: "Haiku 4.5", desc: "Fastest for quick answers" },
] as const;

const MODEL_MAP: Record<string, string> = {
  "opus-4.6-1m": "claude-opus-4-6",
  "opus-4.6": "claude-opus-4-6",
  "sonnet-4.6": "claude-sonnet-4-6",
  "haiku-4.5": "claude-haiku-4-5-20251001",
};

export function ChatInput() {
  const { activeAgentId, sendMessage, getIsStreaming, stopStream } = useChatStore();
  const [inputVal, setInputVal] = useState("");
  const [images, setImages] = useState<{ id: string; url: string; file: File }[]>([]);
  const [permission, setPermission] = useState("auto");
  const [model, setModel] = useState("opus-4.6-1m");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = activeAgentId ? getIsStreaming(activeAgentId) : false;

  const addImages = (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const newImages = imageFiles.map((file) => ({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url: URL.createObjectURL(file),
      file,
    }));
    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      addImages(files);
    }
  };

  const handleSend = () => {
    if ((!inputVal.trim() && images.length === 0) || !activeAgentId) return;
    const text = inputVal.trim();
    sendMessage(activeAgentId, text, "user", "local");
    setInputVal("");
    // Clear images (revoke URLs)
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);

    // Send to backend if signed in
    const loggedIn = useAuthStore.getState().loggedIn;
    if (!loggedIn) return;

    // Room modes → orchestration or discussion engine
    if (activeAgentId === "command") {
      useOrchestrationStore.getState().startOrchestration(text, MODEL_MAP[model] ?? model);
      return;
    }
    if (activeAgentId === "discussion") {
      useDiscussionStore.getState().startDiscussion(text, MODEL_MAP[model] ?? model);
      return;
    }

    // Direct agent chat
    const agent = useAgentStore.getState().agents.find((a) => a.id === activeAgentId);
    const agentName = agent?.name ?? "Assistant";
    const agentRole = agent?.role ?? "General";
    const systemPrompt = agent?.isSecretary
      ? `You are ${agentName}, the orchestrator of the Zentral workspace — a multi-agent desktop app created by h1dr0n. You coordinate tasks between specialized agents (Vex for Git, Koda for Code, Prova for Testing, etc.). Be helpful, concise, and proactive. Always respond in the same language the user uses.`
      : `You are ${agentName}, a specialized agent with the role: ${agentRole}, working inside the Zentral workspace created by h1dr0n. Be helpful and concise. Always respond in the same language the user uses.`;

    // Build conversation history for context (if memory enabled)
    const memoryOn = useChatStore.getState().memoryEnabled;
    const budget = useSettingsStore.getState().settings.chatTokenBudget;
    let fullMessage = text;

    if (memoryOn) {
      const messages = useChatStore.getState().getMessages(activeAgentId);
      const history = buildContextFromBudget(messages, budget || 4000);
      if (history) {
        fullMessage = `${history}\n\nHuman: ${text}`;
      }
    }

    const msgId = `msg-${Date.now()}-agent`;
    // Create empty streaming message in store
    useChatStore.getState().appendStreamChunk(activeAgentId, msgId, "");

    invoke("send_chat_message", {
      agentId: activeAgentId,
      messageId: msgId,
      message: fullMessage,
      systemPrompt,
      model: MODEL_MAP[model] ?? model,
    }).catch((err) => {
      useChatStore.getState().stopStream(activeAgentId);
      console.error("send_chat_message failed:", err);
    });
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


  const selectedModel = MODEL_OPTIONS.find((m) => m.id === model)!;

  return (
    <div className="px-4 pb-4 pt-0 bg-background relative z-20">
      <div className="flex w-full flex-col rounded-xl border bg-sidebar shadow-sm focus-within:ring-1 focus-within:ring-ring">
        {/* Attachment preview */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {images.map((img) => (
              <div
                key={img.id}
                className="group flex items-center gap-2 rounded-lg bg-muted px-2 py-1.5"
              >
                <img
                  src={img.url}
                  alt={img.file.name}
                  className="h-8 w-8 rounded object-cover"
                />
                <div className="flex flex-col text-xs leading-tight">
                  <span className="font-medium text-foreground max-w-[120px] truncate">{img.file.name}</span>
                  <span className="text-muted-foreground">
                    {Math.round(img.file.size / 1024)} KB
                  </span>
                </div>
                <button
                  onClick={() => removeImage(img.id)}
                  className="ml-1 rounded-sm p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-background transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea area */}
        <textarea
          ref={textareaRef}
          data-chat-input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Type a message..."
          disabled={isStreaming}
          className="h-[100px] w-full resize-none rounded-t-xl bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto overflow-wrap-anywhere [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
        />

        {/* Toolbar — separate row */}
        <div className="flex items-center justify-between px-2 pb-2">
          {/* Permission dropdown — left */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <FileEdit className="h-3.5 w-3.5" />
                <span>{PERMISSION_OPTIONS.find((p) => p.id === permission)?.label}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8} className="w-64">
              {PERMISSION_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <DropdownMenuItem
                    key={opt.id}
                    onClick={() => setPermission(opt.id)}
                    className="flex items-start gap-2.5 py-2"
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${opt.warning ? "text-yellow-500" : ""}`} />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.desc}</span>
                    </div>
                    {permission === opt.id && <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1">
            {/* Model dropdown — right */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <span>{selectedModel.label}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-64">
                {MODEL_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.id}
                    onClick={() => setModel(opt.id)}
                    className="flex items-start gap-2.5 py-2"
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.desc}</span>
                    </div>
                    {model === opt.id && <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Send / Stop button */}
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
