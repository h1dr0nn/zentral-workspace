# Build and Release

> How to build Zentral for development and production, and how the release process works.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Run the full development stack (Vite dev server + Rust backend with hot-reload):

```bash
pnpm tauri dev
```

The frontend is served on `localhost:1420` with HMR. The Rust backend recompiles on file changes in `src-tauri/`.

To build only the frontend for inspection:

```bash
pnpm build
```

## Production Build

Generate a release-optimized binary with bundled installers:

```bash
pnpm tauri build
```

This compiles the frontend, builds the Rust binary in release mode, and packages platform-specific installers.

## Platform Outputs

| Platform | Format | Location |
|----------|--------|----------|
| Windows | `.msi`, `.exe` (NSIS) | `src-tauri/target/release/bundle/msi/` and `nsis/` |
| macOS | `.dmg`, `.app` | `src-tauri/target/release/bundle/dmg/` |
| Linux | `.deb`, `.AppImage` | `src-tauri/target/release/bundle/deb/` and `appimage/` |

The raw executable (without installer) is at `src-tauri/target/release/zentral` (or `zentral.exe` on Windows).

## Code Signing

### Windows

Sign the `.msi` and `.exe` installers using SignTool with an EV code signing certificate:

```bash
# SignTool is part of the Windows SDK
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /f certificate.pfx /p <password> target/release/bundle/nsis/zentral_1.0.0_x64-setup.exe
```

In CI, the certificate is stored as a base64-encoded secret and decoded before signing. Tauri supports automatic signing via environment variables:

```bash
TAURI_SIGNING_PRIVATE_KEY=<base64-encoded-key>
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<password>
```

### macOS

Sign and notarize the application bundle:

```bash
# Sign
codesign --deep --force --verify --verbose --sign "Developer ID Application: <Team>" target/release/bundle/macos/Zentral.app

# Notarize
xcrun notarytool submit target/release/bundle/dmg/Zentral_1.0.0_aarch64.dmg --apple-id <email> --password <app-specific-password> --team-id <team-id> --wait

# Staple
xcrun stapler staple target/release/bundle/dmg/Zentral_1.0.0_aarch64.dmg
```

### Linux

Sign release artifacts with GPG:

```bash
gpg --armor --detach-sign target/release/bundle/deb/zentral_1.0.0_amd64.deb
```

## Auto-Update

Zentral uses the Tauri updater plugin to deliver updates to users.

### Configuration

Enable the updater in `tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "dialog": true,
      "endpoints": [
        "https://releases.zentral.dev/{{target}}/{{arch}}/{{current_version}}"
      ],
      "pubkey": "<public-key>"
    }
  }
}
```

### Update Manifest

The update endpoint returns a JSON manifest:

```json
{
  "version": "1.1.0",
  "notes": "Bug fixes and performance improvements.",
  "pub_date": "2026-03-24T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<signature>",
      "url": "https://releases.zentral.dev/downloads/zentral_1.1.0_x64-setup.nsis.zip"
    },
    "darwin-aarch64": {
      "signature": "<signature>",
      "url": "https://releases.zentral.dev/downloads/zentral_1.1.0_aarch64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "<signature>",
      "url": "https://releases.zentral.dev/downloads/zentral_1.1.0_amd64.AppImage.tar.gz"
    }
  }
}
```

Generate the signing keypair with:

```bash
cargo tauri signer generate -w ~/.tauri/zentral.key
```

## Version Numbering

The project follows Semantic Versioning (semver): `MAJOR.MINOR.PATCH`.

- **MAJOR** -- breaking changes to user-facing features or data formats.
- **MINOR** -- new features, backward-compatible.
- **PATCH** -- bug fixes, performance improvements.

Versions must be kept in sync across three files:

| File | Field |
|------|-------|
| `package.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version` under `[package]` |
| `src-tauri/tauri.conf.json` | `"version"` |

Use a single command to bump all three:

```bash
# Example: bump to 1.2.0
pnpm version 1.2.0 --no-git-tag-version
# Then manually update Cargo.toml and tauri.conf.json, or use a script
```

## Release Process

1. **Prepare:** Ensure `main` is green in CI. Update `CHANGELOG.md` with the new version's entries.
2. **Bump version:** Update version strings in `package.json`, `Cargo.toml`, and `tauri.conf.json`.
3. **Commit and tag:**
   ```bash
   git add -A
   git commit -m "chore: release v1.0.0"
   git tag v1.0.0
   git push origin main --tags
   ```
4. **CI builds:** The `release.yml` workflow triggers on the `v*` tag, builds all platforms, signs artifacts, and uploads them to a GitHub Release draft.
5. **Publish:** Review the draft release on GitHub, edit release notes if needed, and publish.
6. **Update endpoint:** Upload the update manifest JSON so existing installations receive the update notification.

## References

- [ci-cd.md](./ci-cd.md) -- CI/CD pipeline configuration
- [setup.md](./setup.md) -- development environment setup
- [Tauri v2 Updater Guide](https://v2.tauri.app/plugin/updater/)
