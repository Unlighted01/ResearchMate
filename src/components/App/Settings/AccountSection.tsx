import React from "react";
import { LogOut, Coins, AlertCircle } from "lucide-react";

interface AccountSectionProps {
  user: any;
  credits: number | string;
  onSignOut: () => void;
  onGoToAuth: () => void;
}

export const AccountSection: React.FC<AccountSectionProps> = ({
  user,
  credits,
  onSignOut,
  onGoToAuth,
}) => {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Account</h2>
      {user ? (
        <div className="theme-surface bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold overflow-hidden">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt={user.email} className="w-full h-full object-cover" />
              ) : (
                user.email?.[0].toUpperCase()
              )}
            </div>
            <div className="overflow-hidden">
              <p className="font-medium text-gray-900 dark:text-white truncate">{user.email}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Coins size={12} className="text-yellow-500" />
                <span>{credits} Credits</span>
              </div>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="theme-btn-secondary w-full py-2 flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      ) : (
        <div className="theme-surface bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 text-center flex flex-col items-center">
          <AlertCircle size={24} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 mb-3">Sign in to sync your research across devices</p>
          <button onClick={onGoToAuth} className="text-blue-600 font-semibold text-sm hover:underline">
            Sign In Now
          </button>
        </div>
      )}
    </section>
  );
};
