import React from "react";
import { motion } from "motion/react";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  activeIcon?: React.ReactNode; // Optional different icon/style for active state
}

interface SegmentedControlProps<T extends string> {
  name: string; // Required for unique layoutId
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export const SegmentedControl = <T extends string>({
  name,
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>) => {
  return (
    <div
      className={`bg-gray-100 dark:bg-gray-800 p-1 rounded-full flex relative shadow-inner border border-black/5 dark:border-white/5 ${className}`}
    >
      {/* Re-implementing with layoutId on the active item for perfect alignment without math */}
      {/* 
          Actually, rendering the shared layout background *behind* the text is tricky if it's a child.
          It usually needs `layoutId` and to be absolutely positioned behind.
       */}

      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 relative z-10 py-1.5 rounded-full text-xs font-medium flex items-center justify-center gap-2 transition-colors duration-200 ${
              isActive
                ? "text-gray-900 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={`segment-bg-${name}`}
                className="absolute inset-0 bg-white dark:bg-gray-700 rounded-full shadow-sm -z-10"
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                }}
              />
            )}

            <span className="relative flex items-center gap-1.5 z-20">
              {isActive && option.activeIcon ? option.activeIcon : option.icon}
              <span className="capitalize">{option.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
