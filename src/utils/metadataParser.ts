// ============================================
// metadataParser.ts - Academic Metadata Auto-Parser
// ============================================

export interface ExtractedMetadata {
  title?: string;
  authors?: string[];
  journal?: string;
  year?: string;
  doi?: string;
  volume?: string;
  issue?: string;
  firstpage?: string;
  lastpage?: string;
  abstract?: string;
  pdfUrl?: string;
  arxivId?: string;
}

/**
 * Parses academic metadata from the active document's meta tags.
 * Supports Highwire Press (Google Scholar), Dublin Core, and Open Graph.
 */
export function parseMetadata(doc: Document = document): ExtractedMetadata {
  const meta: ExtractedMetadata = {};

  // Helper to get meta content by name or property attribute
  const getMeta = (names: string[]): string | undefined => {
    for (const name of names) {
      const el = doc.querySelector(`meta[name="${name}"], meta[property="${name}"], meta[name*=":${name}"]`);
      if (el) {
        const content = el.getAttribute("content")?.trim();
        if (content) return content;
      }
    }
    return undefined;
  };

  // Helper to get all meta contents (e.g., for multiple authors)
  const getAllMeta = (names: string[]): string[] => {
    const results: string[] = [];
    for (const name of names) {
      const elements = doc.querySelectorAll(`meta[name="${name}"], meta[property="${name}"]`);
      elements.forEach((el) => {
        const content = el.getAttribute("content")?.trim();
        if (content && !results.includes(content)) {
          results.push(content);
        }
      });
    }
    return results;
  };

  // 1. Core metadata tags
  meta.title = getMeta(["citation_title", "DC.title", "og:title", "twitter:title"]) || doc.title;
  
  const authors = getAllMeta(["citation_author", "DC.creator"]);
  if (authors.length > 0) {
    meta.authors = authors;
  }

  meta.journal = getMeta([
    "citation_journal_title",
    "citation_publisher",
    "DC.publisher",
    "citation_technical_report_institution",
    "og:site_name"
  ]);

  const pubDate = getMeta(["citation_publication_date", "citation_date", "DC.date", "DCTERMS.issued"]);
  if (pubDate) {
    const yearMatch = pubDate.match(/\d{4}/);
    if (yearMatch) {
      meta.year = yearMatch[0];
    }
  }

  // DOI extraction
  let extractedDoi = getMeta(["citation_doi", "citation_doi", "DC.identifier"]);
  if (extractedDoi) {
    if (extractedDoi.startsWith("doi:")) {
      extractedDoi = extractedDoi.substring(4).trim();
    }
    // Validate DOI format loosely (should start with 10.)
    const doiMatch = extractedDoi.match(/10\.\d{4,}\/[^\s"<>[\]{}|\\^~`]+/);
    if (doiMatch) {
      meta.doi = doiMatch[0];
    }
  }

  meta.volume = getMeta(["citation_volume"]);
  meta.issue = getMeta(["citation_issue"]);
  meta.firstpage = getMeta(["citation_firstpage"]);
  meta.lastpage = getMeta(["citation_lastpage"]);
  
  meta.abstract = getMeta(["citation_abstract", "description", "og:description", "DC.description"]);
  meta.pdfUrl = getMeta(["citation_pdf_url"]);

  // 2. Site-specific fallbacks and parsers
  const url = doc.location.href;

  if (url.includes("arxiv.org")) {
    meta.journal = meta.journal || "arXiv preprint";
    const arxivMatch = url.match(/abs\/(\d{4}\.\d{4,5})/);
    if (arxivMatch) {
      meta.arxivId = arxivMatch[1];
    }
    
    // Abstract parser fallback from arXiv HTML page
    if (!meta.abstract || meta.abstract.length < 50) {
      const abstractEl = doc.querySelector("blockquote.abstract");
      if (abstractEl) {
        meta.abstract = abstractEl.textContent?.replace(/^Abstract:\s*/i, "").trim();
      }
    }
  }

  if (url.includes("pubmed.ncbi.nlm.nih.gov")) {
    meta.journal = meta.journal || "PubMed";
    const PMIDEl = doc.querySelector("meta[name=\"ncbi_uid\"]");
    const PMID = PMIDEl?.getAttribute("content")?.trim();
    if (PMID) {
      meta.arxivId = `PMID:${PMID}`;
    }
  }

  // Clean strings
  if (meta.title) {
    meta.title = meta.title.replace(/\s+/g, " ").trim();
  }
  if (meta.abstract) {
    meta.abstract = meta.abstract.replace(/\s+/g, " ").trim();
  }

  return meta;
}

/**
 * Formats parsed metadata into a citation string.
 * Supports APA style by default.
 */
export function formatMetadataCitation(meta: ExtractedMetadata, url: string, style: string = "apa"): string {
  const authors = meta.authors || [];
  let authorStr = "Unknown Author";
  if (authors.length > 0) {
    if (style === "apa") {
      const formatted = authors.map((author) => {
        const parts = author.trim().split(/\s+/);
        if (parts.length > 1) {
          const family = parts[parts.length - 1];
          const initials = parts.slice(0, -1).map((p) => p.charAt(0).toUpperCase() + ".").join(" ");
          return `${family}, ${initials}`;
        }
        return author;
      });
      if (formatted.length === 1) authorStr = formatted[0];
      else if (formatted.length === 2) authorStr = `${formatted[0]} & ${formatted[1]}`;
      else authorStr = formatted.slice(0, -1).join(", ") + ", & " + formatted[formatted.length - 1];
    } else {
      authorStr = authors.join(", ");
    }
  }

  const year = meta.year || "n.d.";
  const title = meta.title || "Untitled Document";
  const journal = meta.journal || "";
  const vol = meta.volume || "";
  const issue = meta.issue || "";
  const pages = (meta.firstpage && meta.lastpage) ? `${meta.firstpage}-${meta.lastpage}` : (meta.firstpage || "");
  const doi = meta.doi ? `https://doi.org/${meta.doi}` : "";

  switch (style) {
    case "apa":
    default: {
      let cit = `${authorStr}. (${year}). ${title}.`;
      if (journal) cit += ` *${journal}*`;
      const volIssue = vol ? (issue ? `${vol}(${issue})` : vol) : "";
      const volIssuePage = [volIssue, pages].filter(Boolean).join(", ");
      if (volIssuePage) cit += `, ${volIssuePage}`;
      cit += `.`;
      if (doi) cit += ` ${doi}`;
      else if (url) cit += ` Retrieved from ${url}`;
      return cit;
    }
  }
}

