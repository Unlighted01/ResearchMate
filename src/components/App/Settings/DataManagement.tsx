import React from "react";
import { Download, Upload, Printer, FileText } from "lucide-react";
import { Collection } from "../../../types";

interface DataManagementProps {
  showExportMenu: boolean;
  onToggleExportMenu: () => void;
  onExportAll: (fmt: string) => void;
  onImportClick: () => void;
  importing: boolean;
  exportMenuRef: React.RefObject<HTMLDivElement>;
  exportScope: "all" | "collection" | "tag";
  onExportScopeChange: (scope: "all" | "collection" | "tag") => void;
  selectedCollectionId: string;
  onCollectionChange: (id: string) => void;
  selectedTag: string;
  onTagChange: (tag: string) => void;
  collections: Collection[];
  uniqueTags: string[];
  exportCount: number;
}

export const DataManagement: React.FC<DataManagementProps> = ({
  showExportMenu,
  onToggleExportMenu,
  onExportAll,
  onImportClick,
  importing,
  exportMenuRef,
  exportScope,
  onExportScopeChange,
  selectedCollectionId,
  onCollectionChange,
  selectedTag,
  onTagChange,
  collections,
  uniqueTags,
  exportCount,
}) => {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Data Management</h2>
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
        <div ref={exportMenuRef} className="border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={onToggleExportMenu}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Download size={16} className="text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-200">Export Research</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${showExportMenu ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
          </button>
          
          {showExportMenu && (
            <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
              {/* Export Scope Selector Section */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 space-y-3 bg-gray-50/50 dark:bg-gray-800/30">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Export Scope</label>
                  <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-950 p-0.5 rounded-lg border border-gray-200/20">
                    {(["all", "collection", "tag"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => onExportScopeChange(s)}
                        className={`py-1 text-xs font-semibold rounded-md transition-all ${
                          exportScope === s
                            ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                      >
                        {s === "all" ? "All" : s === "collection" ? "Collection" : "Tag"}
                      </button>
                    ))}
                  </div>
                </div>

                {exportScope === "collection" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400">Select Collection</label>
                    {collections.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No collections found</p>
                    ) : (
                      <select
                        value={selectedCollectionId}
                        onChange={(e) => onCollectionChange(e.target.value)}
                        className="w-full text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 outline-none text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500"
                      >
                        {collections.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name} ({col.item_count || 0})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {exportScope === "tag" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400">Select Tag</label>
                    {uniqueTags.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No tags found</p>
                    ) : (
                      <select
                        value={selectedTag}
                        onChange={(e) => onTagChange(e.target.value)}
                        className="w-full text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 outline-none text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500"
                      >
                        {uniqueTags.map((t) => (
                          <option key={t} value={t}>
                            #{t}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 pt-1.5 border-t border-gray-100 dark:border-gray-700/50">
                  <span>Ready to export:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                    {exportCount} item{exportCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {[
                { fmt: "pdf", icon: <Printer size={14} />, label: "PDF Report" },
                { fmt: "json", icon: <Download size={14} />, label: "JSON Backup" },
                { fmt: "md", icon: <FileText size={14} />, label: "Markdown Collection" },
              ].map(({ fmt, icon, label }) => (
                <button
                  key={fmt}
                  onClick={() => onExportAll(fmt)}
                  className="w-full px-8 py-2.5 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
                >
                  <span className="text-gray-400">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onImportClick}
          disabled={importing}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Upload size={16} className="text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-200">
              {importing ? "Importing items..." : "Import Local Files"}
            </span>
          </div>
        </button>
      </div>
    </section>
  );
};
