import React from "react";
import logo from "../../../assets/logo.svg";
import { RefreshCw, PenTool } from "lucide-react";
import { GearIcon } from "../../icons";
import { AnimatePresence, motion } from "motion/react";
import { SyncState, NavState } from "./useSidePanelData";

interface SidePanelHeaderProps {
  sync: SyncState;
  onSync: () => void;
  onNavigate: (view: NavState["view"]) => void;
}

export const SidePanelHeader: React.FC<SidePanelHeaderProps> = ({
  sync,
  onSync,
  onNavigate,
}) => {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-2">
        <img src={logo} alt="Logo" className="w-6 h-6" />
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
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

        {/* Sync Button */}
        <button
          onClick={onSync}
          aria-label="Sync to Cloud"
          className={`p-2 rounded-full transition-colors ${
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
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400"
          title="Smart Pen"
        >
          <PenTool size={20} />
        </button>
        <button
          onClick={() => onNavigate("settings")}
          aria-label="Settings"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400"
          title="Settings"
        >
          <GearIcon size={20} />
        </button>
      </div>
    </div>
  );
};
