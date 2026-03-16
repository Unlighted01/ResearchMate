import { useEffect, useRef, useState } from "react";
import { X, Plus, Folder, Loader2 } from "lucide-react";
import { Collection } from "../types";
import { getCollections, createCollection, addItemsToCollection } from "../services/collectionService";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface CollectionSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItemIds: string[];
  onComplete: () => void;
}

export function CollectionSelector({ isOpen, onClose, selectedItemIds, onComplete }: CollectionSelectorProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, isOpen, onClose);
  
  // Create New State
  const [isCreating, setIsCreating] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [creatingLoading, setCreatingLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCollections();
    }
  }, [isOpen]);

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

  const handleCreate = async () => {
    if (!newColName.trim()) return;
    setCreatingLoading(true);
    try {
      const newCol = await createCollection({ name: newColName, color: "#4F46E5" }); // Default Indigo color
      if (newCol) {
        setCollections([newCol, ...collections]);
        setNewColName("");
        setIsCreating(false);
        // Automatically add items to this new collection
        await handleSelectCollection(newCol.id);
      }
    } catch (err) {
      console.error("Failed to create collection", err);
    } finally {
      setCreatingLoading(false);
    }
  };

  const handleSelectCollection = async (collectionId: string) => {
    setSaving(true);
    try {
      await addItemsToCollection(selectedItemIds, collectionId);
      onComplete(); // Triggers a list refresh & closes modal
    } catch (err) {
      console.error("Failed to add to collection", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animation-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-selector-title"
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-[320px] shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[80vh] overflow-hidden transform transition-all scale-100"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 id="collection-selector-title" className="font-bold text-gray-900 dark:text-white">Save to Collection</h3>
          <button aria-label="Close" onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-2 scrollbar-hide flex-1">
          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-1">
              {/* Create New Inline Form */}
              {isCreating ? (
                <div className="p-2 mb-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Collection Name"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm mb-2 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => { setIsCreating(false); setNewColName(""); }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleCreate}
                      disabled={!newColName.trim() || creatingLoading}
                      className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-xs font-medium disabled:opacity-50"
                    >
                      {creatingLoading ? "Creating..." : "Create"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center gap-3 p-3 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-blue-500 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                    <Plus size={16} />
                  </div>
                  <span className="font-medium text-sm">New Collection</span>
                </button>
              )}

              {/* List Collections */}
              {collections.map((col) => (
                <button
                  key={col.id}
                  onClick={() => handleSelectCollection(col.id)}
                  disabled={saving}
                  className="w-full flex items-center gap-3 p-3 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${col.color || '#4F46E5'}15`, color: col.color || '#4F46E5' }}
                  >
                    <Folder size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{col.name}</div>
                    <div className="text-xs text-gray-500 truncate">{col.item_count || 0} items</div>
                  </div>
                </button>
              ))}
              
              {collections.length === 0 && !isCreating && !loading && (
                <div className="text-center py-6 text-sm text-gray-500">
                  No collections yet. Create one!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
