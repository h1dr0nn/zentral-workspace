import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useTerminalTheme } from "./useTerminalTheme";
import { getTheme, getSystemDefaultTheme } from "@/lib/themes";
import "@xterm/xterm/css/xterm.css";

interface TerminalRendererProps {
  tabId: string;
  visible: boolean;
}

export function TerminalRenderer({ tabId, visible }: TerminalRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const theme = useTerminalTheme();

  // Create xterm instance once
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);

    term.writeln("\x1b[1;38;2;200;120;50mZentral Terminal\x1b[0m");
    term.writeln("PTY backend not connected.\r\n");

    // Local echo until PTY is connected
    let line = "";
    term.onData((data) => {
      if (data === "\r") {
        term.writeln("");
        if (line.trim()) {
          term.writeln(`\x1b[90mcommand not available: ${line.trim()}\x1b[0m`);
        }
        line = "";
        term.write("$ ");
      } else if (data === "\x7f" || data === "\b") {
        if (line.length > 0) {
          line = line.slice(0, -1);
          term.write("\b \b");
        }
      } else if (data.charCodeAt(0) >= 32) {
        line += data;
        term.write(data);
      }
    });
    term.write("$ ");

    termRef.current = term;
    fitRef.current = fitAddon;

    // Initial fit after layout
    requestAnimationFrame(() => {
      fitAddon.fit();
      term.focus();
    });

    return () => {
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
    // Sync container background with terminal background
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
