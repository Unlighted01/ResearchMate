import React from "react";
import { motion } from "motion/react";
import { ViewType } from "./useSidePanelData";

interface SidePanelNavProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  onSelectionReset: () => void;
}

export const SidePanelNav: React.FC<SidePanelNavProps> = ({
  activeView,
  onNavigate,
  onSelectionReset,
}) => {
  const tabs: { id: ViewType; label: string }[] = [
    { id: "list", label: "Items" },
    { id: "collections", label: "Collections" },
    { id: "notepad", label: "Notepad" },
    { id: "chat", label: "Chat" },
  ];

  return (
    <div className="flex gap-4 border-b border-gray-100 dark:border-gray-800 mb-3 px-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            onNavigate(tab.id);
            onSelectionReset();
          }}
          className={`pb-3 text-sm font-semibold transition-colors relative ${
            activeView === tab.id
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          {tab.label}
          {activeView === tab.id && (
            <motion.div
              layoutId="nav-pill"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"
            />
          )}
        </button>
      ))}
    </div>
  );
};
