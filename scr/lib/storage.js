import { supabase } from "./supabase.js";

export async function getAllItems() {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Fetch error:", error);
    throw error;
  }

  console.log("📦 Raw data from Supabase:", data);

  return (data || []).map((item) => ({
    id: item.id,
    text: item.text,
    tags: Array.isArray(item.tags) ? item.tags : [],
    note: item.note || "",
    sourceUrl: item.source_url || "",
    sourceTitle: item.source_title || "",
    createdAt: item.created_at,
  }));
}

export async function addItem(item) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  console.log("💾 Saving item:", item);

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
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("❌ Save error:", error);
    throw error;
  }

  console.log("✅ Saved:", data);

  return {
    id: data.id,
    text: data.text,
    tags: data.tags,
    note: data.note,
    sourceUrl: data.source_url,
    sourceTitle: data.source_title,
    createdAt: data.created_at,
  };
}

export async function updateItem(id, updates) {
  const updateData = {};
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.note !== undefined) updateData.note = updates.note;
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("items")
    .update(updateData)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteItem(id) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}
