import { supabase } from "./supabaseClient";
import { lookupISBN } from "./citationService";

const API_BASE_URL = "https://research-mate-website.vercel.app/api"; // Extension points to production API

export interface SummaryResult {
  ok: boolean;
  summary: string;
  reason?: string;
  error?: string;
  credits_remaining?: number | string;
}

export interface TagsResult {
  ok: boolean;
  tags: string[];
  reason?: string;
  error?: string;
  credits_remaining?: number | string;
}

export interface CitationResult {
  ok: boolean;
  citation: string;
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

/**
 * Summarize text using the ResearchMate API
 */
export async function summarizeText(text: string): Promise<SummaryResult> {
  if (!text.trim()) return { ok: false, summary: "", reason: "empty" };

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/summarize`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 403 && data.code === "NO_CREDITS") {
        return {
          ok: false,
          summary: "",
          reason: "no_credits",
          error: "You have used all your free AI credits.",
        };
      }
      // General error for non-OK responses
      return {
        ok: false,
        summary: "",
        error: data.error || "An unknown error occurred during summarization.",
      };
    }

    return {
      ok: true,
      summary: data.summary,
      credits_remaining: data.credits_remaining,
    };
  } catch (error: any) {
    console.error("Summarize error:", error);
    return { ok: false, summary: "", error: error.message };
  }
}

/**
 * Generate Citation
 */
// Helper to extract metadata from the active tab
async function extractPageMetadata(tabId: number): Promise<any> {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const getMeta = (names: string[]) => {
          for (const name of names) {
            const meta = document.querySelector(
              `meta[name="${name}"], meta[property="${name}"], meta[property="og:${name}"], meta[name="citation_${name}"]`,
            );
            if (meta && meta.getAttribute("content"))
              return meta.getAttribute("content");
          }
          return "";
        };

        // Try to get JSON-LD author
        let jsonIdAuthor = "";
        try {
          const scripts = document.querySelectorAll(
            'script[type="application/ld+json"]',
          );
          for (const script of scripts) {
            const data = JSON.parse(script.textContent || "{}");
            if (data.author) {
              if (Array.isArray(data.author)) {
                jsonIdAuthor = data.author.map((a: any) => a.name).join(", ");
              } else if (typeof data.author === "object") {
                jsonIdAuthor = data.author.name;
              } else {
                jsonIdAuthor = data.author;
              }
              if (jsonIdAuthor) break;
            }
          }
        } catch (e) {}

        return {
          title: document.title || getMeta(["title"]),
          description: getMeta(["description"]),
          // Prioritize specific author tags over generic ones
          author:
            jsonIdAuthor ||
            getMeta([
              "citation_author",
              "author",
              "article:author",
              "dc.creator",
              "byl", // Bloomberg etc
              "parsely-author",
            ]),
          // Fallback corporate author if no person is found (Tier 2 improvement)
          siteName: getMeta([
            "og:site_name",
            "site_name",
            "citation_journal_title",
            "application-name",
          ]),
          publishDate: getMeta([
            "citation_publication_date",
            "publication_date",
            "date",
            "article:published_time",
          ]),
          publisher: getMeta([
            "citation_journal_title",
            "journal_title",
            "site_name",
            "site_name",
            "og:site_name",
            "dc.publisher",
          ]),
          doi: getMeta(["citation_doi", "doi", "dc.identifier"]),
          isbn: getMeta(["citation_isbn", "isbn", "dc.identifier.isbn"]), // New
          url: window.location.href,
        };
      },
    });
    return result;
  } catch (e) {
    console.error("Failed to extract metadata:", e);
    return null;
  }
}

export async function generateCitation(
  url: string,
  // But this runs in the context of the popup usually.
  styleProp?: string,
): Promise<CitationResult> {
  try {
    const style =
      styleProp || (localStorage.getItem("citationStyle") as any) || "apa";

    // 1. Extract Local Metadata (Tier 2 Candidate)
    let localMetadata: any = null;
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        localMetadata = await extractPageMetadata(tab.id);
      }
    } catch (e) {
      console.warn("Could not extract local metadata", e);
    }

    // --- Tier 1: Deterministic ID (Free & Perfect) ---
    // Check for ISBN (DOI later if supported by custom API)
    if (localMetadata?.isbn) {
      console.log(
        "Found ISBN locally, attempting Tier 1 lookup:",
        localMetadata.isbn,
      );
      const isbnResult = await lookupISBN(localMetadata.isbn);
      if (isbnResult.ok && isbnResult.data && isbnResult.data.length > 0) {
        const book = isbnResult.data[0];
        // Construct Citation from Book Data
        const author = book.authors?.join(", ") || "Unknown Author";
        const year = book.publishedDate?.split("-")[0] || "n.d.";
        const title = book.title || "Untitled";
        const pub = book.publisher || "Publisher";

        let citation = "";
        // Reuse formatting logic (maybe refactor to shared helper later)
        if (style === "apa") {
          citation = `${author}. (${year}). *${title}*. ${pub}.`; // Simple Book Cit
        } else if (style === "mla") {
          citation = `${author}. *${title}*. ${pub}, ${year}.`;
        } else {
          citation = `${author}. (${year}). *${title}*. ${pub}.`;
        }
        console.log("Tier 1 Success: Used Library API");
        return { ok: true, citation };
      }
    }

    // --- Tier 2: Structured Metadata (Free & Good) ---
    // If we have Author, Title, AND Date/Year from meta tags, use them.
    // [MODIFIED] Relaxed check: logic below handles "corporate author" fallback

    // Check for "Human" author first
    let hasAuthor =
      localMetadata &&
      localMetadata.author &&
      localMetadata.author.length > 2 &&
      !localMetadata.author.toLowerCase().includes("unknown");

    // If no human author, can we use Site Name as Corporate Author? (e.g. NASA, MDN)
    if (!hasAuthor && localMetadata && localMetadata.siteName) {
      // Corporate Fallback
      localMetadata.author = localMetadata.siteName;
      hasAuthor = true;
      console.log("Using Site Name as Corporate Author:", localMetadata.author);
    }

    const hasTitle = localMetadata && localMetadata.title;
    // Date is nice, but not strictly required for a "decent" free citation if we have author+title
    // But let's keep it somewhat strict to avoid bad citations.
    // Date is nice, but not strictly required for a "decent" free citation if we have author+title
    // But let's keep it somewhat strict to avoid bad citations.
    // const hasDate = localMetadata && (localMetadata.publishDate || localMetadata.active);

    if (hasTitle && hasAuthor) {
      console.log("Tier 2 Success: Used Local Metadata (Human or Corporate)");
      // We rely on the "Merge Strategies" block below to pick this up
    }

    const headers = (await getAuthHeaders()) as Record<string, string>;

    // Check if user enabled "Enhanced AI Citation"
    const useAI = localStorage.getItem("useAiCitation") === "true";

    // DECISION: If Tier 1 failed, do we call Tier 3 (AI) immediately?
    // User wants to SAVE credits.
    // If Tier 2 looks good, we should SKIP AI unless user forced it.

    let apiData = null;

    const tier2LooksGood = hasTitle && hasAuthor; // Date is optional for "Good Enough" to save credits

    // Only call AI if:
    // 1. User forced it (useAiCitation = true)
    // 2. OR Tier 2 is bad (missing fields)
    if (useAI || !tier2LooksGood) {
      // --- Tier 3: AI Analysis (Paid & Smart) ---
      console.log("Tier 1 & 2 insufficient, calling Tier 3 (AI)...");
      const response = await fetch(`${API_BASE_URL}/extract-citation`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url, useAI: true }), // Force AI if we are here
      });

      if (response.ok) {
        const json = await response.json();
        apiData = json.metadata;
      }
    } else {
      console.log("Tier 2 sufficient, skipping AI to save credits.");
    }

    // 3. Merge Strategies
    // Use API data if robust, fallback to local if API is generic/blocked or skipped
    let finalMetadata = apiData || localMetadata;

    const isApiGeneric =
      !apiData ||
      !apiData.author ||
      apiData.title === "Access Denied" ||
      apiData.title === "Just a moment...";

    // If API failed/generic but we have local, use local
    if (
      isApiGeneric &&
      localMetadata &&
      localMetadata.title &&
      localMetadata.title.length > (apiData?.title?.length || 0)
    ) {
      console.log("Using Local Metadata (API was generic/blocked or skipped)");
      finalMetadata = localMetadata;
    }

    if (!finalMetadata) {
      throw new Error("Could not extract citation data from API or page.");
    }

    // 4. Generate Citation String (Local Rule-Based)
    const author = finalMetadata.author || "Unknown Author";
    const year = finalMetadata.publishDate
      ? new Date(finalMetadata.publishDate).getFullYear()
      : "n.d.";
    const title = finalMetadata.title || "Untitled";
    const site = finalMetadata.publisher || finalMetadata.siteName || "Website";

    let citation = "";
    if (style === "apa") {
      citation = `${author}. (${year}). ${title}. ${site}. ${url}`;
    } else if (style === "mla") {
      citation = `${author}. "${title}." ${site}, ${year}, ${url}.`;
    } else if (style === "chicago") {
      citation = `${author}. "${title}." ${site} (${year}). ${url}.`;
    } else if (style === "harvard") {
      citation = `${author} (${year}) '${title}', ${site}. Available at: ${url}.`;
    } else if (style === "ieee") {
      // IEEE Format: J. K. Author, "Title," Site, Year. [Online]. Available: URL. [Accessed: Abbrev. Month. Day, Year].
      const dateAccess = new Date();
      const months = [
        "Jan.",
        "Feb.",
        "Mar.",
        "Apr.",
        "May",
        "June",
        "July",
        "Aug.",
        "Sept.",
        "Oct.",
        "Nov.",
        "Dec.",
      ];
      const accessed = `${months[dateAccess.getMonth()]} ${dateAccess.getDate()}, ${dateAccess.getFullYear()}`;
      citation = `${author}, "${title}," *${site}*, ${year}. [Online]. Available: ${url}. [Accessed: ${accessed}].`;
    } else if (style === "bibtex") {
      const slug = author.split(" ")[0].toLowerCase() + year;
      citation = `@misc{${slug}, title={${title}}, url={${url}}, journal={${site}}, author={${author}}, year={${year}}}`;
    } else {
      citation = `${author}. (${year}). ${title}. ${site}. ${url}`;
    }

    return { ok: true, citation };
  } catch (error: any) {
    console.error("Citation Gen Error:", error);
    return { ok: false, citation: "", error: error.message };
  }
}
