import React, { useState, useEffect, useRef } from "react";
import { getCurrentUser, signOut, supabase } from "../services/supabaseClient";
import { useToast } from "./Toast";
import {
  LogOut,
  Download,
  Upload,
  Coins,
  AlertCircle,
  Github,
  Facebook,
  Mail,
  ArrowLeft,
  Moon,
  Sun,
  Monitor,
  Printer, // New icon for PDF
  FileText // New icon for Markdown
} from "lucide-react";
import { getAllItems, addItem } from "../services/storageService";
import { runOCRFromDataUrl } from "../services/geminiService";
import { exportToPdf } from "../services/pdfService"; // Import service
import { generateMarkdownTemplate } from "../utils/markdownGenerator"; // Import MD Gen
import { SegmentedControl } from "./SegmentedControl";
import { AnimatedSwitch } from "./AnimatedSwitch";

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "system");
  const [credits, setCredits] = useState<number | string>("...");
  const [citationStyle, setCitationStyle] = useState(
    localStorage.getItem("citationStyle") || "apa",
  );
  const [useAiCitation, setUseAiCitation] = useState(
    localStorage.getItem("useAiCitation") === "true",
  );
  const [importing, setImporting] = useState(false);
  const [exportFormat, setExportFormat] = useState(
    localStorage.getItem("exportFormat") || "pdf",
  );
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCurrentUser().then(async (u) => {
      setUser(u);
      setLoading(false);

      if (u) {
        setCredits("Checking...");
        const { data, error } = await supabase
          .from("profiles")
          .select("ai_credits")
          .eq("id", u.id)
          .single();

        if (data) {
          setCredits(data.ai_credits);
        } else if (error) {
          console.error("Error fetching credits:", error);
          setCredits(0);
        }
      } else {
        setCredits(0);
      }
    });
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    // Trigger storage event for cross-tab sync (if open in multiple places)
    window.dispatchEvent(new Event("storage"));

    // Sync to chrome storage for content scripts
    chrome.storage.local.set({ theme: newTheme });

    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (newTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  const handleExport = async () => {
    const items = await getAllItems();
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "researchmate_backup.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleExportPdf = async () => {
    const items = await getAllItems();
    exportToPdf(items, user);
  };

  const handleExportMarkdown = async () => {
    const items = await getAllItems();
    if (!items || items.length === 0) {
      toast("No research items found to export.", "info");
      return;
    }
    const mdContent = items
      .map((item) => generateMarkdownTemplate(item) + "\n---\n")
      .join("\n");
      
    const dataStr =
      "data:text/markdown;charset=utf-8," +
      encodeURIComponent(mdContent);
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "researchmate_backup.md");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleExportAll = async (fmt: string) => {
    setShowExportMenu(false);
    if (fmt === "pdf") {
      await handleExportPdf();
    } else if (fmt === "json") {
      await handleExport();
    } else if (fmt === "md") {
      await handleExportMarkdown();
    }
  };

  // Close export dropdown on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setImporting(true);
    let totalImported = 0;
    let totalSkipped = 0;
    let cloudFallbacks = 0;

    for (const file of files) {
      const name = file.name.toLowerCase();
      try {
        if (name.endsWith(".json")) {
          // --- JSON import ---
          const text = await file.text();
          let parsed: unknown;
          try {
            parsed = JSON.parse(text);
          } catch {
            toast(`"${file.name}" — not valid JSON, skipped.`, "error");
            continue;
          }
          if (!Array.isArray(parsed)) {
            toast(`"${file.name}" — expected a JSON array, skipped.`, "error");
            continue;
          }
          for (const item of parsed) {
            if (typeof item?.text !== "string" || !item.text.trim()) {
              totalSkipped++;
              continue;
            }
            await addItem(
              {
                text: item.text.trim(),
                note: typeof item.note === "string" ? item.note : undefined,
                sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : undefined,
                sourceTitle: typeof item.sourceTitle === "string" ? item.sourceTitle : undefined,
                tags: Array.isArray(item.tags)
                  ? item.tags.filter((t: unknown) => typeof t === "string")
                  : undefined,
                aiSummary: typeof item.aiSummary === "string" ? item.aiSummary : undefined,
              },
              () => cloudFallbacks++,
            );
            totalImported++;
          }

        } else if (name.endsWith(".pdf")) {
          // --- PDF import (extract text via pdfjs-dist) ---
          toast(`Extracting text from "${file.name}"…`, "info");
          const pdfjsLib = await import("pdfjs-dist");
          // Use a bundled worker URL so Chrome extension CSP is satisfied
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url,
          ).href;

          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText +=
              textContent.items.map((item: any) => item.str).join(" ") + "\n\n";
          }

          const cleanText = fullText.trim();
          if (!cleanText) {
            toast(`"${file.name}" — no readable text found, skipped.`, "error");
            continue;
          }

          await addItem(
            {
              text: cleanText,
              sourceTitle: file.name.replace(/\.pdf$/i, ""),
              sourceUrl: "",
              tags: [],
              note: "",
              deviceSource: "extension",
            },
            () => cloudFallbacks++,
          );
          totalImported++;

        } else if (file.type.startsWith("image/")) {
          // --- Image import via OCR ---
          toast(`Running OCR on "${file.name}"…`, "info");
          const base64DataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
          });

          const result = await runOCRFromDataUrl(base64DataUrl);
          if (!result.ok || !result.ocrText) {
            toast(`"${file.name}" — OCR failed, skipped.`, "error");
            continue;
          }

          await addItem(
            {
              text: result.ocrText,
              sourceTitle: file.name,
              sourceUrl: "",
              tags: [],
              note: "",
              deviceSource: "smart_pen",
              imageUrl: base64DataUrl,
              ocrConfidence: result.ocrConfidence,
            },
            () => cloudFallbacks++,
          );
          totalImported++;

        } else {
          toast(`"${file.name}" — unsupported file type, skipped.`, "error");
        }
      } catch {
        toast(`Failed to import "${file.name}".`, "error");
      }
    }

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (totalImported > 0) {
      const fallbackNote = cloudFallbacks > 0 ? ` (${cloudFallbacks} saved locally — cloud sync failed)` : "";
      const skipNote = totalSkipped > 0 ? ` (${totalSkipped} skipped — no text)` : "";
      toast(`Imported ${totalImported} item${totalImported > 1 ? "s" : ""}${fallbackNote}${skipNote}`, "success");
      setTimeout(() => window.location.reload(), 1800);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 sticky top-0 z-10 shrink-0">
        <button
          onClick={onBack}
          aria-label="Go back"
          className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group border border-gray-200 dark:border-gray-700"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
          Settings
        </h1>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto flex-1 pb-20">
        {/* Account Section */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Account
          </h2>
          {user ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-apple-blue text-white flex items-center justify-center text-lg font-bold overflow-hidden">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt={user.email}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.email?.[0].toUpperCase()
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {user.email}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-apple-gray-2">
                    <Coins size={12} className="text-yellow-500" />
                    <span>{credits} Credits</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                className="w-full py-2 flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center flex flex-col items-center">
              <AlertCircle size={24} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 mb-2">
                Sign in to sync your research
              </p>
              <button
                onClick={onBack}
                aria-label="Go to sign in"
                className="text-apple-blue font-medium text-sm"
              >
                Go to Sign In
              </button>
            </div>
          )}
        </section>
        {/* Appearance Section */}
        {/* Appearance Section */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Appearance
          </h2>
          <SegmentedControl
            name="theme"
            value={theme as "light" | "dark" | "system"}
            onChange={handleThemeChange}
            options={[
              {
                value: "light",
                label: "Light",
                icon: <Sun size={14} className="group-hover:text-gray-900" />,
                activeIcon: (
                  <Sun size={14} className="text-orange-500 fill-orange-500" />
                ),
              },
              {
                value: "dark",
                label: "Dark",
                icon: <Moon size={14} className="group-hover:text-gray-300" />,
                activeIcon: (
                  <Moon size={14} className="text-blue-400 fill-blue-400" />
                ),
              },
              {
                value: "system",
                label: "System",
                icon: <Monitor size={14} />,
                activeIcon: <Monitor size={14} className="text-purple-500" />,
              },
            ]}
          />
        </section>
        {/* Citation Settings */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Citation Settings
          </h2>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            {/* Style Selector */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Format</label>
              <SegmentedControl
                name="citation-style"
                value={citationStyle}
                onChange={(val) => {
                  setCitationStyle(val);
                  localStorage.setItem("citationStyle", val);
                }}
                options={[
                  { value: "apa", label: "APA" },
                  { value: "mla", label: "MLA" },
                  { value: "chicago", label: "CHICAGO" },
                  { value: "ieee", label: "IEEE" },
                ]}
              />
            </div>

            {/* AI Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Enhanced AI Citation
                </h3>
                <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                  Fills missing authors/dates using AI. Cost: 1 Credit.
                </p>
              </div>
              <AnimatedSwitch
                checked={useAiCitation}
                onChange={(checked) => {
                  setUseAiCitation(checked);
                  localStorage.setItem("useAiCitation", String(checked));
                  window.dispatchEvent(new Event("storage"));
                }}
                label="Toggle AI Citation"
              />
            </div>

            {/* Default Export Format */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block">
                Default Export Format
              </label>
              <SegmentedControl
                name="export-format"
                value={exportFormat}
                onChange={(val) => {
                  setExportFormat(val);
                  localStorage.setItem("exportFormat", val);
                  window.dispatchEvent(new Event("storage")); // Notify other components
                }}
                options={[
                  { value: "pdf", label: "PDF" },
                  { value: "json", label: "JSON" },
                  { value: "txt", label: "TXT" },
                  { value: "md", label: "MD" },
                ]}
              />
            </div>
          </div>
        </section>
        {/* Data Management */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Data Management
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
            <div ref={exportMenuRef} className="border-b border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                aria-label="Export all items"
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Download size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    Export All Items (PDF / JSON / Markdown)
                  </span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${showExportMenu ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
              </button>
              {showExportMenu && (
                <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                  {[
                    { fmt: "pdf", icon: <Printer size={14} />, label: "PDF Report" },
                    { fmt: "json", icon: <Download size={14} />, label: "JSON Backup" },
                    { fmt: "md", icon: <FileText size={14} />, label: "Markdown File" },
                  ].map(({ fmt, icon, label }) => (
                    <button
                      key={fmt}
                      onClick={() => handleExportAll(fmt)}
                      className="w-full px-8 py-2.5 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
                    >
                      <span className="text-gray-400">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleImportClick}
              disabled={importing}
              aria-label="Import items from file"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Upload size={16} className="text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {importing ? "Importing..." : "Import Files (JSON / PDF / Image)"}
                </span>
              </div>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              title="Upload file(s) to import"
              className="hidden"
              accept=".json,.pdf,.png,.jpg,.jpeg"
              multiple
              onChange={handleFileChange}
            />
          </div>
        </section>
        {/* About Section */}
        {/* Citation Style */}
        {/* About Section */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            About
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Version</span>
              <span className="font-mono text-gray-900 dark:text-white">
                1.0.0
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">
                Extension ID
              </span>
              <span className="font-mono text-[10px] text-gray-500 truncate max-w-[150px]">
                {chrome.runtime.id}
              </span>
            </div>
          </div>
          <div className="text-center pt-2">
            <button
              onClick={async () => {
                const { data } = await supabase.auth.getSession();
                let url = "https://research-mate-website.vercel.app";
                if (data.session) {
                  // Append tokens for auto-login
                  // Supabase looks for #access_token=...&refresh_token=...&type=recovery
                  const params = new URLSearchParams();
                  params.set("access_token", data.session.access_token);
                  params.set("refresh_token", data.session.refresh_token);
                  params.set("expires_in", String(data.session.expires_in));
                  params.set("token_type", "bearer");
                  params.set("type", "recovery"); // Trick Supabase into handling it like a magic link
                  url += `/#${params.toString()}`;
                }
                window.open(url, "_blank");
              }}
              className="text-xs text-apple-gray-2 hover:text-apple-blue transition-colors bg-transparent border-none cursor-pointer underline"
            >
              Visit Website & Auto-Login
            </button>
          </div>
        </section>
        {/* Follow Us Section */}
        <section className="space-y-3 pt-6 border-t border-gray-100 dark:border-gray-800">
          <div className="flex justify-center gap-4">
            <a
              href="mailto:netnetku21@gmail.com"
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Email Us"
            >
              <Mail size={20} />
            </a>
            <a
              href="https://www.facebook.com/ntkuson"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-600 transition-colors"
              title="Facebook"
            >
              <Facebook size={20} />
            </a>
            <a
              href="https://github.com/Unlighted01"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title="GitHub"
            >
              <Github size={20} />
            </a>
          </div>
          <p className="text-[10px] text-center text-gray-400">
            © {new Date().getFullYear()} ResearchMate
          </p>
        </section>
      </div>
    </div>
  );
};

export default Settings;
