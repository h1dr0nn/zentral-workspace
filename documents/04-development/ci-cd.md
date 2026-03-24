# CI/CD

> Continuous integration and continuous delivery pipelines for Zentral. All automation runs on GitHub Actions.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

The project uses two GitHub Actions workflows:

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| CI | `.github/workflows/ci.yml` | Every PR, push to `main` | Lint, test, typecheck |
| Release | `.github/workflows/release.yml` | Tag push matching `v*` | Build, sign, publish |

## CI Workflow

The CI workflow validates code quality on every pull request and push to `main`. It runs the following steps in order:

1. Checkout repository
2. Setup Rust toolchain (stable)
3. Setup Node.js 20 and pnpm 9
4. Install frontend dependencies (`pnpm install`)
5. Install platform-specific system dependencies (Linux only)
6. Rust format check (`cargo fmt --check`)
7. Rust linting (`cargo clippy -- -D warnings`)
8. Rust tests (`cargo test`)
9. Frontend linting (`pnpm lint`)
10. Frontend type check (`pnpm typecheck`)
11. Frontend tests (`pnpm test`)

The workflow runs on `ubuntu-22.04` to keep CI costs low. All checks must pass before a PR can be merged.

### CI Workflow Definition

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install frontend dependencies
        run: pnpm install

      - name: Rust format check
        run: cargo fmt --manifest-path src-tauri/Cargo.toml --check

      - name: Rust clippy
        run: cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

      - name: Rust tests
        run: cargo test --manifest-path src-tauri/Cargo.toml

      - name: Frontend lint
        run: pnpm lint

      - name: Frontend typecheck
        run: pnpm typecheck

      - name: Frontend tests
        run: pnpm test
```

## Release Workflow

The release workflow builds platform-specific installers, signs them, and uploads to a GitHub Release. It triggers when a version tag is pushed.

### Build Matrix

| OS | Runner | Rust Target |
|----|--------|-------------|
| Windows | `windows-latest` | `x86_64-pc-windows-msvc` |
| Linux | `ubuntu-22.04` | `x86_64-unknown-linux-gnu` |
| macOS | `macos-latest` | `aarch64-apple-darwin` |

### Release Workflow Definition

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
          - os: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
          - os: macos-latest
            target: aarch64-apple-darwin

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install system dependencies (Linux)
        if: matrix.os == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install frontend dependencies
        run: pnpm install

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          # macOS signing
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "Zentral ${{ github.ref_name }}"
          releaseBody: "See the [CHANGELOG](https://github.com/<owner>/zentral/blob/main/CHANGELOG.md) for details."
          releaseDraft: true
          prerelease: false
          args: --target ${{ matrix.target }}
```

## Secrets

The following repository secrets must be configured in GitHub Settings:

| Secret | Purpose | Required By |
|--------|---------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Signs update bundles for the auto-updater | All platforms |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key | All platforms |
| `APPLE_CERTIFICATE` | Base64-encoded .p12 developer certificate | macOS |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 certificate | macOS |
| `APPLE_SIGNING_IDENTITY` | Certificate common name for codesign | macOS |
| `APPLE_ID` | Apple ID email for notarization | macOS |
| `APPLE_PASSWORD` | App-specific password for notarization | macOS |
| `APPLE_TEAM_ID` | Apple Developer Team ID | macOS |

Windows code signing with an EV certificate requires additional setup. See the Tauri documentation for integrating SignTool into the build pipeline.

## Caching

Both workflows use caching to speed up builds:

- **Rust dependencies:** `swatinem/rust-cache` caches the `target/` directory and Cargo registry, keyed by `Cargo.lock`.
- **pnpm store:** The `pnpm/action-setup` action automatically configures the pnpm store cache.
- **Node modules:** Resolved from the pnpm store; no separate cache needed.

Typical CI run times after cache warm-up:

| Job | Duration |
|-----|----------|
| CI (lint + test) | 3-5 minutes |
| Release (per platform) | 8-12 minutes |

## References

- [build-and-release.md](./build-and-release.md) -- build outputs and release process
- [coding-standards.md](./coding-standards.md) -- standards enforced by CI
- [setup.md](./setup.md) -- local development setup
- [tauri-apps/tauri-action](https://github.com/tauri-apps/tauri-action) -- official Tauri GitHub Action
