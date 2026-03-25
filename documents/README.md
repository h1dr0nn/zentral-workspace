# Zentral Documentation

> Complete documentation for Zentral — Claude Multi-Agent Workspace.

> **Status:** draft
> **Last updated:** 2026-03-25

---

## Overview

Documentation is organized into seven numbered sections, each covering a distinct concern. Start with **01 -- Architecture** for a top-down understanding of the system, then move to **02 -- Specifications** for detailed behavior of each module. **03 -- UI/UX** describes every visible surface. **04 -- Development** covers contributor workflow. **05 -- Roadmap** defines the delivery plan. **06 -- Research** captures technical investigation notes that informed design decisions. **07 -- Project** holds cross-cutting reference material such as the glossary and vision statement.

Within each section, documents are self-contained but may cross-reference one another. Links are relative so they work both on GitHub and in local editors.

## 01 -- Architecture

| Document | Description |
|----------|-------------|
| [System Architecture](01-architecture/system-architecture.md) | High-level system design, communication patterns, module dependencies |
| [Rust Core](01-architecture/rust-core.md) | Rust module layout, thread model, error handling, crate dependencies |
| [Frontend Architecture](01-architecture/frontend-architecture.md) | React components, Zustand stores, library usage, event patterns |
| [Tauri Bridge](01-architecture/tauri-bridge.md) | IPC commands and events inventory with full signatures |
| [Data Flow](01-architecture/data-flow.md) | Step-by-step data flows for all major user actions |

## 02 -- Specifications

| Document | Description |
|----------|-------------|
| [Agent Manager](02-specifications/agent-manager.md) | Agent lifecycle, state machine, concurrency control |
| [Secretary Agent](02-specifications/secretary-agent.md) | Orchestration logic, skill-based routing, execution plans |
| [Skill Pool](02-specifications/skill-pool.md) | Skill registry, categories, assignment, SQLite schema |
| [Agent Spawner](02-specifications/agent-spawner.md) | Claude CLI spawning, stdin/stdout piping, buffer management |
| [Telegram Bot](02-specifications/telegram-bot.md) | Long polling, commands, authentication, message routing |
| [Project Workspace](02-specifications/project-workspace.md) | Project CRUD, context detection, CWD switching |
| [PTY Handling](02-specifications/pty-handling.md) | Cross-platform pseudo-terminal for embedded terminal panel |
| [Persistence](02-specifications/persistence.md) | SQLite schema, migrations, CRUD operations |
| [Streaming Protocol](02-specifications/streaming-protocol.md) | NDJSON parsing, event types, abort mechanism |
| [Schedules](02-specifications/schedules.md) | Recurring task scheduler, cron expressions, scheduling engine |
| [Workflows](02-specifications/workflows.md) | Multi-step agent pipelines, branching logic, execution engine |
| [Activity History](02-specifications/activity-history.md) | Event log, filtering, retention policy |
| [Knowledge Base](02-specifications/knowledge-base.md) | Document repository, categories, agent context injection |

## 03 -- UI/UX

| Document | Description |
|----------|-------------|
| [Design System](03-ui-ux/design-system.md) | Colors (oklch), typography, spacing, shadcn/ui components, status indicators |
| [Window Decoration](03-ui-ux/window-decoration.md) | Custom titlebar, menu bar, panel toggle buttons |
| [Left Sidebar -- Projects](03-ui-ux/sidebar-left-projects.md) | Project list, context badges, add/remove |
| [Right Sidebar -- Agents](03-ui-ux/sidebar-right-agents.md) | Agent cards, status indicators, skill badges |
| [Main Area -- Chat](03-ui-ux/main-area-chat.md) | Chat view, message rendering, streaming, multi-agent attribution |
| [Terminal Panel](03-ui-ux/terminal-panel.md) | Embedded terminal, xterm.js, toggle behavior |
| [Command Palette](03-ui-ux/command-palette.md) | Quick action launcher, fuzzy search |
| [Settings Modal](03-ui-ux/settings-modal.md) | Configuration UI with tabs |
| [Themes](03-ui-ux/themes.md) | CSS variable theming, light/dark mode |
| [Keyboard Shortcuts](03-ui-ux/keyboard-shortcuts.md) | Default keybindings, customization |
| [Left Sidebar -- Schedules](03-ui-ux/sidebar-left-schedules.md) | Schedule cards, toggle controls, creation dialog |
| [Left Sidebar -- Workflows](03-ui-ux/sidebar-left-workflows.md) | Workflow cards, step pipeline, detail view |
| [Left Sidebar -- History](03-ui-ux/sidebar-left-history.md) | Activity timeline, event cards, filters, date grouping |
| [Left Sidebar -- Knowledge](03-ui-ux/sidebar-left-knowledge.md) | Document list, category groups, detail view, search |

## 04 -- Development

| Document | Description |
|----------|-------------|
| [Setup](04-development/setup.md) | Prerequisites, installation, IDE configuration |
| [Coding Standards](04-development/coding-standards.md) | Rust and TypeScript conventions, git workflow |
| [Testing Strategy](04-development/testing-strategy.md) | Unit, integration, E2E testing approach |
| [Build and Release](04-development/build-and-release.md) | Build commands, platform outputs, versioning |
| [CI/CD](04-development/ci-cd.md) | GitHub Actions workflows |

## 05 -- Roadmap

| Document | Description |
|----------|-------------|
| [Roadmap](05-roadmap/roadmap.md) | 5-phase overview and MVP definition |
| [Phase 1 -- Foundation](05-roadmap/phase-1-foundation.md) | Tauri scaffold, SQLite, single agent, basic UI |
| [Phase 2 -- Agents](05-roadmap/phase-2-agents.md) | Multi-agent system, secretary, skill pool |
| [Phase 3 -- Telegram](05-roadmap/phase-3-telegram.md) | Telegram bot integration |
| [Phase 4 -- Polish](05-roadmap/phase-4-polish.md) | Themes, command palette, auto-update, performance |
| [Phase 5 -- Automation](05-roadmap/phase-5-automation.md) | Schedules, workflows, activity history, knowledge base |

## 06 -- Research

| Document | Description |
|----------|-------------|
| [Competitor Analysis](06-research/competitor-analysis.md) | Agentrooms, CrewAI, Claude Desktop, Cursor comparison |
| [Claude CLI Internals](06-research/claude-cli-internals.md) | CLI flags, NDJSON format, sessions, authentication |
| [Rust Crates](06-research/rust-crates.md) | Crate selection guide with rationale |

## 07 -- Project

| Document | Description |
|----------|-------------|
| [Glossary](07-project/glossary.md) | Term definitions |
| [Vision and Goals](07-project/vision-and-goals.md) | Vision, goals, non-goals, design principles |
