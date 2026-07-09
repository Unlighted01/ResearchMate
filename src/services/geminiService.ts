import { supabase } from "./supabaseClient";
import { lookupISBN } from "./citationService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://research-mate-website.vercel.app/api"; // Extension points to production API

export interface SummaryResult {
  ok: boolean;
  summary: string;
  reason?: string;
  error?: string;
  credits_remaining?: number | string;
}

export type SummaryMode = "ultra-short" | "standard" | "detailed";

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
  inTextCitation?: string; // Short parenthetical form, e.g. "(Smith & Jones, 2024)"
  error?: string;
}

interface CrossRefAuthor { given: string; family: string; }
interface CrossRefWork {
  DOI: string;
  title: string[];
  author?: CrossRefAuthor[];
  published?: { "date-parts": number[][] };
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
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

// Extract a DOI from any URL string
function extractDOIFromUrl(url: string): string {
  const match = url.match(/10\.\d{4,}\/[^\s"<>[\]{}|\\^~`]+/);
  return match ? match[0] : "";
}

// Fetch authoritative metadata from CrossRef by DOI
async function lookupCrossRef(doi: string): Promise<CrossRefWork | null> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.message as CrossRefWork) ?? null;
  } catch {
    return null;
  }
}

// Search CrossRef by title when no DOI is available
async function searchCrossRefByTitle(title: string, year?: string | number): Promise<CrossRefWork | null> {
  try {
    const query = encodeURIComponent(title);
    const res = await fetch(`https://api.crossref.org/works?query.bibliographic=${query}&rows=3`);
    if (!res.ok) return null;
    const json = await res.json();
    const items: CrossRefWork[] = json?.message?.items ?? [];
    // Normalise title for comparison
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const titleNorm = norm(title);
    for (const item of items) {
      const itemTitle = item.title?.[0] ?? "";
      // Accept if 60%+ of the query title appears inside the candidate title
      const overlap = titleNorm.length > 0 && norm(itemTitle).includes(titleNorm.slice(0, Math.floor(titleNorm.length * 0.6)));
      const yearMatch = !year || item.published?.["date-parts"]?.[0]?.[0]?.toString() === String(year);
      if (overlap && yearMatch && (item.author?.length ?? 0) > 0) return item;
    }
    // Looser fallback: just take top result if it has authors
    if (items[0] && (items[0].author?.length ?? 0) > 0) return items[0];
    return null;
  } catch {
    return null;
  }
}

// "Scott W." → "S. W."
function toInitials(given: string): string {
  return given
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + ".")
    .join(" ");
}

// Format an author list per citation style
function formatAuthors(authors: CrossRefAuthor[], style: string): string {
  if (authors.length === 0) return "Unknown Author";

  switch (style) {
    case "apa": {
      const formatted = authors.map((a) => `${a.family}, ${toInitials(a.given)}`);
      if (formatted.length === 1) return formatted[0];
      if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
      return formatted.slice(0, -1).join(", ") + ", & " + formatted[formatted.length - 1];
    }
    case "mla": {
      if (authors.length === 1) return `${authors[0].family}, ${authors[0].given}`;
      if (authors.length === 2) return `${authors[0].family}, ${authors[0].given}, and ${authors[1].given} ${authors[1].family}`;
      return `${authors[0].family}, ${authors[0].given}, et al.`;
    }
    case "chicago": {
      const formatted = authors.map((a, i) =>
        i === 0 ? `${a.family}, ${a.given}` : `${a.given} ${a.family}`
      );
      if (formatted.length <= 2) return formatted.join(", and ");
      return formatted.slice(0, -1).join(", ") + ", and " + formatted[formatted.length - 1];
    }
    case "harvard": {
      const formatted = authors.map((a) => `${a.family}, ${toInitials(a.given)}`);
      if (formatted.length === 1) return formatted[0];
      if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
      return formatted.slice(0, -1).join(", ") + " and " + formatted[formatted.length - 1];
    }
    case "ieee": {
      const formatted = authors.map((a) => `${toInitials(a.given)} ${a.family}`);
      if (formatted.length === 1) return formatted[0];
      if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
      return formatted.slice(0, -1).join(", ") + ", and " + formatted[formatted.length - 1];
    }
    case "bibtex": {
      return authors.map((a) => `${a.family}, ${a.given}`).join(" and ");
    }
    default: {
      const formatted = authors.map((a) => `${a.family}, ${toInitials(a.given)}`);
      if (formatted.length === 1) return formatted[0];
      if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
      return formatted.slice(0, -1).join(", ") + ", & " + formatted[formatted.length - 1];
    }
  }
}

// Build the short parenthetical in-text citation from CrossRef author/year data
function formatInTextCitation(authors: CrossRefAuthor[], year: string, style: string): string {
  if (authors.length === 0) return style === "ieee" ? "[1]" : `(Unknown, ${year})`;
  const first = authors[0].family;
  switch (style) {
    case "apa":
    case "harvard": {
      if (authors.length === 1) return `(${first}, ${year})`;
      if (authors.length === 2) return `(${first} & ${authors[1].family}, ${year})`;
      return `(${first} et al., ${year})`;
    }
    case "mla": {
      if (authors.length === 1) return `(${first})`;
      if (authors.length === 2) return `(${first} and ${authors[1].family})`;
      return `(${first} et al.)`;
    }
    case "chicago": {
      if (authors.length === 1) return `(${first} ${year})`;
      if (authors.length === 2) return `(${first} and ${authors[1].family} ${year})`;
      return `(${first} et al. ${year})`;
    }
    case "ieee": return "[1]";
    default: {
      if (authors.length === 1) return `(${first}, ${year})`;
      return `(${first} et al., ${year})`;
    }
  }
}

// Build a complete citation string from a CrossRef work object
function formatCrossRefCitation(work: CrossRefWork, style: string, url: string): string {
  const authors = work.author ?? [];
  const authorStr = formatAuthors(authors, style);
  const year = work.published?.["date-parts"]?.[0]?.[0]?.toString() ?? "n.d.";
  const title = work.title?.[0] ?? "Untitled";
  const journal = work["container-title"]?.[0] ?? "";
  const vol = work.volume ?? "";
  const issue = work.issue ?? "";
  const pages = work.page ?? "";
  const doiUrl = `https://doi.org/${work.DOI}`;

  const volIssue = vol ? (issue ? `*${vol}*(${issue})` : `*${vol}*`) : "";
  const volIssuePage = [volIssue, pages].filter(Boolean).join(", ");

  switch (style) {
    case "apa": {
      let cit = `${authorStr}. (${year}). ${title}.`;
      if (journal) cit += ` *${journal}*`;
      if (volIssuePage) cit += `, ${volIssuePage}`;
      cit += `. ${doiUrl}`;
      return cit;
    }
    case "mla": {
      let cit = `${authorStr}. "${title}."`;
      if (journal) cit += ` *${journal}*,`;
      if (vol) cit += ` vol. ${vol},`;
      if (issue) cit += ` no. ${issue},`;
      cit += ` ${year}`;
      if (pages) cit += `, pp. ${pages}`;
      cit += `.`;
      return cit;
    }
    case "chicago": {
      let cit = `${authorStr}. "${title}."`;
      if (journal) cit += ` *${journal}*`;
      if (vol) cit += ` ${vol}`;
      if (issue) cit += `, no. ${issue}`;
      cit += ` (${year})`;
      if (pages) cit += `: ${pages}`;
      cit += `. ${doiUrl}.`;
      return cit;
    }
    case "harvard": {
      let cit = `${authorStr} (${year}) '${title}',`;
      if (journal) cit += ` *${journal}*,`;
      if (vol) cit += ` vol. ${vol},`;
      if (issue) cit += ` no. ${issue},`;
      if (pages) cit += ` pp. ${pages},`;
      cit += ` doi: ${work.DOI}.`;
      return cit;
    }
    case "ieee": {
      const dateAccess = new Date();
      const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
      const accessed = `${months[dateAccess.getMonth()]} ${dateAccess.getDate()}, ${dateAccess.getFullYear()}`;
      let cit = `${authorStr}, "${title},"`;
      if (journal) cit += ` *${journal}*,`;
      if (vol) cit += ` vol. ${vol},`;
      if (issue) cit += ` no. ${issue},`;
      if (pages) cit += ` pp. ${pages},`;
      cit += ` ${year}. doi: ${work.DOI}. [Accessed: ${accessed}].`;
      return cit;
    }
    case "bibtex": {
      const firstAuthor = authors[0]?.family.toLowerCase() ?? "unknown";
      const key = `${firstAuthor}${year}`;
      let entry = `@article{${key},\n`;
      entry += `  author = {${authorStr}},\n`;
      entry += `  title = {${title}},\n`;
      if (journal) entry += `  journal = {${journal}},\n`;
      if (vol) entry += `  volume = {${vol}},\n`;
      if (issue) entry += `  number = {${issue}},\n`;
      if (pages) entry += `  pages = {${pages}},\n`;
      entry += `  year = {${year}},\n`;
      entry += `  doi = {${work.DOI}},\n`;
      entry += `  url = {${url}}\n}`;
      return entry;
    }
    default:
      return `${authorStr}. (${year}). ${title}. ${doiUrl}`;
  }
}

// Robustly parse a year from various date string formats
function extractYear(dateStr: string): string | number {
  if (!dateStr) return "n.d.";
  // Exact 4-digit year
  const exact = dateStr.match(/^\d{4}$/);
  if (exact) return parseInt(exact[0], 10);
  // Any 4-digit year embedded in the string
  const embedded = dateStr.match(/\d{4}/);
  if (embedded) return parseInt(embedded[0], 10);
  // Last resort: native Date parse
  const d = new Date(dateStr);
  if (!isNaN(d.getFullYear())) return d.getFullYear();
  return "n.d.";
}

/**
 * Summarize text using the ResearchMate API
 */
export async function summarizeText(text: string, signal?: AbortSignal, mode: SummaryMode = "standard"): Promise<SummaryResult> {
  if (!text.trim()) return { ok: false, summary: "", reason: "empty" };

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/summarize`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text, mode }),
      signal, // Attach standard AbortSignal
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

        // Collect all citation_author meta tags (one per author on academic pages)
        const authorMetas = Array.from(
          document.querySelectorAll('meta[name="citation_author"]')
        )
          .map((m) => m.getAttribute("content"))
          .filter(Boolean) as string[];

        // DOI: meta tags first, then <a href="https://doi.org/..."> links, then body text scan
        const doiPattern = /10\.\d{4,}\/[^\s"'<>[\]{}|\\^~`,;)]+/;
        let doi = getMeta(["citation_doi", "doi", "dc.identifier"]) || "";
        if (!doi) {
          // Check for doi.org links in <a> tags
          const doiLink = document.querySelector('a[href*="doi.org/10."]') as HTMLAnchorElement | null;
          if (doiLink) {
            const m = doiLink.href.match(doiPattern);
            if (m) doi = m[0];
          }
        }
        if (!doi) {
          // Scan visible page text (catches DOI printed as plain text on the page)
          const bodyText = (document.body?.innerText ?? "").slice(0, 50000);
          const m = bodyText.match(doiPattern);
          if (m) doi = m[0].replace(/[.,;)]+$/, "");
        }
        if (!doi) {
          // Scan all <a href> attributes
          const allLinks = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
          for (const a of allLinks) {
            const m = a.href.match(doiPattern);
            if (m) { doi = m[0]; break; }
          }
        }

        return {
          title: document.title || getMeta(["title"]),
          description: getMeta(["description"]),
          author:
            (authorMetas.length > 0 ? authorMetas.join("; ") : null) ||
            jsonIdAuthor ||
            getMeta(["author", "article:author", "dc.creator", "byl", "parsely-author"]),
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
            "og:site_name",
            "dc.publisher",
          ]),
          doi,
          isbn: getMeta(["citation_isbn", "isbn", "dc.identifier.isbn"]),
          volume: getMeta(["citation_volume"]),
          issue: getMeta(["citation_issue"]),
          pages: (() => {
            const f = getMeta(["citation_firstpage"]);
            const l = getMeta(["citation_lastpage"]);
            return f ? (l ? `${f}-${l}` : f) : "";
          })(),
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

export interface OcrResult {
  ok: boolean;
  ocrText?: string;
  ocrConfidence?: number;
  aiSummary?: string;
  error?: string;
}

/**
 * Run OCR on a remote image URL via the ResearchMate API
 */
export async function runOCR(imageUrl: string): Promise<OcrResult> {
  try {
    // Fetch the image and convert to base64 data URL
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) throw new Error("Failed to fetch image");
    const blob = await imgResponse.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(blob);
    });

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/ocr`, {
      method: "POST",
      headers,
      body: JSON.stringify({ image: base64, includeSummary: false }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ok: false, error: data.error || "OCR failed" };
    }

    return {
      ok: true,
      ocrText: data.ocrText,
      ocrConfidence: data.ocrConfidence,
      aiSummary: data.aiSummary,
    };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Run OCR on a local file already loaded as a base64 data URL (skips the fetch step)
 */
export async function runOCRFromDataUrl(base64DataUrl: string): Promise<OcrResult> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/ocr`, {
      method: "POST",
      headers,
      body: JSON.stringify({ image: base64DataUrl, includeSummary: false }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ok: false, error: data.error || "OCR failed" };
    }

    return {
      ok: true,
      ocrText: data.ocrText,
      ocrConfidence: data.ocrConfidence,
      aiSummary: data.aiSummary,
    };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

export async function generateCitation(
  url: string,
  // But this runs in the context of the popup usually.
  styleProp?: string,
): Promise<CitationResult> {
  try {
    const style =
      styleProp || (localStorage.getItem("citationStyle") as any) || "mla";

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
    // Check for ISBN
    if (localMetadata?.isbn) {
      console.log(
        "Found ISBN locally, attempting Tier 1 lookup:",
        localMetadata.isbn,
      );
      const isbnResult = await lookupISBN(localMetadata.isbn);
      if (isbnResult.ok && isbnResult.data && isbnResult.data.length > 0) {
        const book = isbnResult.data[0];
        const author = book.authors?.join(", ") || "Unknown Author";
        const year = book.publishedDate?.split("-")[0] || "n.d.";
        const title = book.title || "Untitled";
        const pub = book.publisher || "Publisher";

        let citation = "";
        if (style === "apa") {
          citation = `${author}. (${year}). *${title}*. ${pub}.`;
        } else if (style === "mla") {
          citation = `${author}. *${title}*. ${pub}, ${year}.`;
        } else {
          citation = `${author}. (${year}). *${title}*. ${pub}.`;
        }
        console.log("Tier 1 Success: Used Library API");
        return { ok: true, citation };
      }
    }

    // --- Tier 1.5: DOI → CrossRef (Free & Authoritative) ---
    const doi = localMetadata?.doi || extractDOIFromUrl(url);
    if (doi) {
      console.log("Found DOI, attempting CrossRef lookup:", doi);
      const work = await lookupCrossRef(doi);
      if (work && work.title?.length && (work.author?.length ?? 0) > 0) {
        console.log("Tier 1.5 Success: Used CrossRef DOI lookup");
        const year = work.published?.["date-parts"]?.[0]?.[0]?.toString() ?? "n.d.";
        return { ok: true, citation: formatCrossRefCitation(work, style, url), inTextCitation: formatInTextCitation(work.author ?? [], year, style) };
      }
    }

    // --- Tier 1.75: CrossRef title search (Free, no DOI needed) ---
    const rawTitle = localMetadata?.title ?? "";
    // Strip common site-name suffixes added by ResearchGate/Springer ("(PDF) ...", "| SpringerLink")
    const cleanTitle = rawTitle
      .replace(/^\(PDF\)\s*/i, "")
      .replace(/\s*[\|–—]\s*.+$/, "")
      .trim();
    if (cleanTitle.length > 20) {
      console.log("Attempting CrossRef title search:", cleanTitle);
      const yearHint = extractYear(localMetadata?.publishDate ?? "");
      const work = await searchCrossRefByTitle(cleanTitle, yearHint !== "n.d." ? yearHint : undefined);
      if (work && work.title?.length && (work.author?.length ?? 0) > 0) {
        console.log("Tier 1.75 Success: Used CrossRef title search");
        const year = work.published?.["date-parts"]?.[0]?.[0]?.toString() ?? "n.d.";
        return { ok: true, citation: formatCrossRefCitation(work, style, url), inTextCitation: formatInTextCitation(work.author ?? [], year, style) };
      }
    }

    // --- Tier 2: Structured Metadata (Free & Good) ---
    let hasAuthor =
      localMetadata &&
      localMetadata.author &&
      localMetadata.author.length > 2 &&
      !localMetadata.author.toLowerCase().includes("unknown");

    // Only use site name as corporate author when no DOI was found
    const hasDoi = !!(localMetadata?.doi || extractDOIFromUrl(url));
    if (!hasAuthor && localMetadata?.siteName && !hasDoi) {
      localMetadata.author = localMetadata.siteName;
      hasAuthor = true;
      console.log("Using Site Name as Corporate Author:", localMetadata.author);
    }

    const hasTitle = localMetadata && localMetadata.title;

    if (hasTitle && hasAuthor) {
      console.log("Tier 2 Success: Used Local Metadata (Human or Corporate)");
    }

    const headers = (await getAuthHeaders()) as Record<string, string>;

    const useAI = localStorage.getItem("useAiCitation") === "true";

    let apiData = null;

    const tier2LooksGood = hasTitle && hasAuthor;

    if (useAI || !tier2LooksGood) {
      console.log("Tier 1 & 2 insufficient, calling Tier 3 (AI)...");
      const response = await fetch(`${API_BASE_URL}/extract-citation`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url, useAI: true }),
      });

      if (response.ok) {
        const json = await response.json();
        apiData = json.metadata;
      }
    } else {
      console.log("Tier 2 sufficient, skipping AI to save credits.");
    }

    // 3. Merge Strategies
    let finalMetadata = apiData || localMetadata;

    const isApiGeneric =
      !apiData ||
      !apiData.author ||
      apiData.title === "Access Denied" ||
      apiData.title === "Just a moment...";

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
    const year = extractYear(finalMetadata.publishDate ?? "");
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
