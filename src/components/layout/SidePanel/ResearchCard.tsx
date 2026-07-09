import React from "react";
import { motion } from "motion/react";
import { 
  CloudOff, 
  Sparkles, 
  Quote, 
  ExternalLink, 
  CheckSquare, 
  Check,
  Pin,
  PinOff
} from "lucide-react";
import { TrashIcon } from "../../icons";
import { StorageItem } from "../../../services/storageService";

interface ResearchCardProps {
  item: StorageItem;
  selectionActive: boolean;
  isSelected: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onClick: (item: StorageItem) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onPin?: (id: string, pin: boolean) => void;
  onEnterSelection?: (id: string) => void;
}

export const ResearchCard: React.FC<ResearchCardProps> = ({
  item,
  selectionActive,
  isSelected,
  onSelect,
  onClick,
  onDelete,
  onPin,
  onEnterSelection,
}) => {
  const colorHex =
    item.color === "yellow" ? "#FBBF24"
    : item.color === "green"  ? "#34D399"
    : item.color === "blue"   ? "#60A5FA"
    : item.color === "red"    ? "#F87171"
    : item.color === "purple" ? "#A78BFA"
    : null;

  const colorBgClass =
    item.color === "yellow" ? "bg-yellow-50/30 dark:bg-yellow-900/10"
    : item.color === "green"  ? "bg-emerald-50/30 dark:bg-emerald-900/10"
    : item.color === "blue"   ? "bg-blue-50/30 dark:bg-blue-900/10"
    : item.color === "red"    ? "bg-red-50/30 dark:bg-red-900/10"
    : item.color === "purple" ? "bg-purple-50/30 dark:bg-purple-900/10"
    : "";

  const hostname = (() => {
    if (!item.sourceUrl) return "UNKNOWN SOURCE";
    try {
      const urlToParse = item.sourceUrl.startsWith("http")
        ? item.sourceUrl
        : `https://${item.sourceUrl}`;
      return new URL(urlToParse).hostname;
    } catch {
      return "UNKNOWN SOURCE";
    }
  })();

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`Research item from ${hostname}: ${item.text.slice(0, 80)}`}
      onClick={() => onClick(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(item);
        }
      }}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 },
      }}
      className={`theme-surface bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--glass-shadow)] backdrop-blur-md p-4 rounded-xl transition-all cursor-pointer group hover-lift relative overflow-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${colorBgClass} ${
        isSelected
          ? "border-[var(--apple-blue)] dark:border-[var(--apple-blue)] bg-blue-50/10 dark:bg-blue-900/10 scale-[0.99]"
          : "hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      {/* Color indicator bar */}
      {colorHex && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-xl"
          style={{ backgroundColor: colorHex }}
        />
      )}

      {/* Selection Checkbox */}
      {(selectionActive || isSelected) && (
        <div
          className="absolute -top-2 -left-2 z-10 bg-white dark:bg-gray-800 rounded-full"
          onClick={(e) => onSelect(item.id, e)}
        >
          {isSelected ? (
            <div className="w-5 h-5 bg-[var(--apple-blue)] rounded-full flex items-center justify-center border border-[var(--apple-blue)] shadow-sm">
              <Check className="w-3 h-3 text-white" />
            </div>
          ) : (
            <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-500 rounded-full bg-white dark:bg-gray-800 shadow-sm group-hover:border-[var(--apple-blue)] transition-colors"></div>
          )}
        </div>
      )}

      <div className="flex justify-between items-start mb-2">
        <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">
          {hostname}
        </span>
        <div className="flex items-center gap-1.5">
          {item.pinned && (
            <span title="Pinned">
              <Pin className="w-3 h-3 text-amber-500 fill-amber-400" />
            </span>
          )}
          {item.id.startsWith("local_") && (
            <div title="Not synced to cloud">
              <CloudOff className="w-3 h-3 text-red-400" />
            </div>
          )}
          <span className="text-xs text-gray-400">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-3 mb-3 font-medium">
        {item.text}
      </p>

      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {item.tags
              ?.filter((t) => !t.startsWith("color:"))
              .slice(0, 2)
              .map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-lg border border-slate-200/40 dark:border-slate-700/40 font-medium"
                >
                  #{tag}
                </span>
              ))}
          </div>

          <div className="flex gap-1 items-center">
            {item.aiSummary && (
              <Sparkles className="w-3 h-3 text-purple-400" />
            )}
            {item.citation && (
              <Quote className="w-3 h-3 text-blue-400" />
            )}
          </div>
        </div>

        {!selectionActive && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-3 right-3 flex gap-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--glass-shadow)] p-1 rounded-xl backdrop-blur-md">
            {/* Pin / Unpin */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPin?.(item.id, !item.pinned);
              }}
              className={`cursor-pointer p-0.5 transition-colors ${
                item.pinned
                  ? "text-amber-500 hover:text-amber-600"
                  : "text-gray-400 hover:text-amber-500"
              }`}
              title={item.pinned ? "Unpin" : "Pin to top"}
            >
              {item.pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                onEnterSelection?.(item.id);
              }}
              className="text-gray-400 hover:text-blue-500 cursor-pointer p-0.5"
              title="Select"
            >
              <CheckSquare size={16} />
            </div>
            {item.sourceUrl && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(item.sourceUrl, "_blank");
                }}
                className="text-gray-400 hover:text-blue-500 cursor-pointer p-0.5"
                title="Visit Source"
              >
                <ExternalLink size={16} />
              </div>
            )}
            <div
              onClick={(e) => onDelete(item.id, e)}
              className="text-gray-400 hover:text-red-500 cursor-pointer p-0.5"
              title="Delete"
            >
              <TrashIcon
                size={16}
                className="text-gray-400 hover:text-red-500"
                dangerHover
                shakeOnClick
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
