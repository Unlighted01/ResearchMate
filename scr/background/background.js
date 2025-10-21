// ============================================
// background.js - Service Worker
// ============================================

console.log("🚀 ResearchMate background service worker starting...");

// ============================================
// CONSTANTS
// ============================================

const CONFIG = {
  CONTEXT_MENU_ID: "save-to-researchmate",
  CONTEXT_MENU_TITLE: "Save to ResearchMate",

  STORAGE_KEYS: {
    PENDING_SAVE: "pendingSave",
    OAUTH_CALLBACK: "oauthCallback",
    OAUTH_TIMESTAMP: "oauthTimestamp",
  },

  MESSAGE_TYPES: {
    KEEP_ALIVE: "keepAlive",
    CONTEXT_MENU_SAVE: "contextMenuSave",
    OAUTH_COMPLETE: "oauthComplete",
    CLEAR_PENDING_SAVE: "clearPendingSave",
  },

  OAUTH: {
    CALLBACK_TIMEOUT: 60000, // 1 minute
  },
};

// ============================================
// PART 1: CONTEXT MENU SETUP
// ============================================

/**
 * Create context menu on installation
 */
function setupContextMenu() {
  chrome.contextMenus.create(
    {
      id: CONFIG.CONTEXT_MENU_ID,
      title: CONFIG.CONTEXT_MENU_TITLE,
      contexts: ["selection"],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(
          "❌ Context menu creation failed:",
          chrome.runtime.lastError
        );
      } else {
        console.log("✅ Context menu created successfully");
      }
    }
  );
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("📦 Extension installed/updated");
  setupContextMenu();
});

// ============================================
// PART 2: CONTEXT MENU HANDLER
// ============================================

/**
 * Handle context menu clicks
 * Saves selected text with metadata
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONFIG.CONTEXT_MENU_ID) {
    return;
  }

  if (!info.selectionText) {
    console.warn("⚠️ Context menu clicked but no text selected");
    return;
  }

  console.log("💾 Context menu triggered");
  console.log("📝 Selected text length:", info.selectionText.length);
  console.log("🌐 Source URL:", tab.url || "Unknown");

  try {
    // Create payload
    const payload = {
      text: info.selectionText.trim(),
      sourceUrl: tab.url || "",
      sourceTitle: tab.title || "Untitled",
      timestamp: Date.now(),
    };

    // Store as pending save
    await chrome.storage.local.set({
      [CONFIG.STORAGE_KEYS.PENDING_SAVE]: payload,
    });

    console.log("✅ Selection stored as pending save");

    // Try to notify popup if it's open
    try {
      await chrome.runtime.sendMessage({
        type: CONFIG.MESSAGE_TYPES.CONTEXT_MENU_SAVE,
        payload: payload,
      });
      console.log("✅ Popup notified of context menu save");
    } catch (error) {
      // Popup not open - that's fine, it will process on next open
      console.log("ℹ️ Popup not open, will process on next open");
    }
  } catch (error) {
    console.error("❌ Error handling context menu click:", error);
  }
});

// ============================================
// PART 3: OAUTH CALLBACK DETECTION
// ============================================

/**
 * Check if URL is an OAuth callback
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isOAuthCallback(url) {
  if (!url) return false;

  const isExtensionUrl = url.includes(chrome.runtime.id);
  const hasTokens =
    url.includes("#access_token") || url.includes("access_token=");

  return isExtensionUrl && hasTokens;
}

/**
 * Extract tokens from OAuth callback URL
 * @param {string} url - The callback URL
 * @returns {{hashFragment: string | null, error: Error | null}}
 */
function extractOAuthTokens(url) {
  try {
    const urlObj = new URL(url);
    let hashFragment = urlObj.hash;

    // Sometimes tokens are in search params instead of hash
    if (!hashFragment && url.includes("access_token=")) {
      hashFragment = urlObj.search.replace("?", "#");
    }

    if (!hashFragment || !hashFragment.includes("access_token")) {
      return {
        hashFragment: null,
        error: new Error("No access token found in URL"),
      };
    }

    return { hashFragment, error: null };
  } catch (exception) {
    console.error("❌ Error parsing OAuth URL:", exception);
    return { hashFragment: null, error: exception };
  }
}

/**
 * Store OAuth tokens for popup to process
 * @param {string} hashFragment - The URL hash containing tokens
 * @returns {Promise<void>}
 */
async function storeOAuthTokens(hashFragment) {
  await chrome.storage.local.set({
    [CONFIG.STORAGE_KEYS.OAUTH_CALLBACK]: hashFragment,
    [CONFIG.STORAGE_KEYS.OAUTH_TIMESTAMP]: Date.now(),
  });
  console.log("✅ OAuth tokens stored successfully");
}

/**
 * Notify popup of OAuth completion
 * @returns {Promise<void>}
 */
async function notifyOAuthComplete() {
  try {
    await chrome.runtime.sendMessage({
      type: CONFIG.MESSAGE_TYPES.OAUTH_COMPLETE,
    });
    console.log("✅ Popup notified of OAuth completion");
  } catch (error) {
    console.log("ℹ️ Popup not open, will process tokens on next open");
  }
}

/**
 * Handle OAuth callback URL
 * Detects when OAuth redirects back to extension and stores tokens
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process complete page loads with URLs
  if (!tab.url) return;

  // Check if this is an OAuth callback
  if (!isOAuthCallback(tab.url)) return;

  console.log("🔒 OAuth callback detected!");
  console.log("📍 Tab ID:", tabId);
  console.log("🔗 URL:", tab.url.substring(0, 100) + "...");

  try {
    // Extract tokens from URL
    const { hashFragment, error } = extractOAuthTokens(tab.url);

    if (error || !hashFragment) {
      console.error("❌ Failed to extract OAuth tokens:", error);
      return;
    }

    console.log("🔑 OAuth tokens extracted");
    console.log("📦 Hash fragment length:", hashFragment.length);

    // Store tokens
    await storeOAuthTokens(hashFragment);

    // Close the OAuth tab
    try {
      await chrome.tabs.remove(tabId);
      console.log("✅ OAuth tab closed");
    } catch (tabError) {
      console.warn("⚠️ Could not close OAuth tab:", tabError);
    }

    // Notify popup
    await notifyOAuthComplete();
  } catch (exception) {
    console.error("❌ Error processing OAuth callback:", exception);
  }
});

// ============================================
// PART 4: MESSAGE HANDLER
// ============================================

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const messageType = message?.type;
  console.log("📨 Message received:", messageType || "unknown");

  // Keep-alive ping
  if (messageType === CONFIG.MESSAGE_TYPES.KEEP_ALIVE) {
    sendResponse({
      status: "alive",
      timestamp: Date.now(),
    });
    return true;
  }

  // OAuth completion notification
  if (messageType === CONFIG.MESSAGE_TYPES.OAUTH_COMPLETE) {
    console.log("🔐 OAuth completion acknowledged");
    sendResponse({ status: "acknowledged" });
    return true;
  }

  // Clear pending save
  if (messageType === CONFIG.MESSAGE_TYPES.CLEAR_PENDING_SAVE) {
    chrome.storage.local
      .remove(CONFIG.STORAGE_KEYS.PENDING_SAVE)
      .then(() => {
        console.log("✅ Pending save cleared");
        sendResponse({ status: "cleared" });
      })
      .catch((error) => {
        console.error("❌ Error clearing pending save:", error);
        sendResponse({ status: "error", error: error.message });
      });
    return true;
  }

  // Unknown message type
  console.warn("⚠️ Unknown message type:", messageType);
  sendResponse({ status: "unknown", type: messageType });
  return true;
});

// ============================================
// PART 5: LIFECYCLE HANDLERS
// ============================================

/**
 * Handle browser restart
 */
chrome.runtime.onStartup.addListener(() => {
  console.log("🔄 Browser restarted, service worker reactivated");
});

/**
 * Keep service worker alive during critical operations
 */
let keepAliveInterval = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "keepAlive") return;

  console.log("🔌 Keep-alive connection established");

  // Ping every 20 seconds to prevent service worker termination
  keepAliveInterval = setInterval(() => {
    try {
      port.postMessage({ type: "ping", timestamp: Date.now() });
    } catch (error) {
      console.warn("⚠️ Keep-alive ping failed:", error);
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    }
  }, 20000);

  port.onDisconnect.addListener(() => {
    console.log("🔌 Keep-alive connection closed");
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
  });
});

// ============================================
// PART 6: ERROR HANDLING
// ============================================

/**
 * Global error handler for uncaught errors
 */
self.addEventListener("error", (event) => {
  console.error("❌ Uncaught error in service worker:", event.error);
  console.error("📍 Error location:", event.filename, "Line:", event.lineno);
});

/**
 * Global handler for unhandled promise rejections
 */
self.addEventListener("unhandledrejection", (event) => {
  console.error("❌ Unhandled promise rejection:", event.reason);
  console.error("📍 Promise:", event.promise);
});

// ============================================
// INITIALIZATION COMPLETE
// ============================================

console.log("✅ Background service worker initialized");
console.log("📋 Active features:");
console.log("   ✓ Context menu (Save to ResearchMate)");
console.log("   ✓ OAuth callback detection");
console.log("   ✓ Message handling");
console.log("   ✓ Keep-alive support");
console.log("   ✓ Error handling");
console.log("🎯 Ready to handle user interactions");
