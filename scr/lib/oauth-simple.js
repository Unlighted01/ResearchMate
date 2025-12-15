// ============================================
// PART 2: oauth-simple.js
// ============================================

import { supabase } from "./supabase.js";

// ============================================
// CONSTANTS
// ============================================

const OAUTH_CONFIG = {
  STORAGE_FLAGS: {
    IN_PROGRESS: "oauthInProgress",
    START_TIME: "oauthStartTime",
    CALLBACK: "oauthCallback",
    TIMESTAMP: "oauthTimestamp",
  },
  QUERY_PARAMS: {
    ACCESS_TYPE: "offline",
    PROMPT: "select_account",
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the extension URL for OAuth redirect
 * CHANGED: Now returns the chromiumapp.org URL to match Supabase whitelist
 */
function getExtensionRedirectUrl() {
  return `https://${chrome.runtime.id}.chromiumapp.org/`;
}

/**
 * Mark OAuth flow as in progress
 * @returns {Promise<void>}
 */
async function markOAuthInProgress() {
  await chrome.storage.local.set({
    [OAUTH_CONFIG.STORAGE_FLAGS.IN_PROGRESS]: true,
    [OAUTH_CONFIG.STORAGE_FLAGS.START_TIME]: Date.now(),
  });
}

/**
 * Clear OAuth in-progress flags
 * @returns {Promise<void>}
 */
async function clearOAuthFlags() {
  await chrome.storage.local.remove([
    OAUTH_CONFIG.STORAGE_FLAGS.IN_PROGRESS,
    OAUTH_CONFIG.STORAGE_FLAGS.START_TIME,
  ]);
}

/**
 * Get OAuth URL from Supabase
 * @param {string} redirectUrl - The URL to redirect to after OAuth
 * @returns {Promise<{url: string | null, error: Error | null}>}
 */
async function getSupabaseOAuthUrl(redirectUrl) {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        skipBrowserRedirect: true,
        redirectTo: redirectUrl,
        queryParams: {
          access_type: OAUTH_CONFIG.QUERY_PARAMS.ACCESS_TYPE,
          prompt: OAUTH_CONFIG.QUERY_PARAMS.PROMPT,
        },
      },
    });

    if (error) {
      console.error("❌ Supabase OAuth URL error:", error);
      return { url: null, error };
    }

    if (!data?.url) {
      const noUrlError = new Error("No OAuth URL returned from Supabase");
      console.error("❌", noUrlError.message);
      return { url: null, error: noUrlError };
    }

    return { url: data.url, error: null };
  } catch (exception) {
    console.error("❌ Exception getting OAuth URL:", exception);
    return { url: null, error: exception };
  }
}

/**
 * Open OAuth URL in a new tab
 * @param {string} oauthUrl - The OAuth URL to open
 * @returns {Promise<chrome.tabs.Tab>}
 */
async function openOAuthTab(oauthUrl) {
  return await chrome.tabs.create({ url: oauthUrl });
}

// ============================================
// MAIN OAUTH FUNCTION
// ============================================

/**
 * @returns {Promise<{success: boolean, error: Error | null}>}
 */
export async function signInWithGoogle() {
  console.log("🔵 Starting Google OAuth flow...");

  try {
    // Step 1: Get extension redirect URL
    const redirectUrl = getExtensionRedirectUrl();
    console.log("🔗 Redirect URL:", redirectUrl);

    // Step 2: Get OAuth URL from Supabase
    console.log("📡 Requesting OAuth URL from Supabase...");
    const { url: oauthUrl, error: urlError } = await getSupabaseOAuthUrl(
      redirectUrl
    );

    if (urlError || !oauthUrl) {
      await clearOAuthFlags();
      return {
        success: false,
        error: urlError || new Error("Failed to get OAuth URL"),
      };
    }

    console.log("✅ OAuth URL obtained");

    // Step 3: Mark OAuth as in progress
    console.log("💾 Marking OAuth as in progress...");
    await markOAuthInProgress();

    // Step 4: Open OAuth in new tab
    console.log("🚀 Opening OAuth tab...");
    const tab = await openOAuthTab(oauthUrl);
    console.log("✅ OAuth tab opened (ID:", tab.id + ")");

    // Step 5: Return immediately
    console.log("✅ OAuth flow initiated successfully");
    console.log("⏳ Waiting for user to complete sign-in...");

    return { success: true, error: null };
  } catch (exception) {
    console.error("❌ OAuth flow exception:", exception);
    await clearOAuthFlags();

    return {
      success: false,
      error:
        exception instanceof Error ? exception : new Error(String(exception)),
    };
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export async function isOAuthInProgress() {
  const data = await chrome.storage.local.get([
    OAUTH_CONFIG.STORAGE_FLAGS.IN_PROGRESS,
    OAUTH_CONFIG.STORAGE_FLAGS.START_TIME,
  ]);

  const inProgress = data[OAUTH_CONFIG.STORAGE_FLAGS.IN_PROGRESS];
  const startTime = data[OAUTH_CONFIG.STORAGE_FLAGS.START_TIME];

  // OAuth is stale if older than 10 minutes
  const STALE_TIMEOUT = 10 * 60 * 1000;
  const isStale = startTime && Date.now() - startTime > STALE_TIMEOUT;

  if (isStale) {
    console.warn("⚠️ Stale OAuth attempt detected, cleaning up...");
    await clearOAuthFlags();
    return false;
  }

  return Boolean(inProgress);
}

export async function cleanupOAuthStorage() {
  console.log("🧹 Cleaning up OAuth storage...");
  await chrome.storage.local.remove([
    OAUTH_CONFIG.STORAGE_FLAGS.IN_PROGRESS,
    OAUTH_CONFIG.STORAGE_FLAGS.START_TIME,
    OAUTH_CONFIG.STORAGE_FLAGS.CALLBACK,
    OAUTH_CONFIG.STORAGE_FLAGS.TIMESTAMP,
  ]);
  console.log("✅ OAuth storage cleaned");
}
