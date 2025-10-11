// supabase.js - Complete auth system with Google OAuth
import { createClient } from "@supabase/supabase-js";

// ⚠️ REPLACE THESE WITH YOUR ACTUAL CREDENTIALS
const SUPABASE_URL = "https://jxevjkzojfbywxvtcwtl.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4ZXZqa3pvamZieXd4dnRjd3RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDc4MzEsImV4cCI6MjA3NTQ4MzgzMX0.hZL-wGTcmD9H0bsmj_jqzZ2iw1GZyJM5X14meIRKgNQ";

// Create and export Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/**
 * Get the current authenticated user
 * @returns {Promise<User|null>}
 */
export async function getCurrentUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      console.error("❌ Get user error:", error);
      return null;
    }
    return user;
  } catch (error) {
    console.error("❌ Get user exception:", error);
    return null;
  }
}

/**
 * Sign in with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: User|null, error: Error|null}>}
 */
export async function signInWithEmail(email, password) {
  try {
    console.log("🔑 Signing in with email:", email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (error) {
      console.error("❌ Sign in error:", error);
      return { user: null, error };
    }

    console.log("✅ Signed in successfully:", data.user?.id);
    return { user: data.user, error: null };
  } catch (error) {
    console.error("❌ Sign in exception:", error);
    return { user: null, error };
  }
}

/**
 * Sign up with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: User|null, error: Error|null}>}
 */
export async function signUpWithEmail(email, password) {
  try {
    console.log("📝 Signing up with email:", email);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        emailRedirectTo: chrome.runtime.getURL("scr/UI/popup/popup.html"),
      },
    });

    if (error) {
      console.error("❌ Sign up error:", error);
      return { user: null, error };
    }

    console.log("✅ Sign up successful:", data.user?.id);
    return { user: data.user, error: null };
  } catch (error) {
    console.error("❌ Sign up exception:", error);
    return { user: null, error };
  }
}

/**
 * Sign out the current user
 * @returns {Promise<{error: Error|null}>}
 */
export async function signOut() {
  try {
    console.log("🚪 Signing out...");

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("❌ Sign out error:", error);
      return { error };
    }

    console.log("✅ Signed out successfully");
    return { error: null };
  } catch (error) {
    console.error("❌ Sign out exception:", error);
    return { error };
  }
}

/**
 * Listen to auth state changes
 * @param {Function} callback - Called with (event, session)
 */
export function onAuthStateChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    console.log(
      "🔄 Auth state changed:",
      event,
      "User:",
      session?.user?.id || "none"
    );
    callback(event, session);
  });

  return subscription;
}

/**
 * Process OAuth callback (called from popup after OAuth redirect)
 * @param {string} hashFragment - The URL hash containing tokens
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function processOAuthCallback(hashFragment) {
  try {
    console.log("🔑 Processing OAuth callback...");

    // Extract tokens from hash fragment
    const hashParams = new URLSearchParams(hashFragment.substring(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (!accessToken || !refreshToken) {
      throw new Error("Missing tokens in OAuth callback");
    }

    // Set the session in Supabase
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error("❌ Failed to set OAuth session:", error);
      return { success: false, error };
    }

    console.log("✅ OAuth session established:", data.user?.id);
    return { success: true, error: null };
  } catch (error) {
    console.error("❌ OAuth callback processing failed:", error);
    return { success: false, error };
  }
}
