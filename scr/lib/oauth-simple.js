// oauth-simple.js - Working OAuth for extensions
import { supabase } from "./supabase.js";

export async function signInWithGoogle() {
  try {
    console.log("🔵 Starting Google OAuth...");

    // Get OAuth URL from Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        skipBrowserRedirect: true,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error || !data?.url) {
      console.error("❌ OAuth error:", error);
      return { success: false, error: error || new Error("No OAuth URL") };
    }

    console.log("✅ OAuth URL obtained");
    console.log("🚀 Opening OAuth tab...");

    // Open OAuth in new tab
    const authTab = await chrome.tabs.create({ url: data.url });

    // Wait for OAuth to complete
    return new Promise((resolve) => {
      let pollTimer;
      let timeoutTimer;

      const cleanup = () => {
        if (pollTimer) clearInterval(pollTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
      };

      // Poll storage for OAuth callback
      pollTimer = setInterval(async () => {
        const { oauthCallback, oauthTimestamp } =
          await chrome.storage.local.get(["oauthCallback", "oauthTimestamp"]);

        if (oauthCallback && Date.now() - (oauthTimestamp || 0) < 60000) {
          console.log("✅ OAuth callback found in storage!");
          cleanup();

          // Try to close the auth tab
          chrome.tabs.remove(authTab.id).catch(() => {});

          resolve({ success: true, error: null });
        }
      }, 500);

      // Timeout after 5 minutes
      timeoutTimer = setTimeout(() => {
        cleanup();
        chrome.tabs.remove(authTab.id).catch(() => {});
        resolve({ success: false, error: new Error("OAuth timeout") });
      }, 300000);
    });
  } catch (error) {
    console.error("❌ Exception:", error);
    return { success: false, error };
  }
}
