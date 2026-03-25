import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useTerminalTheme } from "./useTerminalTheme";
import { getTheme, getSystemDefaultTheme } from "@/lib/themes";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSettingsStore } from "@/stores/settingsStore";
import { useProjectStore } from "@/stores/projectStore";
import "@xterm/xterm/css/xterm.css";

interface TerminalRendererProps {
  tabId: string;
  visible: boolean;
}

export function TerminalRenderer({ tabId, visible }: TerminalRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lastSizeRef = useRef<{ cols: number; rows: number }>({ cols: 0, rows: 0 });
  const theme = useTerminalTheme();

  // Create xterm instance and connect to PTY
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let unlistenData: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;
    let connected = false;

    const term = new Terminal({
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      cursorBlink: true,
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    async function connectPty() {
      // Fit first to get accurate cols/rows before spawning
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          fitAddon.fit();
          resolve();
        });
      });

      // Bail if component unmounted during await (React strict mode)
      if (cancelled) return;

      // Listen for PTY output before spawning
      unlistenData = await listen<{ id: string; data: string }>("pty:data", (event) => {
        if (event.payload.id === tabId && termRef.current) {
          termRef.current.write(event.payload.data);
        }
      });

      if (cancelled) { unlistenData(); return; }

      unlistenExit = await listen<{ id: string; code: number }>("pty:exit", (event) => {
        if (event.payload.id === tabId && termRef.current) {
          termRef.current.writeln("\r\n\x1b[90m[Process exited]\x1b[0m");
        }
      });

      if (cancelled) { unlistenData(); unlistenExit(); return; }

      // Get project path for cwd
      const activeProjectId = useProjectStore.getState().activeProjectId;
      const projects = useProjectStore.getState().projects;
      const activeProject = projects.find((p) => p.id === activeProjectId);
      const cwd = activeProject?.path || undefined;

      const shell = useSettingsStore.getState().settings.defaultShell || undefined;
      const cols = term.cols || 80;
      const rows = term.rows || 24;

      // Record initial size so resize handler won't fire for same dimensions
      lastSizeRef.current = { cols, rows };

      // Welcome message
      term.writeln("\x1b[1;38;2;200;120;50mZentral Workspace Terminal\x1b[0m");
      if (cwd) term.writeln(`\x1b[90m${cwd}\x1b[0m`);
      term.writeln("");

      try {
        await invoke("pty_spawn", { id: tabId, shell, cwd, cols, rows });
        if (cancelled) {
          invoke("pty_kill", { id: tabId }).catch(() => {});
          return;
        }
        connected = true;
      } catch (err) {
        if (!cancelled) {
          term.writeln(`\x1b[31mFailed to spawn PTY: ${err}\x1b[0m\r\n`);
        }
        return;
      }

      term.focus();

      // Forward keystrokes to PTY
      term.onData((data) => {
        if (connected && !cancelled) {
          invoke("pty_write", { id: tabId, data }).catch(() => {});
        }
      });

      // Forward resize events — only if dimensions actually changed
      term.onResize(({ cols, rows }) => {
        if (!connected || cancelled) return;
        const last = lastSizeRef.current;
        if (cols === last.cols && rows === last.rows) return;
        lastSizeRef.current = { cols, rows };
        invoke("pty_resize", { id: tabId, cols, rows }).catch(() => {});
      });
    }

    connectPty();

    return () => {
      cancelled = true;
      unlistenData?.();
      unlistenExit?.();
      if (connected) {
        invoke("pty_kill", { id: tabId }).catch(() => {});
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  // Apply theme reactively
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = theme;
    }
    if (containerRef.current && theme.background) {
      containerRef.current.style.backgroundColor = theme.background;
    }
  }, [theme]);

  // Refit + focus on visibility change
  useEffect(() => {
    if (!visible || !containerRef.current) return;

    requestAnimationFrame(() => {
      fitRef.current?.fit();
      termRef.current?.focus();
    });

    let timeout: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fitRef.current?.fit(), 50);
    });
    observer.observe(containerRef.current);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{
        display: visible ? "block" : "none",
        backgroundColor: getTheme(document.documentElement.dataset.theme || getSystemDefaultTheme()).terminal.background,
      }}
    />
  );
}
