import React from "react";
import { motion } from "motion/react";

export const SkeletonCard: React.FC = () => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 8 },
      show: { opacity: 1, y: 0 },
    }}
    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
    aria-hidden="true"
  >
    <div className="flex justify-between items-center mb-3">
      <div className="h-2.5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      <div className="h-2.5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
    </div>
    <div className="space-y-2 mb-4">
      <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      <div className="h-3 w-5/6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
    </div>
    <div className="flex gap-2">
      <div className="h-4 w-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      <div className="h-4 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
    </div>
  </motion.div>
);
