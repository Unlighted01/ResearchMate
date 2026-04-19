import React from "react";
import { Download, Upload, Printer, FileText } from "lucide-react";

interface DataManagementProps {
  showExportMenu: boolean;
  onToggleExportMenu: () => void;
  onExportAll: (fmt: string) => void;
  onImportClick: () => void;
  importing: boolean;
  exportMenuRef: React.RefObject<HTMLDivElement>;
}

export const DataManagement: React.FC<DataManagementProps> = ({
  showExportMenu,
  onToggleExportMenu,
  onExportAll,
  onImportClick,
  importing,
  exportMenuRef,
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
              <span className="text-sm text-gray-700 dark:text-gray-200">Export All Research</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${showExportMenu ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
          </button>
          
          {showExportMenu && (
            <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
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
