import React, { useState } from "react";
import { Search, X, Book, Loader2, AlertCircle } from "lucide-react";
import {
  searchBooks,
  lookupISBN,
  BookMetadata,
} from "../services/citationService";

interface ISBNSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBook: (book: BookMetadata) => void;
}

const ISBNSearchModal: React.FC<ISBNSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectBook,
}) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BookMetadata[]>([]);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);
    setSearched(false);

    // Naive ISBN check (numbers and dashes, length 10 or 13)
    const cleanQuery = query.replace(/[-\s]/g, "");
    const isISBN = /^(\d{10}|\d{13})$/.test(cleanQuery);

    let result;
    if (isISBN) {
      result = await lookupISBN(cleanQuery);
    } else {
      result = await searchBooks(query);
    }

    setLoading(false);
    setSearched(true);

    if (result.ok && result.data) {
      setResults(result.data);
    } else {
      setError(result.error || "No books found matches your query.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 z-10">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Book className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Identify Source
          </h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Enter ISBN (e.g., 9780...) or Title"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-400" />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Search"
              )}
            </button>
          </form>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Tip: Use the barcode number (ISBN) for best results.
          </p>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
              <p className="text-sm">Searching library...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 text-red-500 px-6 text-center">
              <AlertCircle className="w-8 h-8 mb-2 opacity-80" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!loading && searched && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Book className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">No books found.</p>
            </div>
          )}

          {!loading &&
            results.map((book, index) => (
              <div
                key={index}
                onClick={() => onSelectBook(book)}
                className="flex gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl cursor-pointer transition-colors group border-b last:border-0 border-gray-50 dark:border-gray-800/50"
              >
                {/* Cover Image */}
                <div className="w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded shadow-sm overflow-hidden flex-shrink-0">
                  {book.imageLinks?.thumbnail ? (
                    <img
                      src={book.imageLinks.thumbnail}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Book className="w-6 h-6 opacity-30" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {book.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                    {book.authors?.join(", ") || "Unknown Author"}
                  </p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span>{book.publishedDate?.split("-")[0] || "n.d."}</span>
                    {book.publisher && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[120px]">
                          {book.publisher}
                        </span>
                      </>
                    )}
                  </div>
                  {book.isbn && (
                    <span className="inline-block mt-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-500">
                      ISBN: {book.isbn}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ISBNSearchModal;
