import React, { useState } from "react";
import { Quote, Check, Copy } from "lucide-react";

interface CitationCardProps {
  citation: string;
  format: string;
  onFormatChange: (format: string) => void;
  loading: boolean;
}

export const CitationCard: React.FC<CitationCardProps> = ({
  citation,
  format,
  onFormatChange,
  loading,
}) => {
  const [copied, setCopied] = useState(false);
  
  if (!citation && !loading) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      
      <div className="p-5 relative group">
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
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-serif italic pr-8">
              {citation}
            </p>
            <button
              onClick={handleCopy}
              className="absolute top-4 right-4 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-blue-100 dark:border-blue-800 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-blue-500" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
