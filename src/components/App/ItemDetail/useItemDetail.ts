import { useState, useEffect, useRef, useCallback } from "react";
import { 
  StorageItem, 
  deleteItem, 
  updateItem 
} from "../../../services/storageService";
import { 
  summarizeText, 
  generateCitation, 
  runOCR,
  SummaryMode 
} from "../../../services/geminiService";
import { 
  exportSingleItemToPdf, 
  exportSingleItemToJson 
} from "../../../services/pdfService";
import { generateMarkdownTemplate } from "../../../utils/markdownGenerator";
import { useToast } from "../../shared/ui/Toast";
import { BookMetadata } from "../../../services/citationService";

// Section headers to skip when extracting a search query
const SKIP_HEADERS = /^(abstract|introduction|methods?|results?|discussion|conclusion|references?|keywords?|background|related work|methodology|overview|summary|acknowledgements?|appendix|table of contents?|figures?|tables?)\s*:?\s*$/i;

// Extract the most meaningful search query from an item's title and OCR text.
function extractSearchQuery(sourceTitle?: string, text?: string): string {
  if (sourceTitle && sourceTitle.length > 4 && !sourceTitle.match(/\.(png|jpg|jpeg|pdf)$/i)) {
    return sourceTitle.replace(/\.[^.]+$/, "").trim();
  }
  if (text) {
    const cleaned = text.split("\n").map(l => l.replace(/[#*_`>]/g, "").trim()).filter(l => l.length > 8);
    const goodLine = cleaned.find(l => !SKIP_HEADERS.test(l));
    if (goodLine) return goodLine.slice(0, 80);
  }
  return "";
}

export function useItemDetail(item: StorageItem, onUpdate: () => void, onDelete: () => void) {
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState(item.aiSummary || "");
  const [citation, setCitation] = useState(item.citation || "");
  const [_inTextCitation, setInTextCitation] = useState("");
  const [citationFormat, setCitationFormat] = useState(item.citationFormat || "mla");
  const [tags, setTags] = useState<string[]>(item.tags || []);
  const [itemColor, setItemColor] = useState<"yellow" | "green" | "red" | "blue" | "purple" | "">(item.color || "");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("standard");
  const [loadingCitation, setLoadingCitation] = useState(false);
  const [isEditingOcr, setIsEditingOcr] = useState(false);
  const [editedOcrText, setEditedOcrText] = useState(item.text);
  const [ocrEdited, setOcrEdited] = useState(item.ocrEdited ?? false);
  const [isRetryingOcr, setIsRetryingOcr] = useState(false);
  const [showSummaryView, setShowSummaryView] = useState(() => {
    if (item.preferredView) return item.preferredView === "summary";
    return !!item.aiSummary;
  });
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [itemNote, setItemNote] = useState(item.note || "");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isIdentifyModalOpen, setIsIdentifyModalOpen] = useState(false);
  const [showScrollTop, _setShowScrollTop] = useState(false);
  const [showScrollBottom, _setShowScrollBottom] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastSummarizeRef = useRef<number>(0);
  const lastCiteRef = useRef<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    setTags(item.tags || []);
    setSummary(item.aiSummary || "");
    setCitation(item.citation || "");
    setItemNote(item.note || "");
    setItemColor(item.color || "");
  }, [item]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(showSummaryView && summary ? summary : item.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [item.text, showSummaryView, summary]);

  const handleToggleView = async (showSummary: boolean) => {
    setShowSummaryView(showSummary);
    await updateItem(item.id, { preferredView: showSummary ? "summary" : "original" });
    onUpdate();
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
    setSummary("");
    setShowSummaryView(false);
    try {
      const result = await summarizeText(item.text, controller.signal, modeToUse);
      if (result.ok) {
        setSummary(result.summary);
        setShowSummaryView(true);
        await updateItem(item.id, { aiSummary: result.summary, preferredView: "summary" });
        onUpdate();
      } else {
        toast(result.error || "Failed to generate summary", "error");
      }
    } catch (e) {
      if ((e as { name?: string }).name !== "AbortError") toast("Error generating summary", "error");
    } finally {
      setSummarizing(false);
      abortControllerRef.current = null;
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

    if (citation && !overrideFormat) {
      document.getElementById("citation-card")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if ((item.deviceSource === "smart_pen" || !item.sourceUrl) && !item.citation) {
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
        await updateItem(item.id, { citation: result.citation, citationFormat: formatToUse });
        onUpdate();
      } else {
        toast(result.error || "Failed to generate citation", "error");
      }
    } else {
      const newCitation = `${item.sourceTitle || "Untitled"}. (${new Date(item.createdAt).getFullYear()}). ResearchMate Save. [${formatToUse.toUpperCase()}]`;
      setCitation(newCitation);
      setCitationFormat(formatToUse);
      await updateItem(item.id, { citation: newCitation, citationFormat: formatToUse });
      onUpdate();
    }
    setLoadingCitation(false);
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    const updatedTags = [...tags, newTag.trim()];
    setTags(updatedTags);
    await updateItem(item.id, { tags: [...updatedTags, itemColor ? `color:${itemColor}` : ""].filter(Boolean) });
    onUpdate();
    setIsAddingTag(false);
    setNewTag("");
  };

  const handleDeleteTag = async (tagToDelete: string) => {
    const updatedTags = tags.filter((t) => t !== tagToDelete);
    setTags(updatedTags);
    await updateItem(item.id, { tags: [...updatedTags, itemColor ? `color:${itemColor}` : ""].filter(Boolean) });
    onUpdate();
  };

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

  const handleDownload = () => {
    const format = localStorage.getItem("exportFormat") || "pdf";
    if (format === "pdf") exportSingleItemToPdf(item);
    else if (format === "json") exportSingleItemToJson(item);
    else if (format === "md") {
      const mdContent = generateMarkdownTemplate(item);
      const element = document.createElement("a");
      element.href = URL.createObjectURL(new Blob([mdContent], { type: "text/markdown" }));
      element.download = `researchmate_item_${item.id.substring(0, 8)}.md`;
      element.click();
    }
  };

  const handleDeleteItem = () => {
    let undone = false;
    onDelete();
    toast("Item deleted", "info", {
      duration: 5000,
      action: { label: "Undo", onClick: () => { undone = true; onUpdate(); } },
    });
    setTimeout(async () => {
      if (undone) return;
      try {
        await deleteItem(item.id);
      } catch {
        toast("Failed to delete item.", "error");
        onUpdate();
      }
    }, 5100);
  };

  const handleSaveOcrEdit = async () => {
    if (!editedOcrText.trim()) return;
    try {
      const newTags = [...item.tags.filter((t) => t !== "ocr:edited"), "ocr:edited"];
      await updateItem(item.id, { text: editedOcrText, tags: newTags });
      setOcrEdited(true);
      setIsEditingOcr(false);
      onUpdate();
      toast("OCR text updated", "success");
      if (citation) await handleCite(citationFormat);
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
        const newTags = item.tags.filter((t) => t !== "ocr:edited");
        await updateItem(item.id, { text: result.ocrText, tags: newTags, ocrConfidence: result.ocrConfidence });
        setEditedOcrText(result.ocrText);
        setOcrEdited(false);
        setIsEditingOcr(false);
        onUpdate();
        toast("OCR re-processed successfully", "success");
      }
    } catch {
      toast("OCR retry failed", "error");
    }
    setIsRetryingOcr(false);
  };

  const handleBookSelect = async (book: BookMetadata) => {
    const authors = book.authors?.join(", ") || "Unknown";
    const year = book.publishedDate?.match(/\d{4}/)?.[0] || "n.d.";
    const newCitation = `${authors} (${year}). *${book.title}*. ${book.publisher || "Publisher"}.`;
    await updateItem(item.id, { sourceTitle: book.title, citation: newCitation, sourceUrl: book.previewLink || book.infoLink || "", citationFormat: "apa" });
    setCitation(newCitation);
    setCitationFormat("apa");
    onUpdate();
    setIsIdentifyModalOpen(false);
  };

  return {
    copied,
    summary,
    citation,
    citationFormat,
    tags,
    itemColor,
    summarizing,
    summaryMode,
    setSummaryMode,
    loadingCitation,
    isEditingOcr,
    setIsEditingOcr,
    editedOcrText,
    setEditedOcrText,
    ocrEdited,
    isRetryingOcr,
    showSummaryView,
    isAddingTag,
    setIsAddingTag,
    newTag,
    setNewTag,
    itemNote,
    setItemNote,
    isEditingNote,
    setIsEditingNote,
    isIdentifyModalOpen,
    setIsIdentifyModalOpen,
    showScrollTop,
    showScrollBottom,
    scrollContainerRef,
    handleCopy,
    handleToggleView,
    handleSummarize,
    handleCite,
    handleAddTag,
    handleDeleteTag,
    handleSaveNote,
    handleDownload,
    handleDeleteItem,
    handleSaveOcrEdit,
    handleRetryOcr,
    handleBookSelect,
    extractSearchQuery: () => extractSearchQuery(item.sourceTitle, item.text),
    handleCopyMarkdown: async () => {
      await navigator.clipboard.writeText(generateMarkdownTemplate(item));
      toast("Markdown copied!");
    }
  };
}
