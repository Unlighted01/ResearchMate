import React, { useEffect, useState } from "react";
import logo from "./assets/logo.svg";
import { User } from "@supabase/supabase-js";
import {
  getAllItems,
  StorageItem,
  deleteItem,
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
} from "lucide-react";
import { Auth } from "./components/Auth";
import Settings from "./components/Settings";
import ItemDetail from "./components/ItemDetail";
import SmartPenView from "./components/SmartPenView";
import { GearIcon, TrashIcon } from "./components/icons";
import { AnimatePresence, motion } from "motion/react";
import { Welcome } from "./components/Welcome";

function SidePanel() {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  // Navigation State
  const [currentView, setCurrentView] = useState<
    "list" | "detail" | "settings" | "smartpen"
  >("list");
  const [selectedItem, setSelectedItem] = useState<StorageItem | null>(null);

  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    // Check for welcome screen
    // FORCE WELCOME FOR DEMO
    // chrome.storage.session.get(["hasSeenWelcome"], (result) => {
    //   if (!result.hasSeenWelcome) {
    setShowWelcome(true);
    //     chrome.storage.session.set({ hasSeenWelcome: true });
    //   }
    // });

    fetchItems();
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Auto-sync on open/mount if logged in
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
        fetchItems(); // Re-fetch to get cloud items
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        fetchItems(); // Re-fetch to get local items only
      }
    });

    // Listen for changes (e.g., context menu save)
    const handleStorageChange = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.researchMateItems) {
        fetchItems();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      subscription.unsubscribe();
    };
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const data = await getAllItems();
    setItems(data);
    setLoading(false);
  };

  const handleSync = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const result = await syncLocalItemsToCloud();
      if (result.success) {
        if (result.count > 0) {
          setSyncStatus({
            msg: `Synced ${result.count} items!`,
            type: "success",
          });
          fetchItems();
        } else {
          setSyncStatus({ msg: "Nothing to sync.", type: "success" });
        }
      } else {
        setSyncStatus({
          msg: result.error || "Sync failed",
          type: "error",
        });
      }
    } catch (e) {
      setSyncStatus({ msg: "Sync error occurred.", type: "error" });
    } finally {
      setIsSyncing(false);
      // Clear status after 3 seconds
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await deleteItem(itemToDelete);
      fetchItems();
      if (selectedItem?.id === itemToDelete) {
        setCurrentView("list");
        setSelectedItem(null);
      }
      setItemToDelete(null);
    }
  };

  const handleItemClick = (item: StorageItem) => {
    setSelectedItem(item);
    setCurrentView("detail");
  };

  const filteredItems = items.filter(
    (item) =>
      item.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sourceTitle?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Render Logic
  // Render Logic
  // Wrap content in AnimatePresence for smooth transitions
  const renderContent = () => {
    switch (currentView) {
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
            <Settings onBack={() => setCurrentView("list")} />
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
              onBack={() => setCurrentView("list")}
              onItemClick={(item) => {
                setSelectedItem(item);
                setCurrentView("detail");
              }}
            />
          </motion.div>
        );
      case "detail":
        if (selectedItem) {
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
                item={selectedItem}
                onBack={() => setCurrentView("list")}
                onDelete={() => {
                  fetchItems();
                  setCurrentView("list");
                }}
                onUpdate={() => {
                  // Refresh the list so it has the latest data (summary, citation, etc.)
                  fetchItems();
                }}
              />
            </motion.div>
          );
        }
        return null;
      case "list":
      default:
        return (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1 flex flex-col overflow-hidden h-full"
          >
            {/* Header */}
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm z-10">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <img src={logo} alt="Logo" className="w-6 h-6" />
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                    ResearchMate
                  </h1>
                </div>

                <div className="flex gap-2 items-center">
                  {/* Status Message */}
                  <AnimatePresence>
                    {syncStatus && (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className={`text-[10px] px-2 py-1 rounded-md font-medium whitespace-nowrap ${
                          syncStatus.type === "success"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {syncStatus.msg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Sync Button */}
                  <div
                    onClick={handleSync}
                    className={`p-2 rounded-full transition-colors cursor-pointer ${
                      isSyncing
                        ? "text-blue-500 bg-blue-50 animate-spin"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                    title="Sync to Cloud"
                  >
                    <RefreshCw size={20} />
                  </div>

                  <div
                    onClick={() => setCurrentView("smartpen")}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400 cursor-pointer"
                    title="Smart Pen"
                  >
                    <PenTool size={20} />
                  </div>
                  <div
                    onClick={() => setCurrentView("settings")}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400 cursor-pointer"
                    title="Settings"
                  >
                    <GearIcon size={20} />
                  </div>
                </div>
              </div>

              {/* Search Bar */}
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
            </div>

            {/* Main Content Area */}
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
              {!user && (
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
                <div className="text-center py-10 text-gray-400">
                  Loading...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                  <p>No items found.</p>
                  <p className="text-xs mt-2">
                    Select text on any page and right-click "Save to
                    ResearchMate"
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0 },
                    }}
                    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer group hover-lift relative"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                        {
                          new URL(item.sourceUrl || "https://example.com")
                            .hostname
                        }
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
                          {item.tags?.slice(0, 2).map((tag) => (
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
                      {/* Action Buttons (visible on hover) */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-3 right-3 flex gap-2">
                        {item.sourceUrl && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(item.sourceUrl, "_blank");
                            }}
                            className="text-gray-400 hover:text-blue-500 cursor-pointer"
                            title="Visit Source"
                          >
                            <ExternalLink size={18} />
                          </div>
                        )}
                        <div
                          onClick={(e) => handleDelete(item.id, e)}
                          className="text-gray-400 hover:text-red-500 cursor-pointer"
                          title="Delete"
                        >
                          <TrashIcon
                            size={18}
                            className="text-gray-400 hover:text-red-500"
                            dangerHover
                            shakeOnClick
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          </motion.div>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>

      {/* Global Overlays (Modals) remain outside AnimatePresence of views */}
      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px] animation-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-[280px] transform transition-all scale-100">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-full text-red-500 dark:text-red-400 mb-1">
                <TrashIcon size={24} dangerHover />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Delete Item?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This action cannot be undone.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setItemToDelete(null);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmDelete();
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAuth && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden relative">
            <button
              onClick={() => setShowAuth(false)}
              className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <Auth />
          </div>
        </div>
      )}

      <AnimatePresence>
        {showWelcome && <Welcome onComplete={() => setShowWelcome(false)} />}
      </AnimatePresence>
    </div>
  );
}

export default SidePanel;
