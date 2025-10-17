// scr/lib/fileExport.js

/**
 * File Export Module
 * Handles exporting saved items in multiple formats
 * ✅ Updated for Supabase (flat data structure)
 */

/**
 * Export items as plain text
 */
export function exportAsText(items) {
  if (!items || items.length === 0) {
    return "No items to export.";
  }

  let output = "═══════════════════════════════════════\n";
  output += "       ResearchMate Export\n";
  output += `       ${new Date().toLocaleDateString()}\n`;
  output += "═══════════════════════════════════════\n\n";

  items.forEach((item, index) => {
    const num = index + 1;

    output += `\n[${num}] ${item.sourceTitle || "Untitled"}\n`;
    output += "─".repeat(50) + "\n";

    if (item.sourceUrl) {
      output += `Source: ${item.sourceUrl}\n`;
    }

    if (item.createdAt) {
      const date = new Date(item.createdAt);
      output += `Date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}\n`;
    }

    if (item.tags && item.tags.length > 0) {
      output += `Tags: ${item.tags.map((t) => `#${t}`).join(" ")}\n`;
    }

    output += "\n";
    output += item.text || "(No content)";
    output += "\n";

    if (item.note) {
      output += `\nNotes: ${item.note}\n`;
    }

    output += "\n" + "═".repeat(50) + "\n";
  });

  return output;
}

/**
 * Export items as JSON
 */
export function exportAsJSON(items) {
  const exportData = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    itemCount: items.length,
    items: items.map((item) => ({
      id: item.id,
      text: item.text || "",
      sourceTitle: item.sourceTitle || "",
      sourceUrl: item.sourceUrl || "",
      tags: item.tags || [],
      note: item.note || "",
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export items as Markdown
 */
export function exportAsMarkdown(items) {
  if (!items || items.length === 0) {
    return "# ResearchMate Export\n\nNo items to export.";
  }

  let output = "# ResearchMate Export\n\n";
  output += `**Exported:** ${new Date().toLocaleDateString()}\n\n`;
  output += `**Total Items:** ${items.length}\n\n`;
  output += "---\n\n";

  items.forEach((item, index) => {
    const num = index + 1;

    output += `## ${num}. ${item.sourceTitle || "Untitled"}\n\n`;

    if (item.sourceUrl) {
      output += `**Source:** [Link](${item.sourceUrl})\n\n`;
    }

    if (item.createdAt) {
      const date = new Date(item.createdAt);
      output += `**Date:** ${date.toLocaleDateString()}\n\n`;
    }

    if (item.tags && item.tags.length > 0) {
      output += `**Tags:** ${item.tags.map((t) => `\`${t}\``).join(", ")}\n\n`;
    }

    output += "### Content\n\n";
    output += item.text || "*(No content)*";
    output += "\n\n";

    if (item.note) {
      output += `### Notes\n\n${item.note}\n\n`;
    }

    output += "---\n\n";
  });

  return output;
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content, filename, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Main export handler with format selection
 */
export function exportItems(items, format = "txt") {
  const timestamp = new Date().toISOString().slice(0, 10);
  let content, filename, mimeType;

  switch (format) {
    case "json":
      content = exportAsJSON(items);
      filename = `researchmate-export-${timestamp}.json`;
      mimeType = "application/json";
      break;

    case "md":
      content = exportAsMarkdown(items);
      filename = `researchmate-export-${timestamp}.md`;
      mimeType = "text/markdown";
      break;

    case "txt":
    default:
      content = exportAsText(items);
      filename = `researchmate-export-${timestamp}.txt`;
      mimeType = "text/plain";
      break;
  }

  downloadFile(content, filename, mimeType);
  return filename;
}
