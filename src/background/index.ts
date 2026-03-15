// Background service worker
import { addItem } from "../services/storageService";
import { QUICK_SAVE_TAG } from "../constants";

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
          .catch(() => { }); // ignore errors if content script not loaded
      }
      return;
    }

    // Handle saving text
    console.log("Saving text from context menu:", text);

    // You would typically send this to the side panel or save directly to storage
    // using the storageService (but background service workers have limited import capabilities w/o bundler)
    // For now, let's store it in local storage to be picked up by the side panel

    const newItem = {
      text: info.selectionText,
      sourceUrl: info.pageUrl || tab?.url || "https://example.com/unknown",
      sourceTitle: tab?.title || "Unknown Title",
      createdAt: new Date().toISOString(),
      deviceSource: "extension" as const,
      tags: [QUICK_SAVE_TAG],
      note: "",
    };

    // Route through the official storage service (handles Supabase/Local fallback)
    addItem(newItem).then(() => {
      // Notify any open SidePanels to refresh their lists
      chrome.runtime.sendMessage({ action: "itemAdded" }).catch(() => { });
    }).catch((err) => {
      console.error("Failed to add item from background:", err);
    });
  }
});

// Listen for save requests from Content Scripts
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "saveItemInBackground") {
    addItem(request.payload)
      .then((resultItem) => {
        // Broadcast the update to any open SidePanels
        chrome.runtime.sendMessage({ action: "itemAdded" }).catch(() => { });
        // Reply to the content script with the success state
        sendResponse({ success: true, isLocal: resultItem?.id.startsWith("local_") });
      })
      .catch((err) => {
        console.error("Background save error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }
});
