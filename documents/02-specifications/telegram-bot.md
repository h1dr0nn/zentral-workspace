# Telegram Bot Integration

> Enables remote interaction with the Secretary agent through a Telegram chat, forwarding messages through the standard dispatch pipeline.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The Telegram bot integration lets the user interact with the Secretary agent remotely through a Telegram chat. Messages sent to the bot are forwarded to the Secretary, which routes them through the normal dispatch logic (direct handling, single-agent delegation, or multi-agent plan). Responses flow back through the bot to the Telegram chat.

The desktop application must be running for the bot to respond. There is no separate server component -- the bot polling loop lives inside the Tauri process as a Tokio async task.

---

## Design Principles

| Principle | Description |
|---|---|
| Lightweight transport | Uses raw HTTP calls to the Telegram Bot API via `reqwest`. No framework dependency (no teloxide, no telegram-bot crate). |
| Single-user | The bot serves exactly one user. A chat ID whitelist rejects all other senders. |
| Secretary gateway | All Telegram messages enter the agent system through the Secretary, identical to messages typed in the local UI. |
| Unified history | Telegram messages appear in the in-app chat alongside local messages, tagged with their origin. |
| Graceful lifecycle | The polling loop respects cancellation tokens and shuts down cleanly when the app exits. |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Zentral (Tauri)                           │
│                                                                  │
│  ┌──────────────┐     ┌───────────┐     ┌──────────────────┐    │
│  │ Telegram     │────>│ Secretary │────>│ Agent(s)         │    │
│  │ Bridge       │     │           │     │                  │    │
│  │ (async task) │<────│           │<────│ (results)        │    │
│  └──────┬───────┘     └───────────┘     └──────────────────┘    │
│         │                                                        │
│         │  reqwest HTTP                                          │
└─────────┼────────────────────────────────────────────────────────┘
          │
          v
┌──────────────────┐
│ Telegram Bot API │
│ api.telegram.org │
└──────────────────┘
```

The bridge module lives at `src-tauri/src/telegram/mod.rs` and exposes a `TelegramBridge` struct that owns the polling loop, configuration, and send queue.

---

## Bot Lifecycle

### Startup

When the application launches, the Tauri setup hook checks whether Telegram integration is enabled in settings. If enabled and a valid bot token is present, it spawns the polling task.

```rust
pub struct TelegramBridge {
    /// Bot token from BotFather.
    token: String,

    /// Chat IDs allowed to interact with the bot.
    allowed_chat_ids: Vec<i64>,

    /// Cancellation token to stop the polling loop.
    cancel: CancellationToken,

    /// Current polling status.
    status: Arc<Mutex<BridgeStatus>>,

    /// HTTP client reused across all requests.
    client: reqwest::Client,
}

pub enum BridgeStatus {
    Stopped,
    Starting,
    Running,
    Error(String),
}
```

### Start Sequence

```
App launch
    |
    v
Read settings from SQLite (bot_token, enabled, allowed_chat_ids)
    |
    v
enabled == true AND bot_token is non-empty?
    |
    +--> NO:  skip, status = Stopped
    |
    +--> YES: spawn tokio::spawn(poll_loop)
              status = Running
```

### Shutdown

When the application closes or the user disables the bot, the bridge sets the cancellation token. The polling loop observes the token on each iteration and exits cleanly.

```rust
impl TelegramBridge {
    pub async fn stop(&self) {
        self.cancel.cancel();
        *self.status.lock().unwrap() = BridgeStatus::Stopped;
    }
}
```

---

## Long Polling Loop

The core of the integration is a Rust async loop that calls the Telegram `getUpdates` endpoint with a long poll timeout.

```rust
pub async fn poll_loop(bridge: Arc<TelegramBridge>, secretary: Arc<SecretaryHandle>) {
    let mut offset: i64 = 0;

    loop {
        tokio::select! {
            _ = bridge.cancel.cancelled() => {
                break;
            }
            result = get_updates(&bridge.client, &bridge.token, offset, 30) => {
                match result {
                    Ok(updates) => {
                        for update in updates {
                            handle_update(&bridge, &secretary, &update).await;
                            offset = update.update_id + 1;
                        }
                    }
                    Err(e) => {
                        log::error!("Telegram poll error: {}", e);
                        retry_backoff(&bridge).await;
                    }
                }
            }
        }
    }

    log::info!("Telegram polling loop stopped");
}
```

### getUpdates Request

```rust
async fn get_updates(
    client: &reqwest::Client,
    token: &str,
    offset: i64,
    timeout: u32,
) -> Result<Vec<Update>, TelegramError> {
    let url = format!("https://api.telegram.org/bot{}/getUpdates", token);
    let resp = client
        .get(&url)
        .query(&[
            ("offset", offset.to_string()),
            ("timeout", timeout.to_string()),
            ("allowed_updates", "message".to_string()),
        ])
        .send()
        .await?;

    let body: TelegramResponse<Vec<Update>> = resp.json().await?;
    if body.ok {
        Ok(body.result)
    } else {
        Err(TelegramError::Api(body.description.unwrap_or_default()))
    }
}
```

---

## Message Routing

All incoming Telegram messages are routed to the Secretary agent by default. The Secretary applies its normal dispatch logic -- it may answer directly, delegate to a single agent, or build a multi-agent execution plan.

### Inbound Flow

```
Telegram message received
    |
    v
Validate chat_id against whitelist
    |
    +--> REJECTED: send "Unauthorized" reply, log warning
    |
    +--> ALLOWED:
         |
         v
    Parse command (if starts with /)
         |
         v
    Forward text to Secretary via internal channel
         |
         v
    Secretary processes (dispatch / delegate / plan)
         |
         v
    Collect response
         |
         v
    Send response back to Telegram chat via sendMessage
```

### Internal Message Type

```rust
pub struct TelegramInbound {
    pub chat_id: i64,
    pub message_id: i64,
    pub text: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}
```

The bridge converts this to a standard `ChatMessage` before sending it to the Secretary:

```rust
pub fn to_chat_message(&self) -> ChatMessage {
    ChatMessage {
        id: Uuid::new_v4().to_string(),
        role: MessageRole::User,
        content: self.text.clone(),
        source: MessageSource::Telegram,
        timestamp: self.timestamp,
        metadata: Some(json!({
            "telegram_chat_id": self.chat_id,
            "telegram_message_id": self.message_id,
        })),
    }
}
```

---

## Bot Commands

The bot recognizes a fixed set of slash commands. All other text is treated as a regular message to the Secretary.

| Command | Description | Example |
|---|---|---|
| `/start` | Sends a greeting and confirms the bot is connected to a running Zentral instance. | `/start` |
| `/status` | Reports the status of all registered agents (running, idle, error). | `/status` |
| `/agents` | Lists all agents with their names, roles, and skills. | `/agents` |
| `/ask <message>` | Explicitly sends `<message>` to the Secretary. Functionally identical to sending plain text. | `/ask run the linter on src/` |

### Command Handler

```rust
async fn handle_update(
    bridge: &TelegramBridge,
    secretary: &SecretaryHandle,
    update: &Update,
) {
    let message = match &update.message {
        Some(m) => m,
        None => return,
    };

    let chat_id = message.chat.id;
    let text = match &message.text {
        Some(t) => t.as_str(),
        None => return,
    };

    // Authentication check
    if !bridge.allowed_chat_ids.contains(&chat_id) {
        send_message(bridge, chat_id, "Unauthorized.").await;
        return;
    }

    let response = match text {
        "/start" => format!(
            "Connected to Zentral workspace.\nAgents online: {}",
            secretary.agent_count()
        ),
        "/status" => secretary.format_agent_statuses().await,
        "/agents" => secretary.format_agent_list().await,
        t if t.starts_with("/ask ") => {
            let query = &t[5..];
            secretary.send_and_wait(query, MessageSource::Telegram).await
        }
        t => {
            secretary.send_and_wait(t, MessageSource::Telegram).await
        }
    };

    send_message(bridge, chat_id, &response).await;
}
```

---

## Authentication

The bot operates in single-user mode. Only Telegram chat IDs listed in the `allowed_chat_ids` setting are permitted to interact with the bot.

### Security Model

| Concern | Mitigation |
|---|---|
| Unknown senders | Messages from chat IDs not in the whitelist receive a static "Unauthorized" reply. The message content is not processed. |
| Token exposure | The bot token is stored in the SQLite settings table. It is never sent to the frontend or included in logs. |
| Man-in-the-middle | All communication with api.telegram.org uses HTTPS. |
| Token rotation | If the token is compromised, the user revokes it via BotFather and enters a new one in Settings. |

### Finding Your Chat ID

The user sends any message to the bot while `allowed_chat_ids` is empty. The bridge logs the rejected chat ID to the application log. The user then adds that ID to the whitelist in Settings.

Alternatively, the Settings modal provides a "Detect Chat ID" button that temporarily accepts the next incoming message, extracts the chat ID, and offers to add it to the whitelist.

---

## Response Formatting

Claude output may contain markdown, code blocks, and structured text. The Telegram Bot API supports MarkdownV2 formatting.

### Conversion Rules

| Claude output | Telegram MarkdownV2 |
|---|---|
| `**bold**` | `*bold*` |
| `` `inline code` `` | `` `inline code` `` |
| ```` ```lang ... ``` ```` | ```` ```lang ... ``` ```` (pre block) |
| `- list item` | `- list item` (plain text) |
| Special chars (`.`, `!`, `(`, `)`, etc.) | Escaped with backslash |

### Message Length Handling

Telegram enforces a 4096-character limit per message. The bridge handles long responses by splitting them.

```rust
fn split_response(text: &str, max_len: usize) -> Vec<String> {
    if text.len() <= max_len {
        return vec![text.to_string()];
    }

    let mut parts = Vec::new();
    let mut remaining = text;

    while !remaining.is_empty() {
        if remaining.len() <= max_len {
            parts.push(remaining.to_string());
            break;
        }

        // Try to split at a newline boundary
        let split_at = remaining[..max_len]
            .rfind('\n')
            .unwrap_or(max_len);

        parts.push(remaining[..split_at].to_string());
        remaining = &remaining[split_at..].trim_start();
    }

    parts
}
```

Each part is sent as a separate `sendMessage` call with a short delay between messages to avoid rate limits.

---

## sendMessage

```rust
async fn send_message(
    bridge: &TelegramBridge,
    chat_id: i64,
    text: &str,
) -> Result<(), TelegramError> {
    let parts = split_response(text, 4096);
    let url = format!("https://api.telegram.org/bot{}/sendMessage", bridge.token);

    for part in parts {
        let formatted = escape_markdown_v2(&part);
        bridge
            .client
            .post(&url)
            .json(&json!({
                "chat_id": chat_id,
                "text": formatted,
                "parse_mode": "MarkdownV2",
            }))
            .send()
            .await?;
    }

    Ok(())
}
```

---

## Error Handling

### Retry Strategy

Network errors and transient failures are handled with exponential backoff.

```rust
async fn retry_backoff(bridge: &TelegramBridge) {
    static BACKOFF_STEPS: &[u64] = &[1, 2, 4, 8, 16, 30];
    let attempt = bridge.consecutive_errors.fetch_add(1, Ordering::Relaxed);
    let delay_secs = BACKOFF_STEPS
        .get(attempt)
        .copied()
        .unwrap_or(30);

    log::warn!("Telegram: backing off for {}s (attempt {})", delay_secs, attempt + 1);
    tokio::time::sleep(Duration::from_secs(delay_secs)).await;
}
```

On a successful poll, the consecutive error counter resets to zero.

### Error Categories

| Error | Behavior |
|---|---|
| Network timeout / DNS failure | Retry with exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s). |
| HTTP 429 (rate limited) | Read `Retry-After` header, sleep for that duration, then resume. |
| HTTP 401 / 403 (invalid token) | Stop the polling loop. Set status to `Error("Invalid bot token")`. Emit `telegram-error` Tauri event so the frontend can show a notification. |
| HTTP 409 (conflict) | Another instance is polling with the same token. Stop and notify the user. |
| Malformed JSON response | Log the raw body, increment error counter, retry. |

---

## In-App Display

Telegram messages appear in the same chat view as locally typed messages. They are visually distinguished by a "Telegram" source badge next to the message timestamp.

### Database Storage

All Telegram messages are stored in the `chat_messages` table with the `source` column set to `"telegram"`.

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL,
    role        TEXT NOT NULL,          -- 'user' | 'assistant'
    content     TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'local',  -- 'local' | 'telegram'
    agent_id    TEXT,
    timestamp   TEXT NOT NULL,
    metadata    TEXT,                   -- JSON blob
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### Frontend Rendering

The chat component reads the `source` field and renders a badge:

```typescript
interface ChatMessageProps {
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    source: "local" | "telegram";
    timestamp: string;
    metadata?: {
      telegram_chat_id?: number;
      telegram_message_id?: number;
    };
  };
}
```

When `source === "telegram"`, the message row displays a small "Telegram" label styled with the context badge tokens from the design system.

---

## Configuration

### Settings Schema

| Key | Type | Default | Description |
|---|---|---|---|
| `telegram_bot_token` | `String` | `""` | Bot token from BotFather. |
| `telegram_enabled` | `bool` | `false` | Whether the polling loop starts on launch. |
| `telegram_allowed_chat_ids` | `Vec<i64>` | `[]` | Whitelist of Telegram chat IDs permitted to use the bot. |

### Rust Config Struct

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramConfig {
    pub bot_token: String,
    pub enabled: bool,
    pub allowed_chat_ids: Vec<i64>,
}

impl Default for TelegramConfig {
    fn default() -> Self {
        Self {
            bot_token: String::new(),
            enabled: false,
            allowed_chat_ids: Vec::new(),
        }
    }
}
```

### Settings Modal

The Settings modal includes a "Telegram" tab with the following fields:

- **Bot Token** -- password input field. Shows a "Test Connection" button that calls `getMe` on the Telegram API to verify the token.
- **Enabled** -- toggle switch.
- **Allowed Chat IDs** -- editable list of integer IDs with add/remove controls.

---

## IPC Commands

### start_telegram_bot

Starts the Telegram polling loop. No-op if already running.

```rust
#[tauri::command]
pub async fn start_telegram_bot(
    state: tauri::State<'_, TelegramBridge>,
) -> Result<(), String> {
    state.start().await.map_err(|e| e.to_string())
}
```

```typescript
import { invoke } from "@tauri-apps/api/core";

await invoke("start_telegram_bot");
```

### stop_telegram_bot

Stops the polling loop and cancels any in-flight requests.

```rust
#[tauri::command]
pub async fn stop_telegram_bot(
    state: tauri::State<'_, TelegramBridge>,
) -> Result<(), String> {
    state.stop().await;
    Ok(())
}
```

```typescript
await invoke("stop_telegram_bot");
```

### get_telegram_status

Returns the current status of the Telegram bridge.

```rust
#[tauri::command]
pub async fn get_telegram_status(
    state: tauri::State<'_, TelegramBridge>,
) -> Result<TelegramStatusResponse, String> {
    Ok(state.get_status())
}

#[derive(Serialize)]
pub struct TelegramStatusResponse {
    pub status: String,        // "stopped" | "running" | "error"
    pub error: Option<String>,
    pub uptime_secs: Option<u64>,
    pub messages_received: u64,
    pub messages_sent: u64,
}
```

```typescript
interface TelegramStatus {
  status: "stopped" | "running" | "error";
  error?: string;
  uptime_secs?: number;
  messages_received: number;
  messages_sent: number;
}

const status = await invoke<TelegramStatus>("get_telegram_status");
```

### set_telegram_config

Updates the Telegram configuration. Restarts the polling loop if it was running and the token changed.

```rust
#[tauri::command]
pub async fn set_telegram_config(
    state: tauri::State<'_, TelegramBridge>,
    config: TelegramConfig,
) -> Result<(), String> {
    state.update_config(config).await.map_err(|e| e.to_string())
}
```

```typescript
await invoke("set_telegram_config", {
  config: {
    bot_token: "123456:ABC-DEF...",
    enabled: true,
    allowed_chat_ids: [123456789],
  },
});
```

---

## Sequence Diagram

### Standard Message Flow

```
Telegram       Telegram Bot API       Rust TelegramBridge       Secretary       Agent(s)
   |                  |                        |                    |               |
   |  send message    |                        |                    |               |
   |----------------->|                        |                    |               |
   |                  |   getUpdates (poll)     |                    |               |
   |                  |<-----------------------|                    |               |
   |                  |   [update]             |                    |               |
   |                  |----------------------->|                    |               |
   |                  |                        |                    |               |
   |                  |                        |  validate chat_id  |               |
   |                  |                        |  (whitelist check) |               |
   |                  |                        |                    |               |
   |                  |                        |  forward message   |               |
   |                  |                        |------------------->|               |
   |                  |                        |                    |               |
   |                  |                        |                    |  delegate      |
   |                  |                        |                    |-------------->|
   |                  |                        |                    |               |
   |                  |                        |                    |  result        |
   |                  |                        |                    |<--------------|
   |                  |                        |                    |               |
   |                  |                        |  response          |               |
   |                  |                        |<-------------------|               |
   |                  |                        |                    |               |
   |                  |   sendMessage          |                    |               |
   |                  |<-----------------------|                    |               |
   |  display reply   |                        |                    |               |
   |<-----------------|                        |                    |               |
   |                  |                        |                    |               |
```

### Error Recovery Flow

```
Telegram Bot API       Rust TelegramBridge
      |                        |
      |   getUpdates           |
      |<-----------------------|
      |                        |
      |   HTTP 500             |
      |----------------------->|
      |                        |
      |                        |  backoff 1s
      |                        |  ...
      |                        |
      |   getUpdates (retry)   |
      |<-----------------------|
      |                        |
      |   HTTP 429             |
      |   Retry-After: 5       |
      |----------------------->|
      |                        |
      |                        |  sleep 5s
      |                        |  ...
      |                        |
      |   getUpdates (retry)   |
      |<-----------------------|
      |                        |
      |   200 OK [updates]     |
      |----------------------->|
      |                        |
```

---

## Telegram API Types

Minimal type definitions covering only the fields Zentral uses. Unrecognized fields are ignored during deserialization.

```rust
#[derive(Debug, Deserialize)]
pub struct TelegramResponse<T> {
    pub ok: bool,
    pub result: T,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Update {
    pub update_id: i64,
    pub message: Option<Message>,
}

#[derive(Debug, Deserialize)]
pub struct Message {
    pub message_id: i64,
    pub chat: Chat,
    pub text: Option<String>,
    pub date: i64,
}

#[derive(Debug, Deserialize)]
pub struct Chat {
    pub id: i64,
    #[serde(rename = "type")]
    pub chat_type: String,
}

#[derive(Debug, Deserialize)]
pub struct User {
    pub id: i64,
    pub first_name: String,
    pub username: Option<String>,
}
```

---

## File Layout

```
src-tauri/src/telegram/
    mod.rs          -- TelegramBridge struct, start/stop, config
    polling.rs      -- poll_loop, get_updates, retry logic
    handler.rs      -- handle_update, command dispatch
    types.rs        -- Telegram API type definitions
    format.rs       -- Markdown escaping, message splitting
```

---

## References

- [Secretary Agent](../02-specifications/secretary-agent.md) -- dispatch logic that processes Telegram messages
- [Agent Manager](../02-specifications/agent-manager.md) -- agent lifecycle and status reporting
- [Session Management](../02-specifications/session-management.md) -- chat_messages persistence model
- [Skill Pool](../02-specifications/skill-pool.md) -- agent skill definitions used by `/agents` command
