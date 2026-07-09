import React from "react";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Download, 
  Quote, 
  Sparkles, 
  Loader2, 
  ExternalLink, 
  BookOpen, 
  Trash,
  LayoutTemplate
} from "lucide-react";
import { CopyIcon } from "../../icons";
import { SummaryMode } from "../../../services/geminiService";

interface ItemHeaderProps {
  onBack: () => void;
  onCopy: () => void;
  copied: boolean;
  onDownload: () => void;
  onCite: () => void;
  loadingCitation: boolean;
  hasCitation: boolean;
  onSummarize: () => void;
  summarizing: boolean;
  hasSummary: boolean;
  summaryMode: SummaryMode;
  onSummaryModeChange: (mode: SummaryMode) => void;
  onIdentifySource: () => void;
  onCopyMarkdown: () => void;
  onDelete: () => void;
  sourceUrl?: string;
  hasOcrData: boolean;
  itemId: string;
}

export const ItemHeader: React.FC<ItemHeaderProps> = ({
  onBack,
  onCopy,
  copied,
  onDownload,
  onCite,
  loadingCitation,
  hasCitation,
  onSummarize,
  summarizing,
  hasSummary,
  summaryMode,
  onSummaryModeChange,
  onIdentifySource,
  onCopyMarkdown,
  onDelete,
  sourceUrl,
  hasOcrData,
  itemId,
}) => {
  return (
    <div className="theme-headerbar theme-divider p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur z-10">
      <button
        onClick={onBack}
        aria-label="Go back"
        className="theme-icon-button p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group border border-gray-200 dark:border-gray-700"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
      </button>

      <div className="flex gap-2 items-center">
        <button
          onClick={onCopy}
          className="theme-icon-button p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
        >
          {copied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <CopyIcon size={20} />}
        </button>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

        <button
          onClick={onDownload}
          className="theme-icon-button p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
        >
          <Download className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

        <button
          onClick={onCite}
          disabled={loadingCitation}
          className={`theme-icon-button p-2 rounded-lg transition-colors ${
            hasCitation 
              ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" 
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          {loadingCitation ? <Loader2 className="w-5 h-5 animate-spin" /> : <Quote className="w-5 h-5" />}
        </button>

        <button
          onClick={onSummarize}
          disabled={summarizing}
          className={`theme-icon-button p-2 rounded-lg transition-colors ${
            hasSummary 
              ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20" 
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          {summarizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        </button>

        <select
          value={summaryMode}
          onChange={(e) => onSummaryModeChange(e.target.value as SummaryMode)}
          disabled={summarizing}
          className="appearance-none px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
        >
          <option value="ultra-short">⚡ Short</option>
          <option value="standard">📝 Std</option>
          <option value="detailed">📖 Detail</option>
        </select>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

        {hasOcrData ? (
          <button onClick={onIdentifySource} className="theme-icon-button p-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg text-gray-400 hover:text-orange-500">
            <BookOpen className="w-5 h-5" />
          </button>
        ) : sourceUrl ? (
          <button onClick={() => window.open(sourceUrl, "_blank")} className="theme-icon-button p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400">
            <ExternalLink className="w-5 h-5" />
          </button>
        ) : null}

        <button onClick={onCopyMarkdown} className="theme-icon-button p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-gray-400 hover:text-emerald-500" title="Copy Markdown">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/><path d="M14 2v4a2 2 0 0 0 2-2h4"/><path d="M2.5 15h3"/><path d="M4 13v6"/><path d="M9 13v6"/><path d="M11 16l-2-3"/><path d="M11 19l-2-3"/><path d="M16 13v6"/><path d="M14 15h3"/></svg>
        </button>

        <button 
          onClick={() => window.open(`https://research-mate-website.vercel.app/#/app/dashboard?id=${itemId}`, "_blank")} 
          className="theme-icon-button p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-gray-400 hover:text-blue-500"
          title="Open in Web Dashboard"
        >
          <LayoutTemplate className="w-5 h-5" />
        </button>

        <button onClick={onDelete} className="theme-icon-button p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 hover:text-red-500">
          <Trash className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
