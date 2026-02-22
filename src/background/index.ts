// Background service worker
console.log("ResearchMate Background Loaded");

// Toggle overlay on action click
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  console.log("Action clicked for tab:", tab.id);

  chrome.tabs.sendMessage(tab.id, { action: "toggleOverlay" }).catch((err) => {
    console.error(
      "Connection failed. The user likely needs to refresh the page.",
      err,
    );
  });
});

// Setup context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-to-researchmate",
      title: "Save to ResearchMate",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-researchmate" && info.selectionText) {
    const text = info.selectionText.trim();
    const words = text.split(/\s+/).filter((w) => w.length > 0);

    // Enforce the same minimum word count as the highlight button
    if (words.length < 10) {
      if (tab?.id) {
        chrome.tabs
          .sendMessage(tab.id, {
            action: "showErrorToast",
            message: "Select a full sentence or paragraph to save",
          })
          .catch(() => {}); // ignore errors if content script not loaded
      }
      return;
    }

    // Handle saving text
    console.log("Saving text from context menu:", text);

    // You would typically send this to the side panel or save directly to storage
    // using the storageService (but background service workers have limited import capabilities w/o bundler)
    // For now, let's store it in local storage to be picked up by the side panel

    const newItem = {
      id: `local_${Date.now()}`,
      text: info.selectionText,
      sourceUrl: tab?.url || "",
      sourceTitle: tab?.title || "",
      createdAt: new Date().toISOString(),
      deviceSource: "extension",
      tags: ["quick-save"],
      note: "",
    };

    chrome.storage.local.get(["researchMateItems"], (result) => {
      const items = result.researchMateItems
        ? JSON.parse(result.researchMateItems)
        : [];
      items.unshift(newItem);
      chrome.storage.local.set(
        { researchMateItems: JSON.stringify(items) },
        () => {
          // Notify the user?
        },
      );
    });
  }
});
