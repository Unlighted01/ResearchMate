/**
 * ResearchMate True SSO Bridge
 * 
 * This script runs strictly on the research-mate-website.vercel.app domain.
 * it extracts the Supabase auth token from the website's localStorage and
 * securely beams it to the extension's background script.
 */

(function() {
  console.log("ResearchMate Auth Sync Script Loaded");

  const syncAuth = () => {
    // Look for Supabase auth token in localStorage
    // Key is 'researchmate-auth' as configured in Website supabaseClient.ts
    let found = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === 'researchmate-auth' || (key && key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        const tokenData = localStorage.getItem(key);
        if (tokenData) {
          try {
            const parsed = JSON.parse(tokenData);
            if (parsed && parsed.access_token) {
              console.log("Found auth token, syncing to extension...");
              chrome.runtime.sendMessage({
                action: "AUTH_SYNC",
                payload: {
                  key: key,
                  data: tokenData
                }
              });
              found = true;
            }
          } catch (e) {
            console.error("Error parsing auth token", e);
          }
        }
      }
    }

    if (!found) {
      // If no token found but we previously had one, we could notify background to logout
      // For now, background just listens for updates
    }
  };

  // Run on initial load
  syncAuth();

  // Listen for storage changes (e.g. user logging in/out on the website tab)
  window.addEventListener('storage', (e) => {
    if (e.key === 'researchmate-auth' || (e.key && e.key.startsWith('sb-') && e.key.endsWith('-auth-token'))) {
       syncAuth();
    }
  });

  // Also listen for potential manual broadcast events if the website wants to trigger sync
  window.addEventListener('message', (event) => {
    const allowedOrigin = import.meta.env.VITE_WEBSITE_URL || "https://research-mate-website.vercel.app";
    if (event.origin !== allowedOrigin) return;

    if (event.data && event.data.type === 'RESEARCH_MATE_FORCE_SYNC') {
      syncAuth();
    }
  });
})();
