# PTY Handling

> Platform-specific pseudo-terminal management for the embedded terminal panel, covering spawning, I/O piping, resize events, and teardown on Unix and Windows.

> **Status:** draft
> **Last updated:** 2026-03-24

---

## Overview

Zentral includes an embedded terminal panel as a secondary convenience feature. The panel is toggled with the `[T]` button in the header bar and provides a system shell running in the active project's working directory. It is independent from the agent chat system -- agents do not interact with this terminal, and the terminal does not feed context into agent conversations.

The PTY layer manages the lifecycle of a pseudo-terminal connected to the user's preferred shell. It handles platform-specific spawning, I/O piping, resize events, and teardown.

```
+---------------------+
|   Zentral Window    |
|                     |
|  +---------------+  |      Tauri Events
|  | Agent Chat    |  |   (raw bytes, resize)
|  | (primary)     |  |          |
|  +---------------+  |          |
|  +---------------+  |          v
|  | Terminal Panel |<-+--- PtyManager ---- OS Thread (read loop)
|  | [T] toggle    |  |          |
|  +---------------+  |          v
+---------------------+    PtyBackend (trait)
                             /         \
                       UnixPty       WindowsPty
                      (nix crate)   (windows crate)
```

---

## PtyBackend Trait

All platform-specific PTY implementations conform to a single trait. The trait uses blocking I/O deliberately -- async is not appropriate here because PTY file descriptors on both platforms are best consumed from a dedicated OS thread.

```rust
use std::io;

/// Platform-agnostic interface to a pseudo-terminal.
pub trait PtyBackend: Send {
    /// Read bytes from the PTY master into `buf`.
    /// Returns the number of bytes read, or 0 on EOF.
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize>;

    /// Write bytes to the PTY master (user input).
    /// Returns the number of bytes written.
    fn write(&mut self, data: &[u8]) -> io::Result<usize>;

    /// Resize the terminal to the given dimensions.
    fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()>;

    /// Return the PID of the child shell process.
    fn pid(&self) -> u32;

    /// Block until the child process exits. Returns the exit code.
    fn wait(&mut self) -> io::Result<i32>;
}
```

---

## PtyConfig

The `PtyConfig` struct carries all parameters needed to spawn a new PTY session. It is constructed by the Tauri command handler when the user opens the terminal panel.

```rust
use std::collections::HashMap;
use std::path::PathBuf;

/// Configuration for spawning a PTY session.
pub struct PtyConfig {
    /// Path to the shell binary.
    /// Detected automatically if None.
    pub shell: Option<String>,

    /// Arguments to pass to the shell.
    /// Example: ["--login"] for bash.
    pub args: Vec<String>,

    /// Additional environment variables merged into the child environment.
    pub env: HashMap<String, String>,

    /// Initial terminal dimensions.
    pub cols: u16,
    pub rows: u16,

    /// Working directory for the shell.
    pub cwd: PathBuf,
}
```

### Default Environment Variables

The following variables are always set in the child environment, regardless of platform.

| Variable | Value | Purpose |
|---|---|---|
| `TERM` | `xterm-256color` | Enables 256-color support in shell programs |
| `COLORTERM` | `truecolor` | Signals 24-bit color capability to applications |
| `ZENTRAL_TERMINAL` | `1` | Allows shell scripts to detect the Zentral terminal |

---

## Unix Implementation

The Unix backend uses the `nix` crate for POSIX PTY operations. The implementation lives at `src-tauri/src/pty/unix.rs`.

### Spawn Sequence

```
openpty()
    |
    +---> master_fd, slave_fd
    |
fork()
    |
    +---> Parent: closes slave_fd, returns master_fd
    |
    +---> Child:
              setsid()              -- create new session
              ioctl(TIOCSCTTY)      -- set controlling terminal
              dup2(slave, 0/1/2)    -- redirect stdin/stdout/stderr
              close(slave_fd)
              close(master_fd)
              execvp(shell, args)   -- replace process image
```

### Shell Detection

The shell binary is resolved in order:

1. `PtyConfig::shell` if explicitly set.
2. `$SHELL` environment variable.
3. Fallback to `/bin/bash`.
4. Final fallback to `/bin/sh` if bash is not found.

### Implementation

```rust
use nix::pty::openpty;
use nix::unistd::{fork, setsid, dup2, execvp, close, ForkResult, Pid};
use nix::sys::termios;
use std::ffi::CString;
use std::os::unix::io::RawFd;

pub struct UnixPty {
    master_fd: RawFd,
    child_pid: Pid,
}

impl UnixPty {
    pub fn spawn(config: &PtyConfig) -> io::Result<Self> {
        // Create the master/slave PTY pair.
        let pty = openpty(None, None)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        // Set initial terminal size.
        set_window_size(pty.master, config.cols, config.rows)?;

        let shell = resolve_shell(&config.shell);
        let shell_cstr = CString::new(shell.as_str())
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

        match unsafe { fork() } {
            Ok(ForkResult::Parent { child }) => {
                // Parent: close the slave side, keep the master.
                let _ = close(pty.slave);
                Ok(UnixPty {
                    master_fd: pty.master,
                    child_pid: child,
                })
            }
            Ok(ForkResult::Child) => {
                // Child: set up the slave as the controlling terminal.
                let _ = close(pty.master);
                setsid().ok();

                dup2(pty.slave, 0).ok(); // stdin
                dup2(pty.slave, 1).ok(); // stdout
                dup2(pty.slave, 2).ok(); // stderr

                if pty.slave > 2 {
                    let _ = close(pty.slave);
                }

                // Set environment.
                std::env::set_var("TERM", "xterm-256color");
                std::env::set_var("COLORTERM", "truecolor");
                std::env::set_var("ZENTRAL_TERMINAL", "1");
                std::env::set_current_dir(&config.cwd).ok();

                for (key, val) in &config.env {
                    std::env::set_var(key, val);
                }

                // Build argv.
                let mut argv = vec![shell_cstr.clone()];
                for arg in &config.args {
                    argv.push(CString::new(arg.as_str()).unwrap());
                }

                // Replace process image. Does not return on success.
                execvp(&shell_cstr, &argv).ok();
                std::process::exit(127);
            }
            Err(e) => Err(io::Error::new(io::ErrorKind::Other, e)),
        }
    }
}
```

### Terminal Resize (ioctl)

```rust
use nix::libc::{winsize, TIOCSWINSZ};
use nix::ioctl_write_ptr_bad;

ioctl_write_ptr_bad!(set_ws, TIOCSWINSZ, winsize);

fn set_window_size(fd: RawFd, cols: u16, rows: u16) -> io::Result<()> {
    let ws = winsize {
        ws_row: rows,
        ws_col: cols,
        ws_xpixel: 0,
        ws_ypixel: 0,
    };
    unsafe { set_ws(fd, &ws) }
        .map(|_| ())
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e))
}
```

### PtyBackend Implementation

```rust
impl PtyBackend for UnixPty {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        nix::unistd::read(self.master_fd, buf)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))
    }

    fn write(&mut self, data: &[u8]) -> io::Result<usize> {
        nix::unistd::write(self.master_fd, data)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))
    }

    fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()> {
        set_window_size(self.master_fd, cols, rows)
    }

    fn pid(&self) -> u32 {
        self.child_pid.as_raw() as u32
    }

    fn wait(&mut self) -> io::Result<i32> {
        use nix::sys::wait::waitpid;
        use nix::sys::wait::WaitStatus;

        match waitpid(self.child_pid, None) {
            Ok(WaitStatus::Exited(_, code)) => Ok(code),
            Ok(WaitStatus::Signaled(_, sig, _)) => Ok(128 + sig as i32),
            Ok(_) => Ok(-1),
            Err(e) => Err(io::Error::new(io::ErrorKind::Other, e)),
        }
    }
}
```

---

## Windows Implementation

The Windows backend uses the ConPTY API introduced in Windows 10 version 1809. The implementation lives at `src-tauri/src/pty/windows.rs`.

### Spawn Sequence

```
CreatePipe() x 2
    |
    +---> pipe_in (read/write handles)
    +---> pipe_out (read/write handles)
    |
CreatePseudoConsole(size, pipe_in_read, pipe_out_write)
    |
    +---> hPC (pseudo console handle)
    |
InitializeProcThreadAttributeList()
UpdateProcThreadAttribute(PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE, hPC)
    |
CreateProcess(shell, ..., EXTENDED_STARTUPINFO_PRESENT)
    |
    +---> hProcess, hThread
    |
Close pipe_in_read, pipe_out_write (owned by ConPTY now)
    |
Read from pipe_out_read  (shell output)
Write to pipe_in_write   (user input)
```

### Shell Detection

The shell binary is resolved in order:

1. `PtyConfig::shell` if explicitly set.
2. `pwsh.exe` (PowerShell 7+) if found on `PATH`.
3. `powershell.exe` (Windows PowerShell 5.1).
4. `cmd.exe` as final fallback.

### Implementation

```rust
use std::io;
use std::ptr;
use windows::Win32::System::Console::*;
use windows::Win32::System::Threading::*;
use windows::Win32::System::Pipes::CreatePipe;
use windows::Win32::Foundation::*;

pub struct WindowsPty {
    hpc: HPCON,
    process: HANDLE,
    pid: u32,
    pipe_in: HANDLE,   // write end -- sends input to shell
    pipe_out: HANDLE,  // read end  -- receives output from shell
}

impl WindowsPty {
    pub fn spawn(config: &PtyConfig) -> io::Result<Self> {
        let size = COORD {
            X: config.cols as i16,
            Y: config.rows as i16,
        };

        // Create I/O pipes.
        let mut pipe_in_read = HANDLE::default();
        let mut pipe_in_write = HANDLE::default();
        let mut pipe_out_read = HANDLE::default();
        let mut pipe_out_write = HANDLE::default();

        unsafe {
            CreatePipe(&mut pipe_in_read, &mut pipe_in_write, None, 0)?;
            CreatePipe(&mut pipe_out_read, &mut pipe_out_write, None, 0)?;
        }

        // Create the pseudo console.
        let hpc = unsafe {
            let mut hpc = HPCON::default();
            CreatePseudoConsole(size, pipe_in_read, pipe_out_write, 0, &mut hpc)?;
            hpc
        };

        // Build the process attribute list.
        let shell = resolve_shell_windows(&config.shell);
        let mut command_line = shell.clone();
        for arg in &config.args {
            command_line.push(' ');
            command_line.push_str(arg);
        }

        // Create the shell process attached to the pseudo console.
        let (process, pid) = create_process_with_pty(
            &command_line,
            &config.cwd,
            hpc,
            &config.env,
        )?;

        // Close the pipe ends that are now owned by the ConPTY.
        unsafe {
            CloseHandle(pipe_in_read).ok();
            CloseHandle(pipe_out_write).ok();
        }

        Ok(WindowsPty {
            hpc,
            process,
            pid,
            pipe_in: pipe_in_write,
            pipe_out: pipe_out_read,
        })
    }
}
```

### PtyBackend Implementation

```rust
impl PtyBackend for WindowsPty {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let mut bytes_read: u32 = 0;
        unsafe {
            ReadFile(self.pipe_out, Some(buf), Some(&mut bytes_read), None)?;
        }
        Ok(bytes_read as usize)
    }

    fn write(&mut self, data: &[u8]) -> io::Result<usize> {
        let mut bytes_written: u32 = 0;
        unsafe {
            WriteFile(self.pipe_in, Some(data), Some(&mut bytes_written), None)?;
        }
        Ok(bytes_written as usize)
    }

    fn resize(&mut self, cols: u16, rows: u16) -> io::Result<()> {
        let size = COORD {
            X: cols as i16,
            Y: rows as i16,
        };
        unsafe {
            ResizePseudoConsole(self.hpc, size)
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e))
        }
    }

    fn pid(&self) -> u32 {
        self.pid
    }

    fn wait(&mut self) -> io::Result<i32> {
        unsafe {
            WaitForSingleObject(self.process, u32::MAX);
            let mut exit_code: u32 = 0;
            GetExitCodeProcess(self.process, &mut exit_code)?;
            Ok(exit_code as i32)
        }
    }
}
```

### Cleanup

```rust
impl Drop for WindowsPty {
    fn drop(&mut self) {
        unsafe {
            ClosePseudoConsole(self.hpc);
            CloseHandle(self.pipe_in).ok();
            CloseHandle(self.pipe_out).ok();
            CloseHandle(self.process).ok();
        }
    }
}
```

---

## Read Loop

The PTY read loop runs on a dedicated OS thread. It uses blocking I/O because PTY file descriptors (Unix) and pipe handles (Windows) do not integrate well with async runtimes. The thread reads raw bytes into a 4 KB buffer and forwards them to the frontend via Tauri events.

```
+------------------+        4 KB buffer        +-------------------+
| PtyBackend::read | -----> raw bytes --------> | Tauri event emit  |
| (blocking, loop) |                           | "terminal:output" |
+------------------+                           +-------------------+
        |                                              |
        v                                              v
  Thread exits on                              Frontend receives
  EOF or error                                 bytes, renders
```

### Implementation

```rust
use tauri::Emitter;

const READ_BUFFER_SIZE: usize = 4096;

fn spawn_read_loop(
    mut pty: Box<dyn PtyBackend>,
    session_id: String,
    app_handle: tauri::AppHandle,
) -> std::thread::JoinHandle<()> {
    std::thread::Builder::new()
        .name(format!("pty-reader-{}", session_id))
        .spawn(move || {
            let mut buf = [0u8; READ_BUFFER_SIZE];

            loop {
                match pty.read(&mut buf) {
                    Ok(0) => {
                        // EOF -- shell exited.
                        app_handle.emit("terminal:exited", &session_id).ok();
                        break;
                    }
                    Ok(n) => {
                        // Send raw bytes to frontend.
                        let data = buf[..n].to_vec();
                        app_handle
                            .emit("terminal:output", (&session_id, &data))
                            .ok();
                    }
                    Err(e) => {
                        log::error!(
                            "PTY read error for session {}: {}",
                            session_id, e
                        );
                        app_handle.emit("terminal:exited", &session_id).ok();
                        break;
                    }
                }
            }
        })
        .expect("failed to spawn PTY reader thread")
}
```

### Why Not Async

| Concern | Blocking thread | Async (tokio) |
|---|---|---|
| PTY fd compatibility | Native support | Requires `AsyncFd` wrapper, platform quirks |
| Complexity | Minimal | Runtime integration, cancellation tokens |
| Performance | One thread per terminal (acceptable) | Marginal savings for one session |
| Reliability | No executor starvation risk | Could starve if runtime is overloaded |

The blocking thread approach is chosen because Zentral runs at most one terminal session per project. The overhead of a single OS thread is negligible compared to the complexity of async PTY wrappers.

---

## Resize Handling

When the terminal panel changes size (window resize, sidebar toggle, panel drag), the frontend recalculates the character grid dimensions and sends a resize command to the Rust backend.

### Flow

```
Browser resize observer fires
        |
        v
Calculate new cols/rows from panel pixel dimensions
and character cell size (measured from a probe element)
        |
        v
invoke("resize_terminal", { sessionId, cols, rows })
        |
        v
Rust PtyManager:
    1. Look up session
    2. Call pty.resize(cols, rows)
        |
        v
OS delivers SIGWINCH (Unix) or ConPTY propagates (Windows)
        |
        v
Shell adjusts line wrapping and redraws prompt
```

### Frontend (TypeScript)

```typescript
import { invoke } from "@tauri-apps/api/core";

function onPanelResize(sessionId: string, panelEl: HTMLElement): void {
  const charWidth = 8.4;   // measured from monospace probe
  const charHeight = 18;   // measured from monospace probe

  const cols = Math.floor(panelEl.clientWidth / charWidth);
  const rows = Math.floor(panelEl.clientHeight / charHeight);

  if (cols > 0 && rows > 0) {
    invoke("resize_terminal", { sessionId, cols, rows });
  }
}
```

### Debouncing

Resize events are debounced at 100 ms on the frontend side to avoid flooding the backend with rapid successive resize calls during a smooth drag.

---

## CWD Behavior

When the user switches the active project in Zentral, the terminal panel's working directory does not change automatically. The shell process is already running and its CWD is managed internally by the shell -- there is no reliable cross-platform mechanism to change a running shell's directory from the outside.

### Options for the User

| Action | Effect |
|---|---|
| Type `cd /new/path` | Shell changes directory normally |
| Close and reopen the terminal panel | New PTY session starts in the new project CWD |
| Switch project while panel is closed | Next panel open starts in the new project CWD |

The terminal panel header displays the session's initial CWD so the user can verify which directory the shell started in.

---

## Terminal Rendering

The frontend receives raw bytes from the PTY and must render them as visible terminal output. The renderer is intentionally minimal -- it is not a full terminal emulator. It provides basic VT100 support sufficient for typical command output, shell prompts, and simple interactive programs.

### Supported Escape Sequences

| Sequence | Name | Behavior |
|---|---|---|
| `ESC[nA` | Cursor Up | Move cursor up n rows |
| `ESC[nB` | Cursor Down | Move cursor down n rows |
| `ESC[nC` | Cursor Forward | Move cursor right n columns |
| `ESC[nD` | Cursor Back | Move cursor left n columns |
| `ESC[H` | Cursor Home | Move cursor to top-left |
| `ESC[n;mH` | Cursor Position | Move cursor to row n, column m |
| `ESC[2J` | Erase Display | Clear entire screen |
| `ESC[K` | Erase in Line | Clear from cursor to end of line |
| `ESC[nm` | SGR (Select Graphic Rendition) | Bold, dim, italic, underline, foreground/background colors (8-color, 256-color, truecolor) |
| `ESC[?25h` | Show Cursor | Make cursor visible |
| `ESC[?25l` | Hide Cursor | Make cursor invisible |
| `\r` | Carriage Return | Move cursor to column 0 |
| `\n` | Line Feed | Move cursor down one row, scroll if at bottom |
| `\b` | Backspace | Move cursor left one column |
| `\t` | Tab | Advance cursor to next tab stop (every 8 columns) |

### Not Supported

The renderer does not handle alternate screen buffer, mouse tracking, bracketed paste mode, or complex cursor save/restore sequences. Programs that require these features (vim, tmux, htop) will produce garbled output. This is an acceptable tradeoff for a convenience terminal panel.

---

## IPC Commands

All terminal operations are exposed as Tauri commands. The frontend calls these through `invoke()`.

### Command Reference

| Command | Parameters | Returns | Description |
|---|---|---|---|
| `create_terminal_session` | `{ cwd: string, cols: number, rows: number }` | `{ sessionId: string }` | Spawn a new PTY and start the read loop. |
| `destroy_terminal_session` | `{ sessionId: string }` | `void` | Kill the shell process and clean up resources. |
| `write_to_terminal` | `{ sessionId: string, data: number[] }` | `void` | Write raw bytes to the PTY (user keystrokes). |
| `resize_terminal` | `{ sessionId: string, cols: number, rows: number }` | `void` | Resize the PTY to new dimensions. |
| `get_terminal_snapshot` | `{ sessionId: string }` | `{ lines: string[], cursorRow: number, cursorCol: number }` | Return the current visible content of the terminal buffer. Used to restore state when the panel is re-shown. |

### Event Reference

| Event | Payload | Direction | Description |
|---|---|---|---|
| `terminal:output` | `[sessionId: string, data: number[]]` | Rust to Frontend | Raw bytes from the PTY. |
| `terminal:exited` | `sessionId: string` | Rust to Frontend | Shell process has exited. |

### Tauri Command Implementations

```rust
use tauri::State;
use std::sync::Mutex;

#[tauri::command]
fn create_terminal_session(
    cwd: String,
    cols: u16,
    rows: u16,
    manager: State<'_, Mutex<PtyManager>>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let config = PtyConfig {
        shell: None,
        args: vec![],
        env: Default::default(),
        cols,
        rows,
        cwd: cwd.into(),
    };

    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    let session_id = mgr
        .create_session(config, app_handle)
        .map_err(|e| e.to_string())?;
    Ok(session_id)
}

#[tauri::command]
fn write_to_terminal(
    session_id: String,
    data: Vec<u8>,
    manager: State<'_, Mutex<PtyManager>>,
) -> Result<(), String> {
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.write(&session_id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn resize_terminal(
    session_id: String,
    cols: u16,
    rows: u16,
    manager: State<'_, Mutex<PtyManager>>,
) -> Result<(), String> {
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.resize(&session_id, cols, rows).map_err(|e| e.to_string())
}

#[tauri::command]
fn destroy_terminal_session(
    session_id: String,
    manager: State<'_, Mutex<PtyManager>>,
) -> Result<(), String> {
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.destroy(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_terminal_snapshot(
    session_id: String,
    manager: State<'_, Mutex<PtyManager>>,
) -> Result<TerminalSnapshot, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.snapshot(&session_id).map_err(|e| e.to_string())
}
```

---

## Session Lifecycle

The terminal panel follows a lazy lifecycle: the PTY session is not created until the user first opens the panel, and it persists across toggles within the same project.

### State Machine

```
                  User clicks [T]
                  (panel not open)
                        |
                        v
               +------------------+
               | create_terminal  |
               | _session(cwd)   |
               +--------+---------+
                        |
                        v
              +-------------------+
         +--->|     RUNNING       |<---+
         |    +---+----------+----+    |
         |        |          |         |
         |  User clicks [T]  Shell    User clicks [T]
         |  (hide panel)     exits    (show panel)
         |        |          |         |
         |        v          v         |
         |   +---------+ +--------+   |
         |   | HIDDEN  | | EXITED |   |
         |   +----+----+ +--------+   |
         |        |                    |
         +--------+                    |
         (panel shown                  |
          again, session               |
          still alive)                 |
                                       |
         User reopens after exit: -----+
         new session created
```

### Rules

| Event | Action |
|---|---|
| User opens terminal panel for the first time | Call `create_terminal_session` with active project CWD |
| User hides terminal panel with `[T]` | Panel hidden in DOM, session remains alive |
| User shows terminal panel with `[T]` | Panel shown, call `get_terminal_snapshot` to restore display |
| Shell process exits (user typed `exit`) | Emit `terminal:exited`, show "Session ended" message |
| User reopens panel after shell exit | Create a new session |
| Active project changes while panel is hidden | No action; session keeps its original CWD |
| App exits or project closes | Call `destroy_terminal_session`, kill shell |

### Resource Limits

| Resource | Limit | Rationale |
|---|---|---|
| Sessions per project | 1 | Convenience feature, not a full terminal multiplexer |
| Scrollback buffer | 5000 lines | Keeps memory usage bounded |
| Read buffer | 4 KB | Matches typical pipe buffer granularity |

---

## References

- [Agent Spawner](./agent-spawner.md) -- child process spawning for Claude CLI agents (separate from PTY)
- [Agent Manager](./agent-manager.md) -- agent lifecycle orchestration
- [Project Workspace](./project-workspace.md) -- project CWD management and switching
- [Terminal Emulation research](../07-research/terminal-emulation.md) -- background on VT100 and ANSI escape codes
