import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Book, Loader2, AlertCircle, ExternalLink, Sparkles } from "lucide-react";
import {
  searchBooks,
  lookupISBN,
  identifySource,
  BookMetadata,
  IdentifyResult,
} from "../../../services/citationService";
import { useFocusTrap } from "../../../hooks/useFocusTrap";

interface ISBNSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBook: (book: BookMetadata) => void;
  initialQuery?: string;
  itemText?: string; // full OCR text for AI identification
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  book:       { label: "Book",       color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  journal:    { label: "Journal",    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  conference: { label: "Conference", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  article:    { label: "Article",    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  report:     { label: "Report",     color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  thesis:     { label: "Thesis",     color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  movie:      { label: "Movie",      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  tv:         { label: "TV Series",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

const ISBNSearchModal: React.FC<ISBNSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectBook,
  initialQuery = "",
  itemText = "",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen, onClose);

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BookMetadata[]>([]);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<IdentifyResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setSearched(false);

    const cleanQuery = q.replace(/[-\s]/g, "");
    const isISBN = /^(\d{10}|\d{13})$/.test(cleanQuery);
    const result = isISBN ? await lookupISBN(cleanQuery) : await searchBooks(q);

    setLoading(false);
    setSearched(true);

    if (result.ok && result.data && result.data.length > 0) {
      setResults(result.data);
    } else {
      setError(result.error || "No results found. Try a different title or author.");
    }
  }, []);

  const runAiIdentify = useCallback(async (text: string) => {
    setAiLoading(true);
    const result = await identifySource(text);
    setAiLoading(false);
    if (result.ok && result.title) {
      setAiSuggestion(result);
      const q = result.searchQuery || `${result.title} ${result.authors?.[0] || ""}`.trim();
      setQuery(q);
      runSearch(q);
    } else {
      // Fall back to keyword search — skip section headers, find first meaningful line
      const SKIP = /^(abstract|introduction|methods?|results?|discussion|conclusion|references?|keywords?|background|related work|methodology|overview|summary|acknowledgements?|appendix)\s*:?\s*$/i;
      const safeInitial = SKIP.test(initialQuery.trim()) ? "" : initialQuery.trim();
      const fallback = safeInitial || (() => {
        const lines = text.replace(/[#*_`>]/g, "").split("\n").map(l => l.trim()).filter(l => l.length > 8);
        return lines.find(l => !SKIP.test(l))?.slice(0, 80) || "";
      })();
      if (fallback) {
        setQuery(fallback);
        runSearch(fallback);
      }
    }
  }, [initialQuery, runSearch]);

  useEffect(() => {
    if (!isOpen) {
      setResults([]);
      setSearched(false);
      setError("");
      setAiSuggestion(null);
      return;
    }

    // If we have full OCR text, use AI to identify first
    if (itemText.trim().length > 30) {
      runAiIdentify(itemText);
    } else if (initialQuery.trim()) {
      setQuery(initialQuery);
      runSearch(initialQuery);
    }
  }, [isOpen, itemText, initialQuery, runAiIdentify, runSearch]);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    runSearch(query);
  };

  const confidenceColor =
    (aiSuggestion?.confidence || 0) >= 70 ? "text-green-600 dark:text-green-400" :
    (aiSuggestion?.confidence || 0) >= 40 ? "text-yellow-600 dark:text-yellow-400" :
    "text-red-500";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Identify source"
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Book className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Identify Source
          </h3>
          <button onClick={onClose} aria-label="Close modal" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Suggestion Banner */}
        {aiLoading && (
          <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500 flex-shrink-0" />
            <span className="text-sm text-indigo-600 dark:text-indigo-400">AI is analyzing your text to identify the source…</span>
          </div>
        )}

        {!aiLoading && aiSuggestion && (
          <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                  AI Identified · <span className={confidenceColor}>{aiSuggestion.confidence}% confidence</span>
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">
                  {aiSuggestion.title}
                </p>
                {aiSuggestion.authors && aiSuggestion.authors.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    by {aiSuggestion.authors.join(", ")}{aiSuggestion.year ? ` · ${aiSuggestion.year}` : ""}
                  </p>
                )}
                {aiSuggestion.reasoning && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic line-clamp-2">
                    {aiSuggestion.reasoning}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search Input */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Title, author, ISBN, or DOI…"
              className="w-full pl-10 pr-20 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus={!itemText}
            />
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
            </button>
          </form>
          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            Searches books, academic papers & movies simultaneously
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
              <p className="text-sm">Searching books, papers & movies…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-10 text-red-500 px-6 text-center">
              <AlertCircle className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!loading && searched && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Book className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">No results found.</p>
              <p className="text-xs mt-1 text-gray-400">Try a shorter or different title</p>
            </div>
          )}

          {!loading && results.map((book, index) => {
            const badge = SOURCE_LABELS[book.sourceType || "book"] || SOURCE_LABELS.book;
            return (
              <div
                key={index}
                onClick={() => onSelectBook(book)}
                className="flex gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl cursor-pointer transition-colors group border-b last:border-0 border-gray-50 dark:border-gray-800/50"
              >
                <div className="w-14 h-20 bg-gray-100 dark:bg-gray-700 rounded shadow-sm overflow-hidden flex-shrink-0">
                  {book.imageLinks?.thumbnail ? (
                    <img src={book.imageLinks.thumbnail} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                      <Book className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {book.title}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {book.authors?.join(", ") || "Unknown Author"}
                  </p>
                  {book.journal && (
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5 italic truncate">{book.journal}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-gray-400">
                    {book.publishedDate && <span>{book.publishedDate.split("-")[0]}</span>}
                    {book.publisher && !book.journal && <span className="truncate max-w-[120px]">· {book.publisher}</span>}
                    {book.isbn && <span className="font-mono">ISBN {book.isbn}</span>}
                    {book.doi && (
                      <a
                        href={`https://doi.org/${book.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-500 hover:underline flex items-center gap-0.5"
                      >
                        DOI <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ISBNSearchModal;
