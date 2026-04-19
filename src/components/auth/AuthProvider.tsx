import { useState, useEffect } from "react";
import {
  supabase,
  signInWithGoogle,
  signOut,
  getCurrentUser,
} from "../../services/supabaseClient";
import { User } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
      // Sync local items to cloud on initial load if user is logged in
      if (u) {
        import("../../services/storageService").then(
          ({ syncLocalItemsToCloud }) => {
            syncLocalItemsToCloud();
          },
        );
      }
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    await signInWithGoogle();
  };

  const handleLogout = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-apple w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-apple-blue to-purple-600 bg-clip-text text-transparent mb-2">
            ResearchMate
          </h1>
          <p className="text-gray-500 mb-8">
            Your AI-powered research companion
          </p>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all hover:shadow-md"
          >
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google"
              className="w-5 h-5"
            />
            Sign in with Google
          </button>
          <p className="mt-4 text-xs text-gray-400">
            Sign in to sync your research across devices.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-semibold text-gray-900">My Research</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white shadow-sm"
            title={user.email}
          >
            {user.email?.[0].toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
