// content.js
(() => {
  const getSel = () =>
    (window.getSelection && window.getSelection().toString()) ||
    (document.getSelection && document.getSelection().toString()) ||
    "";

  let t = null;
  let hadNonEmpty = false;
  window.addEventListener("blur", () => {
    const text =
      (window.getSelection && window.getSelection().toString()) || "";
    if (!text.trim()) chrome.runtime.sendMessage({ type: "selectionCleared" });
  });

  document.addEventListener("selectionchange", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const text = getSel().trim();
      if (text && text.length >= 4) {
        chrome.runtime.sendMessage({
          type: "selectionPreview",
          text,
          url: location.href,
          title: document.title,
        });
        hadNonEmpty = true;
      } else if (hadNonEmpty) {
        // user cleared selection → tell the extension to clear the box
        chrome.runtime.sendMessage({ type: "selectionCleared" });
        hadNonEmpty = false;
      }
    }, 200);
  });

  // keep the on-demand getter for debugging
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "getSelection") {
      const text = getSel();
      sendResponse({ text, url: location.href, title: document.title });
    }
  });
})();
