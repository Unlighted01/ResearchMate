import React from "react";
import { motion } from "motion/react";
import { Moon, Sun, Monitor } from "lucide-react";

interface AnimatedToggleProps {
  value: "light" | "dark" | "system";
  onChange: (value: "light" | "dark" | "system") => void;
}

export const AnimatedToggle: React.FC<AnimatedToggleProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-full flex relative shadow-inner border border-black/5 dark:border-white/5">
      {/* Background slider */}
      <motion.div
        className="absolute top-1 bottom-1 bg-white dark:bg-gray-700 rounded-full shadow-sm z-0"
        layoutId="theme-slider"
        initial={false}
        animate={{
          left:
            value === "light" ? "4px" : value === "dark" ? "33.33%" : "66.66%",
          width: "calc(33.33% - 8px)", // Adjust width calculation
          x: value === "light" ? 0 : value === "dark" ? 4 : 4, // Slight offset for centering
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
      />

      {(["light", "dark", "system"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`flex-1 relative z-10 py-2 rounded-full text-xs font-medium flex items-center justify-center gap-2 transition-colors duration-200 ${
            value === t
              ? "text-gray-900 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <span className="relative">
            {t === "light" && (
              <Sun
                size={14}
                className={
                  value === "light" ? "fill-orange-400 text-orange-400" : ""
                }
              />
            )}
            {t === "dark" && (
              <Moon
                size={14}
                className={
                  value === "dark" ? "fill-blue-400 text-blue-400" : ""
                }
              />
            )}
            {t === "system" && <Monitor size={14} />}

            {/* Glow effect for active icon */}
            {value === t && (
              <motion.div
                layoutId="icon-glow"
                className="absolute inset-0 blur-sm bg-current opacity-30"
                transition={{ duration: 0.2 }}
              />
            )}
          </span>
          <span className="capitalize">{t}</span>
        </button>
      ))}
    </div>
  );
};
