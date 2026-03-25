import { useEffect, useState } from "react";
import type { ITheme } from "@xterm/xterm";
import { getTheme, getSystemDefaultTheme } from "@/lib/themes";

function buildTheme(): ITheme {
  const themeId = document.documentElement.dataset.theme
    || getSystemDefaultTheme();
  const t = getTheme(themeId);
  const tc = t.terminal;

  return {
    background: tc.background,
    foreground: tc.foreground,
    cursor: tc.cursor,
    cursorAccent: tc.background,
    selectionBackground: `${tc.selectionBg}4d`,
    selectionForeground: tc.selectionFg,
    black: tc.black,
    red: tc.red,
    green: tc.green,
    yellow: tc.yellow,
    blue: tc.blue,
    magenta: tc.magenta,
    cyan: tc.cyan,
    white: tc.white,
    brightBlack: tc.brightBlack,
    brightRed: tc.brightRed,
    brightGreen: tc.brightGreen,
    brightYellow: tc.brightYellow,
    brightBlue: tc.brightBlue,
    brightMagenta: tc.brightMagenta,
    brightCyan: tc.brightCyan,
    brightWhite: tc.brightWhite,
  };
}

export function useTerminalTheme() {
  const [theme, setTheme] = useState<ITheme>(() => buildTheme());

  useEffect(() => {
    setTheme(buildTheme());

    const observer = new MutationObserver(() => {
      setTheme(buildTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
