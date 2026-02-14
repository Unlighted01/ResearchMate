import React, { useEffect } from "react";
import { motion } from "motion/react";
import logo from "../assets/logo.svg";

interface WelcomeProps {
  onComplete: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2800); // Slightly longer than animation to allow for smooth exit
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-gray-900"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      <div className="relative flex flex-col items-center">
        {/* Logo */}
        <motion.div
          className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-2xl mb-6 relative overflow-hidden"
          initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{
            duration: 0.8,
            type: "spring",
            stiffness: 200,
            damping: 20,
          }}
        >
          <img
            src={logo}
            alt="ResearchMate Logo"
            className="w-16 h-16 object-contain"
          />
        </motion.div>

        {/* Text Animation */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
            ResearchMate
          </h1>
          <motion.p
            className="text-gray-500 dark:text-gray-400 text-sm font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            Your AI Research Companion
          </motion.p>
        </motion.div>

        {/* Loading Indicator (Optional, adds to "app loading" feel) */}
        <motion.div
          className="absolute bottom-[-60px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-apple-blue/50"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
