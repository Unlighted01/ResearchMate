import React, { useEffect, useState, useRef } from "react";
import logo from "./assets/logo.svg";
import { User } from "@supabase/supabase-js";
import {
  getAllItems,
  getItemsPage,
  PAGE_SIZE,
  StorageItem,
  deleteItem,
  deleteItems,
  syncLocalItemsToCloud,
} from "./services/storageService";
import { getCurrentUser, supabase } from "./services/supabaseClient";
import {
  Search,
  PenTool,
  Sparkles,
  Quote,
  ExternalLink,
  CloudOff,
  RefreshCw,
  Folder,
  X,
} from "lucide-react";
import { Auth } from "./components/Auth";
import Settings from "./components/Settings";
import ItemDetail from "./components/ItemDetail";
import SmartPenView from "./components/SmartPenView";
import { GearIcon, TrashIcon } from "./components/icons";
import { AnimatePresence, motion } from "motion/react";
import { CheckSquare, Check, FolderPlus } from "lucide-react";
import { CollectionSelector } from "./components/CollectionSelector";
import { CollectionsView } from "./components/CollectionsView";
import { Welcome } from "./components/Welcome";
import { useToast } from "./components/Toast";
import { STORAGE_KEY } from "./constants";
import { useFocusTrap } from "./hooks/useFocusTrap";

const SkeletonCard: React.FC = () => (
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

function SidePanel() {
  // Data & auth
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // Pagination / infinite scroll
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(PAGE_SIZE);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Search & collection filter
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCollection, setActiveCollection] = useState<{ id: string; name: string } | null>(null);

  // Debounce search input — only re-filter after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Navigation (grouped — view and selected item always change together)
  const [nav, setNav] = useState<{
    view: "list" | "collections" | "detail" | "settings" | "smartpen";
    item: StorageItem | null;
  }>({ view: "list", item: null });

  // Sync (grouped — running flag and status message are always paired)
  const [sync, setSync] = useState<{
    running: boolean;
    status: { msg: string; type: "success" | "error" } | null;
  }>({ running: false, status: null });

  // Selection (grouped — these three always change together)
  const [selection, setSelection] = useState<{
    active: boolean;
    ids: Set<string>;
    showCollectionPicker: boolean;
  }>({ active: false, ids: new Set(), showCollectionPicker: false });

  const { toast } = useToast();
  const authModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(authModalRef, showAuth, () => setShowAuth(false));

  useEffect(() => {
    // Check for welcome screen — only show once per browser session
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      chrome.storage.session.get(["hasSeenWelcome"], (result) => {
        if (!result.hasSeenWelcome) {
          setShowWelcome(true);
          chrome.storage.session.set({ hasSeenWelcome: true });
        }
      });
    }

    fetchItems();
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        syncLocalItemsToCloud().then((res) => {
          if (res.success && res.count > 0) {
            console.log("Auto-synced on open:", res.count);
            fetchItems();
          }
        });
      }
    });

    // Listen for Auth Changes (Login/Logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setUser(session.user);
        setShowAuth(false);
        fetchItems();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        fetchItems();
      }
    });

    // Listen for changes (e.g., context menu save)
    const handleStorageChange = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes[STORAGE_KEY]) {
        fetchItems();
      }
    };

    const handleMessage = (msg: any) => {
      if (msg.action === "itemAdded") {
        fetchItems();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleMessage);
      subscription.unsubscribe();
    };
  }, []);

  // Reload when search changes (skip first render — initial load handled by main useEffect)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchItems();
  }, [debouncedSearch]);

  const fetchItems = async () => {
    setLoading(true);
    if (debouncedSearch) {
      // Search mode: load full dataset so results aren't limited to current page
      const all = await getAllItems();
      setItems(all);
      setHasMore(false);
      setNextOffset(0);
      setLoading(false);
      setNav((prev) => {
        if (prev.view === "detail" && prev.item) {
          const fresh = all.find((i) => i.id === prev.item!.id);
          return fresh ? { ...prev, item: fresh } : prev;
        }
        return prev;
      });
    } else {
      const result = await getItemsPage(0);
      setItems(result.items);
      setHasMore(result.hasMore);
      setNextOffset(result.nextOffset);
      setLoading(false);
      setNav((prev) => {
        if (prev.view === "detail" && prev.item) {
          const fresh = result.items.find((i) => i.id === prev.item!.id);
          return fresh ? { ...prev, item: fresh } : prev;
        }
        return prev;
      });
    }
  };

  const loadMore = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const result = await getItemsPage(nextOffset);
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const fresh = result.items.filter((i) => !existingIds.has(i.id));
      return [...prev, ...fresh];
    });
    setHasMore(result.hasMore);
    setNextOffset(result.nextOffset);
    setIsFetchingMore(false);
  };

  // Infinite scroll — observe sentinel element at bottom of list
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, nextOffset]);

  const handleSync = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    setSync({ running: true, status: null });
    try {
      const result = await syncLocalItemsToCloud();
      if (result.success) {
        if (result.count > 0) {
          setSync({ running: false, status: { msg: `Synced ${result.count} items!`, type: "success" } });
          fetchItems();
        } else {
          setSync({ running: false, status: { msg: "Nothing to sync.", type: "success" } });
        }
      } else {
        setSync({ running: false, status: { msg: result.error || "Sync failed", type: "error" } });
      }
    } catch (e) {
      setSync({ running: false, status: { msg: "Sync error occurred.", type: "error" } });
    } finally {
      setTimeout(() => setSync((p) => ({ ...p, status: null })), 3000);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const itemSnapshot = items.find((i) => i.id === id);
    if (!itemSnapshot) return;

    // Optimistic remove
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (nav.item?.id === id) {
      setNav({ view: "list", item: null });
    }

    let undone = false;
    toast("Item deleted", "info", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          setItems((prev) =>
            [itemSnapshot, ...prev].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          );
        },
      },
    });

    setTimeout(async () => {
      if (undone) return;
      try {
        await deleteItem(id);
      } catch {
        setItems((prev) =>
          [itemSnapshot, ...prev].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
        toast("Failed to delete item.", "error");
      }
    }, 5100);
  };

  const handleBulkDelete = async () => {
    if (selection.ids.size === 0) return;

    const selectedIds = Array.from(selection.ids);
    const snapshots = items.filter((i) => selectedIds.includes(i.id));

    // Optimistic remove
    setItems((prev) => prev.filter((i) => !selectedIds.includes(i.id)));
    setSelection({ active: false, ids: new Set(), showCollectionPicker: false });

    let undone = false;
    toast(`${snapshots.length} item${snapshots.length > 1 ? "s" : ""} deleted`, "info", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          setItems((prev) =>
            [...snapshots, ...prev].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          );
        },
      },
    });

    setTimeout(async () => {
      if (undone) return;
      try {
        await deleteItems(selectedIds);
      } catch {
        toast("Failed to delete selected items.", "error");
        setItems((prev) =>
          [...snapshots, ...prev].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
      }
    }, 5100);
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selection.ids);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelection((p) => ({ ...p, ids: newSet }));
  };

  const handleItemClick = (item: StorageItem) => {
    if (selection.active) {
      const newSet = new Set(selection.ids);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
      } else {
        newSet.add(item.id);
      }
      setSelection((p) => ({ ...p, ids: newSet }));
      return;
    }
    setNav({ view: "detail", item });
  };

  const filteredItems = items.filter((item) => {
    if (activeCollection && item.collectionId !== activeCollection.id) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return (
        item.text.toLowerCase().includes(q) ||
        item.note?.toLowerCase().includes(q) ||
        item.sourceTitle?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Render Logic
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
                  // Optimistically remove from list — item still in DB during undo window
                  setItems((prev) => prev.filter((i) => i.id !== nav.item!.id));
                  setNav({ view: "list", item: null });
                }}
                onUpdate={() => fetchItems()}
              />
            </motion.div>
          );
        }
        return null;
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
            {/* Header */}
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm z-10 pb-0">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <img src={logo} alt="Logo" className="w-6 h-6" />
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                    ResearchMate
                  </h1>
                </div>

                <div className="flex gap-2 items-center">
                  {/* Status Message */}
                  <div aria-live="polite" aria-atomic="true" className="contents">
                  <AnimatePresence>
                    {sync.status && (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className={`text-[10px] px-2 py-1 rounded-md font-medium whitespace-nowrap ${sync.status.type === "success"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                          }`}
                      >
                        {sync.status.msg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  </div>

                  {/* Sync Button */}
                  <button
                    onClick={handleSync}
                    aria-label="Sync to Cloud"
                    className={`p-2 rounded-full transition-colors ${sync.running
                      ? "text-blue-500 bg-blue-50 animate-spin"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    title="Sync to Cloud"
                  >
                    <RefreshCw size={20} />
                  </button>

                  <button
                    onClick={() => setNav({ view: "smartpen", item: null })}
                    aria-label="Smart Pen"
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400"
                    title="Smart Pen"
                  >
                    <PenTool size={20} />
                  </button>
                  <button
                    onClick={() => setNav({ view: "settings", item: null })}
                    aria-label="Settings"
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400"
                    title="Settings"
                  >
                    <GearIcon size={20} />
                  </button>
                </div>
              </div>

              {/* Top Navigation Tabs */}
              <div className="flex gap-4 border-b border-gray-100 dark:border-gray-800 mb-3 px-1">
                <button
                  onClick={() => {
                    setNav({ view: "list", item: null });
                    setSelection((p) => ({ ...p, active: false }));
                  }}
                  className={`pb-3 text-sm font-semibold transition-colors relative ${
                    nav.view === "list"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  Items
                  {nav.view === "list" && (
                    <motion.div layoutId="nav-pill" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setNav({ view: "collections", item: null });
                    setSelection((p) => ({ ...p, active: false }));
                  }}
                  className={`pb-3 text-sm font-semibold transition-colors relative ${
                    nav.view === "collections"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  Collections
                  {nav.view === "collections" && (
                    <motion.div layoutId="nav-pill" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
                  )}
                </button>
              </div>

              {/* Search Bar (Only in list view) */}
              {nav.view === "list" && (
                <div className="space-y-2 mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search your research..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-xl text-sm focus:ring-2 focus:ring-apple-blue dark:text-white outline-none"
                    />
                  </div>
                  {/* Active collection filter chip */}
                  {activeCollection && (
                    <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium px-2.5 py-1.5 rounded-lg w-fit">
                      <Folder className="w-3 h-3" />
                      <span>{activeCollection.name}</span>
                      <button
                        onClick={() => setActiveCollection(null)}
                        aria-label="Clear collection filter"
                        className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                        title="Clear collection filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Selection Action Bar */}
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

            {/* Main Content Area */}
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
              {!user && !isAuthLoading && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center justify-between mb-4">
                  <div className="text-xs text-blue-800 dark:text-blue-200">
                    <span className="font-semibold">Guest Mode:</span> Items are
                    saved locally.
                  </div>
                  <button
                    onClick={() => setShowAuth(true)}
                    className="text-xs bg-apple-blue text-white px-3 py-1.5 rounded-md font-medium hover:bg-blue-600 transition-colors"
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
                  <svg
                    width="80" height="80" viewBox="0 0 80 80" fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-5 opacity-60"
                    aria-hidden="true"
                  >
                    <rect x="14" y="8" width="40" height="52" rx="6" className="fill-gray-100 dark:fill-gray-700" />
                    <rect x="22" y="22" width="24" height="3" rx="1.5" className="fill-gray-300 dark:fill-gray-500" />
                    <rect x="22" y="30" width="18" height="3" rx="1.5" className="fill-gray-300 dark:fill-gray-500" />
                    <rect x="22" y="38" width="20" height="3" rx="1.5" className="fill-gray-300 dark:fill-gray-500" />
                    <circle cx="52" cy="52" r="14" fill="none" stroke="#60A5FA" strokeWidth="3" />
                    <line x1="62" y1="62" x2="70" y2="70" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="58" cy="46" r="2.5" fill="#A78BFA" opacity="0.7" />
                  </svg>
                  {debouncedSearch ? (
                    <>
                      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                        No results for "{debouncedSearch}"
                      </h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Try a different keyword, or clear the search to browse all items.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                        Your research library is empty
                      </h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-5 max-w-[220px]">
                        Save any highlighted text from the web and it will appear here.
                      </p>
                      <ol className="text-xs text-gray-400 dark:text-gray-500 text-left space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">1</span>
                          Highlight text on any webpage
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">2</span>
                          Click the floating save button, or right-click → "Save to ResearchMate"
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">3</span>
                          Come back here to view, tag, and cite it
                        </li>
                      </ol>
                    </>
                  )}
                </motion.div>
              ) : (
                <>
                  {filteredItems.map((item) => {
                    const colorHex =
                      item.color === "yellow" ? "#FBBF24"
                      : item.color === "green"  ? "#34D399"
                      : item.color === "blue"   ? "#60A5FA"
                      : item.color === "red"    ? "#F87171"
                      : item.color === "purple" ? "#A78BFA"
                      : null;

                    const colorBgClass =
                      item.color === "yellow" ? "bg-yellow-50/30 dark:bg-yellow-900/10"
                      : item.color === "green"  ? "bg-emerald-50/30 dark:bg-emerald-900/10"
                      : item.color === "blue"   ? "bg-blue-50/30 dark:bg-blue-900/10"
                      : item.color === "red"    ? "bg-red-50/30 dark:bg-red-900/10"
                      : item.color === "purple" ? "bg-purple-50/30 dark:bg-purple-900/10"
                      : "";

                    const hostname = (() => {
                      if (!item.sourceUrl) return "UNKNOWN SOURCE";
                      try {
                        const urlToParse = item.sourceUrl.startsWith('http')
                          ? item.sourceUrl
                          : `https://${item.sourceUrl}`;
                        return new URL(urlToParse).hostname;
                      } catch {
                        return "UNKNOWN SOURCE";
                      }
                    })();

                    return (
                      <motion.div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Research item from ${hostname}: ${item.text.slice(0, 80)}`}
                        onClick={() => handleItemClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleItemClick(item);
                          }
                        }}
                        variants={{
                          hidden: { opacity: 0, y: 10 },
                          show: { opacity: 1, y: 0 },
                        }}
                        className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border transition-all cursor-pointer group hover-lift relative overflow-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${colorBgClass} ${
                          selection.ids.has(item.id)
                            ? "border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10"
                            : "border-gray-100 dark:border-gray-700"
                        }`}
                      >
                        {/* Color indicator bar — absolutely positioned to avoid CSS border-color conflicts */}
                        {colorHex && (
                          <div
                            className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-xl"
                            style={{ backgroundColor: colorHex }}
                          />
                        )}
                        {/* Selection Checkbox */}
                        {(selection.active || selection.ids.has(item.id)) && (
                          <div
                            className="absolute -top-2 -left-2 z-10 bg-white dark:bg-gray-800 rounded-full"
                            onClick={(e) => toggleSelection(item.id, e)}
                          >
                            {selection.ids.has(item.id) ? (
                              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border border-blue-500 shadow-sm">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-500 rounded-full bg-white dark:bg-gray-800 shadow-sm group-hover:border-blue-400 transition-colors"></div>
                            )}
                          </div>
                        )}

                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                            {hostname}
                          </span>
                          <div className="flex items-center gap-1">
                            {item.id.startsWith("local_") && (
                              <div title="Not synced to cloud">
                                <CloudOff className="w-3 h-3 text-red-400" />
                              </div>
                            )}
                            <span className="text-[10px] text-gray-400">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-3 mb-3 font-medium">
                          {item.text}
                        </p>

                        <div className="flex justify-between items-center">
                          <div className="flex gap-2 items-center">
                            <div className="flex gap-1">
                              {item.tags?.filter((t) => !t.startsWith("color:")).slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>

                            {/* Status Indicators */}
                            <div className="flex gap-1 items-center">
                              {item.aiSummary && (
                                <Sparkles className="w-3 h-3 text-purple-400" />
                              )}
                              {item.citation && (
                                <Quote className="w-3 h-3 text-blue-400" />
                              )}
                            </div>
                          </div>
                          {/* Action Buttons (visible on hover, hidden in selection mode) */}
                          {!selection.active && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-3 right-3 flex gap-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-1 rounded-lg shadow-sm">
                              {!selection.active && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelection({ active: true, ids: new Set([item.id]), showCollectionPicker: false });
                                  }}
                                  className="text-gray-400 hover:text-blue-500 cursor-pointer p-0.5"
                                  title="Select"
                                >
                                  <CheckSquare size={16} />
                                </div>
                              )}
                              {item.sourceUrl && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(item.sourceUrl, "_blank");
                                  }}
                                  className="text-gray-400 hover:text-blue-500 cursor-pointer p-0.5"
                                  title="Visit Source"
                                >
                                  <ExternalLink size={16} />
                                </div>
                              )}
                              <div
                                onClick={(e) => handleDelete(item.id, e)}
                                className="text-gray-400 hover:text-red-500 cursor-pointer p-0.5"
                                title="Delete"
                              >
                                <TrashIcon
                                  size={16}
                                  className="text-gray-400 hover:text-red-500"
                                  dangerHover
                                  shakeOnClick
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Infinite scroll sentinel */}
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
                  {!hasMore && items.length > PAGE_SIZE && (
                    <p className="text-center text-[10px] text-gray-300 dark:text-gray-600 py-3">
                      All {items.length} items loaded
                    </p>
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

      {showAuth && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAuth(false); }}
        >
          <div
            ref={authModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Sign in to ResearchMate"
            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden relative"
          >
            <button
              onClick={() => setShowAuth(false)}
              aria-label="Close sign-in dialog"
              className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <Auth />
          </div>
        </div>
      )}

      {/* Collection Selector Modal */}
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
