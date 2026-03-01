import { supabase, isAuthenticated } from "./supabaseClient";
import type { Collection } from "../types";

export interface CreateCollectionInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export async function getCollections(): Promise<Collection[]> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return []; // Return empty if not authenticated, as collections are strictly cloud-synced for now
  }

  const { data, error } = await supabase
    .from("collections")
    .select(`
      *,
      items (count)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching collections:", error);
    return [];
  }

  // Transform data to ensure item_count is mapped correctly if it's nested
  return (data || []).map((col: any) => ({
    ...col,
    item_count: col.items?.[0]?.count || 0
  })) as Collection[];
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
        description: input.description,
        color: input.color,
        icon: input.icon,
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

export async function addItemsToCollection(itemIds: string[], collectionId: string | null): Promise<void> {
  const authenticated = await isAuthenticated();
  
  if (authenticated) {
    // Cloud items update
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
    const localItems = await new Promise<any[]>((resolve) => {
      chrome.storage.local.get(["researchMateItems"], (result) => {
        resolve(result.researchMateItems ? JSON.parse(result.researchMateItems) : []);
      });
    });

    const newItems = localItems.map((i) =>
      localIds.includes(i.id) ? { ...i, collectionId: collectionId } : i
    );

    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        { researchMateItems: JSON.stringify(newItems) },
        () => resolve()
      );
    });
  }
}
