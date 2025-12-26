// src/services/storage.js - Hybrid storage (local + cloud)
import { supabase } from "./supabase.js";

// ============================================
// HELPER: Check if authenticated
// ============================================

async function isAuthenticated() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return !!session;
  } catch {
    return false;
  }
}

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

async function getLocalItems() {
  const { researchMateItems = [] } = await chrome.storage.local.get(
    "researchMateItems"
  );
  return researchMateItems;
}

async function setLocalItems(items) {
  await chrome.storage.local.set({ researchMateItems: items });
}

// ============================================
// MAIN FUNCTIONS (Keep same signatures!)
// ============================================

export async function getAllItems() {
  const authenticated = await isAuthenticated();

  // If logged in, get from cloud
  if (authenticated) {
    try {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((item) => ({
        id: item.id,
        text: item.text,
        tags: Array.isArray(item.tags) ? item.tags : [],
        note: item.note || "",
        sourceUrl: item.source_url || "",
        sourceTitle: item.source_title || "",
        createdAt: item.created_at,
        deviceSource: item.device_source || "extension",
        aiSummary: item.ai_summary || "",
      }));
    } catch (error) {
      console.error("☁️ Cloud fetch failed, using local:", error);
      return await getLocalItems();
    }
  }

  // Guest mode: use local storage
  return await getLocalItems();
}

export async function addItem(item) {
  const authenticated = await isAuthenticated();

  // If logged in, save to cloud
  if (authenticated) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("items")
        .insert([
          {
            user_id: user.id,
            text: item.text,
            tags: item.tags || [],
            note: item.note || "",
            source_url: item.sourceUrl || "",
            source_title: item.sourceTitle || "",
            device_source: "extension", // ← FIXED: Now tracks device source!
          },
        ])
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        text: data.text,
        tags: data.tags,
        note: data.note,
        sourceUrl: data.source_url,
        sourceTitle: data.source_title,
        createdAt: data.created_at,
        deviceSource: data.device_source,
      };
    } catch (error) {
      console.error("☁️ Cloud save failed, saving locally:", error);
      // Fall through to local save
    }
  }

  // Guest mode: save locally
  const items = await getLocalItems();
  const newItem = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    text: item.text,
    tags: item.tags || [],
    note: item.note || "",
    sourceUrl: item.sourceUrl || "",
    sourceTitle: item.sourceTitle || "",
    createdAt: new Date().toISOString(),
    deviceSource: "extension",
  };

  items.unshift(newItem);
  await setLocalItems(items);
  return newItem;
}

export async function updateItem(id, updates) {
  const authenticated = await isAuthenticated();

  // Ensure id is a string to prevent type errors
  const itemId = String(id);

  // If it's a local item (ID starts with "local_")
  if (itemId.startsWith("local_")) {
    const items = await getLocalItems();
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) throw new Error("Item not found");

    items[index] = { ...items[index], ...updates };
    await setLocalItems(items);
    return;
  }

  // Cloud item
  if (authenticated) {
    const updateData = {};
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.note !== undefined) updateData.note = updates.note;
    if (updates.aiSummary !== undefined)
      updateData.ai_summary = updates.aiSummary;
    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("items")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;
  }
}

export async function deleteItem(id) {
  // Ensure id is a string
  const itemId = String(id);

  // If it's a local item
  if (itemId.startsWith("local_")) {
    const items = await getLocalItems();
    const filtered = items.filter((item) => item.id !== itemId);
    await setLocalItems(filtered);
    return;
  }

  // Cloud item
  const { error } = await supabase.from("items").delete().eq("id", itemId);
  if (error) throw error;
}

// ============================================
// NEW: Migration function
// ============================================

export async function migrateLocalToCloud() {
  const localItems = await getLocalItems();
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    throw new Error("Must be signed in to migrate");
  }

  if (localItems.length === 0) {
    return { success: 0, failed: 0 };
  }

  const results = { success: 0, failed: 0 };

  for (const item of localItems) {
    try {
      await addItem({
        text: item.text,
        tags: item.tags,
        note: item.note,
        sourceUrl: item.sourceUrl,
        sourceTitle: item.sourceTitle,
      });
      results.success++;
    } catch (error) {
      console.error(`Failed to migrate item ${item.id}:`, error);
      results.failed++;
    }
  }

  // Clear local items if all succeeded
  if (results.failed === 0) {
    await chrome.storage.local.remove("researchMateItems");
  }

  return results;
}

export async function getLocalItemsCount() {
  const items = await getLocalItems();
  return items.length;
}
