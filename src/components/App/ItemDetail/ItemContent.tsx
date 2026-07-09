import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Pencil,
  PenTool,
  Smartphone,
  Tablet,
  Image
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
  const getSourceIconAndLabel = () => {
    switch (deviceSource) {
      case "smart_pen":
        return {
          icon: <PenTool className="w-4 h-4" />,
          label: "Handwritten Note",
          colorClass: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        };
      case "mobile_scanner":
        return {
          icon: <Smartphone className="w-4 h-4" />,
          label: "Mobile Scanner Page",
          colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        };
      case "tablet_sync":
        return {
          icon: <Tablet className="w-4 h-4" />,
          label: "Tablet Sync Note",
          colorClass: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        };
      default:
        return {
          icon: <Image className="w-4 h-4" />,
          label: "Captured Image",
          colorClass: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        };
    }
  };

  const sourceMeta = getSourceIconAndLabel();

  return (
    <div className="mb-6">
      {/* Smart Pen / Image Content */}
      {imageUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <div className={`p-1.5 rounded-full ${sourceMeta.colorClass}`}>
              {sourceMeta.icon}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {sourceMeta.label}
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
                <span className={`text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${ocrConfidence >= 80 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
                  {ocrConfidence}% conf.
                </span>
              )}
              {ocrEdited && (
                <span className={`text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600`}>
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
              className="text-xs font-bold uppercase text-gray-400 hover:text-indigo-600 flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
          {summary && !isEditingOcr && (
            <button
              onClick={() => onToggleView(!showSummaryView)}
              className="text-xs font-bold uppercase text-purple-600 hover:text-purple-700 flex items-center gap-1"
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
            className="w-full min-h-[140px] p-3 text-base text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-indigo-300 rounded-xl outline-none"
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
          <div className="mt-2 text-xs text-purple-400 font-bold uppercase tracking-widest text-right opacity-70">AI Generated</div>
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
