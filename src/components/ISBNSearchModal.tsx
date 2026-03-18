import React, { useState, useEffect } from "react";
import { Search, X, Book, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import {
  searchBooks,
  lookupISBN,
  BookMetadata,
} from "../services/citationService";

interface ISBNSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBook: (book: BookMetadata) => void;
  initialQuery?: string; // pre-populated from OCR text
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  book:       { label: "Book",       color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  journal:    { label: "Journal",    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  conference: { label: "Conference", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  article:    { label: "Article",    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  report:     { label: "Report",     color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  thesis:     { label: "Thesis",     color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
};

const ISBNSearchModal: React.FC<ISBNSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectBook,
  initialQuery = "",
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BookMetadata[]>([]);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  // Auto-search when modal opens with an initial query
  useEffect(() => {
    if (isOpen && initialQuery.trim()) {
      setQuery(initialQuery);
      runSearch(initialQuery);
    }
  }, [isOpen, initialQuery]);

  if (!isOpen) return null;

  const runSearch = async (q: string) => {
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
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    runSearch(query);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200"
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

        {/* Search Input */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Title, author, ISBN, or DOI…"
              className="w-full pl-10 pr-20 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
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
            Searches books <span className="text-blue-500">and</span> academic papers simultaneously
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[260px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
              <p className="text-sm">Searching books & academic papers…</p>
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
                {/* Cover / Type icon */}
                <div className="w-14 h-20 bg-gray-100 dark:bg-gray-700 rounded shadow-sm overflow-hidden flex-shrink-0">
                  {book.imageLinks?.thumbnail ? (
                    <img src={book.imageLinks.thumbnail} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                      <Book className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1.5 mb-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${badge.color}`}>
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
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5 truncate italic">
                      {book.journal}
                    </p>
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
