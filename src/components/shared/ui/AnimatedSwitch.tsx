import React from "react";
import { motion } from "motion/react";

interface AnimatedSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string; // Accessible label
}

export const AnimatedSwitch: React.FC<AnimatedSwitchProps> = ({
  checked,
  onChange,
  label,
}) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-label={label || "Toggle"}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-apple-blue ${
        checked ? "bg-apple-blue" : "bg-gray-200 dark:bg-gray-700"
      }`}
    >
      <span className="sr-only">{label}</span>
      <motion.span
        layout
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
        animate={{
          x: checked ? 22 : 2, // 44px width - 20px knob - 2px padding = 22px move
        }}
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm pointer-events-none"
      />
    </button>
  );
};
