// Shared constants — single source of truth for magic strings across the codebase

export const STORAGE_KEY = "researchMateItems" as const;

export const QUICK_SAVE_TAG = "quick-save" as const;

export const CITATION_FORMATS = ["apa", "mla", "harvard", "chicago", "ieee", "bibtex"] as const;
export type CitationFormat = typeof CITATION_FORMATS[number];
