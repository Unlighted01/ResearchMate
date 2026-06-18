import { supabase } from "./supabaseClient";

const API_BASE_URL = "https://research-mate-website.vercel.app/api";

export interface BookMetadata {
  title: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: { type: string; identifier: string }[];
  imageLinks?: { smallThumbnail?: string; thumbnail?: string };
  previewLink?: string;
  infoLink?: string;
  isbn?: string;
  sourceType?: "book" | "journal" | "conference" | "article" | "report" | "thesis" | "movie" | "tv";
  journal?: string;
  doi?: string;
  imdbId?: string;
}

export interface SearchResult {
  ok: boolean;
  data?: BookMetadata[];
  error?: string;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

export interface IdentifyResult {
  ok: boolean;
  title?: string;
  authors?: string[];
  year?: string;
  type?: string;
  publisher?: string;
  isbn?: string;
  doi?: string;
  confidence?: number;
  reasoning?: string;
  searchQuery?: string;
  error?: string;
}

/**
 * Use AI to identify what source a block of text comes from
 */
export async function identifySource(text: string): Promise<IdentifyResult> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/identify-source`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text }),
    });
    const data = await response.json();
    if (!response.ok) return { ok: false, error: data.error || "Identification failed" };
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "An unexpected error occurred" };
  }
}

/**
 * Search for books by query (Title, Author, or ISBN)
 */
export async function searchBooks(query: string): Promise<SearchResult> {
  if (!query.trim()) return { ok: false, error: "Query is empty" };

  try {
    const headers = await getAuthHeaders();
    // Use the generic search endpoint
    const response = await fetch(`${API_BASE_URL}/search-books`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: data.error || "Failed to search books",
      };
    }

    return {
      ok: true,
      data: data.items || [], // Assuming API returns { items: [...] }
    };
  } catch (error) {
    console.error("Book Search Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "An unexpected error occurred" };
  }
}

/**
 * Direct ISBN lookup (Specific Endpoint if available, else re-use search)
 */
export async function lookupISBN(isbn: string): Promise<SearchResult> {
  // We can interpret ISBN lookup as a specific search
  return searchBooks(`isbn:${isbn}`);
}
