import React, { useState } from "react";
import { signInWithGoogle } from "../services/supabaseClient";
import { LogIn, Loader2, AlertCircle } from "lucide-react";

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      // Success is handled by auth state listener in parent/context
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 text-center">
      <div className="mb-6 flex justify-center">
        <div className="w-12 h-12 bg-apple-blue/10 rounded-full flex items-center justify-center text-apple-blue">
          <LogIn size={24} />
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Welcome Back
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Sign in to sync your research across devices and access AI features.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-lg flex items-center gap-2 text-left">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full py-2.5 bg-apple-blue hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google"
              className="w-4 h-4 bg-white rounded-full"
            />
            Sign in with Google
          </>
        )}
      </button>

      <p className="mt-4 text-xs text-gray-400">
        By signing in using your extension, you agree to ResearchMate's terms of
        service.
      </p>
    </div>
  );
};
