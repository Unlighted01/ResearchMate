import { StorageItem } from "../services/storageService";

/**
 * Generates a comprehensive Markdown block representing a saved research item,
 * optimized for pasting into note-taking apps like Notion or Obsidian.
 *
 * @param item - The StorageItem to format
 * @returns A formatted markdown string
 */
export function generateMarkdownTemplate(item: StorageItem): string {
  const content = item.text || item.ocrText || "";
  let markdown = `> ${content}\n\n`;

  if (item.sourceTitle || item.sourceUrl) {
    const title = item.sourceTitle || "Source";
    const link = item.sourceUrl ? `[${title}](${item.sourceUrl})` : title;
    markdown += `**Source:** ${link}\n`;
  } else {
     markdown += `**Source:** Saved from ResearchMate\n`;
  }

  if (item.aiSummary) {
    markdown += `**Summary:** ${item.aiSummary}\n`;
  }

  if (item.color) {
    // Capitalize the first letter for aesthetics
    const capitalizedColor = item.color.charAt(0).toUpperCase() + item.color.slice(1);
    markdown += `**Highlight:** ${capitalizedColor}\n`;
  }

  if (item.createdAt) {
      markdown += `**Captured:** ${new Date(item.createdAt).toLocaleDateString()}\n`;
  }

  if (item.tags && item.tags.length > 0) {
    // Re-pack tags into #hashtags without color: mappings
    const formattedTags = item.tags
      .filter((t: string) => !t.startsWith("color:"))
      .map((t: string) => `#${t.replace(/\s+/g, "_")}`) // Obsidian prefers underscores for multi-word tags
      .join(" ");
      
    if (formattedTags) {
        markdown += `**Tags:** ${formattedTags}\n`;
    }
  }

  return markdown;
}
