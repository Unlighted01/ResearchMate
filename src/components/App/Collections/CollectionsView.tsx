import { useEffect, useRef, useState } from "react";
import { Collection } from "../../../types";
import { getCollections, createCollection, deleteCollection } from "../../../services/collectionService";
import { Folder, MoreVertical, LayoutGrid, List, Plus, X, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import { useToast } from "../../shared/ui/Toast";

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

interface CollectionsViewProps {
  onCollectionClick: (collectionId: string, collectionName: string) => void;
  isGuest: boolean;
}

export function CollectionsView({ onCollectionClick, isGuest }: CollectionsViewProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { toast } = useToast();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Create modal state
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0].value);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, showModal, () => closeModal());

  useEffect(() => {
    if (!isGuest) {
      loadCollections();
    } else {
      setLoading(false);
    }
  }, [isGuest]);

  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpenId]);

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

  const openModal = () => {
    setNewName("");
    setNewColor(PRESET_COLORS[0].value);
    setCreateError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (creating) return;
    setShowModal(false);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setCreateError("Name is required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const created = await createCollection({ name, color: newColor });
      if (created) {
        setCollections((prev) => [{ ...created }, ...prev]);
      }
      setShowModal(false);
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create collection.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (col: Collection) => {
    setMenuOpenId(null);
    // Optimistic remove
    setCollections((prev) => prev.filter((c) => c.id !== col.id));
    let undone = false;
    toast(`"${col.name}" deleted`, "info", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          setCollections((prev) => {
            const already = prev.find((c) => c.id === col.id);
            return already ? prev : [col, ...prev];
          });
        },
      },
    });
    setTimeout(() => {
      if (!undone) deleteCollection(col.id).catch(console.error);
    }, 5100);
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
      {/* Toolbar */}
      <div className="px-4 py-2 flex justify-between items-center text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
        <span className="text-xs font-semibold uppercase tracking-wider">{collections.length} Collections</span>
        <div className="flex items-center gap-2">
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
          <button
            onClick={openModal}
            title="New Collection"
            aria-label="Create new collection"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
          >
            <Plus size={13} />
            New
          </button>
        </div>
      </div>

      {/* List */}
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
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 mb-4">
              Create one to start grouping your research.
            </p>
            <button
              onClick={openModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              <Plus size={13} /> New Collection
            </button>
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
                className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none border border-gray-100 dark:border-gray-700/50 cursor-pointer group hover:-translate-y-0.5 transition-all
                  ${viewMode === "grid" ? "p-4 aspect-square flex flex-col justify-between" : "p-3 flex items-center gap-3"}
                `}
                onClick={() => {
                  if (menuOpenId === col.id) { setMenuOpenId(null); return; }
                  onCollectionClick(col.id, col.name);
                }}
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
                      <button
                        title="More Options"
                        aria-label="Collection options"
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === col.id ? null : col.id); }}
                        className="p-1 rounded-lg text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-all"
                      >
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
                    <button
                      title="More Options"
                      aria-label="Collection options"
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === col.id ? null : col.id); }}
                      className="p-2 rounded-lg text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </>
                )}

                {/* Dropdown menu */}
                <AnimatePresence>
                  {menuOpenId === col.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.1 }}
                      className="absolute top-2 right-2 z-20 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden min-w-[130px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleDelete(col)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Create Collection Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-collection-title"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 id="create-collection-title" className="text-base font-bold text-gray-900 dark:text-white">
                  New Collection
                </h2>
                <button
                  onClick={closeModal}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Literature Review"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setCreateError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  maxLength={80}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                {createError && (
                  <p className="text-xs text-red-500 mt-1">{createError}</p>
                )}
              </div>

              {/* Color */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      title={c.label}
                      aria-label={`${c.label}${newColor === c.value ? " (selected)" : ""}`}
                      onClick={() => setNewColor(c.value)}
                      className="w-7 h-7 rounded-full transition-transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                      style={{
                        backgroundColor: c.value,
                        transform: newColor === c.value ? "scale(1.25)" : "scale(1)",
                        boxShadow: newColor === c.value ? `0 0 0 2px white, 0 0 0 4px ${c.value}` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${newColor}20`, color: newColor }}
                >
                  <Folder size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">
                    {newName.trim() || "Collection name"}
                  </p>
                  <p className="text-xs text-gray-400">0 items</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={closeModal}
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
