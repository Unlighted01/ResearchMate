import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Pencil
} from "lucide-react";

interface ItemContentProps {
  text: string;
  imageUrl?: string;
  deviceSource: string;
  hasOcrData: boolean;
  ocrConfidence?: number;
  ocrEdited: boolean;
  isEditingOcr: boolean;
  editedOcrText: string;
  onEditedOcrTextChange: (text: string) => void;
  onSaveOcrEdit: () => void;
  onCancelOcrEdit: () => void;
  onRetryOcr: () => void;
  isRetryingOcr: boolean;
  showSummaryView: boolean;
  summary: string;
  onToggleView: (showSummary: boolean) => void;
  onStartEditingOcr: () => void;
}

export const ItemContent: React.FC<ItemContentProps> = ({
  text,
  imageUrl,
  deviceSource,
  hasOcrData,
  ocrConfidence,
  ocrEdited,
  isEditingOcr,
  editedOcrText,
  onEditedOcrTextChange,
  onSaveOcrEdit,
  onCancelOcrEdit,
  onRetryOcr: _onRetryOcr,
  isRetryingOcr: _isRetryingOcr,
  showSummaryView,
  summary,
  onToggleView,
  onStartEditingOcr,
}) => {
  return (
    <div className="mb-6">
      {/* Smart Pen / Image Content */}
      {imageUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
              {deviceSource === "smart_pen" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z" /><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-17z" /><path d="m2 2 7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              )}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {deviceSource === "smart_pen" ? "Handwritten Note" : "Captured Image"}
            </span>
          </div>
          <img src={imageUrl} alt="Captured" className="w-full h-auto object-cover max-h-[300px] hover:max-h-full transition-all cursor-zoom-in" />
        </div>
      )}

      {/* OCR Text / Research Content Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {hasOcrData ? "Transcribed Text (OCR)" : "Research Content"}
          </h3>
          {hasOcrData && (
            <div className="flex items-center gap-1.5">
              {ocrConfidence != null && (
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${ocrConfidence >= 80 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
                  {ocrConfidence}% conf.
                </span>
              )}
              {ocrEdited && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">
                  Edited
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasOcrData && !isEditingOcr && (
            <button
              onClick={onStartEditingOcr}
              className="text-[10px] font-bold uppercase text-gray-400 hover:text-indigo-600 flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
          {summary && !isEditingOcr && (
            <button
              onClick={() => onToggleView(!showSummaryView)}
              className="text-[10px] font-bold uppercase text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              {showSummaryView ? "View Original" : "View Summary"}
            </button>
          )}
        </div>
      </div>

      {isEditingOcr ? (
        <div className="space-y-2">
          <textarea
            value={editedOcrText}
            onChange={(e) => onEditedOcrTextChange(e.target.value)}
            className="w-full min-h-[140px] p-3 text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-indigo-300 rounded-xl outline-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={onCancelOcrEdit} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100">Cancel</button>
            <button onClick={onSaveOcrEdit} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white">Save</button>
          </div>
        </div>
      ) : showSummaryView ? (
        <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-xl p-4 border border-purple-100 dark:border-purple-900/30">
          <p className="text-gray-800 dark:text-gray-200 text-base font-serif leading-relaxed whitespace-pre-wrap">
            {summary}
          </p>
          <div className="mt-2 text-[10px] text-purple-400 font-bold uppercase tracking-widest text-right opacity-70">AI Generated</div>
        </div>
      ) : (
        <div className="pl-3 relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/30 rounded-full"></div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};
