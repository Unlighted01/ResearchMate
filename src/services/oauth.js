// oauth.js - Chrome extension OAuth handler
import { supabase } from "./supabase.js";

/**
 * Get the extension's OAuth redirect URL
 */
function getRedirectURL() {
  // Chrome extensions use this format for chrome.identity
  return `https://${chrome.runtime.id}.chromiumapp.org/`;
}

/**
 * Handle Google OAuth using chrome.identity API
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function signInWithGoogleExtension() {
  try {
    console.log("🔵 Starting Google OAuth with chrome.identity...");

    const redirectURL = getRedirectURL();
    console.log("🔗 Redirect URL:", redirectURL);

    // Get the OAuth URL from Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectURL, // Use the chromiumapp.org URL
        skipBrowserRedirect: true,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error || !data?.url) {
      console.error("❌ Failed to get OAuth URL:", error);
      return { success: false, error: error || new Error("No OAuth URL") };
    }

    console.log("🔗 OAuth URL obtained:", data.url);

    // Use chrome.identity to handle the OAuth flow
    return new Promise((resolve) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: data.url,
          interactive: true,
        },
        async (redirectUrl) => {
          // Check for errors first
          if (chrome.runtime.lastError) {
            console.error("❌ OAuth flow error:", chrome.runtime.lastError);
            resolve({
              success: false,
              error: new Error(chrome.runtime.lastError.message),
            });
            return;
          }

          if (!redirectUrl) {
            console.error("❌ No redirect URL received");
            resolve({
              success: false,
              error: new Error("OAuth cancelled or failed"),
            });
            return;
          }

          console.log("✅ OAuth redirect received:", redirectUrl);

          // Extract tokens from the redirect URL
          try {
            const url = new URL(redirectUrl);

            // Tokens can be in hash or query params
            let hashParams = new URLSearchParams(url.hash.substring(1));

            // If not in hash, try query params
            if (!hashParams.get("access_token")) {
              hashParams = new URLSearchParams(url.search.substring(1));
            }

            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");

            console.log("🔑 Access token found:", !!accessToken);
            console.log("🔑 Refresh token found:", !!refreshToken);

            if (!accessToken || !refreshToken) {
              throw new Error("Missing tokens in OAuth response");
            }

            // Set the session in Supabase
            const { data: sessionData, error: sessionError } =
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

            if (sessionError) {
              console.error("❌ Failed to set session:", sessionError);
              resolve({ success: false, error: sessionError });
              return;
            }

            console.log("✅ Google sign-in successful!", sessionData.user?.id);
            resolve({ success: true, error: null });
          } catch (err) {
            console.error("❌ Error processing OAuth response:", err);
            resolve({ success: false, error: err });
          }
        }
      );
    });
  } catch (error) {
    console.error("❌ OAuth exception:", error);
    return { success: false, error };
  }
}
