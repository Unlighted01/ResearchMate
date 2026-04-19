// ============================================
// documentService.ts - Supabase CRUD for Documents
// ============================================

// ============================================
// PART 1: IMPORTS & DEPENDENCIES
// ============================================

import { supabase } from "./supabaseClient";

// ============================================
// PART 2: TYPE DEFINITIONS
// ============================================

export interface Document {
  id: string;
  userId: string;
  title: string;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface DocumentRow {
  id: string;
  user_id: string;
  title: string;
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================
// PART 3: HELPERS
// ============================================

const EMPTY_DOC_CONTENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const mapRow = (row: DocumentRow): Document => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ============================================
// PART 4: SERVICE FUNCTIONS
// ============================================

export async function getDocuments(): Promise<Document[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function getDocument(id: string): Promise<Document | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return mapRow(data);
}

export async function createDocument(
  title = "Untitled Document"
): Promise<Document> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title,
      content: EMPTY_DOC_CONTENT,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function updateDocument(
  id: string,
  updates: { title?: string; content?: Record<string, unknown> }
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.content !== undefined) updateData.content = updates.content;

  const { error } = await supabase
    .from("documents")
    .update(updateData)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}
