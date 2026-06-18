import { supabase, isAuthenticated } from "./supabaseClient";
import type { Collection } from "../types";
import { STORAGE_KEY } from "../constants";
import type { StorageItem } from "./storageService";

export interface CreateCollectionInput {
  name: string;
  description?: string;
  color?: string;
}

export async function getCollections(): Promise<Collection[]> {
  const authenticated = await isAuthenticated();
  if (!authenticated) return [];

  try {
    // Fetch collections without relying on a FK join (not configured in Supabase)
    const { data: cols, error: colError } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });

    if (colError) throw colError;
    if (!cols || cols.length === 0) return [];

    // Manually count items per collection to avoid relationship errors
    const { data: items } = await supabase
      .from("items")
      .select("collection_id")
      .not("collection_id", "is", null);

    const counts: Record<string, number> = {};
    if (items) {
      items.forEach((i) => {
        if (i.collection_id) {
          counts[i.collection_id] = (counts[i.collection_id] || 0) + 1;
        }
      });
    }

    return cols.map((row) => ({
      ...row,
      item_count: counts[row.id] || 0,
    })) as Collection[];
  } catch (error) {
    console.error("Error fetching collections:", error);
    return [];
  }
}

export async function createCollection(input: CreateCollectionInput): Promise<Collection | null> {
  const authenticated = await isAuthenticated();
  if (!authenticated) throw new Error("Must be logged in to create a collection");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not found");

  const { data, error } = await supabase
    .from("collections")
    .insert([
      {
        user_id: user.id,
        name: input.name,
        description: input.description || "",
        color: input.color || "#4F46E5",
      }
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating collection:", error);
    throw error;
  }

  return { ...data, item_count: 0 } as Collection;
}

export async function deleteCollection(collectionId: string): Promise<void> {
  // Detach all items from the collection first
  await supabase
    .from("items")
    .update({ collection_id: null })
    .eq("collection_id", collectionId);

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", collectionId);

  if (error) throw error;
}

export async function addItemsToCollection(itemIds: string[], collectionId: string | null): Promise<void> {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    const cloudIds = itemIds.filter(id => !id.startsWith("local_"));
    if (cloudIds.length > 0) {
      const { error } = await supabase
        .from("items")
        .update({ collection_id: collectionId })
        .in("id", cloudIds);

      if (error) {
        console.error("Error updating cloud items:", error);
        throw error;
      }
    }
  }

  // Local storage update
  const localIds = itemIds.filter(id => id.startsWith("local_"));
  if (localIds.length > 0 && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    const localItems = await new Promise<StorageItem[]>((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve(result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : []);
      });
    });

    const newItems = localItems.map((i) =>
      localIds.includes(i.id) ? { ...i, collectionId: collectionId || undefined } : i
    );

    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        { [STORAGE_KEY]: JSON.stringify(newItems) },
        () => resolve()
      );
    });
  }
}
