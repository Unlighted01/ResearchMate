import { useState, useEffect, useRef, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { 
  getAllItems, 
  getItemsPage, 
  PAGE_SIZE, 
  StorageItem, 
  deleteItem, 
  deleteItems, 
  updateItem,
  syncLocalItemsToCloud 
} from "../../../services/storageService";
import { getCurrentUser, supabase, isAuthenticated } from "../../../services/supabaseClient";
import { STORAGE_KEY } from "../../../constants";
import { useToast } from "../../shared/ui/Toast";
import { getCollections } from "../../../services/collectionService";

export type ViewType = "list" | "collections" | "detail" | "settings" | "smartpen" | "notepad";

export interface NavState {
  view: ViewType;
  item: StorageItem | null;
}

export interface SyncState {
  running: boolean;
  status: { msg: string; type: "success" | "error" } | null;
}

export interface SelectionState {
  active: boolean;
  ids: Set<string>;
  showCollectionPicker: boolean;
}

export function useSidePanelData() {
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

  // Navigation — persisted across panel open/close
  const NAV_VIEW_KEY = "rm_last_view";
  // Views that make sense to restore (detail needs an item which we don't persist)
  const RESTORABLE_VIEWS: ViewType[] = ["list", "collections", "settings", "smartpen", "notepad"];

  const [nav, setNavState] = useState<NavState>({ view: "list", item: null });

  // Wrap setNav so every navigation change is also saved to storage
  const setNav = useCallback((newNav: NavState) => {
    setNavState(newNav);
    if (RESTORABLE_VIEWS.includes(newNav.view)) {
      chrome.storage.local.set({ [NAV_VIEW_KEY]: newNav.view }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync
  const [sync, setSync] = useState<SyncState>({ running: false, status: null });

  // Selection
  const [selection, setSelection] = useState<SelectionState>({ 
    active: false, 
    ids: new Set(), 
    showCollectionPicker: false 
  });

  const { toast } = useToast();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    if (debouncedSearch) {
      const all = await getAllItems();
      setItems(all);
      setHasMore(false);
      setNextOffset(0);
      setLoading(false);
      
      setNavState((prev) => {
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

      setNavState((prev) => {
        if (prev.view === "detail" && prev.item) {
          const fresh = result.items.find((i) => i.id === prev.item!.id);
          return fresh ? { ...prev, item: fresh } : prev;
        }
        return prev;
      });
    }
  }, [debouncedSearch]);

  const loadMore = useCallback(async () => {
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
  }, [hasMore, isFetchingMore, nextOffset]);

  // Initial load and listeners
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage?.session) {
      chrome.storage.session.get(["hasSeenWelcome"], (result) => {
        if (!result.hasSeenWelcome) {
          setShowWelcome(true);
          chrome.storage.session.set({ hasSeenWelcome: true });
        }
      });
    }

    // Restore last active view (so SmartPen / Notepad survive panel close/reopen)
    chrome.storage.local.get([NAV_VIEW_KEY], (result) => {
      const saved = result[NAV_VIEW_KEY] as ViewType | undefined;
      if (saved && RESTORABLE_VIEWS.includes(saved)) {
        setNavState({ view: saved, item: null });
      }
    });

    fetchItems();
    isAuthenticated().then((isAuth) => {
      if (isAuth) {
        getCurrentUser().then((currentUser) => {
          setUser(currentUser);
          setIsAuthLoading(false);
          if (currentUser) {
            syncLocalItemsToCloud().then((res) => {
              if (res.success && res.count > 0) {
                fetchItems();
              }
            });
          }
        });
      } else {
        setUser(null);
        setIsAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setUser(session.user);
        setShowAuth(false);
        fetchItems();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        fetchItems();
      }
    });

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[STORAGE_KEY]) fetchItems();
    };

    const handleMessage = (msg: any) => {
      if (msg.action === "itemAdded") {
        fetchItems();
        getCollections().then((cols) => {
          if (cols && cols.length > 0 && msg.itemId) {
            toast("Saved to ResearchMate", "success", {
              action: {
                label: "Add to collection?",
                onClick: () => {
                  setSelection({
                    active: false,
                    ids: new Set([msg.itemId]),
                    showCollectionPicker: true,
                  });
                },
              },
            });
          } else {
            toast("Saved to ResearchMate", "success");
          }
        }).catch(() => {
          toast("Saved to ResearchMate", "success");
        });
      }
      if (msg.action === "authSynced") {
        isAuthenticated().then((isAuth) => {
          if (isAuth) {
            getCurrentUser().then((currentUser) => {
              setUser(currentUser);
              if (currentUser) {
                syncLocalItemsToCloud().then(() => fetchItems());
              }
            });
          }
        });
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleMessage);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Supabase Realtime: subscribe per-user so channels are stable ──────────
  // Kept in a separate effect so it only runs when `user` changes, not on every
  // search keystroke (avoids creating/destroying channels unnecessarily).
  useEffect(() => {
    if (!user) return; // Guest mode: no realtime, local storage listener handles it

    let itemsDebounce: ReturnType<typeof setTimeout> | null = null;
    let collectionsDebounce: ReturnType<typeof setTimeout> | null = null;

    const itemsChannel = supabase
      .channel(`items-live-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Debounce rapid bursts (e.g. bulk delete) into a single refresh
          if (itemsDebounce) clearTimeout(itemsDebounce);
          itemsDebounce = setTimeout(() => fetchItems(), 800);
        }
      )
      .subscribe();

    const collectionsChannel = supabase
      .channel(`collections-live-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "collections",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Collections changing doesn't affect the items list directly,
          // but we do a light re-fetch so collection names/counts stay fresh
          if (collectionsDebounce) clearTimeout(collectionsDebounce);
          collectionsDebounce = setTimeout(() => fetchItems(), 800);
        }
      )
      .subscribe();

    return () => {
      if (itemsDebounce) clearTimeout(itemsDebounce);
      if (collectionsDebounce) clearTimeout(collectionsDebounce);
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(collectionsChannel);
    };
  }, [user, fetchItems]);

  // Infinite scroll observer
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
  }, [hasMore, isFetchingMore, loadMore]);

  // Re-fetch on search change (skip first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchItems();
  }, [debouncedSearch, fetchItems]);

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

    setItems((prev) => prev.filter((i) => i.id !== id));
    if (nav.item?.id === id) setNav({ view: "list", item: null });

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

  const handlePin = useCallback(async (id: string, pin: boolean) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Re-assemble raw tags (including the encoded special tags)
    const rawTags = [
      ...item.tags,
      ...(item.color ? [`color:${item.color}`] : []),
      ...(item.ocrEdited ? ["ocr:edited"] : []),
    ].filter((t) => t !== "pinned:true"); // strip old pin state

    const newTags = pin ? [...rawTags, "pinned:true"] : rawTags;

    // Optimistic update so the card moves instantly
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, pinned: pin || undefined } : i))
    );

    try {
      await updateItem(id, { tags: newTags });
    } catch {
      // Revert on failure
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, pinned: item.pinned } : i))
      );
      toast("Failed to update pin. Please try again.", "error");
    }
  }, [items, toast]);


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

  const filteredItems = items
    .filter((item) => {
      if (activeCollection && item.collectionId !== activeCollection.id) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        return (
          item.text.toLowerCase().includes(q) ||
          item.note?.toLowerCase().includes(q) ||
          item.sourceTitle?.toLowerCase().includes(q) ||
          item.tags.some((t) => !t.startsWith("color:") && !t.startsWith("ocr:") && t.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      // Pinned items always float to the top; preserve relative order within each group
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

  return {
    items,
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
  };
}
