export interface TerminalColors {
  foreground: string;
  background: string;
  cursor: string;
  selectionBg: string;
  selectionFg: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  author: string;
  isDark: boolean;
  cssVars: Record<string, string>;
  terminal: TerminalColors;
}

// Helper to lighten/darken hex colors
function adjustHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function mixHex(hex1: string, hex2: string, ratio: number): string {
  const n1 = parseInt(hex1.replace("#", ""), 16);
  const n2 = parseInt(hex2.replace("#", ""), 16);
  const r = Math.round(((n1 >> 16) & 0xff) * (1 - ratio) + ((n2 >> 16) & 0xff) * ratio);
  const g = Math.round(((n1 >> 8) & 0xff) * (1 - ratio) + ((n2 >> 8) & 0xff) * ratio);
  const b = Math.round((n1 & 0xff) * (1 - ratio) + (n2 & 0xff) * ratio);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function buildDarkTheme(
  id: string,
  name: string,
  author: string,
  bg: string,
  fg: string,
  primary: string,
  terminal: TerminalColors,
): ThemeDefinition {
  const card = adjustHex(bg, 12);
  const border = adjustHex(bg, 25);
  const muted = adjustHex(bg, 18);
  const mutedFg = mixHex(fg, bg, 0.4);
  const accent = adjustHex(bg, 22);
  const secondary = adjustHex(bg, 20);
  const input = adjustHex(bg, 28);
  const sidebar = adjustHex(bg, 8);

  return {
    id, name, author, isDark: true,
    cssVars: {
      "--background": bg,
      "--foreground": fg,
      "--card": card,
      "--card-foreground": fg,
      "--popover": card,
      "--popover-foreground": fg,
      "--primary": primary,
      "--primary-foreground": "#151515",
      "--secondary": secondary,
      "--secondary-foreground": fg,
      "--muted": muted,
      "--muted-foreground": mutedFg,
      "--accent": accent,
      "--accent-foreground": fg,
      "--destructive": terminal.red,
      "--destructive-foreground": fg,
      "--border": border,
      "--input": input,
      "--ring": primary,
      "--sidebar": sidebar,
      "--sidebar-foreground": fg,
      "--sidebar-border": input,
      "--sidebar-accent": accent,
      "--sidebar-accent-foreground": fg,
      "--sidebar-primary": primary,
      "--sidebar-primary-foreground": "#151515",
      "--sidebar-ring": primary,
      "--chart-1": primary,
      "--chart-2": terminal.blue,
      "--chart-3": terminal.green,
      "--chart-4": terminal.magenta,
      "--chart-5": terminal.yellow,
    },
    terminal,
  };
}

function buildLightTheme(
  id: string,
  name: string,
  author: string,
  bg: string,
  fg: string,
  primary: string,
  terminal: TerminalColors,
): ThemeDefinition {
  const card = "#ffffff";
  const border = adjustHex(bg, -12);
  const muted = adjustHex(bg, 5);
  const mutedFg = mixHex(fg, bg, 0.4);
  const accent = adjustHex(bg, -8);
  const secondary = adjustHex(bg, 3);
  const input = adjustHex(bg, -6);
  const sidebar = adjustHex(bg, -5);

  return {
    id, name, author, isDark: false,
    cssVars: {
      "--background": bg,
      "--foreground": fg,
      "--card": card,
      "--card-foreground": fg,
      "--popover": card,
      "--popover-foreground": fg,
      "--primary": primary,
      "--primary-foreground": "#fafafa",
      "--secondary": secondary,
      "--secondary-foreground": fg,
      "--muted": muted,
      "--muted-foreground": mutedFg,
      "--accent": accent,
      "--accent-foreground": fg,
      "--destructive": terminal.red,
      "--destructive-foreground": "#fafafa",
      "--border": border,
      "--input": input,
      "--ring": primary,
      "--sidebar": sidebar,
      "--sidebar-foreground": fg,
      "--sidebar-border": input,
      "--sidebar-accent": accent,
      "--sidebar-accent-foreground": fg,
      "--sidebar-primary": primary,
      "--sidebar-primary-foreground": "#fafafa",
      "--sidebar-ring": primary,
      "--chart-1": primary,
      "--chart-2": terminal.blue,
      "--chart-3": terminal.green,
      "--chart-4": terminal.magenta,
      "--chart-5": terminal.yellow,
    },
    terminal,
  };
}

// ─── Theme definitions ──────────────────────────────────────────────

export const themes: ThemeDefinition[] = [
  // Zentral Dark (default dark)
  {
    id: "zentral-dark",
    name: "Zentral Dark",
    author: "Zentral",
    isDark: true,
    cssVars: {
      "--background": "oklch(0.2598 0.0306 262.6666)",
      "--foreground": "oklch(0.9219 0 0)",
      "--card": "oklch(0.3106 0.0301 268.6365)",
      "--card-foreground": "oklch(0.9219 0 0)",
      "--popover": "oklch(0.3106 0.0301 268.6365)",
      "--popover-foreground": "oklch(0.9219 0 0)",
      "--primary": "oklch(0.6397 0.1720 36.4421)",
      "--primary-foreground": "oklch(0.1500 0 0)",
      "--secondary": "oklch(0.3500 0.0250 265.0000)",
      "--secondary-foreground": "oklch(0.9219 0 0)",
      "--muted": "oklch(0.3200 0.0280 266.0000)",
      "--muted-foreground": "oklch(0.6500 0.0040 264.0000)",
      "--accent": "oklch(0.3700 0.0350 264.0000)",
      "--accent-foreground": "oklch(0.9219 0 0)",
      "--destructive": "oklch(0.6368 0.2078 25.3313)",
      "--destructive-foreground": "oklch(0.9219 0 0)",
      "--border": "oklch(36.312% 0.02607 264.194)",
      "--input": "oklch(0.3800 0.0260 266.0000)",
      "--ring": "oklch(0.6397 0.1720 36.4421)",
      "--sidebar": "oklch(31.005% 0.02839 267.753)",
      "--sidebar-foreground": "oklch(0.9219 0 0)",
      "--sidebar-border": "oklch(0.3800 0.0260 266.0000)",
      "--sidebar-accent": "oklch(0.3700 0.0350 264.0000)",
      "--sidebar-accent-foreground": "oklch(0.9219 0 0)",
      "--sidebar-primary": "oklch(0.6397 0.1720 36.4421)",
      "--sidebar-primary-foreground": "oklch(0.1500 0 0)",
      "--sidebar-ring": "oklch(0.6397 0.1720 36.4421)",
      "--chart-1": "oklch(0.6397 0.1720 36.4421)",
      "--chart-2": "oklch(0.62 0.18 250)",
      "--chart-3": "oklch(0.72 0.19 142)",
      "--chart-4": "oklch(0.70 0.15 310)",
      "--chart-5": "oklch(0.80 0.15 85)",
    },
    terminal: {
      foreground: "#e8e8e8", background: "#2b2d3d", cursor: "#c45a2c",
      selectionBg: "#4a4c6a", selectionFg: "#e8e8e8",
      black: "#1e1e2e", red: "#e06c75", green: "#98c379", yellow: "#e5c07b",
      blue: "#61afef", magenta: "#c678dd", cyan: "#56b6c2", white: "#abb2bf",
      brightBlack: "#6c7086", brightRed: "#e06c75", brightGreen: "#98c379", brightYellow: "#e5c07b",
      brightBlue: "#61afef", brightMagenta: "#c678dd", brightCyan: "#56b6c2", brightWhite: "#ffffff",
    },
  },

  // Zentral Light (default light)
  {
    id: "zentral-light",
    name: "Zentral Light",
    author: "Zentral",
    isDark: false,
    cssVars: {
      "--background": "oklch(0.9383 0.0042 236.4993)",
      "--foreground": "oklch(0.3211 0 0)",
      "--card": "oklch(1.0000 0 0)",
      "--card-foreground": "oklch(0.3211 0 0)",
      "--popover": "oklch(1.0000 0 0)",
      "--popover-foreground": "oklch(0.3211 0 0)",
      "--primary": "oklch(0.6397 0.1720 36.4421)",
      "--primary-foreground": "oklch(0.9846 0.0017 247.8389)",
      "--secondary": "oklch(0.9670 0.0029 264.5419)",
      "--secondary-foreground": "oklch(0.3211 0 0)",
      "--muted": "oklch(0.9846 0.0017 247.8389)",
      "--muted-foreground": "oklch(0.5561 0.0049 264.5320)",
      "--accent": "oklch(0.9119 0.0222 243.8174)",
      "--accent-foreground": "oklch(0.3211 0 0)",
      "--destructive": "oklch(0.6368 0.2078 25.3313)",
      "--destructive-foreground": "oklch(0.9846 0.0017 247.8389)",
      "--border": "oklch(0.85 0.01 247.8822)",
      "--input": "oklch(0.9022 0.0052 247.8822)",
      "--ring": "oklch(0.6397 0.1720 36.4421)",
      "--sidebar": "oklch(0.9030 0.0046 258.3257)",
      "--sidebar-foreground": "oklch(0.3211 0 0)",
      "--sidebar-border": "oklch(0.9022 0.0052 247.8822)",
      "--sidebar-accent": "oklch(0.9119 0.0222 243.8174)",
      "--sidebar-accent-foreground": "oklch(0.3211 0 0)",
      "--sidebar-primary": "oklch(0.6397 0.1720 36.4421)",
      "--sidebar-primary-foreground": "oklch(0.9846 0.0017 247.8389)",
      "--sidebar-ring": "oklch(0.6397 0.1720 36.4421)",
      "--chart-1": "oklch(0.6397 0.1720 36.4421)",
      "--chart-2": "oklch(0.62 0.18 250)",
      "--chart-3": "oklch(0.72 0.19 142)",
      "--chart-4": "oklch(0.70 0.15 310)",
      "--chart-5": "oklch(0.80 0.15 85)",
    },
    terminal: {
      foreground: "#383a42", background: "#eef1f5", cursor: "#c45a2c",
      selectionBg: "#d0d5dd", selectionFg: "#383a42",
      black: "#383a42", red: "#e45649", green: "#50a14f", yellow: "#c18401",
      blue: "#4078f2", magenta: "#a626a4", cyan: "#0184bc", white: "#a0a1a7",
      brightBlack: "#696c77", brightRed: "#e45649", brightGreen: "#50a14f", brightYellow: "#c18401",
      brightBlue: "#4078f2", brightMagenta: "#a626a4", brightCyan: "#0184bc", brightWhite: "#ffffff",
    },
  },

  // Dracula
  buildDarkTheme("dracula", "Dracula", "Dracula Theme", "#282a36", "#f8f8f2", "#bd93f9", {
    foreground: "#f8f8f2", background: "#282a36", cursor: "#f8f8f2",
    selectionBg: "#44475a", selectionFg: "#f8f8f2",
    black: "#21222c", red: "#ff5555", green: "#50fa7b", yellow: "#f1fa8c",
    blue: "#bd93f9", magenta: "#ff79c6", cyan: "#8be9fd", white: "#f8f8f2",
    brightBlack: "#6272a4", brightRed: "#ff6e6e", brightGreen: "#69ff94", brightYellow: "#ffffa5",
    brightBlue: "#d6acff", brightMagenta: "#ff92df", brightCyan: "#a4ffff", brightWhite: "#ffffff",
  }),

  // One Dark
  buildDarkTheme("one-dark", "One Dark", "Atom", "#282c34", "#abb2bf", "#61afef", {
    foreground: "#abb2bf", background: "#282c34", cursor: "#528bff",
    selectionBg: "#3e4451", selectionFg: "#abb2bf",
    black: "#282c34", red: "#e06c75", green: "#98c379", yellow: "#e5c07b",
    blue: "#61afef", magenta: "#c678dd", cyan: "#56b6c2", white: "#abb2bf",
    brightBlack: "#5c6370", brightRed: "#e06c75", brightGreen: "#98c379", brightYellow: "#e5c07b",
    brightBlue: "#61afef", brightMagenta: "#c678dd", brightCyan: "#56b6c2", brightWhite: "#ffffff",
  }),

  // Nord
  buildDarkTheme("nord", "Nord", "Arctic Ice Studio", "#2e3440", "#d8dee9", "#88c0d0", {
    foreground: "#d8dee9", background: "#2e3440", cursor: "#d8dee9",
    selectionBg: "#434c5e", selectionFg: "#d8dee9",
    black: "#3b4252", red: "#bf616a", green: "#a3be8c", yellow: "#ebcb8b",
    blue: "#81a1c1", magenta: "#b48ead", cyan: "#88c0d0", white: "#e5e9f0",
    brightBlack: "#4c566a", brightRed: "#bf616a", brightGreen: "#a3be8c", brightYellow: "#ebcb8b",
    brightBlue: "#81a1c1", brightMagenta: "#b48ead", brightCyan: "#8fbcbb", brightWhite: "#eceff4",
  }),

  // Tokyo Night
  buildDarkTheme("tokyo-night", "Tokyo Night", "Enkia", "#1a1b26", "#a9b1d6", "#7aa2f7", {
    foreground: "#a9b1d6", background: "#1a1b26", cursor: "#c0caf5",
    selectionBg: "#33467c", selectionFg: "#a9b1d6",
    black: "#15161e", red: "#f7768e", green: "#9ece6a", yellow: "#e0af68",
    blue: "#7aa2f7", magenta: "#bb9af7", cyan: "#7dcfff", white: "#a9b1d6",
    brightBlack: "#414868", brightRed: "#f7768e", brightGreen: "#9ece6a", brightYellow: "#e0af68",
    brightBlue: "#7aa2f7", brightMagenta: "#bb9af7", brightCyan: "#7dcfff", brightWhite: "#c0caf5",
  }),

  // Catppuccin Mocha
  buildDarkTheme("catppuccin-mocha", "Catppuccin Mocha", "Catppuccin", "#1e1e2e", "#cdd6f4", "#89b4fa", {
    foreground: "#cdd6f4", background: "#1e1e2e", cursor: "#f5e0dc",
    selectionBg: "#585b70", selectionFg: "#cdd6f4",
    black: "#45475a", red: "#f38ba8", green: "#a6e3a1", yellow: "#f9e2af",
    blue: "#89b4fa", magenta: "#f5c2e7", cyan: "#94e2d5", white: "#bac2de",
    brightBlack: "#585b70", brightRed: "#f38ba8", brightGreen: "#a6e3a1", brightYellow: "#f9e2af",
    brightBlue: "#89b4fa", brightMagenta: "#f5c2e7", brightCyan: "#94e2d5", brightWhite: "#a6adc8",
  }),

  // Catppuccin Macchiato
  buildDarkTheme("catppuccin-macchiato", "Catppuccin Macchiato", "Catppuccin", "#24273a", "#cad3f5", "#8aadf4", {
    foreground: "#cad3f5", background: "#24273a", cursor: "#f4dbd6",
    selectionBg: "#494d64", selectionFg: "#cad3f5",
    black: "#494d64", red: "#ed8796", green: "#a6da95", yellow: "#eed49f",
    blue: "#8aadf4", magenta: "#f5bde6", cyan: "#8bd5ca", white: "#b8c0e0",
    brightBlack: "#5b6078", brightRed: "#ed8796", brightGreen: "#a6da95", brightYellow: "#eed49f",
    brightBlue: "#8aadf4", brightMagenta: "#f5bde6", brightCyan: "#8bd5ca", brightWhite: "#a5adcb",
  }),

  // Solarized Dark
  buildDarkTheme("solarized-dark", "Solarized Dark", "Ethan Schoonover", "#002b36", "#839496", "#268bd2", {
    foreground: "#839496", background: "#002b36", cursor: "#839496",
    selectionBg: "#073642", selectionFg: "#93a1a1",
    black: "#073642", red: "#dc322f", green: "#859900", yellow: "#b58900",
    blue: "#268bd2", magenta: "#d33682", cyan: "#2aa198", white: "#eee8d5",
    brightBlack: "#002b36", brightRed: "#cb4b16", brightGreen: "#586e75", brightYellow: "#657b83",
    brightBlue: "#839496", brightMagenta: "#6c71c4", brightCyan: "#93a1a1", brightWhite: "#fdf6e3",
  }),

  // One Light
  buildLightTheme("one-light", "One Light", "Binaryify", "#fafafa", "#383a42", "#4078f2", {
    foreground: "#383a42", background: "#fafafa", cursor: "#526fff",
    selectionBg: "#e5e5e6", selectionFg: "#383a42",
    black: "#383a42", red: "#e45649", green: "#50a14f", yellow: "#c18401",
    blue: "#4078f2", magenta: "#a626a4", cyan: "#0184bc", white: "#a0a1a7",
    brightBlack: "#696c77", brightRed: "#e45649", brightGreen: "#50a14f", brightYellow: "#c18401",
    brightBlue: "#4078f2", brightMagenta: "#a626a4", brightCyan: "#0184bc", brightWhite: "#ffffff",
  }),

  // GitHub Light
  buildLightTheme("github-light", "GitHub Light", "GitHub", "#ffffff", "#24292e", "#0366d6", {
    foreground: "#24292e", background: "#ffffff", cursor: "#24292e",
    selectionBg: "#0366d625", selectionFg: "#24292e",
    black: "#24292e", red: "#d73a49", green: "#28a745", yellow: "#f9c513",
    blue: "#0366d6", magenta: "#5a32a3", cyan: "#0598bc", white: "#6a737d",
    brightBlack: "#959da5", brightRed: "#cb2431", brightGreen: "#22863a", brightYellow: "#b08800",
    brightBlue: "#005cc5", brightMagenta: "#544490", brightCyan: "#3192aa", brightWhite: "#d1d5da",
  }),

  // Solarized Light
  buildLightTheme("solarized-light", "Solarized Light", "Ethan Schoonover", "#fdf6e3", "#657b83", "#268bd2", {
    foreground: "#657b83", background: "#fdf6e3", cursor: "#657b83",
    selectionBg: "#eee8d5", selectionFg: "#586e75",
    black: "#073642", red: "#dc322f", green: "#859900", yellow: "#b58900",
    blue: "#268bd2", magenta: "#d33682", cyan: "#2aa198", white: "#eee8d5",
    brightBlack: "#002b36", brightRed: "#cb4b16", brightGreen: "#586e75", brightYellow: "#657b83",
    brightBlue: "#839496", brightMagenta: "#6c71c4", brightCyan: "#93a1a1", brightWhite: "#fdf6e3",
  }),
];

export const themeMap = new Map(themes.map((t) => [t.id, t]));

export function getTheme(id: string): ThemeDefinition {
  return themeMap.get(id) ?? themeMap.get("zentral-dark")!;
}

/** Detect system preference and return matching default theme id */
export function getSystemDefaultTheme(): string {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  return prefersDark ? "zentral-dark" : "zentral-light";
}

export function applyTheme(id: string): void {
  const theme = getTheme(id);
  const root = document.documentElement;

  // Set CSS variables
  for (const [key, value] of Object.entries(theme.cssVars)) {
    root.style.setProperty(key, value);
  }

  // Toggle dark class for Tailwind dark variant
  root.classList.toggle("dark", theme.isDark);

  // Store active theme id as data attribute for observers
  root.dataset.theme = theme.id;
}
