import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { applyTheme, getSystemDefaultTheme } from "./lib/themes";

// Apply saved theme or detect from system on first launch
const saved = (() => {
  try {
    const raw = localStorage.getItem("zentral:settings");
    return raw ? JSON.parse(raw).theme : "";
  } catch {
    return "";
  }
})();

applyTheme(saved || getSystemDefaultTheme());

// Block browser context menu everywhere except inputs, terminal, and chat content
document.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement;
  const allowed =
    target.closest("input, textarea, [contenteditable]") ||
    target.closest(".xterm") ||
    target.closest(".prose") ||
    target.closest("pre, code");
  if (!allowed) {
    e.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
