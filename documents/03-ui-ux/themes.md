# Themes

> Theming system using CSS custom properties and Tailwind CSS v4 `@theme inline` directive with built-in light and dark palettes.

> **Status:** ui-complete
> **Last updated:** 2026-03-25

---

## Overview

The theme system follows three principles:

1. **CSS variables as the single source of truth.** Every color in the application resolves to a `var(--token)` reference. No hardcoded color values appear in component code.
2. **Two built-in modes.** Light mode is defined on `:root`. Dark mode is defined on `.dark` and applied by toggling the class on the `<html>` element.
3. **Tailwind integration via `@theme inline`.** A mapping block converts `--token` variables to `--color-token` variables that Tailwind v4 consumes. Components use standard utility classes like `bg-background` and `text-foreground`.

```
+------------------+      +-----------------+      +------------------+
|  :root / .dark   | ---> | @theme inline   | ---> | Tailwind classes |
|  CSS variables   |      | --color-* map   |      | bg-*, text-*, etc|
+------------------+      +-----------------+      +------------------+
```

## How It Works

### Light Mode (:root)

The `:root` selector defines the default (light) palette. All colors use the oklch color space for perceptual uniformity.

### Dark Mode (.dark)

The `.dark` class, applied to `<html>`, overrides the same variable names with dark-appropriate values. Because components reference variables (not literal colors), the entire UI switches instantly.

### Mode Switching

```
User selects "dark"
       |
       v
document.documentElement.classList.add("dark")
       |
       v
:root vars overridden by .dark vars
       |
       v
All bg-background, text-foreground, etc. update
```

No JavaScript color logic is needed. The browser resolves the new variable values through the cascade.

## Full CSS

This is the complete variable definition block placed in the main stylesheet (`src/styles.css`).

```css
@import "tailwindcss";

:root {
  --background: oklch(0.9383 0.0042 236.4993);
  --foreground: oklch(0.3211 0 0);
  --card: oklch(1.0000 0 0);
  --card-foreground: oklch(0.3211 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.3211 0 0);
  --primary: oklch(0.6397 0.1720 36.4421);
  --primary-foreground: oklch(0.9846 0.0017 247.8389);
  --secondary: oklch(0.9670 0.0029 264.5419);
  --secondary-foreground: oklch(0.3211 0 0);
  --muted: oklch(0.9846 0.0017 247.8389);
  --muted-foreground: oklch(0.5561 0.0049 264.5320);
  --accent: oklch(0.9119 0.0222 243.8174);
  --accent-foreground: oklch(0.3211 0 0);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(0.9846 0.0017 247.8389);
  --border: oklch(0.9022 0.0052 247.8822);
  --input: oklch(0.9022 0.0052 247.8822);
  --ring: oklch(0.6397 0.1720 36.4421);
  --radius: 0.625rem;
  --sidebar: oklch(0.9030 0.0046 258.3257);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-border: oklch(0.9022 0.0052 247.8822);
  --sidebar-accent: oklch(0.9119 0.0222 243.8174);
  --sidebar-accent-foreground: oklch(0.3211 0 0);
  --sidebar-primary: oklch(0.6397 0.1720 36.4421);
  --sidebar-primary-foreground: oklch(0.9846 0.0017 247.8389);
  --sidebar-ring: oklch(0.6397 0.1720 36.4421);
  --chart-1: oklch(0.6397 0.1720 36.4421);
  --chart-2: oklch(0.62 0.18 250);
  --chart-3: oklch(0.72 0.19 142);
  --chart-4: oklch(0.70 0.15 310);
  --chart-5: oklch(0.80 0.15 85);
}

.dark {
  --background: oklch(0.2598 0.0306 262.6666);
  --foreground: oklch(0.9219 0 0);
  --card: oklch(0.3106 0.0301 268.6365);
  --card-foreground: oklch(0.9219 0 0);
  --popover: oklch(0.3106 0.0301 268.6365);
  --popover-foreground: oklch(0.9219 0 0);
  --primary: oklch(0.6397 0.1720 36.4421);
  --primary-foreground: oklch(0.1500 0 0);
  --secondary: oklch(0.3500 0.0250 265.0000);
  --secondary-foreground: oklch(0.9219 0 0);
  --muted: oklch(0.3200 0.0280 266.0000);
  --muted-foreground: oklch(0.6500 0.0040 264.0000);
  --accent: oklch(0.3700 0.0350 264.0000);
  --accent-foreground: oklch(0.9219 0 0);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(0.9219 0 0);
  --border: oklch(0.3800 0.0260 266.0000);
  --input: oklch(0.3800 0.0260 266.0000);
  --ring: oklch(0.6397 0.1720 36.4421);
  --sidebar: oklch(0.3100 0.0283 267.7408);
  --sidebar-foreground: oklch(0.9219 0 0);
  --sidebar-border: oklch(0.3800 0.0260 266.0000);
  --sidebar-accent: oklch(0.3700 0.0350 264.0000);
  --sidebar-accent-foreground: oklch(0.9219 0 0);
  --sidebar-primary: oklch(0.6397 0.1720 36.4421);
  --sidebar-primary-foreground: oklch(0.1500 0 0);
  --sidebar-ring: oklch(0.6397 0.1720 36.4421);
  --chart-1: oklch(0.6397 0.1720 36.4421);
  --chart-2: oklch(0.62 0.18 250);
  --chart-3: oklch(0.72 0.19 142);
  --chart-4: oklch(0.70 0.15 310);
  --chart-5: oklch(0.80 0.15 85);
}
```

## @theme inline Block

The `@theme inline` directive tells Tailwind CSS v4 to read color values from CSS variables. This block is placed immediately after the `@import "tailwindcss"` line and the variable definitions.

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius: 0.625rem;
}
```

With this in place, Tailwind generates utilities such as `bg-background`, `text-foreground`, `border-border`, `bg-chart-1`, and so on. Opacity modifiers work as expected: `bg-primary/80` produces an 80% opacity variant.

## Theme Toggle

### Store Definition

The settings store manages the current theme preference and applies it to the DOM.

```typescript
// src/stores/settingsStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface SettingsState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  root.classList.toggle("dark", isDark);
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    { name: "zentral-settings" }
  )
);
```

### System Preference Listener

When the theme is set to `"system"`, the app must respond to OS-level changes (for example, macOS automatic light/dark switching).

```typescript
// Called once at app startup
function initSystemThemeListener() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");

  mq.addEventListener("change", () => {
    const { theme } = useSettingsStore.getState();
    if (theme === "system") {
      applyTheme("system");
    }
  });

  // Apply on initial load
  applyTheme(useSettingsStore.getState().theme);
}
```

### Toggle Component

```typescript
import { Moon, Sun, Monitor } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

function ThemeToggle() {
  const { theme, setTheme } = useSettingsStore();

  const options: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ];

  return (
    <div className="flex gap-1">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`rounded-md p-2 ${
            theme === value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50"
          }`}
          aria-label={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
```

## Chart Colors

Five chart colors are provided for data visualizations such as resource usage graphs, agent activity timelines, and session statistics.

| Token | Light / Dark Value | Visual |
|---|---|---|
| `--chart-1` | `oklch(0.6397 0.1720 36.4421)` | Orange/amber (matches primary) |
| `--chart-2` | `oklch(0.62 0.18 250)` | Blue |
| `--chart-3` | `oklch(0.72 0.19 142)` | Green |
| `--chart-4` | `oklch(0.70 0.15 310)` | Purple/magenta |
| `--chart-5` | `oklch(0.80 0.15 85)` | Yellow/amber |

Chart colors are the same in both light and dark modes. They are chosen to be distinguishable from each other and accessible at their given lightness levels. Use them via Tailwind as `bg-chart-1`, `text-chart-2`, `stroke-chart-3`, and so on.

```typescript
// Example: using chart colors in a component
const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
```

## Customization

### Overriding Variables

Users or developers can override any token by adding a `<style>` block or a secondary CSS file that redefines the variables. Because the entire system resolves through `var()`, overrides propagate everywhere.

```css
/* custom-overrides.css */
:root {
  --primary: oklch(0.55 0.20 270); /* switch brand to purple */
  --ring: oklch(0.55 0.20 270);
}
```

### Future: Theme Import/Export

A planned feature will allow users to export the current variable set as JSON and import custom themes. The format would be:

```json
{
  "name": "Custom Purple",
  "mode": "dark",
  "tokens": {
    "background": "oklch(0.2200 0.0350 280.0000)",
    "foreground": "oklch(0.9200 0 0)",
    "primary": "oklch(0.5500 0.2000 270.0000)",
    "destructive": "oklch(0.6368 0.2078 25.3313)"
  }
}
```

The import function would validate each token, apply it via `document.documentElement.style.setProperty`, and persist the selection in the settings store. This feature is not yet implemented.

## References

- [Design System](./design-system.md) -- full token semantics, component library, and icon reference
- [Header](./header.md) -- header bar where the theme toggle resides
- [Terminal View](./terminal-view.md) -- terminal color handling and ANSI-to-theme mapping
