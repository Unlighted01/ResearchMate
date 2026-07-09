import React, { useState } from "react";
import { Quote, Check, Copy } from "lucide-react";

interface CitationCardProps {
  citation: string;
  inTextCitation?: string;
  format: string;
  onFormatChange: (format: string) => void;
  loading: boolean;
}

export const CitationCard: React.FC<CitationCardProps> = ({
  citation,
  inTextCitation,
  format,
  onFormatChange,
  loading,
}) => {
  const [copiedBib, setCopiedBib] = useState(false);
  const [copiedInText, setCopiedInText] = useState(false);
  
  if (!citation && !loading) return null;

  const handleCopyBib = () => {
    navigator.clipboard.writeText(citation);
    setCopiedBib(true);
    setTimeout(() => setCopiedBib(false), 2000);
  };

  const handleCopyInText = () => {
    if (inTextCitation) {
      navigator.clipboard.writeText(inTextCitation);
      setCopiedInText(true);
      setTimeout(() => setCopiedInText(false), 2000);
    }
  };

  const formats = ["mla", "apa", "chicago", "harvard"];

  return (
    <div id="citation-card" className="mt-8 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Quote className="w-4 h-4 text-blue-500" />
          <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Academic Citation</h3>
        </div>
        
        <div className="flex bg-white/50 dark:bg-gray-800/50 p-1 rounded-lg border border-blue-100 dark:border-blue-900/30">
          {formats.map((f) => (
            <button
              key={f}
              onClick={() => onFormatChange(f)}
              className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                format === f 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "text-blue-400 hover:text-blue-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      
      <div className="p-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }}></div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Full Bibliography Entry */}
            <div className="relative group p-3 bg-white dark:bg-gray-800 rounded-xl border border-blue-100/50 dark:border-blue-900/20">
              <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Bibliography Entry</h4>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-serif italic pr-8 whitespace-pre-wrap">
                {citation}
              </p>
              <button
                onClick={handleCopyBib}
                aria-label="Copy bibliography entry"
                className="absolute top-3 right-3 p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {copiedBib ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>

            {/* In-Text Citation */}
            {inTextCitation && (
              <div className="relative group p-3 bg-white dark:bg-gray-800 rounded-xl border border-blue-100/50 dark:border-blue-900/20">
                <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">In-Text Citation</h4>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-serif pr-8">
                  {inTextCitation}
                </p>
                <button
                  onClick={handleCopyInText}
                  aria-label="Copy in-text citation"
                  className="absolute top-3 right-3 p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {copiedInText ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
