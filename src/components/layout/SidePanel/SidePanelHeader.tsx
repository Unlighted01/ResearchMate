import React, { useEffect, useState } from "react";
import logo from "../../../assets/logo.svg";
import { RefreshCw, PenTool, Zap } from "lucide-react";
import { GearIcon } from "../../icons";
import { AnimatePresence, motion } from "motion/react";
import { SyncState, NavState } from "./useSidePanelData";
import { supabase } from "../../../services/supabaseClient";

interface SidePanelHeaderProps {
  sync: SyncState;
  onSync: () => void;
  onNavigate: (view: NavState["view"]) => void;
  /** Optional: invalidate credits after an AI operation by incrementing this. */
  creditsBuster?: number;
}

export const SidePanelHeader: React.FC<SidePanelHeaderProps> = ({
  sync,
  onSync,
  onNavigate,
  creditsBuster = 0,
}) => {
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchCredits = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setCredits(null); return; }
        const { data } = await supabase
          .from("profiles")
          .select("ai_credits")
          .eq("id", session.user.id)
          .single();
        if (!cancelled && data) setCredits(data.ai_credits ?? 0);
      } catch { /* silent — badge is non-critical */ }
    };
    fetchCredits();
    return () => { cancelled = true; };
  }, [creditsBuster]);

  return (
    <div className="theme-headerbar theme-divider flex justify-between items-center mb-4">
      <div className="flex items-center gap-2">
        <img src={logo} alt="Logo" className="w-6 h-6" />
        <h1 className="theme-title text-lg font-bold text-gray-900 dark:text-white">
          ResearchMate
        </h1>
      </div>

      <div className="flex gap-2 items-center">
        {/* Status Message */}
        <div aria-live="polite" aria-atomic="true" className="contents">
          <AnimatePresence>
            {sync.status && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`text-[10px] px-2 py-1 rounded-md font-medium whitespace-nowrap ${
                  sync.status.type === "success"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {sync.status.msg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Credits Badge */}
        <AnimatePresence>
          {credits !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              title={`${credits} AI credits remaining`}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                credits === 0
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                  : credits <= 10
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
              }`}
            >
              <Zap size={9} />
              {credits}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sync Button */}
        <button
          onClick={onSync}
          aria-label="Sync to Cloud"
          className={`theme-icon-button p-2 rounded-full transition-colors ${
            sync.running
              ? "text-blue-500 bg-blue-50 animate-spin"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
          title="Sync to Cloud"
        >
          <RefreshCw size={20} />
        </button>

        <button
          onClick={() => onNavigate("smartpen")}
          aria-label="Smart Pen"
          className="theme-icon-button p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400"
          title="Smart Pen"
        >
          <PenTool size={20} />
        </button>
        <button
          onClick={() => onNavigate("settings")}
          aria-label="Settings"
          className="theme-icon-button p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400"
          title="Settings"
        >
          <GearIcon size={20} />
        </button>
      </div>
    </div>
  );
};
