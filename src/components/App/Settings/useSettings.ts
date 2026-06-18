import { useState, useEffect, useRef } from "react";
import { getCurrentUser, signOut, supabase } from "../../../services/supabaseClient";
import { getAllItems, addItem, StorageItem } from "../../../services/storageService";
import { getCollections } from "../../../services/collectionService";
import { Collection } from "../../../types";
import { runOCRFromDataUrl } from "../../../services/geminiService";
import { exportToPdf } from "../../../services/pdfService";
import { generateMarkdownTemplate } from "../../../utils/markdownGenerator";
import { useToast } from "../../shared/ui/Toast";
import { User } from "@supabase/supabase-js";

export function useSettings() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "system");
  const [visualTheme, setVisualTheme] = useState(localStorage.getItem("visualTheme") || "minimalist");
  const [credits, setCredits] = useState<number | string>("...");
  const [citationStyle, setCitationStyle] = useState(localStorage.getItem("citationStyle") || "apa");
  const [useAiCitation, setUseAiCitation] = useState(localStorage.getItem("useAiCitation") === "true");
  const [exportFormat, setExportFormat] = useState(localStorage.getItem("exportFormat") || "pdf");
  const [importing, setImporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Export Scope States
  const [exportScope, setExportScope] = useState<"all" | "collection" | "tag">("all");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [allItems, setAllItems] = useState<StorageItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [uniqueTags, setUniqueTags] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const items = await getAllItems();
      setAllItems(items);

      const tagsSet = new Set<string>();
      items.forEach((item) => {
        item.tags.forEach((tag) => {
          if (
            tag !== "quick-save" &&
            !tag.startsWith("color:") &&
            !tag.startsWith("ocr:") &&
            tag !== "pinned:true"
          ) {
            tagsSet.add(tag);
          }
        });
      });
      const tags = Array.from(tagsSet);
      setUniqueTags(tags);
      if (tags.length > 0) {
        setSelectedTag(tags[0]);
      }

      const cols = await getCollections();
      setCollections(cols);
      if (cols.length > 0) {
        setSelectedCollectionId(cols[0].id);
      }
    };
    loadData();
  }, []);

  const getExportItems = () => {
    if (exportScope === "collection") {
      return allItems.filter((i) => i.collectionId === selectedCollectionId);
    }
    if (exportScope === "tag") {
      const lowerTag = selectedTag.toLowerCase();
      return allItems.filter((i) => i.tags.some((t) => t.toLowerCase() === lowerTag));
    }
    return allItems;
  };

  const exportCount = getExportItems().length;

  useEffect(() => {
    getCurrentUser().then(async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setCredits("Checking...");
        const { data } = await supabase.from("profiles").select("ai_credits").eq("id", u.id).single();
        setCredits(data?.ai_credits ?? 0);
      } else {
        setCredits(0);
      }
    });
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    window.dispatchEvent(new Event("storage"));
    chrome.storage.local.set({ theme: newTheme });
    
    if (newTheme === "dark") document.documentElement.classList.add("dark");
    else if (newTheme === "light") document.documentElement.classList.remove("dark");
    else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
  };

  const handleVisualThemeChange = (newTheme: string) => {
    setVisualTheme(newTheme);
    localStorage.setItem("visualTheme", newTheme);
    document.documentElement.setAttribute("data-ui-theme", newTheme);
  };

  const handleExportAll = async (fmt: string) => {
    setShowExportMenu(false);
    const items = getExportItems();
    if (!items || items.length === 0) {
      toast("No research items found to export.", "info");
      return;
    }

    if (fmt === "pdf") {
      exportToPdf(items, user);
    } else if (fmt === "json") {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "researchmate_backup.json");
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } else if (fmt === "md") {
      const mdContent = items.map((item) => generateMarkdownTemplate(item) + "\n---\n").join("\n");
      const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(mdContent);
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "researchmate_backup.md");
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setImporting(true);
    let totalImported = 0;
    
    for (const file of files) {
      const name = file.name.toLowerCase();
      try {
        if (name.endsWith(".json")) {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item?.text) {
                await addItem(item);
                totalImported++;
              }
            }
          }
        } else if (file.type.startsWith("image/")) {
          const base64DataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          const result = await runOCRFromDataUrl(base64DataUrl);
          if (result.ok && result.ocrText) {
            await addItem({ text: result.ocrText, imageUrl: base64DataUrl, deviceSource: "smart_pen" });
            totalImported++;
          }
        }
      } catch (e) { console.error("Import failed:", e); }
    }

    setImporting(false);
    if (totalImported > 0) {
      toast(`Imported ${totalImported} items`, "success");
      setTimeout(() => window.location.reload(), 1800);
    }
  };

  return {
    user,
    loading,
    theme,
    credits,
    citationStyle,
    setCitationStyle: (val: string) => { setCitationStyle(val); localStorage.setItem("citationStyle", val); },
    useAiCitation,
    setUseAiCitation: (val: boolean) => { setUseAiCitation(val); localStorage.setItem("useAiCitation", String(val)); },
    exportFormat,
    setExportFormat: (val: string) => { setExportFormat(val); localStorage.setItem("exportFormat", val); },
    importing,
    showExportMenu,
    setShowExportMenu,
    handleThemeChange,
    visualTheme,
    handleVisualThemeChange,
    handleExportAll,
    handleFileChange,
    handleSignOut: async () => { await signOut(); window.location.reload(); },
    fileInputRef,
    exportMenuRef,
    exportScope,
    setExportScope,
    selectedCollectionId,
    setSelectedCollectionId,
    selectedTag,
    setSelectedTag,
    collections,
    uniqueTags,
    exportCount
  };
}
