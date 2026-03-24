# Coding Standards

> Coding conventions enforced across the Zentral codebase. All contributors are expected to follow these standards.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

### Formatting

All Rust code must pass `cargo fmt`. The project uses default rustfmt settings with no overrides.

```bash
# Check formatting (CI mode)
cargo fmt --check

# Apply formatting
cargo fmt
```

### Linting

Clippy is the project linter. All warnings are treated as errors:

```bash
cargo clippy -- -D warnings
```

### Error Handling

The project uses a two-tier error strategy:

- **`thiserror`** for domain-specific errors that callers need to match on. Define typed error enums in the module where they originate.
- **`anyhow`** for application-level plumbing where the caller only needs to know something failed and display a message.

```rust
// Domain error -- callers can match variants
#[derive(Debug, thiserror::Error)]
pub enum SessionError {
    #[error("session not found: {0}")]
    NotFound(String),
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
}

// Application-level usage
fn bootstrap() -> anyhow::Result<()> {
    let config = load_config().context("failed to load configuration")?;
    Ok(())
}
```

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Functions, variables | snake_case | `parse_input`, `session_id` |
| Types, traits, enums | PascalCase | `SessionManager`, `AgentKind` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_BUFFER_SIZE` |
| Modules | snake_case | `context_engine` |
| Crate names | kebab-case | `zentral-core` |

### Module Organization

- One file per module. Each module directory has a `mod.rs` that re-exports public items.
- Keep module files under 500 lines. Split into submodules when a file grows beyond that.
- Place unit tests in a `#[cfg(test)]` block at the bottom of the same file.

```rust
// src/session/mod.rs
mod manager;
mod types;

pub use manager::SessionManager;
pub use types::{Session, SessionId};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_creation() {
        // ...
    }
}
```

### Async

Use `tokio` for async runtime. Prefer `tokio::spawn` for background tasks and `crossbeam-channel` for communication between the async runtime and synchronous Tauri command handlers.

## TypeScript Conventions

### Strict Mode

TypeScript strict mode is enabled in `tsconfig.json`. Do not disable it or add `@ts-ignore` comments without a documented justification.

### Components

- Functional components only. No class components.
- Use named exports exclusively. Default exports are not permitted.

```typescript
// Good
export function AgentSidebar() {
  return <div>...</div>;
}

// Bad -- default export
export default function AgentSidebar() { ... }

// Bad -- class component
export class AgentSidebar extends React.Component { ... }
```

### Type Safety

- Never use the `any` type. Use `unknown` when the type is genuinely unknown, then narrow with type guards.
- Prefer `interface` over `type` for object shapes. Use `type` for unions, intersections, and mapped types.

```typescript
// Prefer interface for object shapes
interface Session {
  id: string;
  name: string;
  createdAt: Date;
}

// Use type for unions
type AgentStatus = "idle" | "running" | "error";
```

### File Naming

| Kind | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `AgentSidebar.tsx` |
| Hooks | camelCase, prefixed with `use` | `useTerminal.ts` |
| Stores | camelCase, suffixed with `Store` | `sessionStore.ts` |
| Utilities | camelCase | `ansiParser.ts` |

### Imports

Use absolute imports from `src/` where possible. Group imports in this order, separated by blank lines:

1. React and third-party libraries
2. Internal modules (components, hooks, stores, utils)
3. Types (import type)

## CSS and Tailwind

### Utility-First

Use Tailwind utility classes for all styling. Avoid writing custom CSS except for animations or complex selectors that Tailwind cannot express.

```typescript
// Good -- Tailwind utilities
<div className="flex items-center gap-2 rounded-lg bg-background p-4 text-foreground">

// Bad -- custom CSS or inline styles
<div style={{ display: "flex", alignItems: "center" }}>
```

### Design Tokens

Use semantic token classes provided by the theme system rather than raw color values:

| Token | Usage |
|-------|-------|
| `bg-background` | Page / panel backgrounds |
| `text-foreground` | Primary text |
| `bg-muted` | Subtle backgrounds |
| `text-muted-foreground` | Secondary text |
| `bg-primary` | Accent / action elements |
| `border-border` | Borders and dividers |

### No Inline Styles

Inline `style` attributes are not allowed. If a value must be dynamic, use CSS custom properties or Tailwind's arbitrary value syntax (`w-[calc(100%-2rem)]`).

## Git Conventions

### Commit Messages

Follow the Conventional Commits specification:

```
feat: add Telegram bot notification support
fix: resolve session restore crash on corrupted database
refactor: extract PTY handler into separate module
docs: update setup guide with Linux dependencies
test: add integration tests for completion engine
chore: bump tauri to 2.1.0
```

Use the imperative mood ("add", not "added" or "adds"). Keep the subject line under 72 characters. Add a body separated by a blank line for non-trivial changes.

### Branch Naming

```
feature/agent-manager
fix/telegram-timeout
refactor/chat-store
docs/setup-guide
test/completion-engine
```

### Pull Requests

- Write a descriptive title matching the conventional commit format.
- Link to the related issue (`Closes #42`).
- Assign at least one reviewer.
- Ensure CI passes before requesting review.
- Squash-merge into `main`.

## Code Review Checklist

Before approving a pull request, verify the following:

| Category | Check |
|----------|-------|
| Security | No secrets, tokens, or credentials in code or comments |
| Security | User input is validated and sanitized |
| Error handling | All error paths are handled; no silent swallows |
| Error handling | Errors propagated to the frontend include user-friendly messages |
| Type safety | No `any` types; no `unwrap()` on fallible Rust code in production paths |
| Tests | New functionality includes tests; existing tests still pass |
| Performance | No unnecessary re-renders; memo used where appropriate |
| Logging | No `console.log` in production code; use the logging system |
| Logging | Rust code uses `log` macros (`info!`, `debug!`, `error!`) |
| Style | Code passes `cargo fmt`, `cargo clippy`, `pnpm lint`, and `pnpm typecheck` |

## References

- [setup.md](./setup.md) -- development environment setup
- [build-and-release.md](./build-and-release.md) -- build pipeline and release process
- [ci-cd.md](./ci-cd.md) -- automated checks and deployment
