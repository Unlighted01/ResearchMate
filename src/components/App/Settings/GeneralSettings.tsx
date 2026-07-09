import React from "react";
import { SegmentedControl } from "../../shared/ui/SegmentedControl";
import { AnimatedSwitch } from "../../shared/ui/AnimatedSwitch";

interface GeneralSettingsProps {
  citationStyle: string;
  onCitationStyleChange: (val: string) => void;
  useAiCitation: boolean;
  onUseAiCitationChange: (val: boolean) => void;
  exportFormat: string;
  onExportFormatChange: (val: string) => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  citationStyle,
  onCitationStyleChange,
  useAiCitation,
  onUseAiCitationChange,
  exportFormat,
  onExportFormatChange,
}) => {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Research Preferences</h2>
      <div className="theme-surface bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
        {/* Style Selector */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">Primary Citation Format</label>
          <SegmentedControl
            name="citation-style"
            value={citationStyle}
            onChange={onCitationStyleChange}
            options={[
              { value: "apa", label: "APA" },
              { value: "mla", label: "MLA" },
              { value: "chicago", label: "Chicago" },
              { value: "ieee", label: "IEEE" },
            ]}
          />
        </div>

        {/* AI Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Enhanced AI Citation</h3>
            <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Fills missing metadata for handwritten notes.</p>
          </div>
          <AnimatedSwitch
            checked={useAiCitation}
            onChange={onUseAiCitationChange}
            label="Toggle AI Citation"
          />
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-700 mx-1"></div>

        {/* Default Export Format */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">Quick Download Format</label>
          <SegmentedControl
            name="export-format"
            value={exportFormat}
            onChange={onExportFormatChange}
            options={[
              { value: "pdf", label: "PDF" },
              { value: "json", label: "JSON" },
              { value: "txt", label: "TXT" },
              { value: "md", label: "MD" },
            ]}
          />
        </div>
      </div>
    </section>
  );
};
