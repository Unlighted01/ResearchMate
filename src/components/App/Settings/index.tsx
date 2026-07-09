import React, { useEffect } from "react";
import { ArrowLeft, Mail, Facebook, Github } from "lucide-react";
import { supabase } from "../../../services/supabaseClient";

// Refactored Parts
import { useSettings } from "./useSettings";
import { AccountSection } from "./AccountSection";
import { AppearanceSection } from "./AppearanceSection";
import { GeneralSettings } from "./GeneralSettings";
import { DataManagement } from "./DataManagement";

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const {
    user,
    loading,
    theme,
    credits,
    citationStyle,
    setCitationStyle,
    useAiCitation,
    setUseAiCitation,
    exportFormat,
    setExportFormat,
    importing,
    showExportMenu,
    setShowExportMenu,
    handleThemeChange,
    visualTheme,
    handleVisualThemeChange,
    handleExportAll,
    handleFileChange,
    handleSignOut,
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
    exportCount,
  } = useSettings();

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

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }}></div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="theme-page theme-sidebar h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="theme-headerbar theme-divider bg-white dark:bg-gray-800 p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 sticky top-0 z-10 shrink-0">
        <button
          onClick={onBack}
          aria-label="Go back"
          className="theme-icon-button p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group border border-gray-200 dark:border-gray-700"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <h1 className="theme-title text-xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h1>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto flex-1 pb-20 scrollbar-hide">
        <AccountSection
          user={user}
          credits={credits}
          onSignOut={handleSignOut}
          onGoToAuth={onBack}
        />

        <AppearanceSection 
          theme={theme} 
          onThemeChange={handleThemeChange} 
          visualTheme={visualTheme}
          onVisualThemeChange={handleVisualThemeChange}
        />

        <GeneralSettings
          citationStyle={citationStyle}
          onCitationStyleChange={setCitationStyle}
          useAiCitation={useAiCitation}
          onUseAiCitationChange={setUseAiCitation}
          exportFormat={exportFormat}
          onExportFormatChange={setExportFormat}
        />

        <DataManagement
          showExportMenu={showExportMenu}
          onToggleExportMenu={() => setShowExportMenu(!showExportMenu)}
          onExportAll={handleExportAll}
          onImportClick={() => fileInputRef.current?.click()}
          importing={importing}
          exportMenuRef={exportMenuRef}
          exportScope={exportScope}
          onExportScopeChange={setExportScope}
          selectedCollectionId={selectedCollectionId}
          onCollectionChange={setSelectedCollectionId}
          selectedTag={selectedTag}
          onTagChange={setSelectedTag}
          collections={collections}
          uniqueTags={uniqueTags}
          exportCount={exportCount}
        />

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".json,.pdf,.png,.jpg,.jpeg"
          multiple
          onChange={handleFileChange}
        />

        {/* About Section */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">About</h2>
          <div className="theme-surface bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Version</span>
              <span className="font-mono text-gray-900 dark:text-white">1.2.0</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Extension ID</span>
              <span className="font-mono text-[10px] text-gray-400 truncate max-w-[140px]">{chrome.runtime.id}</span>
            </div>
            <div className="pt-2 border-t border-gray-50 dark:border-gray-700">
               <button
                  onClick={async () => {
                    const { data } = await supabase.auth.getSession();
                    let url = "https://research-mate-website.vercel.app";
                    if (data.session) {
                      const params = new URLSearchParams();
                      params.set("access_token", data.session.access_token);
                      params.set("refresh_token", data.session.refresh_token);
                      params.set("expires_in", String(data.session.expires_in));
                      params.set("token_type", "bearer");
                      params.set("type", "recovery");
                      url += `/#${params.toString()}`;
                    }
                    window.open(url, "_blank");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                >
                  Visit Website & Auto-Login
                </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
          <div className="flex justify-center gap-6">
            <a href="mailto:netnetku21@gmail.com" className="text-gray-300 hover:text-red-400 transition-colors"><Mail size={18} /></a>
            <a href="https://www.facebook.com/ntkuson" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-500 transition-colors"><Facebook size={18} /></a>
            <a href="https://github.com/Unlighted01" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"><Github size={18} /></a>
          </div>
          <p className="text-[10px] text-gray-400">© {new Date().getFullYear()} ResearchMate Ecosystem</p>
        </section>
      </div>
    </div>
  );
};

export default Settings;
