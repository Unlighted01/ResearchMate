import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FolderPlus } from "lucide-react";

// Components
import { Auth } from "./components/auth/Auth";
import Settings from "./components/App/Settings";
import ItemDetail from "./components/App/ItemDetail";
import SmartPenView from "./components/App/SmartPenView/SmartPenView";
import { CollectionSelector } from "./components/App/Collections/CollectionSelector";
import { CollectionsView } from "./components/App/Collections/CollectionsView";
import { Welcome } from "./components/App/Welcome";
import { TrashIcon } from "./components/icons";
import NotepadView from "./components/App/Notepad/NotepadView";
import { ChatView } from "./components/App/Chat/ChatView";

// Refactored Parts
import { useSidePanelData } from "./components/layout/SidePanel/useSidePanelData";
import { SidePanelHeader } from "./components/layout/SidePanel/SidePanelHeader";
import { SidePanelNav } from "./components/layout/SidePanel/SidePanelNav";
import { SidePanelSearch } from "./components/layout/SidePanel/SidePanelSearch";
import { ResearchCard } from "./components/layout/SidePanel/ResearchCard";
import { SkeletonCard } from "./components/layout/SidePanel/Skeleton";

// Hooks
import { useFocusTrap } from "./hooks/useFocusTrap";
import { PAGE_SIZE } from "./services/storageService";

function SidePanel() {
  const {
    loading,
    user,
    isAuthLoading,
    showAuth,
    setShowAuth,
    showWelcome,
    setShowWelcome,
    hasMore,
    isFetchingMore,
    sentinelRef,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    activeCollection,
    setActiveCollection,
    nav,
    setNav,
    sync,
    selection,
    setSelection,
    fetchItems,
    handleSync,
    handleDelete,
    handleBulkDelete,
    handlePin,
    toggleSelection,
    handleItemClick,
    filteredItems,
  } = useSidePanelData();

  const authModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(authModalRef, showAuth, () => setShowAuth(false));

  const renderContent = () => {
    switch (nav.view) {
      case "settings":
        return (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="h-full"
          >
            <Settings onBack={() => setNav({ view: "list", item: null })} />
          </motion.div>
        );
      case "smartpen":
        return (
          <motion.div
            key="smartpen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="h-full"
          >
            <SmartPenView
              onBack={() => setNav({ view: "list", item: null })}
              onItemClick={(item) => setNav({ view: "detail", item })}
            />
          </motion.div>
        );
      case "detail":
        if (nav.item) {
          return (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="h-full"
            >
              <ItemDetail
                item={nav.item}
                onBack={() => setNav({ view: "list", item: null })}
                onDelete={() => {
                  fetchItems(); // Refresh list after delete from detail
                  setNav({ view: "list", item: null });
                }}
                onUpdate={() => fetchItems()}
              />
            </motion.div>
          );
        }
        return null;
      case "notepad":
        return (
          <motion.div
            key="notepad"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1 flex flex-col overflow-hidden h-full"
          >
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm z-10 pb-0">
              <SidePanelHeader
                sync={sync}
                onSync={handleSync}
                onNavigate={(view) => setNav({ view, item: null })}
              />
              <SidePanelNav
                activeView={nav.view}
                onNavigate={(view) => setNav({ view, item: null })}
                onSelectionReset={() => setSelection((p) => ({ ...p, active: false }))}
              />
            </div>
            <div className="flex-1 overflow-hidden relative">
              <NotepadView />
            </div>
          </motion.div>
        );
      case "chat":
        return (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1 flex flex-col overflow-hidden h-full"
          >
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm z-10 pb-0">
              <SidePanelHeader
                sync={sync}
                onSync={handleSync}
                onNavigate={(view) => setNav({ view, item: null })}
              />
              <SidePanelNav
                activeView={nav.view}
                onNavigate={(view) => setNav({ view, item: null })}
                onSelectionReset={() => setSelection((p) => ({ ...p, active: false }))}
              />
            </div>
            <div className="flex-1 overflow-hidden relative">
              <ChatView onItemClick={(item) => setNav({ view: "detail", item })} />
            </div>
          </motion.div>
        );
      case "collections":
      case "list":
      default:
        return (
          <motion.div
            key={nav.view}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1 flex flex-col overflow-hidden h-full"
          >
            {/* Header Area */}
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm z-10 pb-0">
              <SidePanelHeader
                sync={sync}
                onSync={handleSync}
                onNavigate={(view) => setNav({ view, item: null })}
              />

              <SidePanelNav
                activeView={nav.view}
                onNavigate={(view) => setNav({ view, item: null })}
                onSelectionReset={() => setSelection((p) => ({ ...p, active: false }))}
              />

              {nav.view === "list" && (
                <SidePanelSearch
                  query={searchQuery}
                  onQueryChange={setSearchQuery}
                  activeCollection={activeCollection}
                  onClearCollection={() => setActiveCollection(null)}
                />
              )}

              {/* Selection Summary Bar */}
              {selection.active && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 flex items-center justify-between"
                >
                  <button
                    onClick={() => {
                      if (selection.ids.size === filteredItems.length) {
                        setSelection((p) => ({ ...p, ids: new Set() }));
                      } else {
                        setSelection((p) => ({ ...p, ids: new Set(filteredItems.map((i) => i.id)) }));
                      }
                    }}
                    className="text-xs font-medium text-blue-500 hover:text-blue-600"
                  >
                    {selection.ids.size === filteredItems.length ? "Deselect All" : "Select All"}
                  </button>
                  <span className="text-xs text-gray-500 font-medium">
                    {selection.ids.size} selected
                  </span>
                  <button
                    onClick={() => setSelection({ active: false, ids: new Set(), showCollectionPicker: false })}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </div>

            {/* List Content Area */}
            {nav.view === "collections" ? (
              <CollectionsView
                isGuest={!user}
                onCollectionClick={(id, name) => {
                  setActiveCollection({ id, name });
                  setSearchQuery("");
                  setNav({ view: "list", item: null });
                }}
              />
            ) : (
              <motion.div
                className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1,
                    },
                  },
                }}
              >
                {/* Guest Mode Banner */}
                {!user && !isAuthLoading && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center justify-between mb-4">
                    <div className="text-xs text-blue-800 dark:text-blue-200">
                      <span className="font-semibold">Guest Mode:</span> Items are saved locally.
                    </div>
                    <button
                      onClick={() => setShowAuth(true)}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md font-medium hover:bg-blue-700 transition-colors"
                    >
                      Sign In
                    </button>
                  </div>
                )}

                {loading ? (
                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: { opacity: 0 },
                      show: { opacity: 1, transition: { staggerChildren: 0.07 } },
                    }}
                    aria-label="Loading items"
                    aria-busy="true"
                  >
                    {Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </motion.div>
                ) : filteredItems.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center justify-center py-16 px-6 text-center"
                  >
                    <div className="mb-5 opacity-60">
                      {/* Empty state SVG */}
                      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="14" y="8" width="40" height="52" rx="6" className="fill-gray-100 dark:fill-gray-700" />
                        <rect x="22" y="22" width="24" height="3" rx="1.5" className="fill-gray-300 dark:fill-gray-500" />
                        <rect x="22" y="30" width="18" height="3" rx="1.5" className="fill-gray-300 dark:fill-gray-500" />
                        <rect x="22" y="38" width="20" height="3" rx="1.5" className="fill-gray-300 dark:fill-gray-500" />
                        <circle cx="52" cy="52" r="14" fill="none" stroke="#60A5FA" strokeWidth="3" />
                        <line x1="62" y1="62" x2="70" y2="70" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    </div>
                    {debouncedSearch ? (
                      <>
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">No results for "{debouncedSearch}"</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500">Try a different keyword or clear the search.</p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">Your library is empty</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-5 max-w-[220px]">Save highlighted text from the web to get started.</p>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <>
                    {filteredItems.map((item) => (
                      <ResearchCard
                        key={item.id}
                        item={item}
                        selectionActive={selection.active}
                        isSelected={selection.ids.has(item.id)}
                        onSelect={toggleSelection}
                        onClick={handleItemClick}
                        onDelete={handleDelete}
                        onPin={handlePin}
                        onEnterSelection={(id) => setSelection({ active: true, ids: new Set([id]), showCollectionPicker: false })}
                      />
                    ))}

                    {/* Infinite Scroll Progress */}
                    {hasMore && (
                      <div ref={sentinelRef} className="py-4 flex justify-center">
                        {isFetchingMore && (
                          <div className="flex gap-1.5">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-blue-400"
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                              />
                            ))}
                          </div>
                      )}
                      </div>
                    )}
                    {!hasMore && filteredItems.length > PAGE_SIZE && (
                      <p className="text-center text-[10px] text-gray-300 dark:text-gray-600 py-3"> All items loaded </p>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* Bulk Actions Bottom Bar */}
            <AnimatePresence>
              {selection.active && selection.ids.size > 0 && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute bottom-4 left-4 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 dark:border-gray-700 p-3 flex justify-between items-center z-40"
                >
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 ml-2">
                    {selection.ids.size} item{selection.ids.size > 1 ? "s" : ""}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelection((p) => ({ ...p, showCollectionPicker: true }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      <FolderPlus size={16} />
                      Collection
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                    >
                      <TrashIcon size={16} dangerHover />
                      Delete
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>

      {/* Auth Modal Overlay */}
      <AnimatePresence>
        {showAuth && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowAuth(false); }}
          >
            <motion.div
              ref={authModalRef}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-label="Sign in to ResearchMate"
              className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden relative shadow-2xl"
            >
              <button
                onClick={() => setShowAuth(false)}
                aria-label="Close sign-in dialog"
                className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 z-10"
              >
                ✕
              </button>
              <Auth />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CollectionSelector
        isOpen={selection.showCollectionPicker}
        onClose={() => setSelection((p) => ({ ...p, showCollectionPicker: false }))}
        selectedItemIds={Array.from(selection.ids)}
        onComplete={() => {
          setSelection({ active: false, ids: new Set(), showCollectionPicker: false });
          fetchItems();
        }}
      />

      <AnimatePresence>
        {showWelcome && <Welcome onComplete={() => setShowWelcome(false)} />}
      </AnimatePresence>
    </div>
  );
}

export default SidePanel;
