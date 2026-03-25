# Phase 4 -- Polish

> Brings Zentral to production quality with focus on user experience, reliability, and operational readiness.

> **Status:** in-progress — core polish done, production items remaining
> **Last updated:** 2026-03-25
>
> **What works:** 12 themes with smooth switching, command palette with fuzzy search, keyboard shortcuts (global hooks), 4-tab settings modal (General, Agents, Telegram, Advanced), error boundaries, Radix UI a11y primitives, performance optimizations (lazy loading, Zustand).
> **What's missing:** Auto-update (no Tauri updater plugin), CI/CD pipeline (no GitHub Actions), comprehensive accessibility audit, end-user documentation.

---

## Overview

The app is installable, auto-updates, looks polished across light and dark themes, handles errors gracefully, is keyboard-accessible, and ships through an automated CI/CD pipeline.

## Tasks

### Theme System

Implement a complete theming layer with light, dark, and system-follow modes.

| Item | Detail |
|------|--------|
| Mechanism | CSS custom properties on `:root`, toggled by a `data-theme` attribute |
| Modes | Light, dark, system (follows OS preference via `prefers-color-scheme`) |
| Persistence | SQLite settings table |
| Transition | 200 ms transition on `background-color` and `color` for smooth switching |

Acceptance criteria:

- Switching themes updates the entire UI without a page reload.
- The system mode reacts to OS-level theme changes in real time.
- All components (chat, sidebar, terminal, dialogs, header) respect the active theme.
- Theme tokens are defined in a single CSS file for easy customization.
- The terminal (xterm.js) theme updates to match the app theme.

### Command Palette

Add a global command palette for fast access to all application actions.

| Item | Detail |
|------|--------|
| Trigger | Ctrl+Shift+P (Cmd+Shift+P on macOS) |
| Search | Fuzzy matching against command names and descriptions |
| Categories | Navigation, agents, settings, terminal, view |

Acceptance criteria:

- The palette opens as a centered overlay with a search input auto-focused.
- Typing filters the command list with fuzzy matching.
- Pressing Enter executes the selected command and closes the palette.
- Pressing Escape closes the palette without action.
- All keyboard shortcuts are listed next to their corresponding commands.
- Recently used commands appear at the top of the list.

### Keyboard Shortcuts

Define and implement a comprehensive shortcut system.

| Action | Shortcut |
|--------|----------|
| Command palette | Ctrl+Shift+P |
| Settings | Ctrl+Comma |
| New project | Ctrl+N |
| Toggle left sidebar | Ctrl+B |
| Toggle right sidebar | Ctrl+Shift+B |
| Toggle terminal | Ctrl+Backtick |
| Focus chat input | Ctrl+L |
| Send message | Enter |
| New line in input | Shift+Enter |
| Search chat | Ctrl+F |
| Close active dialog | Escape |

Acceptance criteria:

- All shortcuts work globally unless a text input or terminal has focus.
- Terminal captures its own shortcuts and does not conflict with app shortcuts.
- Shortcuts are discoverable via the command palette and a help dialog.
- A future-facing design allows user customization (implementation of custom bindings is optional in Phase 4).

### Settings Modal

Expand the settings modal into a full tabbed interface.

| Tab | Contents |
|-----|----------|
| General | Theme, font family, font size, language, startup behavior |
| Agents | Default max concurrent agents, queue timeout, default skills |
| Telegram | Bot token, enabled toggle, allowed chat IDs, polling interval |
| Advanced | Database path, log level, reset to defaults, export/import settings |

Acceptance criteria:

- Each tab renders only its relevant settings.
- Changes apply immediately with visual confirmation.
- The "Reset to defaults" action requires confirmation.
- Export produces a JSON file; import validates and applies the file.
- All settings persist in SQLite.

### Auto-Update

Integrate the Tauri updater plugin for seamless application updates.

| Item | Detail |
|------|--------|
| Plugin | `@tauri-apps/plugin-updater` |
| Channel | GitHub Releases (or custom endpoint) |
| Check interval | On launch and every 6 hours |
| UI | Toast notification with "Update available" and an install button |

Acceptance criteria:

- The app checks for updates on startup and periodically.
- When an update is available, a non-intrusive toast appears.
- Clicking "Install" downloads and applies the update, then prompts for restart.
- The update process shows a progress indicator.
- If the update check fails (offline, server error), it fails silently and retries later.

### Performance Optimization

Address performance bottlenecks for a smooth experience on large conversations and long-running sessions.

| Area | Technique |
|------|-----------|
| Chat rendering | Virtual scrolling with `react-virtuoso` for message lists |
| Component loading | `React.lazy` and `Suspense` for non-critical panels |
| Event handling | Debounced resize and input events (150 ms) |
| Terminal | Limit scrollback buffer to 10,000 lines by default |
| IPC | Batch frequent Tauri events to reduce bridge overhead |
| Memory | Dispose xterm.js instances when terminal tabs close |

Acceptance criteria:

- A conversation with 1,000 messages scrolls at 60 fps.
- The app launches to interactive state in under 2 seconds on a mid-range machine.
- Resizing panels does not cause visible jank.
- Memory usage stays below 500 MB under normal use (5 agents, 3 terminal tabs, 2,000 messages).

### Error Handling

Implement global error handling and user-facing error reporting.

| Layer | Mechanism |
|-------|-----------|
| React | Error boundary wrapping each major panel |
| Rust | `anyhow` or `thiserror` with structured error types |
| IPC | Standardized error response format with codes and messages |
| UI | Toast notifications for transient errors; inline messages for persistent errors |

Acceptance criteria:

- A crash in one panel (e.g., terminal) does not take down the entire app.
- Tauri command errors surface as user-readable toast messages.
- Unhandled promise rejections in React are caught and logged.
- The Rust backend logs all errors with context to a rotating log file.
- A "Copy error details" button is available on error toasts for bug reporting.

### Accessibility

Ensure the app is usable with keyboard-only navigation and assistive technology.

| Area | Requirement |
|------|-------------|
| Focus management | Logical tab order across all panels and dialogs |
| ARIA | Roles and labels on custom components (sidebar, palette, tabs) |
| Screen reader | Chat messages announced with sender and content |
| Contrast | WCAG AA contrast ratios in both light and dark themes |
| Motion | Reduced motion support via `prefers-reduced-motion` |

Acceptance criteria:

- A user can navigate the entire app using only the keyboard.
- All interactive elements have visible focus indicators.
- The command palette and dialogs trap focus while open.
- Screen readers announce chat messages, agent status changes, and notifications.
- Color is never the sole indicator of state (status indicators include text labels or icons).

### Documentation

Prepare end-user and developer documentation.

| Document | Audience |
|----------|----------|
| User guide | End users: installation, setup, features |
| README | Developers: build, contribute, architecture overview |
| API reference | Plugin/extension developers: Tauri commands, event contracts |

Acceptance criteria:

- The user guide covers installation, first-run setup, project management, agent configuration, Telegram setup, and keyboard shortcuts.
- The README includes build instructions, tech stack, and contribution guidelines.
- All documentation is reviewed for accuracy against the shipping product.

### CI/CD Pipeline

Set up GitHub Actions workflows for automated build, test, and release.

| Workflow | Trigger | Steps |
|----------|---------|-------|
| CI | Push, PR | Lint, type-check, unit tests, Rust tests, build |
| Release | Tag push (`v*`) | Build all platforms, sign, upload to GitHub Releases |
| Develop | Push to `develop` | CI + deploy preview (if applicable) |

Acceptance criteria:

- Every push and PR runs the CI workflow.
- The CI workflow fails on lint errors, type errors, test failures, or Rust compilation errors.
- Tagging a release builds Windows (MSI/NSIS), macOS (DMG), and Linux (AppImage/deb) artifacts.
- Release artifacts are signed and uploaded to GitHub Releases automatically.
- The release workflow updates the updater endpoint for auto-update.

## Definition of Done

Phase 4 is complete when:

1. The app ships with light and dark themes that switch smoothly.
2. The command palette lists all actions and supports fuzzy search.
3. All keyboard shortcuts work and are documented.
4. Settings are organized into tabs covering General, Agents, Telegram, and Advanced.
5. The Tauri updater checks for and installs updates.
6. A 1,000-message conversation scrolls without frame drops.
7. Errors in any panel are caught and reported without crashing the app.
8. The app is navigable via keyboard alone with screen reader support.
9. User guide and developer README are complete.
10. CI/CD pipelines build, test, and release for all three platforms.

## References

- [Roadmap Overview](roadmap.md)
- [Phase 3 Telegram](phase-3-telegram.md)
- [Design System](../04-ui-ux/design-system.md)
- [Themes](../04-ui-ux/themes.md)
- [Keyboard Shortcuts](../04-ui-ux/keyboard-shortcuts.md)
- [CI/CD](../06-development/ci-cd.md)
- [Build and Release](../06-development/build-and-release.md)
