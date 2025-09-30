// content.js - Optimized version
(() => {
  const getSel = () => window.getSelection?.()?.toString?.() || "";

  let debounceTimer = null;
  let lastSelection = "";

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
          chrome.runtime.sendMessage({
            type: "selectionPreview",
            text,
            url: location.href,
            title: document.title,
          });
        } else if (lastSelection) {
          chrome.runtime.sendMessage({ type: "selectionCleared" });
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
        chrome.runtime.sendMessage({ type: "selectionCleared" });
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
