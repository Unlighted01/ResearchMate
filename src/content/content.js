// src/content/content.js - Content script for text selection
(() => {
  const getSel = () => window.getSelection?.()?.toString?.() || "";

  let debounceTimer = null;
  let lastSelection = "";

  /**
   * Safely send message to extension - handles disconnection gracefully
   */
  function safeSendMessage(message) {
    try {
      chrome.runtime.sendMessage(message).catch(() => {
        // Extension context invalidated - ignore silently
      });
    } catch (error) {
      // Extension not available (context invalidated, extension reloaded, etc.)
      // This is expected during extension updates - fail silently
    }
  }

  // ✅ Add passive listener for better performance
  document.addEventListener(
    "selectionchange",
    () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const text = getSel().trim();

        // ✅ Avoid unnecessary messaging if selection unchanged
        if (text === lastSelection) return;
        lastSelection = text;

        if (text && text.length >= 4) {
          safeSendMessage({
            type: "selectionPreview",
            text,
            url: location.href,
            title: document.title,
          });
        } else if (lastSelection) {
          safeSendMessage({ type: "selectionCleared" });
        }
      }, 200);
    },
    { passive: true }
  ); // ✅ Added passive option

  // ✅ Add window blur handler
  window.addEventListener(
    "blur",
    () => {
      const text = getSel();
      if (!text.trim()) {
        safeSendMessage({ type: "selectionCleared" });
        lastSelection = "";
      }
    },
    { passive: true }
  );

  // Keep the on-demand getter for debugging
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "getSelection") {
      const text = getSel();
      sendResponse({ text, url: location.href, title: document.title });
    }
  });
})();
