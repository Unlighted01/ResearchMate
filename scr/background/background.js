// background.js - Detect OAuth callback at extension URL
console.log("🚀 Background worker active");

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-researchmate",
    title: "Save to ResearchMate",
    contexts: ["selection"],
  });
  console.log("✅ Context menu ready");
});

// Handle context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-to-researchmate" && info.selectionText) {
    console.log("💾 Context menu: Save selection");
    const payload = {
      text: info.selectionText.trim(),
      sourceUrl: tab.url || "",
      sourceTitle: tab.title || "",
      timestamp: Date.now(),
    };
    await chrome.storage.local.set({ pendingSave: payload });
    chrome.runtime
      .sendMessage({ type: "contextMenuSave", payload })
      .catch(() => console.log("ℹ️ Popup not open"));
  }
});

// ✅ Listen for OAuth callback at EXTENSION URL
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;

  const url = tab.url;

  // Check if this is our extension with OAuth tokens
  const isOurExtension = url.includes(chrome.runtime.id);
  const hasTokens =
    url.includes("#access_token") || url.includes("access_token=");

  if (isOurExtension && hasTokens) {
    console.log("🔑 OAuth callback detected at extension URL!");
    console.log("📍 URL:", url);

    try {
      const urlObj = new URL(url);
      let hashFragment = urlObj.hash;

      // Sometimes tokens are in search params instead of hash
      if (!hashFragment && url.includes("access_token=")) {
        const searchParams = urlObj.search;
        hashFragment = searchParams.replace("?", "#");
      }

      if (hashFragment && hashFragment.includes("access_token")) {
        console.log("✅ Storing OAuth tokens...");
        console.log("🔑 Hash:", hashFragment.substring(0, 50) + "...");

        await chrome.storage.local.set({
          oauthCallback: hashFragment,
          oauthTimestamp: Date.now(),
        });

        console.log("✅ Tokens stored successfully!");

        // Close the blocked tab
        await chrome.tabs.remove(tabId);
        console.log("✅ OAuth tab closed");

        // Notify popup if open
        chrome.runtime.sendMessage({ type: "oauthComplete" }).catch(() => {
          console.log("ℹ️ No popup open, will process on next open");
        });
      }
    } catch (error) {
      console.error("❌ Error processing OAuth:", error);
    }
  }
});

// Keep alive
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "keepAlive") {
    sendResponse({ status: "alive" });
  }
  return true;
});

console.log("✅ Background worker initialized");
