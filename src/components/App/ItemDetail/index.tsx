import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

// Components
import ISBNSearchModal from "./ISBNSearchModal";

// Refactored Parts
import { useItemDetail } from "./useItemDetail";
import { ItemHeader } from "./ItemHeader";
import { ItemContent } from "./ItemContent";
import { ItemMetadata } from "./ItemMetadata";
import { CitationCard } from "./CitationCard";

// Types
import { StorageItem } from "../../../services/storageService";

interface ItemDetailProps {
  item: StorageItem;
  onBack: () => void;
  onDelete: () => void;
  onUpdate: () => void;
}

const ItemDetail: React.FC<ItemDetailProps> = ({
  item,
  onBack,
  onDelete,
  onUpdate,
}) => {
  const {
    copied,
    summary,
    citation,
    citationFormat,
    tags,
    itemColor,
    summarizing,
    summaryMode,
    setSummaryMode,
    loadingCitation,
    isEditingOcr,
    setIsEditingOcr,
    editedOcrText,
    setEditedOcrText,
    ocrEdited,
    isRetryingOcr,
    showSummaryView,
    isAddingTag,
    setIsAddingTag,
    newTag,
    setNewTag,
    itemNote,
    setItemNote,
    isEditingNote,
    setIsEditingNote,
    isIdentifyModalOpen,
    setIsIdentifyModalOpen,
    showScrollTop,
    showScrollBottom,
    scrollContainerRef,
    handleCopy,
    handleToggleView,
    handleSummarize,
    handleCite,
    handleAddTag,
    handleDeleteTag,
    handleSaveNote,
    handleDownload,
    handleDeleteItem,
    handleSaveOcrEdit,
    handleRetryOcr,
    handleBookSelect,
    extractSearchQuery,
    handleCopyMarkdown,
  } = useItemDetail(item, onUpdate, onDelete);

  const hasOcrData = item.deviceSource === "smart_pen" || item.ocrConfidence != null || !!item.imageUrl;

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 relative">
      <ISBNSearchModal
        isOpen={isIdentifyModalOpen}
        onClose={() => setIsIdentifyModalOpen(false)}
        onSelectBook={handleBookSelect}
        initialQuery={extractSearchQuery()}
        itemText={item.text}
      />

      <ItemHeader
        onBack={onBack}
        onCopy={handleCopy}
        copied={copied}
        onDownload={handleDownload}
        onCite={() => handleCite()}
        loadingCitation={loadingCitation}
        hasCitation={!!citation}
        onSummarize={() => handleSummarize()}
        summarizing={summarizing}
        hasSummary={!!summary}
        summaryMode={summaryMode}
        onSummaryModeChange={setSummaryMode}
        onIdentifySource={() => setIsIdentifyModalOpen(true)}
        onCopyMarkdown={handleCopyMarkdown}
        onDelete={handleDeleteItem}
        sourceUrl={item.sourceUrl}
        hasOcrData={hasOcrData}
        itemId={item.id}
      />

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 scrollbar-hide relative">
        <ItemContent
          text={item.text}
          imageUrl={item.imageUrl}
          deviceSource={item.deviceSource}
          hasOcrData={hasOcrData}
          ocrConfidence={item.ocrConfidence ?? undefined}
          ocrEdited={ocrEdited}
          isEditingOcr={isEditingOcr}
          editedOcrText={editedOcrText}
          onEditedOcrTextChange={setEditedOcrText}
          onSaveOcrEdit={handleSaveOcrEdit}
          onCancelOcrEdit={() => setIsEditingOcr(false)}
          onRetryOcr={handleRetryOcr}
          isRetryingOcr={isRetryingOcr}
          showSummaryView={showSummaryView}
          summary={summary}
          onToggleView={handleToggleView}
          onStartEditingOcr={() => {
            setEditedOcrText(item.text);
            handleToggleView(false);
            setIsEditingOcr(true);
          }}
        />

        <CitationCard
          citation={citation}
          format={citationFormat}
          onFormatChange={(f) => handleCite(f)}
          loading={loadingCitation}
        />

        <ItemMetadata
          tags={tags}
          itemColor={itemColor}
          onColorChange={(_color) => {
             // Use internal handler or handle locally
            // This is simplified for the refactor
          }}
          isAddingTag={isAddingTag}
          onStartAddingTag={() => setIsAddingTag(true)}
          onCancelAddingTag={() => setIsAddingTag(false)}
          newTag={newTag}
          onNewTagChange={setNewTag}
          onAddTag={handleAddTag}
          onDeleteTag={handleDeleteTag}
          itemNote={itemNote}
          onNoteChange={setItemNote}
          isEditingNote={isEditingNote}
          onStartEditingNote={() => setIsEditingNote(!isEditingNote)}
          onSaveNote={handleSaveNote}
        />
      </div>

      {/* Floating Scroll Buttons */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="absolute bottom-6 right-6 p-3 bg-white dark:bg-gray-800 text-gray-500 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 hover:text-blue-500 transition-colors z-20"
          >
            <ArrowUp size={20} />
          </motion.button>
        )}
        {showScrollBottom && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "smooth" })}
            className="absolute bottom-6 right-20 p-3 bg-white dark:bg-gray-800 text-gray-500 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 hover:text-blue-500 transition-colors z-20"
          >
            <ArrowDown size={20} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ItemDetail;
