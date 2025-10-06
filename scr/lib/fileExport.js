// scr/lib/fileExport.js

/**
 * File Export Module
 * Handles exporting saved items in multiple formats
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
    const data = item.data;
    const num = index + 1;

    output += `\n[${num}] ${data.sourceTitle || "Untitled"}\n`;
    output += "─".repeat(50) + "\n";

    if (data.sourceUrl) {
      output += `Source: ${data.sourceUrl}\n`;
    }

    if (data.createdAt) {
      const date = data.createdAt.toDate
        ? data.createdAt.toDate()
        : new Date(data.createdAt);
      output += `Date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}\n`;
    }

    if (data.tags && data.tags.length > 0) {
      output += `Tags: ${data.tags.map((t) => `#${t}`).join(" ")}\n`;
    }

    output += "\n";
    output += data.text || "(No content)";
    output += "\n";

    if (data.note) {
      output += `\nNotes: ${data.note}\n`;
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
    items: items.map((item) => {
      const data = item.data;
      return {
        id: item.id,
        text: data.text || "",
        sourceTitle: data.sourceTitle || "",
        sourceUrl: data.sourceUrl || "",
        tags: data.tags || [],
        note: data.note || "",
        createdAt: data.createdAt
          ? data.createdAt.toDate
            ? data.createdAt.toDate().toISOString()
            : new Date(data.createdAt).toISOString()
          : null,
      };
    }),
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
    const data = item.data;
    const num = index + 1;

    output += `## ${num}. ${data.sourceTitle || "Untitled"}\n\n`;

    if (data.sourceUrl) {
      output += `**Source:** [Link](${data.sourceUrl})\n\n`;
    }

    if (data.createdAt) {
      const date = data.createdAt.toDate
        ? data.createdAt.toDate()
        : new Date(data.createdAt);
      output += `**Date:** ${date.toLocaleDateString()}\n\n`;
    }

    if (data.tags && data.tags.length > 0) {
      output += `**Tags:** ${data.tags.map((t) => `\`${t}\``).join(", ")}\n\n`;
    }

    output += "### Content\n\n";
    output += data.text || "*(No content)*";
    output += "\n\n";

    if (data.note) {
      output += `### Notes\n\n${data.note}\n\n`;
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
