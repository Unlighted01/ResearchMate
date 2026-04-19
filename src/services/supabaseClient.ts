// ============================================
// PART 1: IMPORTS & DEPENDENCIES
// ============================================

import {
  createClient,
  SupabaseClient,
  User,
  Session,
  AuthChangeEvent,
} from "@supabase/supabase-js";

// ============================================
// PART 2: CONFIGURATION & CONSTANTS
// ============================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase credentials missing. Auth will fail.");
}

/**
 * Custom storage adapter for Chrome Extension
 * Ensures auth persists in chrome.storage.local
 */
const chromeStorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || null);
      });
    });
  },
  setItem: (key: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  },
  removeItem: (key: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, () => {
        resolve();
      });
    });
  },
};

// ============================================
// PART 3: TYPE DEFINITIONS
// ============================================

export interface AuthResult {
  user: User | null;
  error: Error | null;
}

export interface SessionResult {
  session: Session | null;
  error: Error | null;
}

export type AuthEventCallback = (
  event: AuthChangeEvent,
  session: Session | null,
) => void;

// ============================================
// PART 4: SUPABASE CLIENT INITIALIZATION
// ============================================

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || "",
  SUPABASE_ANON_KEY || "",
  {
    auth: {
      storage: chromeStorageAdapter,
      storageKey: "researchmate-auth",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Extensions don't use URL for session
    },
  },
);

// ============================================
// PART 5: USER AUTHENTICATION FUNCTIONS
// ============================================

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  // Ignore session missing error as it's expected when not logged in
  if (error && !error.message.includes("Auth session missing")) {
    console.error("Error getting user:", error);
  }
  return user;
}

/**
 * Get the current session
 */
export async function getSession(): Promise<SessionResult> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  return { session, error: error as Error | null };
}

/**
 * Check if user is currently authenticated
 * Includes fallback logic to wake up session from storage
 */
export async function isAuthenticated(): Promise<boolean> {
  // Force the Supabase client to wake up and retrieve the session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) return true;

  // Fallback: If Supabase auth state hasn't initialized yet, manually check storage
  const allData = await new Promise<{ [key: string]: any }>((resolve) => {
    chrome.storage.local.get(null, (result) => resolve(result));
  });

  const authKey = Object.keys(allData).find(
    (key) => key === "researchmate-auth" || (key.startsWith("sb-") && key.endsWith("-auth-token"))
  );

  if (authKey && allData[authKey]) {
    try {
      const sessionData = typeof allData[authKey] === "string"
        ? JSON.parse(allData[authKey])
        : allData[authKey];

      if (sessionData && sessionData.access_token) {
        await supabase.auth.setSession({
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
        });
        return true;
      }
    } catch (e) {
      console.error("Failed to parse chrome auth token", e);
    }
  }

  return false;
}

// ============================================
// PART 6: EMAIL AUTHENTICATION
// ============================================

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });
    return { user: data.user, error: error as Error | null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        // Extensions usually redirect back via Identity API, but for simple email verification
        // we point them to the website
        emailRedirectTo: `https://research-mate-website.vercel.app/auth/callback`,
      },
    });
    return { user: data.user, error: error as Error | null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

// ============================================
// PART 7: OAUTH AUTHENTICATION
// ============================================

/**
 * Sign in with Google using Chrome Identity API
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  try {
    const redirectUrl = chrome.identity.getRedirectURL();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) throw new Error("No auth URL returned");

    const authResponse = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: data.url,
          interactive: true,
        },
        (responseUrl) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (responseUrl) {
            resolve(responseUrl);
          } else {
            reject(new Error("Auth flow failed"));
          }
        },
      );
    });

    const url = new URL(authResponse);
    const params = new URLSearchParams(url.hash.substring(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      throw new Error("No tokens found in redirect URL");
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (sessionError) throw sessionError;
    return { error: null };
  } catch (error: any) {
    console.error("Google Sign-In Error:", error);
    return { error };
  }
}

// ============================================
// PART 8: SIGN OUT
// ============================================

export async function signOut() {
  return await supabase.auth.signOut();
}

// ============================================
// PART 9: AUTH STATE LISTENER
// ============================================

export function onAuthStateChange(callback: AuthEventCallback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return subscription;
}

// ============================================
// PART 10: EXPORTS
// ============================================

export default {
  supabase,
  getCurrentUser,
  getSession,
  isAuthenticated,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOut,
  onAuthStateChange,
};
