# Development Setup

> Guide covering everything needed to set up a local development environment for Zentral.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

### Required Toolchain

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Rust | 1.77+ | [rustup.rs](https://rustup.rs) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| Tauri CLI v2 | 2.x | `cargo install tauri-cli --version "^2"` |

### Platform-Specific Dependencies

### Windows

- **Visual Studio Build Tools 2022** with the "Desktop development with C++" workload. Install from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/visual-cpp-build-tools/). Ensure the following components are selected:
  - MSVC v143 build tools
  - Windows 10/11 SDK
  - C++ CMake tools
- **WebView2** runtime. Pre-installed on Windows 11. For Windows 10, download the Evergreen Bootstrapper from [developer.microsoft.com](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

### Linux

Install the required system libraries:

```bash
# Debian / Ubuntu
sudo apt install build-essential libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

# Fedora
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel

# Arch
sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg
```

### macOS

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

## Clone and Install

```bash
git clone <repo-url>
cd zentral
pnpm install
```

This installs all frontend dependencies defined in `package.json`. Rust dependencies are fetched automatically by Cargo on the first build.

## Development

Start the development environment with a single command:

```bash
pnpm tauri dev
```

This launches both the Vite dev server (frontend hot-reload on `localhost:1420`) and compiles the Rust backend. The Tauri window opens automatically once both are ready.

To run frontend and backend checks independently:

```bash
# Frontend only
pnpm dev            # Vite dev server
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit

# Backend only
cargo check --manifest-path src-tauri/Cargo.toml
cargo test  --manifest-path src-tauri/Cargo.toml
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | No (optional for dev) | Bot token for Telegram integration. Without it, Telegram features are disabled gracefully. |
| `RUST_LOG` | No | Controls Rust log verbosity. Set to `debug` during development: `RUST_LOG=debug pnpm tauri dev` |

Create a `.env` file in the project root for convenience:

```bash
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
RUST_LOG=debug
```

## IDE Setup

VS Code is the recommended editor. Install the following extensions:

| Extension | Purpose |
|-----------|---------|
| rust-analyzer | Rust language server (completions, diagnostics, formatting) |
| Tailwind CSS IntelliSense | Autocomplete for Tailwind utility classes |
| ESLint | JavaScript/TypeScript linting |
| Prettier | Code formatting for TS/JSON/CSS |
| Tauri | Official Tauri extension for project management and debugging |

Recommended `settings.json` overrides for the workspace:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "rust-analyzer.check.command": "clippy"
}
```

## Project Structure

```
zentral/
├── src/                        # React frontend (TypeScript)
│   ├── components/             # UI components (PascalCase files)
│   │   ├── header/
│   │   ├── sidebar/
│   │   ├── tabs/
│   │   ├── terminal/
│   │   └── settings/
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Zustand state stores
│   ├── utils/                  # Utility functions
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css              # Tailwind entry point
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── agent/              # Agent detection and adapters
│   │   ├── commands/           # Tauri IPC command handlers
│   │   ├── completion/         # Completion engine
│   │   ├── config/             # Configuration and themes
│   │   ├── context/            # Context detectors (git, node, etc.)
│   │   ├── parser/             # ANSI parser and state machine
│   │   ├── plugin/             # Plugin loader and manifest
│   │   ├── pty/                # PTY handling (unix/windows)
│   │   ├── session/            # Session management
│   │   ├── terminal/           # Terminal emulator and grid
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── completions/                # Bundled completion definitions (TOML)
├── themes/                     # Theme files (TOML)
├── shell-integration/          # Shell integration scripts
├── documents/                  # Project documentation
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tsconfig.json
└── eslint.config.js
```

## Common Issues

### WebView2 Missing (Windows 10)

**Symptom:** The application window opens but displays a blank white screen, or fails to launch with a WebView2 error.

**Fix:** Download and install the WebView2 Evergreen Runtime from Microsoft. A reboot may be required.

### webkit2gtk Version Mismatch (Linux)

**Symptom:** Compilation fails with errors referencing `webkit2gtk-4.0` instead of `webkit2gtk-4.1`.

**Fix:** Tauri v2 requires `webkit2gtk-4.1`. Ensure your distribution provides this package. On Ubuntu, version 22.04+ is required.

### Slow First Compilation (All Platforms)

**Symptom:** The first `pnpm tauri dev` takes 5-15 minutes.

**Fix:** This is expected. Cargo downloads and compiles all Rust dependencies on the first run. Subsequent builds are incremental and much faster. To speed things up, use the `sccache` compiler cache:

```bash
cargo install sccache
export RUSTC_WRAPPER=sccache
```

### Port Already in Use

**Symptom:** Vite fails to start with `EADDRINUSE` on port 1420.

**Fix:** Kill the process occupying the port or change the dev server port in `vite.config.ts`.

## References

- [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/)
- [coding-standards.md](./coding-standards.md) -- project coding conventions
- [build-and-release.md](./build-and-release.md) -- production builds and releases
- [ci-cd.md](./ci-cd.md) -- continuous integration setup
