import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "./Toast";
import {
  StorageItem,
  deleteItem,
  updateItem,
} from "../services/storageService";
import { summarizeText, generateCitation, runOCR } from "../services/geminiService";
import type { SummaryMode } from "../services/geminiService";
import {
  exportSingleItemToPdf,
  exportSingleItemToJson,
} from "../services/pdfService";
import {
  ArrowLeft,
  Tag,
  CheckCircle2,
  Sparkles,
  Quote,
  Loader2,
  Plus,
  ExternalLink,
  BookOpen,
  Download,
  ArrowUp,
  ArrowDown,
  Pencil,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { Trash } from "lucide-react";
import { CopyIcon } from "./icons";
import { generateMarkdownTemplate } from "../utils/markdownGenerator";
import ISBNSearchModal from "./ISBNSearchModal";
import { BookMetadata } from "../services/citationService";

interface ItemDetailProps {
  item: StorageItem;
  onBack: () => void;
  onDelete: () => void;
  onUpdate: () => void;
}

const ItemDetail: React.FC<ItemDetailProps> = ({
  item,
  onBack,
  onDelete,
  onUpdate,
}) => {
  const [copied, setCopied] = useState(false);

  // Local State initialized from Item (for immediate UI updates)
  const [summary, setSummary] = useState(item.aiSummary || "");
  const [citation, setCitation] = useState(item.citation || "");
  const [inTextCitation, setInTextCitation] = useState("");
  const [citationFormat, setCitationFormat] = useState(
    item.citationFormat || "mla",
  );
  const [tags, setTags] = useState<string[]>(item.tags || []);
  const [itemColor, setItemColor] = useState<"yellow" | "green" | "red" | "blue" | "purple" | "">(item.color || "");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("standard");
  const [loadingCitation, setLoadingCitation] = useState(false);
  // Use a ref instead of state so abort doesn't trigger re-renders and cleanup works on unmount
  const abortControllerRef = useRef<AbortController | null>(null);
  // Rate-limiting refs — track last call time to prevent rapid re-triggers
  const lastSummarizeRef = useRef<number>(0);
  const lastCiteRef = useRef<number>(0);
  const { toast } = useToast();

  // True for any item that went through OCR — not just smart_pen
  const hasOcrData = item.ocrConfidence != null || !!item.imageUrl;

  // OCR editing state
  const [isEditingOcr, setIsEditingOcr] = useState(false);
  const [editedOcrText, setEditedOcrText] = useState(item.text);
  const [ocrEdited, setOcrEdited] = useState(item.ocrEdited ?? false);
  const [isRetryingOcr, setIsRetryingOcr] = useState(false);

  // Abort any in-flight summarization on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Initialize from preference OR default to showing summary if it exists
  const [showSummaryView, setShowSummaryView] = useState(() => {
    if (item.preferredView) {
      return item.preferredView === "summary";
    }
    return !!item.aiSummary;
  });

  // Tag State
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");

  // Note editing state
  const [itemNote, setItemNote] = useState(item.note || "");
  const [isEditingNote, setIsEditingNote] = useState(false);

  const handleSaveNote = async () => {
    try {
      await updateItem(item.id, { note: itemNote });
      setIsEditingNote(false);
      onUpdate();
      toast("Note saved", "success");
    } catch {
      toast("Failed to save note", "error");
    }
  };

  // ISBN Search State
  const [isIdentifyModalOpen, setIsIdentifyModalOpen] = useState(false);

  // Scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const check = () => {
      setShowScrollTop(el.scrollTop > 80);
      setShowScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
    };
    el.addEventListener("scroll", check, { passive: true });
    // Defer initial check until after browser layout is complete
    const raf = requestAnimationFrame(check);
    return () => {
      el.removeEventListener("scroll", check);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Re-check scroll bounds whenever content grows (summary/citation added)
  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      setShowScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
    });
  }, [summary, citation]);

  const scrollToTop = () =>
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  const scrollToBottom = () =>
    scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" });

  // Sync tags if item prop changes
  useEffect(() => {
    setTags(item.tags || []);
  }, [item.tags]);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      showSummaryView && summary ? summary : item.text,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleView = async (showSummary: boolean) => {
    setShowSummaryView(showSummary);
    await updateItem(item.id, {
      preferredView: showSummary ? "summary" : "original",
    });
    onUpdate();
  };

  const handleDelete = () => {
    let undone = false;
    // Navigate away immediately — item still in DB during undo window
    onDelete();
    toast("Item deleted", "info", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          // Item is still in DB — re-fetch to restore it in the list
          onUpdate();
        },
      },
    });
    setTimeout(async () => {
      if (undone) return;
      try {
        await deleteItem(item.id);
      } catch {
        toast("Failed to delete item. Please try again.", "error");
        onUpdate();
      }
    }, 5100);
  };

  const cancelSummarization = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSummarizing(false);
  };

  const handleSummarize = async (overrideMode?: SummaryMode) => {
    const now = Date.now();
    if (now - lastSummarizeRef.current < 3000) {
      toast("Please wait a moment before summarizing again.", "info");
      return;
    }
    lastSummarizeRef.current = now;
    const modeToUse = overrideMode ?? summaryMode;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setSummarizing(true);
    setSummary(""); // Clear existing so loading overlay appears
    setShowSummaryView(false);
    try {
      const result = await summarizeText(item.text, controller.signal, modeToUse);
      if (result.ok) {
        setSummary(result.summary);
        setShowSummaryView(true);
        // Persist — failure here is non-critical; don't let it mask a successful summary
        try {
          await updateItem(item.id, {
            aiSummary: result.summary,
            preferredView: "summary",
          });
          onUpdate();
        } catch (persistError) {
          console.error("Failed to persist summary:", persistError);
        }
      } else {
        toast(result.error || "Failed to generate summary", "error");
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        toast("Error generating summary", "error");
      }
    } finally {
      setSummarizing(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const mdContent = generateMarkdownTemplate(item);
      await navigator.clipboard.writeText(mdContent);
      toast("Markdown copied to clipboard!");
    } catch (e) {
      console.error("Failed to copy markdown", e);
      toast("Failed to copy markdown", "error");
    }
  };

  const handleCite = async (overrideFormat?: string) => {
    const now = Date.now();
    if (now - lastCiteRef.current < 3000) {
      toast("Please wait a moment before generating another citation.", "info");
      return;
    }
    lastCiteRef.current = now;
    const formatToUse = overrideFormat || citationFormat;

    // If we simply clicked the header button and a citation exists,
    // maybe just ensure it's visible?
    if (citation && !overrideFormat) {
      // Scroll to citation?
      const citationElement = document.getElementById("citation-card");
      citationElement?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // Smart Integration: If it's a pen note and unknown source, open the "Identify" modal
    // effectively "saving credits" by not calling the generic AI scraper on an empty URL.
    if (
      (item.deviceSource === "smart_pen" || !item.sourceUrl) &&
      !item.citation
    ) {
      setIsIdentifyModalOpen(true);
      return;
    }

    setLoadingCitation(true);

    if (item.sourceUrl) {
      const result = await generateCitation(item.sourceUrl, formatToUse);
      if (result.ok) {
        setCitation(result.citation);
        if (result.inTextCitation) setInTextCitation(result.inTextCitation);
        setCitationFormat(formatToUse);
        await updateItem(item.id, {
          citation: result.citation,
          citationFormat: formatToUse,
        });
        onUpdate();
      } else {
        toast(result.error || "Failed to generate citation", "error");
      }
    } else {
      // Fallback local citation
      const newCitation = `${item.sourceTitle || "Untitled"}. (${new Date(item.createdAt).getFullYear()}). ResearchMate Save. [${formatToUse.toUpperCase()}]`;
      setCitation(newCitation);
      setCitationFormat(formatToUse);
      await updateItem(item.id, {
        citation: newCitation,
        citationFormat: formatToUse,
      });
      onUpdate();
    }
    setLoadingCitation(false);
  };

  // Build the full tags array (display tags + encoded color) for storage
  const buildTagsForStorage = (displayTags: string[], color: string) => {
    const base = displayTags.filter((t) => !t.startsWith("color:"));
    return color ? [...base, `color:${color}`] : base;
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    const updatedTags = [...tags, newTag.trim()];
    setTags(updatedTags); // Optimistic UI update
    await updateItem(item.id, { tags: buildTagsForStorage(updatedTags, itemColor) });
    onUpdate();
    setIsAddingTag(false);
    setNewTag("");
  };

  const handleDeleteTag = async (tagToDelete: string) => {
    const updatedTags = tags.filter((t) => t !== tagToDelete);
    setTags(updatedTags); // Optimistic UI update
    await updateItem(item.id, { tags: buildTagsForStorage(updatedTags, itemColor) });
    onUpdate();
  };

  const handleColorChange = async (color: "yellow" | "green" | "red" | "blue" | "purple" | "") => {
    const newColor = itemColor === color ? "" : color;
    setItemColor(newColor);
    await updateItem(item.id, { tags: buildTagsForStorage(tags, newColor) });
    onUpdate();
  };

  const handleSaveOcrEdit = async () => {
    if (!editedOcrText.trim()) return;
    try {
      // Encode ocrEdited as "ocr:edited" tag so it persists without a DB migration
      const newTags = [...item.tags.filter((t) => t !== "ocr:edited"), "ocr:edited"];
      await updateItem(item.id, { text: editedOcrText, tags: newTags, ocrConfidence: null });
      setOcrEdited(true);
      setIsEditingOcr(false);
      onUpdate();
      toast("OCR text updated", "success");
      // Auto-regenerate citation so it matches the corrected text
      if (citation) {
        await handleCite(citationFormat);
      }
    } catch {
      toast("Failed to save changes", "error");
    }
  };

  const handleRetryOcr = async () => {
    if (!item.imageUrl) return;
    setIsRetryingOcr(true);
    try {
      const result = await runOCR(item.imageUrl);
      if (result.ok && result.ocrText) {
        // Remove "ocr:edited" tag — text is now fresh from OCR
        const newTags = item.tags.filter((t) => t !== "ocr:edited");
        await updateItem(item.id, {
          text: result.ocrText,
          tags: newTags,
          ocrConfidence: result.ocrConfidence,
        });
        setEditedOcrText(result.ocrText);
        setOcrEdited(false);
        setIsEditingOcr(false);
        onUpdate();
        toast("OCR re-processed successfully", "success");
      } else {
        toast(result.error || "OCR retry failed", "error");
      }
    } catch {
      toast("OCR retry failed", "error");
    }
    setIsRetryingOcr(false);
  };

  const handleBookSelect = async (book: BookMetadata) => {
    const authors = book.authors?.join(", ") || "Unknown";
    const rawDate = book.publishedDate || "";
    const yearMatch = rawDate.match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : "n.d.";
    const newCitation = `${authors} (${year}). *${book.title}*. ${book.publisher || "Publisher"}.`;

    await updateItem(item.id, {
      sourceTitle: book.title,
      citation: newCitation,
      sourceUrl: book.previewLink || book.infoLink || "",
      citationFormat: "apa",
    });

    // Update local state via setState (no prop mutation)
    setCitation(newCitation);
    setCitationFormat("apa");

    onUpdate();
    setIsIdentifyModalOpen(false);
  };

  const handleDownload = () => {
    const format = localStorage.getItem("exportFormat") || "pdf";
    if (format === "pdf") {
      exportSingleItemToPdf(item);
    } else if (format === "json") {
      exportSingleItemToJson(item);
    } else if (format === "md") {
      const mdContent = generateMarkdownTemplate(item);
      const element = document.createElement("a");
      const file = new Blob([mdContent], { type: "text/markdown" });
      element.href = URL.createObjectURL(file);
      element.download = `researchmate_item_${item.id.substring(0, 8)}.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else if (format === "txt") {
      // Simple TXT download
      const textContent = `Title: ${item.sourceTitle || "Untitled"}\n\n${item.citation ? `Citation: ${item.citation}\n\n` : ""}${item.aiSummary ? `Summary:\n${item.aiSummary}\n\nOriginal Text:\n` : ""}${item.text}\n\nSource: ${item.sourceUrl || "-"}`;
      const element = document.createElement("a");
      const file = new Blob([textContent], { type: "text/plain" });
      element.href = URL.createObjectURL(file);
      element.download = `researchmate_item_${item.id.substring(0, 8)}.txt`;
      document.body.appendChild(element); // Required for this to work in FireFox
      element.click();
      document.body.removeChild(element);
    }
  };

  // Helper to get exact hex for detailed view badge
  let colorHex = "#D1D5DB"; // default gray
  let colorName = "None";
  if (item.color === "yellow") { colorHex = "#FBBF24"; colorName = "Yellow"; }
  if (item.color === "green") { colorHex = "#34D399"; colorName = "Green"; }
  if (item.color === "blue") { colorHex = "#60A5FA"; colorName = "Blue"; }
  if (item.color === "red") { colorHex = "#F87171"; colorName = "Red"; }
  if (item.color === "purple") { colorHex = "#A78BFA"; colorName = "Purple"; }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 relative">
      <ISBNSearchModal
        isOpen={isIdentifyModalOpen}
        onClose={() => setIsIdentifyModalOpen(false)}
        onSelectBook={handleBookSelect}
      />
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur z-10">
        <button
          onClick={onBack}
          aria-label="Go back"
          className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group border border-gray-200 dark:border-gray-700"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            aria-label="Copy content"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
            title="Copy content"
          >
            {copied ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <CopyIcon size={20} className="w-5 h-5" />
            )}
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            aria-label="Download Item"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
            title="Download Item"
          >
            <Download className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

          {/* Citation Button - Persistent */}
          <button
            onClick={() => handleCite()}
            disabled={loadingCitation}
            aria-label="Generate Citation"
            className={`p-2 rounded-lg transition-colors ${citation ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            title="Generate Citation"
          >
            {loadingCitation ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Quote className="w-5 h-5" />
            )}
          </button>

          {/* Summarize Button - Persistent */}
          <button
            onClick={() => handleSummarize()}
            disabled={summarizing}
            aria-label="Summarize content"
            className={`p-2 rounded-lg transition-colors ${summary ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            title="Summarize"
          >
            {summarizing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </button>

          {/* Summary Mode Selector */}
          <select
            value={summaryMode}
            onChange={(e) => {
              const newMode = e.target.value as SummaryMode;
              setSummaryMode(newMode);
              // If a summary already exists, regenerate immediately with the new mode
              if (summary) handleSummarize(newMode);
            }}
            disabled={summarizing}
            aria-label="Summary Mode"
            className="appearance-none px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] font-medium text-gray-600 dark:text-gray-300 outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="ultra-short">⚡ Short</option>
            <option value="standard">📝 Standard</option>
            <option value="detailed">📖 Detailed</option>
          </select>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

          {item.sourceUrl ? (
            <button
              onClick={() => window.open(item.sourceUrl, "_blank")}
              aria-label="Visit source"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
              title="Visit Source"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setIsIdentifyModalOpen(true)}
              aria-label="Identify Source"
              className="p-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors text-gray-400 hover:text-orange-500"
              title="Identify Source"
            >
              <BookOpen className="w-5 h-5" />
            </button>
          )}

          <div className="relative group">
            <button
              onClick={handleCopyMarkdown}
              aria-label="Copy as Markdown"
              className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors text-gray-400 hover:text-emerald-500 flex items-center gap-1"
              title="Copy as Markdown"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-type-2"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M2.5 15h3"/><path d="M4 13v6"/><path d="M9 13v6"/><path d="M11 16l-2-3"/><path d="M11 19l-2-3"/><path d="M16 13v6"/><path d="M14 15h3"/></svg>
            </button>
            <div className="absolute right-0 top-full mt-2 w-max px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Copy as Markdown
            </div>
          </div>

          <button
            onClick={handleDelete}
            aria-label="Delete item"
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-gray-400 hover:text-red-500"
            title="Delete item"
          >
            <Trash className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 scrollbar-hide relative">
        {/* Source Info */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {item.color && (
            <div 
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${colorHex}20`, color: colorHex }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colorHex }}></div>
              {colorName}
            </div>
          )}
        </div>
        
        {/* Smart Pen / Image Content */}
        {item.imageUrl && (
          <div className="mb-6 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-pen-tool"
                >
                  <path d="m12 19 7-7 3 3-7 7-3-3z" />
                  <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-17z" />
                  <path d="m2 2 7.586 7.586" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Handwritten Note
              </span>
            </div>
            <img
              src={item.imageUrl}
              alt="Smart Pen Capture"
              className="w-full h-auto object-cover max-h-[300px] hover:max-h-full transition-all cursor-zoom-in"
            />
          </div>
        )}

        {/* OCR Text / Research Content Header with Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-book-open w-4 h-4 text-gray-400"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {hasOcrData ? "Transcribed Text (OCR)" : "Research Content"}
              </h3>
              {/* OCR badges */}
              {hasOcrData && (
                <div className="flex items-center gap-1.5 ml-2">
                  {item.ocrConfidence != null && (
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.ocrConfidence >= 80 ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : item.ocrConfidence >= 60 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400" : "bg-red-100 dark:bg-red-900/30 text-red-500"}`}>
                      {item.ocrConfidence}% conf.
                    </span>
                  )}
                  {ocrEdited && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      Edited
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* OCR edit / retry controls */}
              {hasOcrData && !isEditingOcr && !showSummaryView && (
                <>
                  <button
                    onClick={() => { setEditedOcrText(item.text); setIsEditingOcr(true); }}
                    aria-label="Edit OCR text"
                    className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                    title="Edit OCR text"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  {item.imageUrl && (
                    <button
                      onClick={handleRetryOcr}
                      disabled={isRetryingOcr}
                      aria-label="Retry OCR"
                      className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-orange-500 transition-colors flex items-center gap-1 disabled:opacity-50"
                      title="Re-run OCR"
                    >
                      {isRetryingOcr ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Retry OCR
                    </button>
                  )}
                </>
              )}
              {/* Toggle between Summary and Original */}
              {summary && !isEditingOcr && (
                <button
                  onClick={() => handleToggleView(!showSummaryView)}
                  aria-label={showSummaryView ? "View original content" : "View summary"}
                  className="text-[10px] font-bold uppercase tracking-wider text-purple-600 hover:text-purple-700 transition-colors flex items-center gap-1"
                >
                  <div className="flex items-center gap-1 opacity-70 hover:opacity-100">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={showSummaryView ? "M9 14 4 9l5-5" : "M15 10l5 5-5 5"} />
                    </svg>
                    {showSummaryView ? "View Original" : "View Summary"}
                  </div>
                </button>
              )}
            </div>
          </div>

          <div className="relative group min-h-[60px]">
            {isEditingOcr ? (
              /* OCR editing mode */
              <div className="space-y-2">
                <textarea
                  value={editedOcrText}
                  onChange={(e) => setEditedOcrText(e.target.value)}
                  aria-label="Edit OCR text"
                  className="w-full min-h-[140px] p-3 text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded-xl resize-y outline-none focus:ring-2 focus:ring-indigo-400/30 font-serif leading-relaxed"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setIsEditingOcr(false)}
                    aria-label="Cancel editing"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                  <button
                    onClick={handleSaveOcrEdit}
                    aria-label="Save OCR edits"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                  >
                    <Save className="w-3 h-3" /> Save
                  </button>
                </div>
              </div>
            ) : showSummaryView && summary ? (
              <div className="animation-fade-in bg-purple-50/50 dark:bg-purple-900/10 rounded-xl p-4 border border-purple-100 dark:border-purple-900/30">
                <p className="text-gray-800 dark:text-gray-200 text-base leading-relaxed whitespace-pre-wrap font-serif">
                  {summary}
                </p>
                <div className="mt-2 flex justify-end">
                  <span className="text-[10px] text-purple-400 uppercase tracking-widest font-bold opacity-70">
                    AI Generated
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-apple-blue to-purple-500 rounded-full opacity-30"></div>
                {/^#{1,3} |\n#{1,3} |\|.+\|/.test(item.text) ? (
                  <div className="pl-3 space-y-2 text-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-4 mb-1 border-b border-gray-200 dark:border-gray-700 pb-1">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold text-blue-900 dark:text-blue-300 mt-3 mb-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-2 mb-1">{children}</h3>,
                        p: ({ children }) => <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-serif">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-white">{children}</strong>,
                        em: ({ children }) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
                        ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 text-gray-800 dark:text-gray-200 font-serif">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 text-gray-800 dark:text-gray-200 font-serif">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-500 dark:text-gray-400 text-xs my-1">{children}</blockquote>,
                        hr: () => <hr className="border-gray-200 dark:border-gray-700 my-2" />,
                        table: ({ children }) => <div className="overflow-x-auto my-2"><table className="w-full text-xs border-collapse">{children}</table></div>,
                        thead: ({ children }) => <thead className="bg-blue-50 dark:bg-blue-900/30">{children}</thead>,
                        th: ({ children }) => <th className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 font-semibold text-gray-900 dark:text-white text-left">{children}</th>,
                        td: ({ children }) => <td className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-gray-700 dark:text-gray-300 align-top">{children}</td>,
                        code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono text-gray-800 dark:text-gray-200">{children}</code>,
                      }}
                    >
                      {item.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-gray-800 dark:text-gray-200 text-base leading-relaxed whitespace-pre-wrap pl-3 font-serif">
                    {item.text}
                  </p>
                )}
              </>
            )}

            {/* Loading State Overlay */}
            {summarizing && !summary && (
              <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  <span className="text-sm font-medium text-purple-600">
                    Summarizing...
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelSummarization(); }}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Citation Card (Persistent) */}
        {citation && (
          <div
            id="citation-card"
            className="mb-6 bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-800/50 animation-fade-in-up group relative"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Quote className="w-4 h-4 text-apple-blue" />
                <h3 className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                  Citation
                </h3>
              </div>

              {/* Format Selector */}
              <div className="relative z-20">
                <select
                  value={citationFormat}
                  onChange={(e) => handleCite(e.target.value)}
                  aria-label="Citation Format"
                  className="appearance-none pl-3 pr-8 py-1 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-medium text-blue-800 dark:text-blue-200 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors relative z-20"
                >
                  <option value="apa">APA</option>
                  <option value="mla">MLA</option>
                  <option value="harvard">Harvard</option>
                  <option value="chicago">Chicago</option>
                  <option value="ieee">IEEE</option>
                  <option value="bibtex">BibTeX</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-blue-500 z-20">
                  <svg
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 1L5 5L9 1" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="relative">
              {loadingCitation ? (
                <div className="h-10 flex items-center justify-center text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-blue-900 dark:text-blue-100 font-serif italic leading-relaxed break-all">
                    {citation}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(citation);
                      toast("Citation copied!", "success");
                    }}
                    aria-label="Copy citation"
                    className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                  >
                    <CopyIcon size={12} className="w-3 h-3" />
                    Copy
                  </button>
                  {inTextCitation && (
                    <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/40">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">In-text</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 font-mono">{inTextCitation}</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(inTextCitation);
                          toast("In-text citation copied!", "success");
                        }}
                        aria-label="Copy in-text citation"
                        className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                      >
                        <CopyIcon size={12} className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Note / Annotation */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Note</h3>
            {!isEditingNote ? (
              <button
                onClick={() => setIsEditingNote(true)}
                aria-label="Edit note"
                className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNote}
                  className="text-[10px] font-bold uppercase tracking-wider text-green-600 hover:text-green-700 transition-colors flex items-center gap-1"
                >
                  <Save className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={() => { setItemNote(item.note || ""); setIsEditingNote(false); }}
                  className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            )}
          </div>
          {isEditingNote ? (
            <textarea
              autoFocus
              value={itemNote}
              onChange={(e) => setItemNote(e.target.value)}
              rows={3}
              className="w-full text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Add a note…"
            />
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed min-h-[2rem]">
              {itemNote || <span className="italic text-gray-400 dark:text-gray-600">No note yet. Click Edit to add one.</span>}
            </p>
          )}
        </div>

        {/* Tags & Color */}
        <div className="mt-6 space-y-4">
          {/* Color Picker Section */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Color Tag
            </h3>
            <div className="flex gap-2">
              {([
                { name: "yellow", hex: "#FBBF24" },
                { name: "green", hex: "#34D399" },
                { name: "blue", hex: "#60A5FA" },
                { name: "red", hex: "#F87171" },
                { name: "purple", hex: "#A78BFA" },
              ] as const).map((c) => (
                <button
                  key={c.name}
                  onClick={() => handleColorChange(c.name)}
                  aria-label={`Mark as ${c.name}${itemColor === c.name ? " (selected)" : ""}`}
                  aria-pressed={itemColor === c.name}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    itemColor === c.name
                      ? "border-gray-900 dark:border-white scale-110 shadow-sm"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {itemColor && (
                <button
                  onClick={() => handleColorChange("")}
                  className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors uppercase font-bold tracking-tighter"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 group/tag hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <Tag className="w-3 h-3 opacity-70" />
                {tag}
                <button
                  onClick={() => handleDeleteTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                  className="ml-1 -mr-1 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover/tag:opacity-100"
                  title="Remove tag"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </span>
            ))}

            {isAddingTag ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  className="bg-white dark:bg-gray-800 border border-apple-blue rounded px-2 py-1 text-xs outline-none w-20"
                  placeholder="New Tag"
                  aria-label="New tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  onBlur={() => setIsAddingTag(false)}
                />
              </div>
            ) : (
              <button
                onClick={() => setIsAddingTag(true)}
                aria-label="Add tag"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-gray-300 text-xs text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Tag
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Scroll shortcut buttons — outside scroll container so they always stay visible */}
      {(showScrollTop || showScrollBottom) && (
        <div className="absolute bottom-6 right-4 flex flex-col gap-1.5 z-20">
          {showScrollTop && (
            <button
              onClick={scrollToTop}
              aria-label="Scroll to top"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md text-gray-500 dark:text-gray-400 hover:text-apple-blue dark:hover:text-apple-blue hover:border-apple-blue transition-all"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
          {showScrollBottom && (
            <button
              onClick={scrollToBottom}
              aria-label="Scroll to bottom"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md text-gray-500 dark:text-gray-400 hover:text-apple-blue dark:hover:text-apple-blue hover:border-apple-blue transition-all"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

    </div>
  );
};

export default ItemDetail;
