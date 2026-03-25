# Phase 3 -- Telegram

> Adds remote access to Zentral through a Telegram bot, enabling messaging from Telegram with responses in both Telegram and the in-app chat UI.

> **Status:** ui-complete
> **Last updated:** 2026-03-25

---

## Overview

A user can configure a Telegram bot in Zentral's settings, send a message to that bot from any Telegram client, and have the secretary process the request using the full agent system. Responses appear in both the Telegram conversation and the Zentral chat view, tagged with a Telegram badge.

## Tasks

### Telegram Bot Backend

Implement a Telegram bot client in the Rust backend using long polling.

| Item | Detail |
|------|--------|
| HTTP client | `reqwest` crate with async runtime |
| API | Telegram Bot API via `getUpdates` long polling |
| Lifecycle | Starts/stops with the app or via settings toggle |
| Thread | Runs on a dedicated Tokio task, does not block the main thread |

Acceptance criteria:

- The bot connects to the Telegram API using a user-provided token.
- Long polling runs continuously while the bot is enabled.
- The bot gracefully handles network interruptions and reconnects.
- Stopping the bot (via settings or app close) cancels the polling loop cleanly.
- No third-party Telegram SDK is required; raw HTTP calls to the Bot API suffice.

### Bot Commands

Support a set of slash commands in the Telegram chat.

| Command | Description |
|---------|-------------|
| `/start` | Welcome message with usage instructions |
| `/status` | Current app status: running agents, queue depth, uptime |
| `/agents` | List all agents with their roles and current status |
| `/ask <message>` | Send a message to the secretary for processing |

Acceptance criteria:

- Unrecognized commands return a help message listing available commands.
- `/start` sends a welcome message and confirms the bot is connected.
- `/status` returns a formatted summary of the system state.
- `/agents` lists each agent's name, role, and status.
- `/ask` forwards the message text to the secretary and streams the response back.
- Plain text messages (without a command prefix) are treated as `/ask`.

### Message Routing

Route messages between Telegram and the secretary agent.

```
Telegram -> Bot Backend -> Secretary -> Agent(s) -> Secretary -> Bot Backend -> Telegram
                                                                    |
                                                              Chat UI (in-app)
```

Acceptance criteria:

- Incoming Telegram messages create a conversation entry in the database.
- The secretary receives the message through the same dispatch path as in-app messages.
- Agent responses are collected by the secretary and sent back through the bot.
- The same response also appears in the in-app chat UI with a Telegram source badge.
- If the secretary delegates to multiple agents, the final aggregated response is sent to Telegram.

### Authentication

Restrict bot access to authorized Telegram users.

| Item | Detail |
|------|--------|
| Method | Chat ID whitelist |
| Storage | SQLite settings table |
| Default | No allowed IDs (bot rejects all messages until configured) |

Acceptance criteria:

- Only messages from whitelisted chat IDs are processed.
- Messages from unauthorized users receive a "not authorized" reply.
- The whitelist is configurable in the settings modal.
- Adding or removing chat IDs takes effect immediately without restarting the bot.
- The bot logs unauthorized access attempts.

### Response Formatting

Format agent responses for Telegram's rendering constraints.

| Constraint | Handling |
|------------|----------|
| Message length | Split at 4096 characters, respecting word boundaries |
| Markup | Convert Markdown to Telegram MarkdownV2 (escape special characters) |
| Code blocks | Preserve triple-backtick blocks; truncate if exceeding limits |
| Errors | Send a plain-text error message if formatting fails |

Acceptance criteria:

- Responses render correctly in Telegram with proper formatting.
- Long responses are split into multiple messages sent in order.
- Code blocks display with monospace formatting.
- Special characters (`_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`) are escaped per MarkdownV2 rules.

### In-App Telegram Display

Show Telegram-originated messages in the Zentral chat UI.

Acceptance criteria:

- Messages from Telegram appear in the chat list with a Telegram badge icon.
- The badge shows the Telegram username or chat ID of the sender.
- Responses sent to Telegram also display in the chat with a "sent to Telegram" indicator.
- Telegram conversations are stored in the same database tables as in-app conversations.
- Filtering or searching chat history includes Telegram messages.

### Telegram Settings

Add a Telegram configuration section to the settings modal.

| Setting | Type | Default |
|---------|------|---------|
| Bot token | Password field | Empty |
| Enabled | Toggle | Off |
| Allowed chat IDs | Comma-separated list | Empty |
| Polling interval | Number (seconds) | 1 |

Acceptance criteria:

- The settings panel validates the bot token format before saving.
- Toggling "enabled" starts or stops the bot immediately.
- Invalid tokens surface an error message in the settings panel.
- All settings persist in SQLite.

### Error Handling

Handle failures in the Telegram integration gracefully.

| Scenario | Behavior |
|----------|----------|
| Invalid token | Disable bot, show error in settings |
| Network failure | Retry with exponential backoff (1s, 2s, 4s, ... up to 60s) |
| Rate limiting | Respect `retry_after` from Telegram API response |
| Agent timeout | Send a timeout error message to the Telegram chat |
| Malformed update | Log and skip the update, continue polling |

Acceptance criteria:

- The bot does not crash on any of the listed failure scenarios.
- Retry backoff resets after a successful poll.
- Persistent errors (invalid token, repeated 401) disable the bot and notify the user in-app.
- All errors are logged with timestamps and context.

## Definition of Done

Phase 3 is complete when a user can:

1. Enter a Telegram bot token and allowed chat IDs in the settings modal.
2. Enable the bot and see a "connected" status indicator.
3. Send `/start` to the bot in Telegram and receive a welcome message.
4. Send `/ask How do I refactor this function?` and receive a formatted response from the secretary.
5. See the same Telegram message and response in the Zentral chat UI with Telegram badges.
6. Send a message from an unauthorized chat ID and see it rejected.
7. Disable the bot in settings and confirm it stops polling.

## References

- [Roadmap Overview](roadmap.md)
- [Phase 2 Agents](phase-2-agents.md)
- [Phase 4 Polish](phase-4-polish.md)
- [Session Management](../03-specifications/session-management.md)
