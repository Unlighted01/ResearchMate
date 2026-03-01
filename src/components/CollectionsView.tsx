import { useEffect, useState } from "react";
import { Collection } from "../types";
import { getCollections } from "../services/collectionService";
import { Folder, MoreVertical, LayoutGrid, List } from "lucide-react";
import { motion } from "motion/react";

interface CollectionsViewProps {
  onCollectionClick: (collectionId: string) => void;
  isGuest: boolean;
}

export function CollectionsView({ onCollectionClick, isGuest }: CollectionsViewProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    if (!isGuest) {
      loadCollections();
    } else {
      setLoading(false);
    }
  }, [isGuest]);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const data = await getCollections();
      setCollections(data);
    } catch (err) {
      console.error("Failed to fetch collections", err);
    } finally {
      setLoading(false);
    }
  };

  if (isGuest) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
        <Folder className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Sign in to use Collections</h3>
        <p className="text-sm">Collections are automatically synced across all your devices using your ResearchMate account.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="px-4 py-2 flex justify-between items-center text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
        <span className="text-xs font-semibold uppercase tracking-wider">{collections.length} Collections</span>
        <div className="flex gap-1 bg-gray-200/50 dark:bg-gray-800 p-1 rounded-lg">
          <button 
            title="Grid View"
            onClick={() => setViewMode("grid")}
            className={`p-1 rounded ${viewMode === "grid" ? "bg-white dark:bg-gray-700 shadow-sm text-blue-500" : "hover:text-gray-700 dark:hover:text-gray-200"}`}
          >
            <LayoutGrid size={14} />
          </button>
          <button 
            title="List View"
            onClick={() => setViewMode("list")}
            className={`p-1 rounded ${viewMode === "list" ? "bg-white dark:bg-gray-700 shadow-sm text-blue-500" : "hover:text-gray-700 dark:hover:text-gray-200"}`}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm animate-pulse">
            Loading collections...
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-4">
              <Folder className="w-8 h-8 text-blue-300 dark:text-blue-700" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No collections yet</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Select items in your feed to start grouping them.</p>
          </div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="show"
            className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.05 } }
            }}
          >
            {collections.map((col) => (
              <motion.div
                key={col.id}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                onClick={() => onCollectionClick(col.id)}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-gray-100 dark:border-gray-700/50 cursor-pointer group hover:-translate-y-0.5 transition-all
                  ${viewMode === "grid" ? "p-4 aspect-square flex flex-col justify-between" : "p-3 flex items-center gap-3"}
                `}
              >
                {viewMode === "grid" ? (
                  <>
                    <div className="flex justify-between items-start">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${col.color || '#4F46E5'}15`, color: col.color || '#4F46E5' }}
                      >
                        <Folder size={20} />
                      </div>
                      <button title="More Options" className="p-1 text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 leading-tight mb-1">{col.name}</h3>
                      <p className="text-xs text-gray-500 font-medium">{col.item_count || 0} items</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${col.color || '#4F46E5'}15`, color: col.color || '#4F46E5' }}
                    >
                      <Folder size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{col.name}</h3>
                      <p className="text-xs text-gray-500 font-medium">{col.item_count || 0} items</p>
                    </div>
                    <button title="More Options" className="p-2 text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical size={16} />
                    </button>
                  </>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
