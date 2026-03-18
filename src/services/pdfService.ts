import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { StorageItem } from "./storageService";

interface User {
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

// ─────────────────────────────────────────────────────────────
// Markdown → jsPDF renderer
// Handles: # H1, ## H2, ### H3, - lists, 1. numbered lists,
//          | tables |, > blockquotes, *italic*, **bold** (stripped),
//          regular paragraphs, and automatic page breaks.
// ─────────────────────────────────────────────────────────────
function renderMarkdown(
  doc: jsPDF,
  markdown: string,
  startY: number,
  margin: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 18;
  let y = startY;

  const checkBreak = (needed: number) => {
    if (y + needed > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin;
    }
  };

  // Strip inline markers for plain rendering (bold/italic not natively supported inline in jsPDF)
  const strip = (s: string) =>
    s
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/~~(.*?)~~/g, "$1");

  // Accumulate table rows until a non-table line breaks the block
  let tableBuffer: string[][] = [];
  let tableSeparatorSeen = false;
  let tableHeaders: string[] = [];

  const parseTableRow = (line: string): string[] =>
    line
      .split("|")
      .filter((_, i, arr) => i > 0 && i < arr.length - 1)
      .map((c) => strip(c.trim()));

  const isSeparatorRow = (line: string) =>
    /^\|[\s|:-]+\|$/.test(line.trim());

  const flushTable = () => {
    if (tableBuffer.length === 0 && tableHeaders.length === 0) return;
    checkBreak(30);
    autoTable(doc, {
      startY: y,
      head: tableHeaders.length > 0 ? [tableHeaders] : undefined,
      body: tableBuffer,
      headStyles: { fillColor: [0, 122, 255], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
    tableBuffer = [];
    tableHeaders = [];
    tableSeparatorSeen = false;
  };

  const lines = markdown.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // ── Table row ──────────────────────────────────────────────
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (isSeparatorRow(line)) {
        // Promote pending rows to headers
        if (tableBuffer.length > 0 && !tableSeparatorSeen) {
          tableHeaders = tableBuffer.pop()!;
          tableSeparatorSeen = true;
        }
        continue;
      }
      tableBuffer.push(parseTableRow(line));
      continue;
    } else {
      flushTable();
    }

    // ── Blank line ──────────────────────────────────────────────
    if (line.trim() === "") {
      y += 3;
      continue;
    }

    // ── H1 ─────────────────────────────────────────────────────
    if (line.startsWith("# ")) {
      const text = strip(line.slice(2));
      checkBreak(14);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      const split = doc.splitTextToSize(text, contentWidth);
      doc.text(split, margin, y);
      y += split.length * 8 + 4;
      // Underline
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 3;
      continue;
    }

    // ── H2 ─────────────────────────────────────────────────────
    if (line.startsWith("## ")) {
      const text = strip(line.slice(3));
      checkBreak(11);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 20, 80);
      const split = doc.splitTextToSize(text, contentWidth);
      doc.text(split, margin, y);
      y += split.length * 7 + 4;
      continue;
    }

    // ── H3 ─────────────────────────────────────────────────────
    if (line.startsWith("### ")) {
      const text = strip(line.slice(4));
      checkBreak(9);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      const split = doc.splitTextToSize(text, contentWidth);
      doc.text(split, margin, y);
      y += split.length * 6 + 3;
      continue;
    }

    // ── Blockquote (footnotes) ──────────────────────────────────
    if (line.startsWith("> ")) {
      const text = strip(line.slice(2));
      checkBreak(6);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 100, 100);
      // Left bar
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.8);
      doc.line(margin, y - 3, margin, y + 1);
      doc.setLineWidth(0.2);
      const split = doc.splitTextToSize(text, contentWidth - 8);
      doc.text(split, margin + 5, y);
      y += split.length * 5 + 3;
      continue;
    }

    // ── Bullet list ─────────────────────────────────────────────
    if (/^[-*+] /.test(line)) {
      const text = strip(line.replace(/^[-*+] /, ""));
      checkBreak(6);
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      const split = doc.splitTextToSize("• " + text, contentWidth - 8);
      doc.text(split, margin + 5, y);
      y += split.length * 5 + 1.5;
      continue;
    }

    // ── Numbered list ───────────────────────────────────────────
    const numberedMatch = line.match(/^(\d+)\. (.+)/);
    if (numberedMatch) {
      const text = strip(numberedMatch[2]);
      checkBreak(6);
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      const split = doc.splitTextToSize(
        `${numberedMatch[1]}. ${text}`,
        contentWidth - 8,
      );
      doc.text(split, margin + 5, y);
      y += split.length * 5 + 1.5;
      continue;
    }

    // ── Horizontal rule ─────────────────────────────────────────
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      checkBreak(6);
      doc.setDrawColor(210, 210, 210);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
      continue;
    }

    // ── Regular paragraph ────────────────────────────────────────
    const text = strip(line);
    checkBreak(6);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const split = doc.splitTextToSize(text, contentWidth);
    doc.text(split, margin, y);
    y += split.length * 5 + 2;
  }

  // Flush any trailing table
  flushTable();

  return y;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function addPageFooter(doc: jsPDF, pageNum: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.setFont("helvetica", "normal");
  doc.text(`Page ${pageNum}`, 14, pageHeight - 10);
  doc.text("ResearchMate", pageWidth - 14, pageHeight - 10, { align: "right" });
}

// ─────────────────────────────────────────────────────────────
// Bulk export (all items → table)
// ─────────────────────────────────────────────────────────────
export const exportToPdf = (items: StorageItem[], user: User | null) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(0, 122, 255);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("ResearchMate Report", 14, 25);

  if (user) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const name = user.user_metadata?.full_name || user.email || "User";
    const date = new Date().toLocaleDateString();
    doc.text(`Generated by: ${name}`, pageWidth - 14, 18, { align: "right" });
    doc.text(`Date: ${date}`, pageWidth - 14, 24, { align: "right" });
    if (user.email) doc.text(user.email, pageWidth - 14, 30, { align: "right" });
  }

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.text(`Total Items: ${items.length}`, 14, 50);

  const tableData = items.map((item) => [
    item.citation || item.sourceTitle || "Untitled Source",
    item.aiSummary || item.note || item.text.substring(0, 120) + "…",
    item.tags?.join(", ") || "-",
    item.sourceUrl || "-",
  ]);

  autoTable(doc, {
    startY: 55,
    head: [["Source / Citation", "Summary / Note", "Tags", "Link"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [0, 122, 255], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 70 },
      2: { cellWidth: 30 },
      3: { cellWidth: 40 },
    },
    didDrawPage: (data: any) => {
      const pageCount = doc.internal.pages.length - 1;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
    },
  });

  doc.save(`researchmate_report_${new Date().toISOString().split("T")[0]}.pdf`);
};

// ─────────────────────────────────────────────────────────────
// Single item export — renders Markdown for OCR/smart pen items
// ─────────────────────────────────────────────────────────────
export const exportSingleItemToPdf = (item: StorageItem) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let pageNum = 1;

  // Header band
  doc.setFillColor(0, 122, 255);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ResearchMate", margin, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const safeTitle = (item.sourceTitle || "Item").substring(0, 60);
  doc.text(safeTitle, margin, 23);

  let y = 40;

  // Citation box
  if (item.citation) {
    doc.setFillColor(245, 247, 250);
    doc.setDrawColor(200, 200, 200);
    doc.setTextColor(0, 50, 100);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("CITATION", margin + 4, y + 7);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    const splitCitation = doc.splitTextToSize(item.citation, pageWidth - margin * 2 - 8);
    doc.rect(margin, y, pageWidth - margin * 2, splitCitation.length * 5 + 14, "FD");
    doc.text(splitCitation, margin + 4, y + 15);
    y += splitCitation.length * 5 + 20;
  }

  // Source info
  if (item.sourceTitle || item.sourceUrl) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    if (item.sourceTitle) { doc.text(`Source: ${item.sourceTitle}`, margin, y); y += 6; }
    if (item.sourceUrl) {
      doc.setTextColor(0, 122, 255);
      doc.textWithLink("Link to Source", margin, y, { url: item.sourceUrl });
      y += 10;
    }
  }

  y += 4;

  // AI Summary
  if (item.aiSummary) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("AI Summary", margin, y);
    y += 7;
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const split = doc.splitTextToSize(item.aiSummary, pageWidth - margin * 2);
    doc.text(split, margin, y);
    y += split.length * 5 + 10;
  }

  // Content — rendered as Markdown if it looks structured, plain text otherwise
  const isMarkdown = /^#{1,3} |^\*\*|^- |\|.*\|/.test(item.text);
  const label = item.aiSummary ? "Original Content" : "Content";

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  if (y + 10 > doc.internal.pageSize.getHeight() - 18) { doc.addPage(); pageNum++; y = margin; }
  doc.text(label, margin, y);
  y += 8;

  if (isMarkdown) {
    y = renderMarkdown(doc, item.text, y, margin);
  } else {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const split = doc.splitTextToSize(item.text, pageWidth - margin * 2);
    // Paginate manually
    const lineH = 5;
    const pageH = doc.internal.pageSize.getHeight() - 18;
    for (const line of split) {
      if (y + lineH > pageH) { doc.addPage(); pageNum++; y = margin; }
      doc.text(line, margin, y);
      y += lineH;
    }
  }

  // Footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPageFooter(doc, p);
  }

  const safeName = (item.sourceTitle || "item").replace(/[^a-z0-9]/gi, "_").substring(0, 20);
  doc.save(`researchmate_${safeName}.pdf`);
};

export const exportSingleItemToJson = (item: StorageItem) => {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(item, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `researchmate_item_${item.id.substring(0, 8)}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
};
