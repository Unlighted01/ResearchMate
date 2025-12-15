// ============================================
// PART 1: oauth-popup.js
// ============================================

import { supabase } from "./supabase.js";

/**
 * Google OAuth using a popup window approach
 * Works more reliably than chrome.identity
 */
export async function signInWithGooglePopup() {
  try {
    console.log("🔵 Starting Google OAuth with popup method...");

    // 1. GENERATE THE CORRECT REDIRECT URL
    // This creates: https://<your-extension-id>.chromiumapp.org/
    const redirectUrl = `https://${chrome.runtime.id}.chromiumapp.org/`;
    console.log("🔗 Using Redirect URL:", redirectUrl);

    // Get OAuth URL from Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        skipBrowserRedirect: true,
        // 2. ADD THIS LINE to force redirect back to extension
        redirectTo: redirectUrl,
      },
    });

    if (error || !data?.url) {
      console.error("❌ Failed to get OAuth URL:", error);
      return { success: false, error: error || new Error("No OAuth URL") };
    }

    console.log("✅ OAuth URL obtained");

    // Create a popup window for OAuth
    const width = 500;
    const height = 600;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    const authWindow = window.open(
      data.url,
      "Google Sign In",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!authWindow) {
      return {
        success: false,
        error: new Error(
          "Popup blocked. Please allow popups for this extension."
        ),
      };
    }

    // Poll the popup URL for the OAuth callback
    return new Promise((resolve) => {
      let pollCount = 0;
      const maxPolls = 300; // 5 minutes (300 * 1000ms)

      const pollTimer = setInterval(async () => {
        pollCount++;

        try {
          // Check if window was closed
          if (authWindow.closed) {
            clearInterval(pollTimer);
            resolve({
              success: false,
              error: new Error("OAuth window was closed"),
            });
            return;
          }

          // Try to read the URL (will fail due to CORS until redirect)
          let currentUrl;
          try {
            currentUrl = authWindow.location.href;
          } catch (e) {
            // CORS error - still on OAuth provider domain
            if (pollCount >= maxPolls) {
              clearInterval(pollTimer);
              authWindow.close();
              resolve({
                success: false,
                error: new Error("OAuth timeout"),
              });
            }
            return;
          }

          // If we can read the URL and it has tokens, we're done!
          if (
            currentUrl &&
            (currentUrl.includes("access_token") || currentUrl.includes("#"))
          ) {
            clearInterval(pollTimer);
            console.log("🔑 OAuth callback detected");

            try {
              const url = new URL(currentUrl);
              const hashParams = new URLSearchParams(url.hash.substring(1));
              const accessToken = hashParams.get("access_token");
              const refreshToken = hashParams.get("refresh_token");

              if (!accessToken || !refreshToken) {
                throw new Error("Missing tokens in OAuth response");
              }

              // Set the session
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (sessionError) {
                throw sessionError;
              }

              authWindow.close();
              console.log("✅ Google OAuth successful!");
              resolve({ success: true, error: null });
            } catch (err) {
              console.error("❌ Error processing OAuth:", err);
              authWindow.close();
              resolve({ success: false, error: err });
            }
          }
        } catch (err) {
          // Unexpected error
          clearInterval(pollTimer);
          authWindow.close();
          resolve({ success: false, error: err });
        }
      }, 1000); // Poll every second
    });
  } catch (error) {
    console.error("❌ OAuth exception:", error);
    return { success: false, error };
  }
}
