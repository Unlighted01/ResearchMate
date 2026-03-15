import React from "react";
import ReactDOM from "react-dom/client";
import SidePanel from "./SidePanel";
import { ToastProvider } from "./components/Toast";
import "./index.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "sans-serif", color: "#ef4444" }}>
          <strong>Something went wrong.</strong>
          <p style={{ fontSize: 12, marginTop: 8, color: "#6b7280" }}>
            {this.state.message}
          </p>
          <button
            style={{ marginTop: 12, fontSize: 12, cursor: "pointer" }}
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <ToastProvider>
        <SidePanel />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
