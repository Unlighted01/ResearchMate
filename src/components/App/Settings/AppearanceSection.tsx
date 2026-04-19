import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { SegmentedControl } from "../../shared/ui/SegmentedControl";

interface AppearanceSectionProps {
  theme: string;
  onThemeChange: (theme: string) => void;
  visualTheme: string;
  onVisualThemeChange: (theme: string) => void;
}

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  theme,
  onThemeChange,
  visualTheme,
  onVisualThemeChange,
}) => {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Appearance</h2>
      <SegmentedControl
        name="theme"
        value={theme as "light" | "dark" | "system"}
        onChange={onThemeChange}
        options={[
          {
            value: "light",
            label: "Light",
            icon: <Sun size={14} />,
            activeIcon: <Sun size={14} className="text-orange-500 fill-orange-500" />,
          },
          {
            value: "dark",
            label: "Dark",
            icon: <Moon size={14} />,
            activeIcon: <Moon size={14} className="text-blue-400 fill-blue-400" />,
          },
          {
            value: "system",
            label: "System",
            icon: <Monitor size={14} />,
            activeIcon: <Monitor size={14} className="text-purple-500" />,
          },
        ]}
      />
      <div className="mt-4 space-y-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Visual Theme</label>
        <select 
          value={visualTheme} 
          onChange={(e) => onVisualThemeChange(e.target.value)}
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        >
          <option value="minimalist">Minimalist (Default)</option>
          <option value="bubble">Bubble</option>
          <option value="glass">Glass</option>
        </select>
        <p className="text-[10px] text-gray-400 mt-1">Applies globally to the extension UI.</p>
      </div>
    </section>
  );
};
