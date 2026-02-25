import {
  createClient,
  SupabaseClient,
  User,
  Session,
  AuthChangeEvent,
} from "@supabase/supabase-js";

// Extension doesn't have process.env available in the same way, but Vite handles import.meta.env
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase credentials missing. Auth will fail.");
}

// Custom storage adapter for Chrome Extension
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

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || "",
  SUPABASE_ANON_KEY || "",
  {
    auth: {
      storage: chromeStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Extensions don't use URL for session
    },
  },
);

// Types
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

// Auth Functions

// Auth Functions

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

export async function getSession(): Promise<SessionResult> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  return { session, error };
}

export async function isAuthenticated(): Promise<boolean> {
  // Force the Supabase client to wake up and retrieve the session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) return true;

  // Fallback: If Supabase auth state hasn't initialized yet in the Background Worker context,
  // manually check our adapter's backing store to see if a token exists.
  // Supabase prefixes keys with sb-[project-id]-auth-token.
  const allData = await new Promise<{ [key: string]: any }>((resolve) => {
    chrome.storage.local.get(null, (result) => resolve(result));
  });

  const authKey = Object.keys(allData).find(
    (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
  );

  if (authKey && allData[authKey]) {
    try {
      // The custom storage adapter stringifies data, but if it's already an object, use it directly
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

export async function signInWithGoogle() {
  try {
    const redirectUrl = chrome.identity.getRedirectURL();
    console.log("Redirect URL:", redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) throw new Error("No auth URL returned");

    // Launch the auth flow via Chrome Identity API
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

    // Parse session from URL (Supabase returns tokens in the hash)
    const url = new URL(authResponse);
    const params = new URLSearchParams(url.hash.substring(1)); // Remove the #
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      throw new Error("No tokens found in redirect URL");
    }

    // Set the session manually
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

export async function signOut() {
  return await supabase.auth.signOut();
}

export default {
  supabase,
  getCurrentUser,
  getSession,
  isAuthenticated,
  signInWithGoogle,
  signOut,
};
