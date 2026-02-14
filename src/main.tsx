import React from "react";
import ReactDOM from "react-dom/client";
import SidePanel from "./SidePanel";
import "./index.css";

// Theme Initialization
const initializeTheme = () => {
  const theme = localStorage.getItem("theme") || "system";
  const root = document.documentElement;

  const applyTheme = (t: string) => {
    if (t === "dark") {
      root.classList.add("dark");
    } else if (t === "light") {
      root.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
    // Sync with chrome storage for content script
    chrome.storage.local.set({ theme: t });
  };

  applyTheme(theme);

  // Listen for storage changes from Settings
  window.addEventListener("storage", (e) => {
    if (e.key === "theme" && e.newValue) {
      applyTheme(e.newValue);
    }
  });

  // Listen for system preference changes if in system mode
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (localStorage.getItem("theme") === "system") {
        applyTheme("system");
      }
    });
};

initializeTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
);
