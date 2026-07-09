import React from "react";
import { Search, Folder, X } from "lucide-react";

interface SidePanelSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  activeCollection: { id: string; name: string } | null;
  onClearCollection: () => void;
}

export const SidePanelSearch: React.FC<SidePanelSearchProps> = ({
  query,
  onQueryChange,
  activeCollection,
  onClearCollection,
}) => {
  return (
    <div className="space-y-2 mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search your research..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="theme-search w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-xl text-sm focus:ring-2 focus:ring-apple-blue dark:text-white outline-none"
        />
      </div>
      {/* Active collection filter chip */}
      {activeCollection && (
        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium px-2.5 py-1.5 rounded-lg w-fit">
          <Folder className="w-3 h-3" />
          <span>{activeCollection.name}</span>
          <button
            onClick={onClearCollection}
            aria-label="Clear collection filter"
            className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
            title="Clear collection filter"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
