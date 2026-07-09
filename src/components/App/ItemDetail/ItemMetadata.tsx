import React from "react";
import { 
  Tag as TagIcon, 
  Plus, 
  X, 
  Pencil, 
  Save 
} from "lucide-react";

interface ItemMetadataProps {
  tags: string[];
  itemColor: string;
  onColorChange: (color: any) => void;
  isAddingTag: boolean;
  onStartAddingTag: () => void;
  onCancelAddingTag: () => void;
  newTag: string;
  onNewTagChange: (val: string) => void;
  onAddTag: () => void;
  onDeleteTag: (tag: string) => void;
  itemNote: string;
  onNoteChange: (val: string) => void;
  isEditingNote: boolean;
  onStartEditingNote: () => void;
  onSaveNote: () => void;
}

export const ItemMetadata: React.FC<ItemMetadataProps> = ({
  tags,
  itemColor,
  onColorChange,
  isAddingTag,
  onStartAddingTag,
  onCancelAddingTag,
  newTag,
  onNewTagChange,
  onAddTag,
  onDeleteTag,
  itemNote,
  onNoteChange,
  isEditingNote,
  onStartEditingNote,
  onSaveNote,
}) => {
  const colors = [
    { id: "yellow", hex: "#FBBF24" },
    { id: "green", hex: "#34D399" },
    { id: "blue", hex: "#60A5FA" },
    { id: "red", hex: "#F87171" },
    { id: "purple", hex: "#A78BFA" },
  ];

  return (
    <div className="space-y-6 pt-6 border-t border-gray-100 dark:border-gray-800">
      {/* Colors & Tags */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TagIcon className="w-4 h-4 text-gray-400" />
          <h3 className="theme-title text-xs font-bold text-gray-400 uppercase tracking-wider">Categorization</h3>
        </div>

        <div className="flex flex-wrap gap-2 items-center mb-4">
          <div className="flex gap-1.5 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg mr-2 border border-gray-100 dark:border-gray-700">
            {colors.map((c) => (
              <button
                key={c.id}
                onClick={() => onColorChange(c.id)}
                className={`w-4 h-4 rounded-full transition-all ${itemColor === c.id ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-110"}`}
                style={{ backgroundColor: c.hex }}
                title={`Mark as ${c.id}`}
              />
            ))}
          </div>

          {tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600">
              #{tag}
              <button onClick={() => onDeleteTag(tag)} className="hover:text-red-500"><X size={12} /></button>
            </span>
          ))}

          {isAddingTag ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newTag}
                onChange={(e) => onNewTagChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddTag()}
                className="theme-input w-24 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-blue-300 rounded-lg outline-none"
                placeholder="Tag name..."
              />
              <button onClick={onAddTag} className="p-1 text-blue-600"><Plus size={16} /></button>
              <button onClick={onCancelAddingTag} className="p-1 text-gray-400"><X size={16} /></button>
            </div>
          ) : (
            <button
              onClick={onStartAddingTag}
              className="flex items-center gap-1 px-2 py-1 border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-blue-400 hover:text-blue-500 rounded-lg text-xs transition-colors"
            >
              <Plus size={12} /> Add Tag
            </button>
          )}
        </div>
      </div>

      {/* Note Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sticky-note w-4 h-4 text-gray-400"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v5a2 2 0 0 0 2 2h5"/><path d="m3 21 9-9"/><path d="M9 18h.01"/></svg>
            <h3 className="theme-title text-xs font-bold text-gray-400 uppercase tracking-wider">Personal Notes</h3>
          </div>
          {!isEditingNote && (
            <button onClick={onStartEditingNote} className="text-xs font-bold uppercase text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors">
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>

        {isEditingNote ? (
          <div className="space-y-2">
            <textarea
              value={itemNote}
              onChange={(e) => onNoteChange(e.target.value)}
              className="theme-input w-full min-h-[100px] p-3 text-base text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-400/20"
              placeholder="Add your thoughts or context here..."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => onStartEditingNote()} className="px-3 py-1.5 text-xs font-semibold text-gray-500">Cancel</button>
              <button onClick={onSaveNote} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">
                <Save size={14} /> Save Note
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800/50">
            {itemNote ? (
              <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed italic">"{itemNote}"</p>
            ) : (
              <p className="text-base text-gray-400 italic">No notes added yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
