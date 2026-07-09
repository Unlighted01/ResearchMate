// Content script to handle text selection and highlighting
import { QUICK_SAVE_TAG } from "../constants";
import { jaccardSimilarity } from "../utils/similarity";
import { parseMetadata, formatMetadataCitation } from "../utils/metadataParser";
import { isResearchContent } from "../utils/classifier";
console.log("ResearchMate Content Script Loaded");



// Overlay State
let overlayInstance: { root: HTMLDivElement; backdrop: HTMLDivElement } | null =
  null;

// Toggle Overlay Function (Hoisted)
function toggleOverlay(viewDetailId?: string) {
  if (overlayInstance) {
    if (viewDetailId) {
      chrome.runtime.sendMessage({ action: "viewItemDetail", itemId: viewDetailId }).catch(() => {});
      return;
    }
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
  iframe.src = chrome.runtime.getURL("index.html") + (viewDetailId ? `?viewDetail=${viewDetailId}` : "");
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

  overlayInstance = { root, backdrop: root };
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
  } else if (request.action === "getPageText") {
    sendResponse({
      text: extractFullPageText(),
      title: document.title,
      url: window.location.href,
    });
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

function extractFullPageText(): string {
  // Try to find main content or body
  const mainEl = document.querySelector("article, main, #content, .content, [role='main']") || document.body;
  const clone = mainEl.cloneNode(true) as HTMLElement;

  // Define selectors for elements we want to completely ignore
  const junkSelectors = [
    "ins.adsbygoogle",
    '[id*="google_ads"]',
    '[class*="ad-"]',
    '[class*="sponsored"]',
    "[data-ad]",
    "iframe",
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "footer",
    "header",
    "aside",
    ".site-header",
    ".post-sidebar",
    ".related-articles",
    ".newsletter-signup",
    ".social-share",
    "#researchmate-overlay-root",
    "#researchmate-trigger-root",
  ];

  // Remove completely ignored elements
  const junk = clone.querySelectorAll(junkSelectors.join(","));
  junk.forEach((el) => el.remove());

  let extractedText = "";

  function processNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      extractedText += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const isBlock = [
        "DIV",
        "P",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "SECTION",
        "ARTICLE",
        "LI",
        "BLOCKQUOTE",
        "PRE",
        "CODE",
      ].includes(el.tagName);

      if (isBlock || el.tagName === "BR" || el.tagName === "HR") {
        extractedText += "\n";
      }

      node.childNodes.forEach(processNode);

      if (isBlock) {
        extractedText += "\n";
      }
    }
  }

  clone.childNodes.forEach(processNode);

  return extractedText
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .trim();
}

function cleanSelectedText(selection: Selection | null): string {
  if (!selection || selection.rangeCount === 0) return "";

  const range = selection.getRangeAt(0);
  const tempDiv = document.createElement("div");
  // Clone the contents of the selection range to separate it from the live DOM
  tempDiv.appendChild(range.cloneContents());

  // Define selectors for elements we want to completely ignore
  const junkSelectors = [
    // Ads
    "ins.adsbygoogle",
    '[id*="google_ads"]',
    '[class*="ad-"]',
    '[class*="sponsored"]',
    "[data-ad]",
    "iframe",
    // Non-content
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "footer",
    "aside",
    ".site-header",
    ".post-sidebar",
    ".related-articles",
    ".newsletter-signup",
    ".social-share",
  ];

  // Remove completely ignored elements
  const junkElements = tempDiv.querySelectorAll(junkSelectors.join(","));
  junkElements.forEach((el) => el.remove());

  // Walk the DOM and replace block elements with spacing
  let extractedText = "";

  function processNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      extractedText += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      // Skip elements that are visibly hidden via inline styles (we can't easily check computed style on a disconnected clone)
      const style = el.getAttribute("style");
      if (
        style &&
        (style.includes("display: none") ||
          style.includes("visibility: hidden") ||
          style.includes("opacity: 0"))
      ) {
        return;
      }
      
      // Skip aria-hidden
      if (el.getAttribute("aria-hidden") === "true") {
        return;
      }

      // Block-level elements that usually indicate a newline
      const isBlock = [
        "DIV",
        "P",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "SECTION",
        "ARTICLE",
        "LI",
        "BLOCKQUOTE",
      ].includes(el.tagName);
      
      const isLineBreak = ["BR", "HR"].includes(el.tagName);
      
      if (isBlock || isLineBreak) {
        extractedText += "\n";
      }

      // Prepend bullet or number formatting for list items
      if (el.tagName === "LI") {
        const parent = el.parentElement;
        if (parent && parent.tagName === "OL") {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(el) + 1;
          extractedText += `${index}. `;
        } else {
          extractedText += "• ";
        }
      }

      // Process children
      node.childNodes.forEach(processNode);

      // Add trailing newline for block elements
      if (isBlock) {
        extractedText += "\n";
      }
    }
  }

  tempDiv.childNodes.forEach(processNode);

  // Clean up whitespace:
  // 1. Replace 3+ consecutive newlines with exactly 2 newlines (one blank line max between paragraphs)
  // 2. Collapse multiple spaces into a single space
  // 3. Trim leading/trailing whitespace
  return extractedText
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .trim();
}

const renderTagSelector = (itemId: string, isLocal: boolean) => {
  if (!selectionButton) return;
  
  // Enable mouse events so the user can click inputs and buttons
  selectionButton.style.pointerEvents = "auto";
  selectionButton.style.borderRadius = "12px";
  selectionButton.style.padding = "10px";
  selectionButton.style.flexDirection = "column";
  selectionButton.style.alignItems = "stretch";
  selectionButton.style.width = "220px";
  selectionButton.style.gap = "8px";

  const statusColor = isLocal ? "#F59E0B" : "#22C55E";
  const statusText = isLocal ? "Saved Locally" : "Saved!";
  const statusIcon = isLocal
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  selectionButton.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; width:100%; margin-bottom:2px;">
      <span style="color:${statusColor}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:12px; font-weight:700; display:flex; align-items:center; gap:4px; line-height:1;">
        ${statusIcon}
        ${statusText}
      </span>
      <button id="rm-done-btn" style="background:#007AFF; color:#fff; border:none; padding:3px 10px; border-radius:6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:11px; font-weight:600; cursor:pointer; transition: background 0.15s;">Done</button>
    </div>
    <div style="position:relative; width:100%;">
      <input type="text" id="rm-tags-input" placeholder="Add tags (comma separated)" style="width:100%; box-sizing:border-box; border:1px solid rgba(0,0,0,0.15); padding:6px 8px; border-radius:6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:12px; outline:none; background:#fff; color:#000; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);" />
      <div id="rm-autocomplete-dropdown" style="position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid rgba(0,0,0,0.15); border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:2147483647; max-height:100px; overflow-y:auto; display:none; margin-top:4px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"></div>
    </div>
  `;

  const doneBtn = selectionButton.querySelector("#rm-done-btn") as HTMLButtonElement;
  const tagsInput = selectionButton.querySelector("#rm-tags-input") as HTMLInputElement;
  const dropdown = selectionButton.querySelector("#rm-autocomplete-dropdown") as HTMLDivElement;

  tagsInput.focus();

  let existingTags: string[] = [];
  chrome.storage.local.get("researchMateItems", (result) => {
    try {
      const itemsStr = result.researchMateItems;
      if (itemsStr) {
        const items = JSON.parse(itemsStr);
        if (Array.isArray(items)) {
          const tagsSet = new Set<string>();
          items.forEach((item: any) => {
            if (Array.isArray(item.tags)) {
              item.tags.forEach((tag: string) => {
                if (
                  tag !== "quick-save" &&
                  !tag.startsWith("color:") &&
                  !tag.startsWith("ocr:") &&
                  tag !== "pinned:true"
                ) {
                  tagsSet.add(tag);
                }
              });
            }
          });
          existingTags = Array.from(tagsSet);
        }
      }
    } catch (e) {
      console.error("Failed to parse tags for autocomplete:", e);
    }
  });

  const updateDropdown = () => {
    const value = tagsInput.value;
    const parts = value.split(",");
    const currentPart = parts[parts.length - 1].trim();

    if (!currentPart) {
      dropdown.style.display = "none";
      return;
    }

    const typedLower = currentPart.toLowerCase();
    const matches = existingTags.filter(
      (tag) =>
        tag.toLowerCase().startsWith(typedLower) &&
        !parts
          .slice(0, -1)
          .map((p) => p.trim().toLowerCase())
          .includes(tag.toLowerCase())
    );

    if (matches.length === 0) {
      dropdown.style.display = "none";
      return;
    }

    dropdown.innerHTML = matches
      .map(
        (match) => `
      <div class="rm-suggestion-item" style="padding:6px 10px; font-size:11px; cursor:pointer; color:#333; transition:background 0.15s; text-align:left; background:#fff;" data-tag="${match}">
        ${match}
      </div>
    `
      )
      .join("");

    if (!document.getElementById("rm-suggestion-styles")) {
      const style = document.createElement("style");
      style.id = "rm-suggestion-styles";
      style.textContent = `
        .rm-suggestion-item:hover {
          background: #F3F4F6 !important;
          color: #000 !important;
        }
      `;
      document.head.appendChild(style);
    }

    dropdown.style.display = "block";

    dropdown.querySelectorAll(".rm-suggestion-item").forEach((itemEl) => {
      itemEl.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const selectedTag = itemEl.getAttribute("data-tag") || "";
        parts[parts.length - 1] = " " + selectedTag;
        tagsInput.value = parts.join(",").trim() + ", ";
        dropdown.style.display = "none";
        tagsInput.focus();
      });
    });
  };

  tagsInput.addEventListener("input", updateDropdown);
  tagsInput.addEventListener("focus", updateDropdown);

  const handleDocumentMouseDown = (ev: MouseEvent) => {
    if (dropdown && !dropdown.contains(ev.target as Node) && ev.target !== tagsInput) {
      dropdown.style.display = "none";
    }
  };
  document.addEventListener("mousedown", handleDocumentMouseDown);

  const saveTagsAndClose = () => {
    document.removeEventListener("mousedown", handleDocumentMouseDown);
    const inputTags = tagsInput.value
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const finalTags = Array.from(new Set([QUICK_SAVE_TAG, ...inputTags]));

    chrome.runtime.sendMessage(
      { action: "updateItemTags", payload: { itemId, tags: finalTags } },
      () => {
        removeSelectionButton();
      }
    );
  };

  doneBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    saveTagsAndClose();
  });

  tagsInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      saveTagsAndClose();
    }
  });
};

const handleSelection = (e?: Event) => {
  const selection = window.getSelection();
  
  // 1. Skip if selection is empty or collapsed (just a click)
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    removeSelectionButton();
    return;
  }

  // 2. Suppress if selection is inside form inputs or editable areas
  const activeEl = document.activeElement;
  if (
    activeEl &&
    (activeEl.tagName === "INPUT" ||
      activeEl.tagName === "TEXTAREA" ||
      (activeEl as HTMLElement).isContentEditable)
  ) {
    removeSelectionButton();
    return;
  }

  // 3. Suppress if parent element is navigation, headers, footers, or interactive components
  const range = selection.getRangeAt(0);
  let parent = range.commonAncestorContainer;
  if (parent.nodeType === Node.TEXT_NODE) {
    parent = parent.parentNode!;
  }
  const parentEl = parent as HTMLElement;
  if (
    parentEl.closest(
      "nav, header, footer, button, select, option, input, textarea, [role='button'], [role='menu'], [role='menuitem'], [role='tab'], [role='combobox']"
    )
  ) {
    removeSelectionButton();
    return;
  }

  const text = cleanSelectedText(selection);

  // 4. Skip if no cleaned text
  if (!text || text.length === 0) {
    removeSelectionButton();
    return;
  }

  // 5. Apply Domain-Based Thresholds & Relevancy Classifier
  const host = window.location.hostname.toLowerCase();
  const isAcademicPage =
    host.endsWith(".edu") ||
    host.includes("arxiv.org") ||
    host.includes("pubmed") ||
    host.includes("nature.com") ||
    host.includes("scholar.google") ||
    host.includes("sciencedirect") ||
    host.includes("researchgate.net") ||
    host.includes("ieee.org") ||
    host.includes("springer.com");

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const minWords = isAcademicPage ? 5 : 8;
  const minChars = isAcademicPage ? 20 : 45;

  if (words.length < minWords || text.length < minChars) {
    removeSelectionButton();
    return;
  }

  // 6. Intelligent Research Classifier Check (free/offline)
  if (!isResearchContent(text, window.location.hostname)) {
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

    // Build the floating save button with an optional color toggle
    selectionButton = document.createElement("div");
    selectionButton.id = "researchmate-selection-btn";
    selectionButton.style.position = "absolute";
    selectionButton.style.top = `${top}px`;
    selectionButton.style.left = `${left}px`;
    selectionButton.style.transform = "translateX(-50%)";
    selectionButton.style.zIndex = "2147483647";
    selectionButton.style.display = "flex";
    selectionButton.style.alignItems = "center";
    selectionButton.style.gap = "4px";
    selectionButton.style.padding = "5px 8px";
    selectionButton.style.background = "#fff";
    selectionButton.style.borderRadius = "20px";
    selectionButton.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    selectionButton.style.border = "1px solid rgba(0,0,0,0.08)";
    selectionButton.style.transition = "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
    selectionButton.style.opacity = "0";
    selectionButton.style.animation = "fadeInScale 0.2s forwards";

    // Add animation styles once
    if (!document.getElementById("rm-anim-styles")) {
      const style = document.createElement("style");
      style.id = "rm-anim-styles";
      style.textContent = `
        @keyframes fadeInScale {
          from { opacity: 0; transform: translate(-50%, 5px) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, 0)   scale(1);    }
        }
        #researchmate-selection-btn:hover {
          transform: translate(-50%, -2px) scale(1.02) !important;
          box-shadow: 0 6px 16px rgba(0,0,0,0.2) !important;
        }
        .rm-save-btn {
          padding: 3px 10px;
          background: #007AFF;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .rm-save-btn:hover { background: #0066dd; }
        .rm-color-dot:hover { transform: scale(1.2); }
        .rm-action-btn:hover { background: rgba(0,0,0,0.05) !important; }
      `;
      document.head.appendChild(style);
    }

    // Core save function
    const doSave = (color?: string, noteText?: string, forceSave = false) => {
      const selection = window.getSelection();
      const text = cleanSelectedText(selection);
      if (!text) return;

      const executeSave = () => {
        if (selectionButton) {
          selectionButton.innerHTML = `<span style="padding: 0 8px; font-family: sans-serif; font-size: 13px; font-weight: 600; color: #333;">Saving...</span>`;
          selectionButton.style.pointerEvents = "none";
        }

        const metadata = parseMetadata(document);
        const url = window.location.href !== "about:blank" ? window.location.href : document.referrer || "https://example.com";
        const citation = metadata.authors ? formatMetadataCitation(metadata, url, "apa") : undefined;

        const payload: Record<string, unknown> = {
          text,
          sourceUrl: url,
          sourceTitle: metadata.title || document.title || "Unknown Title",
          tags: [QUICK_SAVE_TAG],
          deviceSource: "extension",
          note: noteText || "",
        };

        if (color) {
          payload.color = color;
          // Add it to tags as well for compatibility with older sync structures
          payload.tags = [QUICK_SAVE_TAG, `color:${color}`];
        }
        if (citation) {
          payload.citation = citation;
          payload.citationFormat = "apa";
        }

        chrome.runtime.sendMessage({ action: "saveItemInBackground", payload }, (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            console.error("Failed to save via background:", chrome.runtime.lastError || response?.error);
            if (selectionButton) {
              selectionButton.innerHTML = `<span style="color:red;padding:0 8px;font-family:sans-serif;font-size:13px;font-weight:600;">Error</span>`;
              selectionButton.style.pointerEvents = "auto";
              setTimeout(() => removeSelectionButton(), 2000);
            }
            return;
          }
          
          // Apply DOM Highlight if color was chosen
          if (color && selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const span = document.createElement("span");
            span.className = `rm-highlight rm-highlight-${color}`;
            const bgColors: Record<string, string> = {
              yellow: "rgba(253, 224, 71, 0.4)",
              green: "rgba(134, 239, 172, 0.4)",
              blue: "rgba(147, 197, 253, 0.4)",
              red: "rgba(252, 165, 165, 0.4)",
            };
            span.style.backgroundColor = bgColors[color] || bgColors.yellow;
            span.style.borderRadius = "2px";
            
            try {
              range.surroundContents(span);
            } catch (e) {
              try {
                const documentFragment = range.extractContents();
                span.appendChild(documentFragment);
                range.insertNode(span);
              } catch (e2) {
                console.error("Failed to highlight DOM range:", e2);
              }
            }
          }

          if (selectionButton && response.itemId) {
            renderTagSelector(response.itemId, !!response.isLocal);
          } else {
            removeSelectionButton();
          }
        });
      };

      if (forceSave) {
        executeSave();
        return;
      }

      // Run duplicate detection check
      chrome.storage.local.get("researchMateItems", (result) => {
        let items: any[] = [];
        try {
          if (result.researchMateItems) {
            items = JSON.parse(result.researchMateItems);
          }
        } catch (e) {
          console.error("Failed to parse items for duplicate check:", e);
        }

        const sortedItems = items
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 50);

        let bestMatch: any = null;
        let highestSim = 0;
        for (const item of sortedItems) {
          const sim = jaccardSimilarity(text, item.text);
          if (sim > highestSim) {
            highestSim = sim;
            bestMatch = item;
          }
        }

        if (highestSim > 0.75 && bestMatch) {
          // Show duplicate warning UI
          if (selectionButton) {
            selectionButton.style.pointerEvents = "auto";
            selectionButton.style.borderRadius = "12px";
            selectionButton.style.padding = "10px";
            selectionButton.style.flexDirection = "column";
            selectionButton.style.alignItems = "stretch";
            selectionButton.style.width = "220px";
            selectionButton.style.gap = "8px";

            selectionButton.innerHTML = `
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:12px; color:#D97706; font-weight:600; text-align:left; line-height:1.4;">
                ⚠️ Looks similar to a saved item. Save anyway?
              </div>
              <div style="display:flex; gap:6px; margin-top:2px;">
                <button id="rm-view-existing-btn" style="flex:1; background:#E5E7EB; color:#374151; border:none; padding:4px 8px; border-radius:6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:11px; font-weight:600; cursor:pointer; transition: background 0.15s;">View Existing</button>
                <button id="rm-save-anyway-btn" style="flex:1; background:#007AFF; color:#fff; border:none; padding:4px 8px; border-radius:6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:11px; font-weight:600; cursor:pointer; transition: background 0.15s;">Save Anyway</button>
              </div>
            `;

            const viewExistingBtn = selectionButton.querySelector("#rm-view-existing-btn") as HTMLButtonElement;
            const saveAnywayBtn = selectionButton.querySelector("#rm-save-anyway-btn") as HTMLButtonElement;

            viewExistingBtn.addEventListener("mousedown", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              toggleOverlay(bestMatch.id);
              removeSelectionButton();
            });

            saveAnywayBtn.addEventListener("mousedown", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              executeSave();
            });
          }
        } else {
          executeSave();
        }
      });
    };

    // Render micro-actions bubble contents
    selectionButton.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; padding:2px; pointer-events:auto;">
        <!-- Colors -->
        <div style="display:flex; align-items:center; gap:5px; padding-right:6px; border-right:1px solid rgba(0,0,0,0.1);">
          <button class="rm-color-dot" data-color="yellow" title="Highlight Yellow" style="width:16px; height:16px; border-radius:50%; border:1px solid rgba(0,0,0,0.15); background:#FDE047; cursor:pointer; padding:0; transition:transform 0.1s;"></button>
          <button class="rm-color-dot" data-color="green" title="Highlight Green" style="width:16px; height:16px; border-radius:50%; border:1px solid rgba(0,0,0,0.15); background:#86EFAC; cursor:pointer; padding:0; transition:transform 0.1s;"></button>
          <button class="rm-color-dot" data-color="blue" title="Highlight Blue" style="width:16px; height:16px; border-radius:50%; border:1px solid rgba(0,0,0,0.15); background:#93C5FD; cursor:pointer; padding:0; transition:transform 0.1s;"></button>
          <button class="rm-color-dot" data-color="red" title="Highlight Rose" style="width:16px; height:16px; border-radius:50%; border:1px solid rgba(0,0,0,0.15); background:#FCA5A5; cursor:pointer; padding:0; transition:transform 0.1s;"></button>
        </div>
        <!-- Note -->
        <button id="rm-action-note-btn" class="rm-action-btn" style="background:transparent; border:none; color:#4B5563; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:12px; font-weight:600; cursor:pointer; padding:4px 8px; border-radius:6px; display:flex; align-items:center; gap:4px; transition:background 0.15s; outline:none;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Note
        </button>
        <!-- Ask AI -->
        <button id="rm-action-ai-btn" class="rm-action-btn" style="background:transparent; border:none; color:#007AFF; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:12px; font-weight:600; cursor:pointer; padding:4px 8px; border-radius:6px; display:flex; align-items:center; gap:4px; transition:background 0.15s; outline:none;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Ask AI
        </button>
      </div>
    `;

    // Attach listeners to Color Dots
    selectionButton.querySelectorAll(".rm-color-dot").forEach((dotEl) => {
      dotEl.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const color = dotEl.getAttribute("data-color") || "yellow";
        doSave(color);
      });
    });

    // Attach listener to Note Button
    const noteBtn = selectionButton.querySelector("#rm-action-note-btn") as HTMLButtonElement;
    noteBtn.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      
      if (selectionButton) {
        selectionButton.style.pointerEvents = "auto";
        selectionButton.style.flexDirection = "column";
        selectionButton.style.alignItems = "stretch";
        selectionButton.style.width = "220px";
        selectionButton.style.gap = "8px";
        selectionButton.style.padding = "10px";
        selectionButton.innerHTML = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:12px; color:#4B5563; font-weight:600; text-align:left; margin-bottom:2px;">
            Add note to selection:
          </div>
          <textarea id="rm-note-textarea" placeholder="Type a note..." style="width:100%; box-sizing:border-box; border:1px solid rgba(0,0,0,0.15); padding:6px 8px; border-radius:6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:12px; outline:none; background:#fff; color:#000; height:60px; resize:none; font-weight:normal; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);"></textarea>
          <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:2px;">
            <button id="rm-note-cancel" style="background:#E5E7EB; color:#374151; border:none; padding:4px 8px; border-radius:6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:11px; font-weight:600; cursor:pointer; transition:background 0.15s;">Cancel</button>
            <button id="rm-note-save" style="background:#007AFF; color:#fff; border:none; padding:4px 8px; border-radius:6px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:11px; font-weight:600; cursor:pointer; transition:background 0.15s;">Save</button>
          </div>
        `;

        const textarea = selectionButton.querySelector("#rm-note-textarea") as HTMLTextAreaElement;
        const cancelBtn = selectionButton.querySelector("#rm-note-cancel") as HTMLButtonElement;
        const saveBtn = selectionButton.querySelector("#rm-note-save") as HTMLButtonElement;

        textarea.focus();

        cancelBtn.addEventListener("mousedown", (cancelEv) => {
          cancelEv.preventDefault();
          cancelEv.stopPropagation();
          removeSelectionButton();
        });

        saveBtn.addEventListener("mousedown", (saveEv) => {
          saveEv.preventDefault();
          saveEv.stopPropagation();
          doSave(undefined, textarea.value.trim());
        });
        
        textarea.addEventListener("keydown", (keyEv) => {
          if (keyEv.key === "Enter" && !keyEv.shiftKey) {
            keyEv.preventDefault();
            doSave(undefined, textarea.value.trim());
          }
        });
      }
    });

    // Attach listener to Ask AI Button
    const aiBtn = selectionButton.querySelector("#rm-action-ai-btn") as HTMLButtonElement;
    aiBtn.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const selectionText = text;
      
      chrome.storage.local.set({ pendingChatQuery: selectionText, chatMode: "page" }, () => {
        chrome.runtime.sendMessage({ action: "askAICopilot" }, () => {
          toggleOverlay();
          removeSelectionButton();
        });
      });
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
