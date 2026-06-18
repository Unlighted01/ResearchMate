// ============================================
// chatService.ts - Extension AI Chat Service
// ============================================

import { getAllItems, StorageItem } from "./storageService";
import { supabase } from "./supabaseClient";

const API_BASE_URL = "https://research-mate-website.vercel.app/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

/**
 * Searches the library for the most relevant items based on keyword overlap
 */
export function getRelevantContext(query: string, items: StorageItem[]): StorageItem[] {
  if (!query || items.length === 0) return items.slice(0, 20);

  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 2); // filter out short words

  if (keywords.length === 0) return items.slice(0, 20);

  const scored = items.map(item => {
    let score = 0;
    const textLower = (item.text || "").toLowerCase();
    const titleLower = (item.sourceTitle || "").toLowerCase();
    const noteLower = (item.note || "").toLowerCase();
    const summaryLower = (item.aiSummary || "").toLowerCase();

    keywords.forEach(word => {
      // Tags (highest weight)
      if (item.tags && item.tags.some(t => t.toLowerCase().includes(word))) {
        score += 10;
      }
      // Source Title
      if (titleLower.includes(word)) {
        score += 5;
      }
      // Summary
      if (summaryLower.includes(word)) {
        score += 3;
      }
      // Main text or notes
      if (textLower.includes(word) || noteLower.includes(word)) {
        score += 2;
      }
    });

    return { item, score };
  });

  // Filter out items with 0 score, then sort by score descending
  const matches = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.item);

  // Fallback to recent items if no keywords matched
  if (matches.length === 0) {
    return items.slice(0, 20);
  }

  return matches.slice(0, 20);
}

/**
 * Sends a chat message to the website's Gemini API with library context
 */
export async function sendChatMessage(
  message: string,
  _history: ChatMessage[]
): Promise<{ response: string; error?: string; credits_remaining?: number | string }> {
  try {
    // 1. Fetch library items
    const allItems = await getAllItems();
    const relevantItems = getRelevantContext(message, allItems);

    // 2. Format context for the API prompt
    const contextText = relevantItems
      .map((item, idx) => {
        const titleStr = item.sourceTitle ? `[Source: ${item.sourceTitle}]` : `[Untitled Item #${idx + 1}]`;
        const urlStr = item.sourceUrl ? ` (URL: ${item.sourceUrl})` : "";
        const tagsStr = item.tags && item.tags.length > 0 ? ` (Tags: ${item.tags.join(", ")})` : "";
        return `${titleStr}${urlStr}${tagsStr}:\nContent: ${item.text}\nNotes: ${item.note || "None"}\nSummary: ${item.aiSummary || "None"}`;
      })
      .join("\n\n---\n\n");

    // 3. Get Auth Session Headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // 4. Send request
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        context: contextText,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 403 || errorData.code === "NO_CREDITS") {
        return {
          response: "",
          error: "You have run out of AI credits. Please upgrade your plan or configure a custom API key in the website settings.",
        };
      }
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }

    const data = await response.json();
    return {
      response: data.response,
      credits_remaining: data.credits_remaining,
    };
  } catch (error) {
    console.error("sendChatMessage error:", error);
    return {
      response: "",
      error: error instanceof Error ? error.message : "Failed to communicate with AI chat service.",
    };
  }
}
