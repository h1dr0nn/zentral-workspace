# Main Area -- Chat View

> Primary interaction surface displaying agent chat conversations with streaming responses, multi-agent delegation, and Telegram integration.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The main area is the primary interaction surface of Zentral. It displays the chat conversation with the currently selected agent, supports streaming responses, multi-agent delegation, and Telegram message integration. All messages are stored per-agent in `chatStore` and rendered through a component hierarchy built on shadcn/ui primitives.

## Layout

The chat view occupies the full width between the left and right sidebars. It is divided vertically into three regions: agent header, message list, and input bar.

```
┌─────────────────────────────────────┐
│ [Agent Name] [Role] [● Online]      │  <- Agent header
├─────────────────────────────────────┤
│                                     │
│  You                    10:30 AM    │
│  ┌─────────────────────────────┐    │
│  │ Can you run the tests?      │    │
│  └─────────────────────────────┘    │
│                                     │
│  QA Lead                10:30 AM    │
│  ┌─────────────────────────────┐    │
│  │ Running tests now...        │    │
│  │ ```                         │    │
│  │ PASS src/app.test.ts        │    │
│  │ Tests: 5 passed, 5 total    │    │
│  │ ```                         │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Delegated to QA Lead]      badge  │  <- Secretary delegation
│                                     │
├─────────────────────────────────────┤
│ [Type a message...        ] [Send]  │  <- Input bar
└─────────────────────────────────────┘
```

The message list fills all available vertical space between the header and the input bar, scrolling independently.

## Agent Header

The agent header is a fixed bar at the top of the chat area. It displays the currently selected agent's name, role label, and a connection status badge.

| Element      | Description                                                      |
|--------------|------------------------------------------------------------------|
| Agent name   | Bold label showing the agent's display name                      |
| Role         | Muted text beside the name, e.g. "Secretary", "QA Lead"         |
| Status badge | Colored dot with label: green "Online", amber "Busy", gray "Offline" |
| Switch dropdown | Click the agent name or a chevron to open a dropdown listing all agents. Selecting one switches the chat context. |

The header uses the shadcn/ui `Badge` component for the status indicator and a `DropdownMenu` for the agent switcher.

## Message Types

The chat view renders four distinct message types. Each type has its own visual treatment.

| Type       | Alignment / Style                                                 |
|------------|-------------------------------------------------------------------|
| User       | Left-aligned with "You" label. Background uses `--user-bubble` color. |
| Agent      | Left-aligned with agent name and role. Background uses `--agent-bubble` color. Border-left color is unique per agent. |
| System     | Centered, muted foreground, no bubble. Used for status updates such as "Agent connected" or "Session started". |
| Delegation | Centered badge reading "Delegated to [Agent Name]". Indicates the secretary routed the task to a sub-agent. Uses the `DelegationBadge` component. |

Each message displays a timestamp on the right side of the header line, formatted as `h:mm AM/PM`.

## Message Rendering

Agent and user messages support full Markdown rendering via `react-markdown` (or an equivalent library). The following content types are handled.

### Markdown Features

- Paragraphs, headings (rendered within the bubble at reduced scale)
- Bold, italic, strikethrough, inline code
- Ordered and unordered lists
- Links (open in external browser via Tauri shell API)
- Block quotes
- Horizontal rules

### Code Blocks

Fenced code blocks render with syntax highlighting. The implementation uses a highlight library such as `shiki` or `react-syntax-highlighter`. Each code block includes a copy-to-clipboard button in its top-right corner.

```typescript
interface MessageContentProps {
  content: string;
  isStreaming: boolean;
}

function MessageContent({ content, isStreaming }: MessageContentProps) {
  return (
    <div className="message-content prose prose-sm dark:prose-invert">
      <ReactMarkdown
        components={{
          code: CodeBlockWithHighlight,
          a: ExternalLink,
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && <StreamingCursor />}
    </div>
  );
}
```

### Streaming Text

While an agent response is being received, the content updates incrementally. A blinking cursor character appears at the end of the rendered text to indicate that the response is still in progress.

## Streaming Indicator

When an agent is actively generating a response, the UI provides two indicators.

| Indicator   | Behavior                                                         |
|-------------|------------------------------------------------------------------|
| Typing dots | Three animated dots appear below the last message while waiting for the first token. |
| Cursor      | Once tokens arrive, a blinking block cursor renders at the end of the streaming text. |
| Stop button | A "Stop" button (shadcn/ui `Button` with `variant="destructive"`) appears in the input bar area. Clicking it aborts the current generation by sending a cancel signal to the Rust backend. |

The stop button replaces the send button for the duration of the stream. When the stream completes or is aborted, the send button returns.

## Multi-Agent Attribution

When the secretary agent delegates a task, subsequent messages may arrive from a different sub-agent. These messages carry full attribution.

- The agent name and role appear in the message header.
- Each agent is assigned a unique border-left color drawn from a palette defined in the theme. This makes it easy to visually distinguish which agent produced each message.
- A `DelegationBadge` system message appears at the point of delegation, reading "Delegated to [Agent Name]".

```
┌──────────────────────────────────────────────┐
│  Secretary               10:31 AM            │
│  ┌────────────────────────────────────────┐  │
│  │ I'll delegate this to the QA Lead.     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│       [Delegated to QA Lead]                 │
│                                              │
│  QA Lead                 10:31 AM            │
│  ┌────────────────────────────────────────┐  │  <- different border color
│  │ Running the test suite now...          │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

## Telegram Messages

Messages originating from the Telegram integration carry a source attribution badge. This allows the user to distinguish between messages typed locally and messages forwarded from Telegram.

| Element          | Description                                                |
|------------------|------------------------------------------------------------|
| Telegram badge   | A small icon and "via Telegram" label rendered next to the timestamp in the message header. |
| Visual treatment | The badge uses `Badge` from shadcn/ui with a Telegram-branded color (blue). |
| Behavior         | Telegram messages are otherwise identical to local user messages in terms of rendering and storage. |

## Scroll Behavior

The message list uses the shadcn/ui `ScrollArea` component and follows these rules.

| Condition                        | Behavior                                                    |
|----------------------------------|-------------------------------------------------------------|
| New message arrives              | Auto-scroll to the bottom of the list.                      |
| User scrolls up                  | Auto-scroll pauses. A "Jump to bottom" button fades in at the bottom-right of the message list. |
| User clicks "Jump to bottom"     | Smooth-scroll to the latest message and re-enable auto-scroll. |
| User scrolls back to the bottom  | Auto-scroll resumes and the button fades out.               |
| Agent streaming                  | Auto-scroll remains active if the user has not scrolled up. Content grows and the view follows. |

The scroll position is tracked using an `IntersectionObserver` on a sentinel element placed at the bottom of the message list.

## Input Bar

The input bar is pinned to the bottom of the chat view.

### Controls

| Element       | Description                                                       |
|---------------|-------------------------------------------------------------------|
| Textarea      | Multi-line input with placeholder text "Type a message...". Uses a native `<textarea>` styled to match the design system. |
| Send button   | shadcn/ui `Button` positioned to the right of the textarea. Disabled when the textarea is empty. |

### Keyboard Shortcuts

| Key Combination | Action                         |
|-----------------|--------------------------------|
| Enter           | Send the message               |
| Shift+Enter     | Insert a newline               |
| Escape          | Clear the textarea (if focused)|

### Auto-Resize

The textarea automatically grows in height as the user types additional lines, up to a maximum height (approximately 8 lines). Beyond that limit, the textarea scrolls internally.

```typescript
function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(textareaRef.current?.value ?? "");
    }
  };

  return (
    <div className="chat-input-bar">
      <textarea
        ref={textareaRef}
        placeholder="Type a message..."
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />
      <Button onClick={() => onSend(textareaRef.current?.value ?? "")}>
        Send
      </Button>
    </div>
  );
}
```

## Empty State

When no messages exist for the currently selected agent, the chat area displays a centered empty state.

- Heading: "Start a conversation with [Agent Name]"
- Subtext: a brief description of the agent's role and capabilities.
- Suggested prompts: two to four clickable chips that pre-fill common messages. Examples vary by agent role (e.g., "Run the test suite" for a QA agent, "Review latest changes" for a code-review agent).

Clicking a suggested prompt inserts its text into the input bar and immediately sends it.

## Message Actions

Hovering over a message reveals an action toolbar in the top-right corner of the bubble.

| Action | Icon     | Behavior                                                          |
|--------|----------|-------------------------------------------------------------------|
| Copy   | Clipboard| Copies the full message content (raw Markdown) to the clipboard.  |
| Retry  | Refresh  | Available only on user messages. Resends the message, triggering a new agent response. The previous agent response for that message is replaced. |

The toolbar fades in on hover and fades out on mouse leave. On touch devices, a long-press gesture reveals it.

## chatStore Integration

All chat state is managed by `chatStore` (Zustand).

```typescript
interface ChatMessage {
  id: string;
  agentId: string;
  role: "user" | "agent" | "system" | "delegation";
  content: string;
  timestamp: number;
  source?: "local" | "telegram";
  isStreaming?: boolean;
}

interface ChatState {
  messagesByAgent: Record<string, ChatMessage[]>;
  streamingByAgent: Record<string, boolean>;
  activeAgentId: string | null;
  sendMessage: (agentId: string, content: string) => void;
  appendStreamChunk: (agentId: string, messageId: string, chunk: string) => void;
  stopStream: (agentId: string) => void;
  setActiveAgent: (agentId: string) => void;
}
```

### Behavior

- Switching the active agent in the header loads that agent's message history from `messagesByAgent`.
- New messages are appended to the array for the relevant `agentId`.
- Streaming state is tracked per agent in `streamingByAgent`. Multiple agents can stream simultaneously if delegated, but only the active agent's stream is visible.
- Messages persist to the Rust backend via Tauri commands and are restored on session reload.

## Components

The chat view is composed of the following React components.

```
ChatView
├── AgentHeader
│   ├── Badge (status)
│   └── DropdownMenu (agent switcher)
├── MessageList (ScrollArea)
│   ├── MessageBubble (repeated)
│   │   ├── MessageContent (Markdown renderer)
│   │   ├── TelegramBadge (conditional)
│   │   └── MessageActions (hover toolbar)
│   ├── DelegationBadge (conditional)
│   ├── StreamingIndicator (conditional)
│   └── ScrollAnchor (sentinel for auto-scroll)
├── JumpToBottomButton (conditional)
└── ChatInput
    ├── textarea
    └── Button (Send / Stop)
```

| Component          | Responsibility                                                |
|--------------------|---------------------------------------------------------------|
| ChatView           | Top-level container. Reads `activeAgentId` from `chatStore` and passes data down. |
| AgentHeader        | Renders agent name, role, status badge, and the agent-switch dropdown. |
| MessageList        | Wraps messages in a `ScrollArea`. Manages scroll position and auto-scroll logic. |
| MessageBubble      | Renders a single message: header (name, timestamp), content, and conditional badges. |
| MessageContent     | Parses Markdown and renders highlighted code blocks.           |
| TelegramBadge      | Small badge showing "via Telegram" with an icon.               |
| MessageActions     | Hover toolbar with copy and retry buttons.                     |
| DelegationBadge    | System-level inline badge for delegation events.               |
| StreamingIndicator | Animated dots shown while waiting for the first token.         |
| ChatInput          | Textarea with send/stop button and keyboard handling.          |
| JumpToBottomButton | Floating button that appears when the user scrolls away from the bottom. |
| ScrollAnchor       | Invisible element observed by `IntersectionObserver` to detect bottom position. |

## shadcn/ui Usage

| shadcn/ui Component | Usage in Chat View                                           |
|----------------------|--------------------------------------------------------------|
| ScrollArea           | Wraps the message list for styled, accessible scrolling.     |
| Button               | Send button, Stop button, Jump to bottom, message action buttons. |
| Badge                | Agent status indicator, Telegram source badge, delegation badge. |
| DropdownMenu         | Agent switcher in the header.                                |
| Tooltip              | Labels on hover for message action icons.                    |

## References

- [Design System](./design-system.md) -- color tokens, typography, spacing
- [Keyboard Shortcuts](./keyboard-shortcuts.md) -- global and context-specific bindings
- [Right Sidebar -- Agents](./sidebar-right-agents.md) -- agent list and selection
- [Themes](./themes.md) -- per-agent border color palette
- [Window Decoration](./window-decoration.md) -- overall window structure and layout regions
