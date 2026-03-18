import { supabase, isAuthenticated } from "./supabaseClient";
import { DeviceSource } from "../types";
import { STORAGE_KEY } from "../constants";

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
  ocrConfidence?: number | null;
  ocrEdited?: boolean;
  preferredView?: "original" | "summary";
  color?: "yellow" | "green" | "red" | "blue" | "purple";
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
  color?: "yellow" | "green" | "red" | "blue" | "purple";
  imageUrl?: string;
  ocrConfidence?: number;
}

// Transform helpers
function transformDatabaseItem(item: any): StorageItem {
  const allTags = Array.isArray(item.tags) ? item.tags : [];
  
  // Extract color tag if present (e.g., "color:green")
  let extractedColor: "yellow" | "green" | "red" | "blue" | "purple" | undefined = undefined;
  let extractedOcrEdited = false;
  const filteredTags = allTags.filter((tag: string) => {
    if (tag.startsWith("color:")) {
      extractedColor = tag.split(":")[1] as any;
      return false; // Remove it from the standard tags array
    }
    if (tag === "ocr:edited") {
      extractedOcrEdited = true;
      return false; // Remove it from the standard tags array
    }
    return true;
  });

  return {
    id: String(item.id), // Ensure ID is always a string
    text: item.text || "",
    tags: filteredTags,
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
    ocrEdited: extractedOcrEdited || undefined,
    preferredView: item.preferred_view || undefined,
    color: extractedColor,
  };
}

function transformToDatabase(
  item: AddItemInput,
  userId: string,
): Record<string, any> {
  const mergedTags = [...(item.tags || [])];
  if (item.color) {
    if (!mergedTags.includes(`color:${item.color}`)) {
        mergedTags.push(`color:${item.color}`);
    }
  }

  const payload: Record<string, any> = {
    user_id: userId,
    text: item.text,
    tags: mergedTags,
    note: item.note || "",
    source_url: item.sourceUrl || "",
    source_title: item.sourceTitle || "",
    ai_summary: item.aiSummary || "",
    device_source: item.deviceSource || "extension",
  };

  if (item.citation !== undefined) payload.citation = item.citation;
  if (item.citationFormat !== undefined) payload.citation_format = item.citationFormat;
  if (item.collectionId !== undefined && item.collectionId !== null) payload.collection_id = item.collectionId;
  if (item.preferredView !== undefined) payload.preferred_view = item.preferredView;
  if (item.createdAt !== undefined) payload.created_at = item.createdAt;
  if (item.imageUrl !== undefined) payload.image_url = item.imageUrl;
  if (item.ocrConfidence !== undefined) payload.ocr_confidence = item.ocrConfidence;

  return payload;
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
  const mergedTags = [...(item.tags || [])];
  if (item.color && !mergedTags.includes(`color:${item.color}`)) {
    mergedTags.push(`color:${item.color}`);
  }

  const newItem: StorageItem = {
    id: `local_${Date.now()}`,
    text: item.text,
    tags: mergedTags,
    note: item.note || "",
    sourceUrl: item.sourceUrl || "",
    sourceTitle: item.sourceTitle || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aiSummary: item.aiSummary,
    deviceSource: item.deviceSource || "extension",
    collectionId: item.collectionId,
    color: item.color,
    imageUrl: item.imageUrl,
    ocrConfidence: item.ocrConfidence,
  };

  const storage = getLocalStorage();
  if (!storage) {
    console.warn("Local storage not available (Web environment)");
    return newItem; // Return the item but don't save it if on web
  }

  const localItems = await new Promise<StorageItem[]>((resolve) => {
    storage.get([STORAGE_KEY], (result) => {
      resolve(
        result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : [],
      );
    });
  });

  localItems.unshift(newItem);

  await new Promise<void>((resolve) => {
    storage.set({ [STORAGE_KEY]: JSON.stringify(localItems) }, () =>
      resolve(),
    );
  });

  return newItem;
}

// Helper to remove duplicated local items after successful cloud sync.
// Matches on both text AND sourceUrl to avoid deleting intentional same-text saves from different sources.
async function purgeLocalDuplicates(text: string, sourceUrl: string): Promise<void> {
  const storage = getLocalStorage();
  if (!storage) return;

  const localItems = await new Promise<StorageItem[]>((resolve) => {
    storage.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : []);
    });
  });

  const filtered = localItems.filter(
    (i) => !(i.text === text && i.sourceUrl === sourceUrl),
  );

  if (filtered.length !== localItems.length) {
    await new Promise<void>((resolve) => {
      storage.set({ [STORAGE_KEY]: JSON.stringify(filtered) }, () => resolve());
    });
  }
}

export async function addItem(
  item: AddItemInput,
  onCloudFallback?: () => void,
): Promise<StorageItem | null> {
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
        await purgeLocalDuplicates(item.text, item.sourceUrl || ""); // Cleanup
        return transformDatabaseItem(data);
      } catch (insertError: any) {
        // Check for "Column not found" error (Schema mismatch)
        if (
          insertError.code === "PGRST204" ||
          insertError.message?.includes("citation") ||
          insertError.message?.includes("column") ||
          insertError.message?.includes("does not exist")
        ) {
          console.warn(
            "Schema mismatch detected (missing columns). Retrying with safe payload...",
            insertError,
          );

          // Retry with safe payload
          const safePayload = {
            user_id: payload.user_id,
            text: payload.text,
            source_url: payload.source_url,
            source_title: payload.source_title,
            tags: payload.tags,
            created_at: payload.created_at,
          };

          const { data: retryData, error: retryError } = await supabase
            .from("items")
            .insert([safePayload])
            .select()
            .single();

          if (retryError) {
             console.error("Safe payload failed:", retryError);
             throw retryError;
          }

          // safePayload omits imageUrl/ocrConfidence/deviceSource.
          // If the item has image data, save it locally too so the preview works.
          // Don't purge local — the local copy carries the fields Supabase couldn't store.
          if (!item.imageUrl && item.ocrConfidence == null) {
            await purgeLocalDuplicates(item.text, item.sourceUrl || "");
          } else {
            await saveToLocalStorage(item); // keeps imageUrl in local storage
          }

          const cloudItem = transformDatabaseItem(retryData);
          return { ...cloudItem, imageUrl: item.imageUrl, ocrConfidence: item.ocrConfidence, deviceSource: item.deviceSource || cloudItem.deviceSource };
        }

        throw insertError; // Re-throw other errors
      }
    } catch (error) {
      console.error("Cloud save failed, falling back to local:", error);
      onCloudFallback?.();
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
    storage.get([STORAGE_KEY], (result) => {
      resolve(
        result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : [],
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
          deviceSource: item.deviceSource || "extension",
          collectionId: item.collectionId,
          preferredView: item.preferredView,
          createdAt: item.createdAt,
        },
        user.id,
      ),
    );

    try {
      const { error } = await supabase.from("items").insert(itemsToUpload);
      if (error) throw error;
    } catch (insertError: any) {
      if (
        insertError.code === "PGRST204" || 
        insertError.message?.includes("citation") ||
        insertError.message?.includes("column") ||
        insertError.message?.includes("does not exist")
      ) {
        console.warn("Schema mismatch during sync. Retrying with safe payload...", insertError);
        const safeItems = itemsToUpload.map(item => ({
          user_id: item.user_id,
          text: item.text,
          source_url: item.source_url,
          source_title: item.source_title,
          tags: item.tags,
          created_at: item.created_at
        }));
        
        try {
          const { error: retryError } = await supabase.from("items").insert(safeItems);
          if (retryError) throw retryError;
        } catch (retryErr: any) {
          console.error("Second sync attempt with safe items failed:", retryErr);
          throw retryErr;
        }
      } else {
        throw insertError;
      }
    }

    // 3. Clear Local Storage on success
    await new Promise<void>((resolve) => {
      storage.remove(STORAGE_KEY, () => resolve());
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
      .limit(500);

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
      storage.get([STORAGE_KEY], (result) => {
        const stored = result[STORAGE_KEY]
          ? JSON.parse(result[STORAGE_KEY])
          : [];
        resolve(stored);
      });
    });
  }

  // 3. Merge and Sort
  // Instead of a global Map deduplicating by text (which hides legitimate duplicate highlights of the same text),
  // we only want to drop `local_` items IF a Cloud item exists with the exact same text.
  // Cloud items should never overwrite each other.

  const finalItems: StorageItem[] = [];
  const cloudItemsTextSet = new Set<string>();

  // Build a map of local items by text for fast lookup
  const localByText = new Map<string, StorageItem>();
  for (const localItem of localItems) {
    localByText.set(localItem.text, localItem);
  }

  // Add all Cloud items first, merging imageUrl/ocrConfidence from local if cloud lacks them
  for (const item of items) {
    const local = localByText.get(item.text);
    if (local && (local.imageUrl || local.ocrConfidence != null) && !item.imageUrl) {
      finalItems.push({ ...item, imageUrl: local.imageUrl, ocrConfidence: local.ocrConfidence ?? item.ocrConfidence, deviceSource: local.deviceSource || item.deviceSource });
    } else {
      finalItems.push(item);
    }
    cloudItemsTextSet.add(item.text);
  }

  // Add Local items only if they don't exactly match a Cloud item's text
  for (const localItem of localItems) {
    if (!cloudItemsTextSet.has(localItem.text)) {
      finalItems.push(localItem);
    }
  }

  return finalItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function deleteItem(id: string): Promise<void> {
  if (id.startsWith("local_")) {
    // Delete from local storage
    const storage = getLocalStorage();
    if (!storage) return;

    const localItems = await new Promise<StorageItem[]>((resolve) => {
      storage.get([STORAGE_KEY], (result) => {
        resolve(
          result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : [],
        );
      });
    });
    const newItems = localItems.filter((i) => i.id !== id);
    await new Promise<void>((resolve) => {
      storage.set({ [STORAGE_KEY]: JSON.stringify(newItems) }, () =>
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
// Delete multiple items at once
export async function deleteItems(ids: string[]): Promise<void> {
  const localIds = ids.filter(id => id.startsWith("local_"));
  const cloudIds = ids.filter(id => !id.startsWith("local_"));

  // 1. Delete from local storage
  if (localIds.length > 0) {
    const storage = getLocalStorage();
    if (storage) {
      const localItems = await new Promise<StorageItem[]>((resolve) => {
        storage.get([STORAGE_KEY], (result) => {
          resolve(result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : []);
        });
      });
      const newItems = localItems.filter((i) => !localIds.includes(i.id));
      await new Promise<void>((resolve) => {
        storage.set({ [STORAGE_KEY]: JSON.stringify(newItems) }, () => resolve());
      });
    }
  }

  // 2. Delete from Cloud
  if (cloudIds.length > 0) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      const { error } = await supabase.from("items").delete().in("id", cloudIds);
      if (error) {
        console.error("Error deleting items in bulk:", error);
        throw error;
      }
    }
  }
}

export async function updateItemsCollection(ids: string[], collectionId: string | null): Promise<void> {
  const localIds = ids.filter(id => id.startsWith("local_"));
  const cloudIds = ids.filter(id => !id.startsWith("local_"));
  
  // 1. Update in local storage
  if (localIds.length > 0) {
    const storage = getLocalStorage();
    if (storage) {
      const localItems = await new Promise<StorageItem[]>((resolve) => {
        storage.get([STORAGE_KEY], (result) => {
          resolve(result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : []);
        });
      });
      
      const newItems = localItems.map((i) => 
        localIds.includes(i.id) ? { ...i, collectionId: collectionId || undefined } : i
      );

      await new Promise<void>((resolve) => {
        storage.set({ [STORAGE_KEY]: JSON.stringify(newItems) }, () => resolve());
      });
    }
  }

  // 2. Update in Cloud
  if (cloudIds.length > 0) {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      const { error } = await supabase
        .from("items")
        .update({ collection_id: collectionId || null })
        .in("id", cloudIds);
        
      if (error) {
        console.error("Error updating items collections in bulk:", error);
        throw error;
      }
    }
  }
}

export const PAGE_SIZE = 30;

export interface PaginatedResult {
  items: StorageItem[];
  hasMore: boolean;
  nextOffset: number;
}

export async function getItemsPage(
  offset: number,
  pageSize: number = PAGE_SIZE,
): Promise<PaginatedResult> {
  const authenticated = await isAuthenticated();
  let cloudItems: StorageItem[] = [];
  let cloudTotal = 0;

  if (authenticated) {
    const { count } = await supabase
      .from("items")
      .select("*", { count: "exact", head: true });
    cloudTotal = count ?? 0;

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (!error && data) {
      cloudItems = data.map(transformDatabaseItem);
    }
  }

  let localItems: StorageItem[] = [];
  const storage = getLocalStorage();
  if (storage) {
    localItems = await new Promise<StorageItem[]>((resolve) => {
      storage.get([STORAGE_KEY], (result) => {
        resolve(result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : []);
      });
    });
  }

  const cloudTexts = new Set(cloudItems.map((i) => i.text));
  const filteredLocal = localItems.filter((l) => !cloudTexts.has(l.text));
  // Local items are small (context-menu saves); include them only on page 0 to avoid duplication
  const combined = offset === 0 ? [...filteredLocal, ...cloudItems] : [...cloudItems];
  const sorted = combined.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const hasMore = authenticated ? offset + pageSize < cloudTotal : false;

  return { items: sorted, hasMore, nextOffset: offset + pageSize };
}

export async function updateItem(
  id: string,
  updates: Partial<StorageItem>,
): Promise<void> {
  const authenticated = await isAuthenticated();

  if (id.startsWith("local_")) {
    const storage = getLocalStorage();
    if (!storage) return;
    const localItems = await new Promise<StorageItem[]>((resolve) => {
      storage.get([STORAGE_KEY], (result) => {
        resolve(
          result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : [],
        );
      });
    });
    const newItems = localItems.map((i): StorageItem => {
      if (i.id !== id) return i;
      const merged = { ...i, ...updates };
      // Re-derive color from tags when tags are updated, so color field stays in sync
      if (updates.tags !== undefined) {
        const colorTag = updates.tags.find((t) => t.startsWith("color:"));
        merged.color = colorTag
          ? (colorTag.split(":")[1] as StorageItem["color"])
          : undefined;
      }
      return merged;
    });
    await new Promise<void>((resolve) => {
      storage.set({ [STORAGE_KEY]: JSON.stringify(newItems) }, () =>
        resolve(),
      );
    });
  } else if (authenticated) {
    // Map updates to DB columns
    const dbUpdates: Record<string, any> = {};
    if (updates.text !== undefined) dbUpdates.text = updates.text;
    if (updates.aiSummary !== undefined) dbUpdates.ai_summary = updates.aiSummary;
    if (updates.citation !== undefined) dbUpdates.citation = updates.citation;
    if (updates.citationFormat !== undefined) dbUpdates.citation_format = updates.citationFormat;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.note !== undefined) dbUpdates.note = updates.note;
    if (updates.preferredView !== undefined) dbUpdates.preferred_view = updates.preferredView;
    if (updates.sourceTitle !== undefined) dbUpdates.source_title = updates.sourceTitle;
    if (updates.sourceUrl !== undefined) dbUpdates.source_url = updates.sourceUrl;
    if ("ocrConfidence" in updates) dbUpdates.ocr_confidence = updates.ocrConfidence ?? null;

    const { error } = await supabase
      .from("items")
      .update(dbUpdates)
      .eq("id", id);
    if (error) {
      console.error("Error updating item:", error);
      throw error;
    }
  }
}
