// Content script to handle text selection and highlighting
console.log("ResearchMate Content Script Loaded");

// Overlay State
let overlayInstance: { root: HTMLDivElement; backdrop: HTMLDivElement } | null =
  null;

// Toggle Overlay Function (Hoisted)
function toggleOverlay() {
  if (overlayInstance) {
    // Close
    overlayInstance.root.style.transform = "translateX(100%)";
    setTimeout(() => {
      overlayInstance?.root.remove();
      overlayInstance = null;
    }, 300);
    return;
  }

  // Open
  // 1. Container
  const root = document.createElement("div");
  root.id = "researchmate-overlay-root";
  root.style.position = "fixed";
  root.style.top = "0";
  root.style.right = "0";
  root.style.bottom = "0";
  root.style.width = "400px"; // Fixed width
  root.style.zIndex = "2147483647";
  root.style.boxShadow = "-5px 0 25px rgba(0,0,0,0.1)";
  root.style.transform = "translateX(100%)";
  root.style.transition = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)";

  // Iframe
  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("index.html");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.background = "transparent";

  root.appendChild(iframe);
  document.body.appendChild(root);

  // Animation in
  requestAnimationFrame(() => {
    root.style.transform = "translateX(0)";
  });

  overlayInstance = { root, backdrop: root }; // Backdrop is just root placeholder to avoid breaking types if used elsewhere
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "getCheckData") {
    sendResponse({
      title: document.title,
      url: window.location.href,
      selection: window.getSelection()?.toString() || "",
    });
  } else if (request.action === "toggleOverlay") {
    toggleOverlay();
  } else if (request.action === "showErrorToast") {
    showErrorToast(request.message);
  }
});

// Handle click outside to close
document.addEventListener("mousedown", (e) => {
  if (overlayInstance && overlayInstance.root) {
    // Check if click target is outside the overlay
    // Note: Clicks inside iframe don't bubble here, so this only catches clicks on the main page.
    // We must also respect the trigger button (don't double toggle)
    const trigger = document.getElementById("researchmate-trigger-root");
    const selectionBtn = document.getElementById("researchmate-selection-btn");

    if (
      !overlayInstance.root.contains(e.target as Node) &&
      (!trigger || !trigger.contains(e.target as Node)) &&
      (!selectionBtn || !selectionBtn.contains(e.target as Node))
    ) {
      toggleOverlay();
    }
  }
});

// Capture selection and show floating button
let selectionButton: HTMLDivElement | null = null;
const removeSelectionButton = () => {
  if (selectionButton) {
    selectionButton.remove();
    selectionButton = null;
  }
};

function showErrorToast(message: string) {
  const existing = document.getElementById("rm-content-error-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "rm-content-error-toast";
  toast.style.position = "fixed";
  toast.style.bottom = "24px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%) translateY(20px)";
  toast.style.opacity = "0";
  toast.style.background = "#EF4444"; // Red error color
  toast.style.color = "#fff";
  toast.style.padding = "8px 16px";
  toast.style.borderRadius = "8px";
  toast.style.fontSize = "14px";
  toast.style.fontWeight = "500";
  toast.style.zIndex = "2147483647";
  toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  toast.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
  toast.innerText = message;

  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = "translateX(-50%) translateY(0)";
    toast.style.opacity = "1";
  });

  // Remove after 2.5s
  setTimeout(() => {
    toast.style.transform = "translateX(-50%) translateY(20px)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

const handleSelection = (e?: Event) => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  if (!text || text.length === 0) {
    removeSelectionButton();
    return;
  }

  const words = text.split(/\s+/).filter((w) => w.length > 0);

  // If selection is too short (less than 2 words), reject it
  if (words.length < 2) {
    removeSelectionButton();
    return;
  }

  // If overlay is already open, don't show button
  if (document.getElementById("researchmate-overlay-root")) {
    return;
  }

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Default position (Top-Center of selection) - Fallback for keyboard selection
    let top = window.scrollY + rect.top - 45;
    let left = window.scrollX + rect.left + rect.width / 2;

    // If triggered by mouse, use mouse coordinates for better UX
    // "Follow the mouse" behavior
    if (e && e instanceof MouseEvent) {
      // Position slightly above the mouse cursor
      top = window.scrollY + e.clientY - 45;
      left = window.scrollX + e.clientX;
    }

    if (selectionButton) {
      // Update position
      selectionButton.style.top = `${top}px`;
      selectionButton.style.left = `${left}px`;
      return;
    }

    // Create Button
    selectionButton = document.createElement("div");
    selectionButton.id = "researchmate-selection-btn";
    selectionButton.style.position = "absolute";
    selectionButton.style.top = `${top}px`;
    selectionButton.style.left = `${left}px`;
    selectionButton.style.transform = "translateX(-50%)";
    selectionButton.style.zIndex = "2147483647";
    selectionButton.style.cursor = "pointer";
    selectionButton.style.display = "flex";
    selectionButton.style.alignItems = "center";
    selectionButton.style.justifyContent = "center";
    selectionButton.style.padding = "6px";
    selectionButton.style.background = "#fff";
    selectionButton.style.borderRadius = "20px";
    selectionButton.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    selectionButton.style.border = "1px solid rgba(0,0,0,0.08)";
    selectionButton.style.fontFamily =
      "-apple-system, BlinkMacSystemFont, sans-serif";
    selectionButton.style.fontSize = "13px";
    selectionButton.style.fontWeight = "600";
    selectionButton.style.color = "#333";
    selectionButton.style.transition = "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
    selectionButton.style.opacity = "0";
    selectionButton.style.animation = "fadeInScale 0.2s forwards";

    // Icon + Text
    selectionButton.innerHTML = `
      <div class="rm-icon-wrapper" style="display: flex; align-items: center; justify-content: center; width: 20px; height: 20px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <span class="rm-btn-label">Save</span>
    `;

    // Add Styles
    if (!document.getElementById("rm-anim-styles")) {
      const style = document.createElement("style");
      style.id = "rm-anim-styles";
      style.textContent = `
            @keyframes fadeInScale {
                from { opacity: 0; transform: translate(-50%, 5px) scale(0.95); }
                to { opacity: 1; transform: translate(-50%, 0) scale(1); }
            }
            #researchmate-selection-btn:hover {
                transform: translate(-50%, -2px) scale(1.05) !important;
                box-shadow: 0 6px 16px rgba(0,0,0,0.2) !important;
            }
            #researchmate-selection-btn .rm-btn-label {
                max-width: 0;
                overflow: hidden;
                opacity: 0;
                white-space: nowrap;
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            #researchmate-selection-btn:hover .rm-btn-label {
                max-width: 60px;
                opacity: 1;
                margin-left: 6px;
                padding-right: 6px;
            }
        `;
      document.head.appendChild(style);
    }

    // Imports

    // ... existing code ...

    selectionButton.addEventListener("mousedown", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text) return;

      // Show Loading/Saving State
      if (selectionButton) {
        selectionButton.innerHTML = `<span style="padding: 0 6px;">Saving...</span>`;
        selectionButton.style.pointerEvents = "none";
      }

      try {
        chrome.runtime.sendMessage(
          {
            action: "saveItemInBackground",
            payload: {
              text: text,
              sourceUrl: window.location.href,
              sourceTitle: document.title,
              tags: ["quick-save"],
              deviceSource: "extension",
            },
          },
          (response) => {
            if (chrome.runtime.lastError || !response || !response.success) {
              console.error("Failed to save via background:", chrome.runtime.lastError || response?.error);
              if (selectionButton) {
                selectionButton.innerHTML = `<span style="color: red; padding: 0 6px;">Error</span>`;
                selectionButton.style.pointerEvents = "auto";
                setTimeout(() => removeSelectionButton(), 2000);
              }
              return;
            }

            // Success State
            if (selectionButton) {
              if (response.isLocal) {
                // Guest Mode / Offline Fallback - Orange UI
                selectionButton.innerHTML = `
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px;">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  <span style="color: #F59E0B; padding: 0 6px;">Saved Locally</span>
                `;
                setTimeout(() => removeSelectionButton(), 2500);
              } else {
                // Authenticated (Supabase Sync) - Green UI
                selectionButton.innerHTML = `
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span style="color: #22C55E; padding: 0 6px;">Saved!</span>
                `;
                setTimeout(() => removeSelectionButton(), 1500);
              }
            }
          }
        );
      } catch (err) {
        console.error("Message execution failed:", err);
        if (selectionButton) {
          selectionButton.innerHTML = `<span style="color: red; padding: 0 6px;">Error</span>`;
          selectionButton.style.pointerEvents = "auto";
          setTimeout(() => removeSelectionButton(), 2000);
        }
      }
    });

    document.body.appendChild(selectionButton);
  }
};

document.addEventListener("mouseup", handleSelection);
document.addEventListener("keyup", handleSelection);
document.addEventListener("mousedown", (e) => {
  if (selectionButton && !selectionButton.contains(e.target as Node)) {
    removeSelectionButton();
  }
});

// Create a floating 'Open ResearchMate' trigger
const createTrigger = () => {
  const id = "researchmate-trigger-root";
  if (document.getElementById(id)) return;

  const root = document.createElement("div");
  root.id = id;
  root.style.position = "fixed";
  root.style.top = "30%";
  root.style.right = "0";
  root.style.zIndex = "2147483647"; // Max z-index
  document.body.appendChild(root);

  const shadow = root.attachShadow({ mode: "open" });

  // Styles
  const style = document.createElement("style");
  style.textContent = `
    .trigger {
      display: flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-right: none;
      border-top-left-radius: 99px;
      border-bottom-left-radius: 99px;
      padding: 8px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      width: 40px;
      overflow: hidden;
      white-space: nowrap;
      height: 40px;
    }
    
    .trigger:hover {
      width: 170px;
      background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
    }

    .icon {
      width: 24px;
      height: 24px;
      min-width: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .label {
      margin-left: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #333;
      opacity: 0;
      transition: opacity 0.2s 0.1s;
    }
    
    .trigger:hover .label {
      opacity: 1;
    }
    
    .trigger.idle {
      opacity: 0;
      transform: translateX(100%);
      pointer-events: none;
    }
    
    .trigger-area {
      position: absolute;
      right: 0;
      top: 0;
      height: 100%;
      width: 20px;
    }
    
    .trigger.fullscreen-hidden {
      transform: translateX(100%);
      opacity: 0;
      pointer-events: none;
    }
  `;

  shadow.appendChild(style);

  // Container
  const container = document.createElement("div");
  container.className = "trigger";
  container.title = "Open ResearchMate";

  // Icon (Logo)
  const icon = document.createElement("div");
  icon.className = "icon";
  icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M2 17L12 22L22 17" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M2 12L12 17L22 12" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  // Label
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "Open ResearchMate";

  container.appendChild(icon);
  container.appendChild(label);

  container.addEventListener("click", () => {
    toggleOverlay();
  });

  shadow.appendChild(container);

  // Create a slightly larger, invisible hit area to make it easier to hover
  // Wait, instead of waking up generally, we just let CSS do the layout but we can make it an edge trigger.
  // Actually, let's keep it visible but super small
  container.className = "trigger";

  // Idle Logic
  let idleTimer: number | null = null;
  const resetIdleTimer = () => {
    if (idleTimer) window.clearTimeout(idleTimer);
    container.classList.remove("idle");

    // After 2 seconds of no interaction, hide almost completely
    idleTimer = window.setTimeout(() => {
      if (!container.matches(":hover")) {
        // We will just apply inline styles to hide it instead of adding the .idle class
        // because we want a tiny sliver visible, and we want hover to work natively.
        container.style.transform = "translateX(36px)";
        container.style.opacity = "0.2";
      }
    }, 2000);
  };

  // Only wake up when we interact WITH the trigger, NOT the whole window!
  container.addEventListener("mouseenter", () => {
    if (idleTimer) window.clearTimeout(idleTimer);
    container.style.transform = "translateX(0)";
    container.style.opacity = "1";
    container.classList.remove("idle");
  });

  container.addEventListener("mouseleave", () => {
    resetIdleTimer();
  });

  resetIdleTimer(); // Initial hide after 2s

  // Hide entirely in fullscreen (YouTube, Netflix, etc.)
  const handleFullscreenChange = () => {
    if (document.fullscreenElement) {
      container.classList.add("fullscreen-hidden");
    } else {
      container.classList.remove("fullscreen-hidden");
    }
  };

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("mozfullscreenchange", handleFullscreenChange);

  // Theme Handling
  const updateTheme = (theme: string) => {
    if (theme === "dark") {
      container.classList.add("dark");
    } else if (theme === "light") {
      container.classList.remove("dark");
    } else {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        container.classList.add("dark");
      } else {
        container.classList.remove("dark");
      }
    }
  };

  chrome.storage.local.get(["theme"], (result) => {
    updateTheme(result.theme || "system");
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.theme) {
      updateTheme(changes.theme.newValue);
    }
  });

  const darkStyle = document.createElement("style");
  darkStyle.textContent = `
    .trigger.dark {
      background: rgba(30, 30, 30, 0.8);
      border-color: rgba(255, 255, 255, 0.1);
    }
    .trigger.dark:hover {
      background: rgba(30, 30, 30, 0.95);
    }
    .trigger.dark .label {
      color: white;
    }
    .trigger.dark .icon path {
      stroke: #0a84ff;
    }
  `;
  shadow.appendChild(darkStyle);
};

// Inject trigger
createTrigger();
