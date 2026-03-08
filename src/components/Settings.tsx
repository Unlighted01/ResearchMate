import React, { useState, useEffect, useRef } from "react";
import { getCurrentUser, signOut, supabase } from "../services/supabaseClient";
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
import { exportToPdf } from "../services/pdfService"; // Import service
import { generateMarkdownTemplate } from "../utils/markdownGenerator"; // Import MD Gen
import { SegmentedControl } from "./SegmentedControl";
import { AnimatedSwitch } from "./AnimatedSwitch";

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
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
      alert("No research items found to export.");
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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const items = JSON.parse(text);
      if (!Array.isArray(items)) throw new Error("Invalid format");

      let count = 0;
      for (const item of items) {
        // Basic validation
        if (item.text) {
          await addItem({
            text: item.text,
            note: item.note,
            sourceUrl: item.sourceUrl,
            sourceTitle: item.sourceTitle,
            tags: item.tags,
            aiSummary: item.aiSummary,
          });
          count++;
        }
      }
      alert(`Successfully imported ${count} items!`);
      window.location.reload(); // Refresh to show items
    } catch (e) {
      alert("Failed to import. Invalid JSON file.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
            <button
              onClick={handleExport}
              aria-label="Export items to JSON"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <Download size={16} className="text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  Export items to JSON
                </span>
              </div>
            </button>

            <button
              onClick={handleExportPdf}
              aria-label="Export as PDF Report"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <Printer size={16} className="text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  Export as PDF Report
                </span>
              </div>
            </button>

            <button
              onClick={handleExportMarkdown}
              aria-label="Export as Markdown"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  Export as Markdown File
                </span>
              </div>
            </button>

            <button
              onClick={handleImportClick}
              disabled={importing}
              aria-label="Import items from JSON"
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Upload size={16} className="text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {importing ? "Importing..." : "Import from JSON"}
                </span>
              </div>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              title="Upload JSON file"
              className="hidden"
              accept=".json"
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
