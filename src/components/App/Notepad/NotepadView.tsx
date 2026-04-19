import React, { useState } from "react";
import useDocumentEditor from "./useDocumentEditor";
import EditorCanvas from "./EditorCanvas";
import { Plus, Edit3, Trash2, ExternalLink, FileText, X, ChevronDown } from "lucide-react";

// ── Mini inline title-prompt modal ─────────────────────────────────────────
interface TitleModalProps {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const TitleModal: React.FC<TitleModalProps> = ({ open, value, onChange, onConfirm, onClose }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-[#2C2C2E] rounded-2xl shadow-2xl w-full max-w-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Name your note</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <input
          autoFocus
          type="text"
          placeholder="e.g. Research Notes"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm();
            if (e.key === "Escape") onClose();
          }}
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1C1C1E] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-2 text-xs font-medium rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            Create Note
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main NotepadView ────────────────────────────────────────────────────────
export const NotepadView: React.FC = () => {
  const {
    documents,
    currentDoc,
    loading,
    saving,
    handleNewDocument,
    handleSelectDocument,
    handleDeleteDocument,
    handleContentChange,
  } = useDocumentEditor();

  // Title modal
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [pendingTitle, setPendingTitle] = useState("");

  const openTitleModal = () => {
    setPendingTitle("");
    setShowTitleModal(true);
  };

  const confirmCreate = async () => {
    const title = pendingTitle.trim() || "Untitled Note";
    setShowTitleModal(false);
    await handleNewDocument(title);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="px-4 py-3 bg-white dark:bg-[#2C2C2E]/50 border-b border-gray-100 dark:border-[#3A3A3C]/50 flex items-center justify-between shrink-0 shadow-sm backdrop-blur-xl">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-blue-500" />
            Notepad
            {saving && (
              <span className="text-[10px] text-gray-400 font-normal ml-1 animate-pulse">Saving…</span>
            )}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={openTitleModal}
              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              title="New Document"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const url = currentDoc
                  ? `https://research-mate-website.vercel.app/editor?id=${currentDoc.id}`
                  : `https://research-mate-website.vercel.app/editor`;
                window.open(url, "_blank");
              }}
              className="p-1.5 rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Open full Website Editor"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document selector row — selector on left, delete on right, no overlap */}
        {documents.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] flex items-center gap-2 shrink-0">
            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="relative flex-1 min-w-0">
              <select
                className="w-full bg-transparent text-sm text-gray-700 dark:text-gray-200 border-none outline-none truncate cursor-pointer appearance-none pr-5"
                value={currentDoc?.id || ""}
                onChange={(e) => handleSelectDocument(e.target.value)}
              >
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id} className="dark:bg-gray-800">
                    {doc.title || "Untitled Note"}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            {currentDoc && (
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${currentDoc.title}"?`)) {
                    handleDeleteDocument(currentDoc.id);
                  }
                }}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-1"
                title="Delete Document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Editor Canvas */}
        <div className="flex-1 overflow-hidden relative">
          {currentDoc ? (
            <EditorCanvas
              content={currentDoc.content as Record<string, unknown>}
              onContentChange={handleContentChange}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <Edit3 className="w-8 h-8 text-blue-500/50" />
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">No documents found.</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[200px] mx-auto">
                  Create a new note to start, or use the full Website Editor.
                </p>
              </div>
              <button
                onClick={openTitleModal}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                Create Note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title Prompt Modal */}
      <TitleModal
        open={showTitleModal}
        value={pendingTitle}
        onChange={setPendingTitle}
        onConfirm={confirmCreate}
        onClose={() => setShowTitleModal(false)}
      />
    </>
  );
};

export default NotepadView;
