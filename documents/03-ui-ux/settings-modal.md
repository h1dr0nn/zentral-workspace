# Settings Modal

> Central configuration UI for managing application preferences, agent behavior, Telegram integration, and advanced options.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The Settings Modal is the central configuration UI for Zentral. It provides a single, organized interface where users manage all application preferences, agent behavior, Telegram integration, and advanced options. The modal is accessible at any time via the keyboard shortcut `Ctrl+,` or through the menu bar under `File > Settings`.

All changes persist to the local SQLite database and take effect immediately where possible. The modal is implemented as a React dialog component backed by Tauri IPC commands for reading and writing configuration values on the Rust side.

## Layout

The modal follows a two-panel design: a vertical tab list on the left and the active tab content on the right. The close button sits in the top-right corner of the header.

```
┌───────────────────────────────────────┐
│ Settings                          [x] │
├──────────┬────────────────────────────┤
│          │                            │
│ General  │  Theme                     │
│ Agents   │  o Light  * Dark  o System │
│ Telegram │                            │
│ Advanced │  Font Size                 │
│          │  [14px           v]        │
│          │                            │
│          │  Default Shell             │
│          │  [/bin/bash      v]        │
│          │                            │
└──────────┴────────────────────────────┘
```

The modal occupies roughly 640x480 pixels on screen and is vertically centered. It dims the background with a semi-transparent overlay and traps keyboard focus while open.

## General Tab

The General tab contains everyday preferences that affect the look and feel of the application.

### Theme

A radio group with three options that controls the application color scheme.

| Option | Behavior |
|--------|----------|
| Light  | Forces the light theme regardless of OS preference |
| Dark   | Forces the dark theme regardless of OS preference |
| System | Follows the operating system appearance setting |

The theme change applies immediately without requiring a restart. The selected value is stored under the key `theme` in the settings table.

### Font Size

A dropdown (or number input with stepper) that sets the terminal font size. The accepted range is 12 to 24 pixels, with a default of 14.

```typescript
const fontSizeSchema = z.number().min(12).max(24).default(14);
```

### Default Shell

A text input or dropdown that determines which shell is launched for new terminal sessions. On Linux and macOS this defaults to the value of the `SHELL` environment variable. On Windows it defaults to `powershell.exe`. Users may override with an absolute path to any installed shell.

### Language

Reserved for future implementation. The field is visible but disabled, showing a tooltip that reads "Coming soon." The default value is `en`.

## Agents Tab

The Agents tab controls how Zentral manages Claude agent processes.

| Setting | Type | Default | Range | Description |
|---------|------|---------|-------|-------------|
| Max concurrent agents | Number input | 5 | 1 -- 10 | Maximum number of agent processes running simultaneously |
| Default agent timeout | Number input (minutes) | 30 | 1 -- 1440 | Time in minutes before an idle agent is stopped |
| Auto-restart on crash | Toggle switch | On | -- | Automatically restart an agent that exits unexpectedly |
| Crash loop threshold | Number input | 3 | 1 -- 20 | Number of crashes within 60 seconds that triggers crash-loop protection, disabling auto-restart for that agent |

When an agent hits the crash loop threshold, Zentral stops restarting it and surfaces a notification with a manual restart button.

```typescript
const agentSettingsSchema = z.object({
  maxConcurrentAgents: z.number().min(1).max(10).default(5),
  defaultAgentTimeout: z.number().min(1).max(1440).default(30),
  autoRestartOnCrash: z.boolean().default(true),
  crashLoopThreshold: z.number().min(1).max(20).default(3),
});
```

## Telegram Tab

The Telegram tab configures the optional Telegram bot integration, which allows users to interact with agents remotely.

### Bot Token

A password-type input field that stores the Telegram Bot API token. A show/hide toggle button sits at the right edge of the input. The token is stored encrypted in the settings table.

### Enabled

A toggle switch that globally enables or disables the Telegram integration. When disabled, no messages are sent or received regardless of other settings.

### Allowed Chat IDs

A text input accepting a comma-separated list of numeric Telegram chat IDs. Only messages originating from these chat IDs are processed by the bot. An empty list means no chats are allowed.

```typescript
const telegramSettingsSchema = z.object({
  botToken: z.string().min(1, "Bot token is required when Telegram is enabled").optional(),
  enabled: z.boolean().default(false),
  allowedChatIds: z
    .string()
    .transform((val) => val.split(",").map((id) => id.trim()).filter(Boolean))
    .pipe(z.array(z.string().regex(/^\d+$/, "Each chat ID must be a number"))),
});
```

### Test Connection

A button labeled "Test Connection" that sends a test message through the configured bot to the first allowed chat ID. The result is displayed inline with one of three status indicators.

| Status | Indicator | Description |
|--------|-----------|-------------|
| Connected | Green dot | Bot authenticated and message delivered |
| Disconnected | Gray dot | Integration disabled or not yet tested |
| Error | Red dot | Authentication failed or message delivery failed |

The test invokes the Tauri command `test_telegram_connection` and displays the response or error message beneath the button.

## Advanced Tab

The Advanced tab provides power-user options for data management and debugging.

### Chat History Retention

A select dropdown that controls automatic cleanup of stored chat history.

| Option | Behavior |
|--------|----------|
| Keep all | No automatic deletion |
| Last 30 days | Delete history older than 30 days on startup |
| Last 7 days | Delete history older than 7 days on startup |

### Clear All Chat History

A button that opens a confirmation dialog before permanently deleting all stored chat messages from the database. The confirmation dialog requires the user to type "DELETE" to proceed.

### Export Settings

A button that serializes all current settings into a JSON file and triggers a native save-file dialog via `dialog.save()`. The exported file includes a schema version for forward compatibility.

### Import Settings

A button that opens a native file picker filtered to `.json` files. On selection, the file is validated against the settings schema. Invalid files produce an inline error message; valid files overwrite all current settings after a confirmation prompt.

### Reset to Defaults

A button with a confirmation dialog that restores every setting to its factory default. This does not affect chat history or session data.

### Claude CLI Path

A text input pre-filled with the auto-detected path to the `claude` CLI binary. Zentral searches `PATH` on startup; users may override the value here if the binary lives in a non-standard location. The path is validated on save by checking that the file exists and is executable.

## Form Handling

All settings forms use React Hook Form for state management and Zod for schema validation. Each tab corresponds to a form section that can be validated independently.

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const generalSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  fontSize: z.number().min(12).max(24).default(14),
  defaultShell: z.string().min(1),
  language: z.string().default("en"),
});

type GeneralSettings = z.infer<typeof generalSchema>;

function GeneralSettingsForm() {
  const form = useForm<GeneralSettings>({
    resolver: zodResolver(generalSchema),
    defaultValues: async () => invoke("get_settings", { section: "general" }),
  });

  const onSubmit = async (data: GeneralSettings) => {
    await invoke("update_settings", { section: "general", values: data });
  };

  // Auto-save on change
  useEffect(() => {
    const subscription = form.watch(() => form.handleSubmit(onSubmit)());
    return () => subscription.unsubscribe();
  }, [form.watch]);

  return ( /* form JSX */ );
}
```

Settings save automatically when a value changes (auto-save). Validation errors display inline beneath the relevant field. If the Tauri backend rejects a value, the error is caught and shown as a toast notification.

## Persistence

All settings are stored in the SQLite database managed by the Rust backend. The `settings` table uses a key-value schema with a section column for grouping.

| Column | Type | Description |
|--------|------|-------------|
| section | TEXT | Tab or feature group (general, agents, telegram, advanced) |
| key | TEXT | Setting name within the section |
| value | TEXT | JSON-encoded setting value |
| updated_at | INTEGER | Unix timestamp of last modification |

The Rust side exposes two Tauri commands.

```
invoke("get_settings", { section: "general" })   -> Record<string, unknown>
invoke("update_settings", { section: "general", values: { ... } })  -> void
```

On application startup, the Rust backend reads all rows from the `settings` table and merges them with compiled-in defaults. Missing keys are filled from defaults so that new settings introduced in updates are always available.

## Components

The feature is decomposed into the following React components.

```
SettingsModal
├── SettingsTabs
│   ├── GeneralSettings
│   ├── AgentSettings
│   ├── TelegramSettings
│   └── AdvancedSettings
└── (confirmation dialogs, toasts)
```

| Component | Responsibility |
|-----------|----------------|
| SettingsModal | Renders the Dialog shell, manages open/close state, listens for `Ctrl+,` |
| SettingsTabs | Renders the vertical Tabs container and routes to the active tab panel |
| GeneralSettings | Theme radio group, font size selector, shell input, language placeholder |
| AgentSettings | Concurrent agent limit, timeout, auto-restart toggle, crash threshold |
| TelegramSettings | Bot token input, enabled toggle, chat IDs, test button, status indicator |
| AdvancedSettings | Retention selector, clear history, export/import, reset, CLI path input |

## shadcn/ui Components

The settings modal is built on the following primitives from the shadcn/ui component library.

| Component | Usage |
|-----------|-------|
| Dialog, DialogContent, DialogHeader, DialogTitle | Modal container and header with close button |
| Tabs, TabsList, TabsTrigger, TabsContent | Left-side tab navigation and content panels |
| Input | Text and number fields (shell path, chat IDs, CLI path) |
| Select, SelectTrigger, SelectContent, SelectItem | Dropdowns (font size, retention policy) |
| Switch | Toggle switches (auto-restart, Telegram enabled) |
| Button | Action buttons (test connection, clear history, export, import, reset) |
| RadioGroup, RadioGroupItem | Theme selection (light, dark, system) |
| Label | Accessible labels for every form control |
| Separator | Visual dividers between form sections within a tab |

## References

- [Design System](./design-system.md) -- color tokens, spacing, typography
- [Themes](./themes.md) -- theme file format and available palettes
- [Keyboard Shortcuts](./keyboard-shortcuts.md) -- full shortcut reference including `Ctrl+,`
