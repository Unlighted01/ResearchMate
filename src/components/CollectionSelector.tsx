import { useEffect, useRef, useState } from "react";
import { X, Plus, Folder, Loader2 } from "lucide-react";
import { Collection } from "../types";
import { getCollections, createCollection, addItemsToCollection } from "../services/collectionService";
import { useFocusTrap } from "../hooks/useFocusTrap";

const PRESET_COLORS = [
  { label: "Indigo", value: "#4F46E5" },
  { label: "Blue",   value: "#3B82F6" },
  { label: "Green",  value: "#10B981" },
  { label: "Yellow", value: "#F59E0B" },
  { label: "Red",    value: "#EF4444" },
  { label: "Purple", value: "#8B5CF6" },
  { label: "Pink",   value: "#EC4899" },
  { label: "Gray",   value: "#6B7280" },
];

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

  // Create new state
  const [isCreating, setIsCreating] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState(PRESET_COLORS[0].value);
  const [creatingLoading, setCreatingLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setIsCreating(false);
      setNewColName("");
      setNewColColor(PRESET_COLORS[0].value);
      setCreateError("");
      loadCollections();
    }
  }, [isOpen]);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const data = await getCollections();
      setCollections(data);
      // Auto-open create form when there are no collections yet
      if (data.length === 0) setIsCreating(true);
    } catch (err) {
      console.error("Failed to fetch collections", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = newColName.trim();
    if (!name) { setCreateError("Name is required."); return; }
    setCreatingLoading(true);
    setCreateError("");
    try {
      const newCol = await createCollection({ name, color: newColColor });
      if (newCol) {
        setCollections((prev) => [newCol, ...prev]);
        setNewColName("");
        setIsCreating(false);
        // Automatically assign selected items to the new collection
        await handleSelectCollection(newCol.id);
      }
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create collection.");
    } finally {
      setCreatingLoading(false);
    }
  };

  const handleSelectCollection = async (collectionId: string) => {
    setSaving(true);
    try {
      await addItemsToCollection(selectedItemIds, collectionId);
      onComplete();
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
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-[320px] shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h3 id="collection-selector-title" className="font-bold text-gray-900 dark:text-white">
            {isCreating ? "New Collection" : "Save to Collection"}
          </h3>
          <button aria-label="Close" onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-3 scrollbar-hide flex-1">
          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : isCreating ? (
            /* ── Create form ── */
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Literature Review"
                  value={newColName}
                  onChange={(e) => { setNewColName(e.target.value); setCreateError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  maxLength={80}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                />
                {createError && <p className="text-xs text-red-500 mt-1">{createError}</p>}
              </div>

              {/* Color */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      title={c.label}
                      aria-label={`${c.label}${newColColor === c.value ? " (selected)" : ""}`}
                      onClick={() => setNewColColor(c.value)}
                      className="w-6 h-6 rounded-full transition-transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                      style={{
                        backgroundColor: c.value,
                        transform: newColColor === c.value ? "scale(1.3)" : "scale(1)",
                        boxShadow: newColColor === c.value ? `0 0 0 2px white, 0 0 0 3.5px ${c.value}` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${newColColor}20`, color: newColColor }}
                >
                  <Folder size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {newColName.trim() || "Collection name"}
                  </p>
                  <p className="text-xs text-gray-400">{selectedItemIds.length} item{selectedItemIds.length !== 1 ? "s" : ""} will be added</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {collections.length > 0 && (
                  <button
                    onClick={() => { setIsCreating(false); setCreateError(""); }}
                    disabled={creatingLoading}
                    className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={handleCreate}
                  disabled={!newColName.trim() || creatingLoading}
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingLoading ? "Creating…" : "Create & Add"}
                </button>
              </div>
            </div>
          ) : (
            /* ── Collection list ── */
            <div className="space-y-1">
              <button
                onClick={() => { setNewColName(""); setNewColColor(PRESET_COLORS[0].value); setCreateError(""); setIsCreating(true); }}
                className="w-full flex items-center gap-3 p-3 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-blue-500 group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                  <Plus size={16} />
                </div>
                <span className="font-medium text-sm">New Collection</span>
              </button>

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
