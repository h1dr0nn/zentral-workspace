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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
