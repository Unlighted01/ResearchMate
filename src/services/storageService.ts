import { supabase, isAuthenticated } from "./supabaseClient";
import { DeviceSource } from "../types";

export interface StorageItem {
  id: string;
  text: string;
  tags: string[];
  note: string;
  sourceUrl: string;
  sourceTitle: string;
  createdAt: string;
  updatedAt?: string;
  aiSummary?: string;
  citation?: string;
  citationFormat?: string;
  deviceSource: DeviceSource;
  collectionId?: string;
  imageUrl?: string;
  ocrText?: string;
  preferredView?: "original" | "summary";
}

export interface AddItemInput {
  text: string;
  tags?: string[];
  note?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  aiSummary?: string;
  citation?: string;
  citationFormat?: string;
  deviceSource?: DeviceSource;
  collectionId?: string;
  preferredView?: "original" | "summary";
  createdAt?: string;
}

// Transform helpers
function transformDatabaseItem(item: any): StorageItem {
  return {
    id: String(item.id), // Ensure ID is always a string
    text: item.text || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    note: item.note || item.notes || "",
    sourceUrl: item.source_url || "",
    sourceTitle: item.source_title || "",
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    aiSummary: item.ai_summary || "",
    citation: item.citation,
    citationFormat: item.citation_format,
    deviceSource: item.device_source || "extension",
    collectionId: item.collection_id,
    imageUrl: item.image_url,
    ocrText: item.ocr_text,
    preferredView: item.preferred_view || undefined,
  };
}

function transformToDatabase(
  item: AddItemInput,
  userId: string,
): Record<string, any> {
  return {
    user_id: userId,
    text: item.text,
    tags: item.tags || [],
    note: item.note || "",
    source_url: item.sourceUrl || "",
    source_title: item.sourceTitle || "",
    ai_summary: item.aiSummary || "",
    citation: item.citation,
    citation_format: item.citationFormat,
    device_source: item.deviceSource || "extension",
    collection_id: item.collectionId || null,
    preferred_view: item.preferredView || null,
    created_at: item.createdAt, // Optional: preserve original creation time
  };
}

// Helper to safely get local storage (handles Web vs Extension)
const getLocalStorage = () => {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    return chrome.storage.local;
  }
  return null;
};

// Helper to save locally
async function saveToLocalStorage(item: AddItemInput): Promise<StorageItem> {
  const newItem: StorageItem = {
    id: `local_${Date.now()}`,
    text: item.text,
    tags: item.tags || [],
    note: item.note || "",
    sourceUrl: item.sourceUrl || "",
    sourceTitle: item.sourceTitle || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aiSummary: item.aiSummary,
    deviceSource: "extension",
    collectionId: item.collectionId,
  };

  const storage = getLocalStorage();
  if (!storage) {
    console.warn("Local storage not available (Web environment)");
    return newItem; // Return the item but don't save it if on web
  }

  const localItems = await new Promise<StorageItem[]>((resolve) => {
    storage.get(["researchMateItems"], (result) => {
      resolve(
        result.researchMateItems ? JSON.parse(result.researchMateItems) : [],
      );
    });
  });

  localItems.unshift(newItem);

  await new Promise<void>((resolve) => {
    storage.set({ researchMateItems: JSON.stringify(localItems) }, () =>
      resolve(),
    );
  });

  return newItem;
}

export async function addItem(item: AddItemInput): Promise<StorageItem | null> {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Try full insert first
      const payload = transformToDatabase(item, user.id);

      try {
        const { data, error } = await supabase
          .from("items")
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        return transformDatabaseItem(data);
      } catch (insertError: any) {
        // Check for "Column not found" error (Schema mismatch)
        if (
          insertError.code === "PGRST204" ||
          insertError.message?.includes("citation")
        ) {
          console.warn(
            "Schema mismatch detected (missing columns). Retrying without citation fields...",
            insertError,
          );

          // Remove new columns and retry
          const safePayload = { ...payload };
          delete safePayload.citation;
          delete safePayload.citation_format;
          // Also remove ai_summary if that might be missing too, but let's stick to citation first

          const { data: retryData, error: retryError } = await supabase
            .from("items")
            .insert([safePayload])
            .select()
            .single();

          if (retryError) throw retryError;
          return transformDatabaseItem(retryData);
        }

        throw insertError; // Re-throw other errors
      }
    } catch (error) {
      console.error("Cloud save failed, falling back to local:", error);
      // Fallback to local storage if cloud fails
      return saveToLocalStorage(item);
    }
  } else {
    return saveToLocalStorage(item);
  }
}

export async function syncLocalItemsToCloud(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return { success: false, count: 0, error: "Not authenticated" };
  }

  const storage = getLocalStorage();
  if (!storage) {
    return { success: false, count: 0, error: "Storage not available" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, count: 0, error: "User not found" };
  }

  // 1. Get Local Items
  const localItems = await new Promise<StorageItem[]>((resolve) => {
    storage.get(["researchMateItems"], (result) => {
      resolve(
        result.researchMateItems ? JSON.parse(result.researchMateItems) : [],
      );
    });
  });

  if (localItems.length === 0) {
    return { success: true, count: 0 };
  }

  console.log(`Syncing ${localItems.length} items to cloud...`);

  // 2. Upload to Supabase
  try {
    const itemsToUpload = localItems.map((item) =>
      transformToDatabase(
        {
          text: item.text,
          tags: item.tags,
          note: item.note,
          sourceUrl: item.sourceUrl,
          sourceTitle: item.sourceTitle,
          aiSummary: item.aiSummary,
          citation: item.citation,
          citationFormat: item.citationFormat,
          deviceSource: "extension",
          collectionId: item.collectionId,
          preferredView: item.preferredView,
          createdAt: item.createdAt,
        },
        user.id,
      ),
    );

    const { error } = await supabase.from("items").insert(itemsToUpload);

    if (error) {
      console.error("Sync failed:", error);
      return { success: false, count: 0, error: error.message };
    }

    // 3. Clear Local Storage on success
    await new Promise<void>((resolve) => {
      storage.remove("researchMateItems", () => resolve());
    });
    console.log("Sync complete and local items cleared.");
    return { success: true, count: localItems.length };
  } catch (err: any) {
    console.error("Sync exception:", err);
    return {
      success: false,
      count: 0,
      error: err.message || "Unknown sync error",
    };
  }
}

export async function getAllItems(): Promise<StorageItem[]> {
  const authenticated = await isAuthenticated();
  let items: StorageItem[] = [];

  // 1. Fetch from Supabase if authenticated
  if (authenticated) {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching items:", error);
    } else {
      items = (data || []).map(transformDatabaseItem);
    }
  }

  // 2. Fetch from Local Storage (Context Menu saves here)
  let localItems: StorageItem[] = [];
  const storage = getLocalStorage();

  if (storage) {
    localItems = await new Promise<StorageItem[]>((resolve) => {
      storage.get(["researchMateItems"], (result) => {
        const stored = result.researchMateItems
          ? JSON.parse(result.researchMateItems)
          : [];
        resolve(stored);
      });
    });
  }

  // 3. Merge and Sort
  // Create a map to avoid duplicates if we decide to sync local to cloud later
  const combined = [...localItems, ...items]; // Local items usually newer/unsynced first

  // Deduplicate by ID
  const uniqueItems = Array.from(
    new Map(combined.map((item) => [item.id, item])).values(),
  );

  return uniqueItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function deleteItem(id: string): Promise<void> {
  if (id.startsWith("local_")) {
    // Delete from local storage
    const storage = getLocalStorage();
    if (!storage) return;

    const localItems = await new Promise<StorageItem[]>((resolve) => {
      storage.get(["researchMateItems"], (result) => {
        resolve(
          result.researchMateItems ? JSON.parse(result.researchMateItems) : [],
        );
      });
    });
    const newItems = localItems.filter((i) => i.id !== id);
    await new Promise<void>((resolve) => {
      storage.set({ researchMateItems: JSON.stringify(newItems) }, () =>
        resolve(),
      );
    });
  } else {
    // Delete from Cloud
    const authenticated = await isAuthenticated();
    if (authenticated) {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) {
        console.error("Error deleting item:", error);
        throw error;
      }
    }
  }
}

export async function updateItem(
  id: string,
  updates: Partial<StorageItem>,
): Promise<void> {
  const authenticated = await isAuthenticated();

  if (id.startsWith("local_")) {
    const localItems = await new Promise<StorageItem[]>((resolve) => {
      chrome.storage.local.get(["researchMateItems"], (result) => {
        resolve(
          result.researchMateItems ? JSON.parse(result.researchMateItems) : [],
        );
      });
    });
    // @ts-ignore
    const newItems = localItems.map((i) =>
      i.id === id ? { ...i, ...updates } : i,
    );
    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        { researchMateItems: JSON.stringify(newItems) },
        () => resolve(),
      );
    });
  } else if (authenticated) {
    // Map updates to DB columns
    const dbUpdates: any = {};
    if (updates.aiSummary !== undefined)
      dbUpdates.ai_summary = updates.aiSummary;
    if (updates.citation !== undefined) dbUpdates.citation = updates.citation;
    if (updates.citationFormat !== undefined)
      dbUpdates.citation_format = updates.citationFormat;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.note !== undefined) dbUpdates.note = updates.note;
    if (updates.preferredView !== undefined)
      dbUpdates.preferred_view = updates.preferredView;

    const { error } = await supabase
      .from("items")
      .update(dbUpdates)
      .eq("id", id);
    if (error) console.error("Error updating item:", error);
  }
}
