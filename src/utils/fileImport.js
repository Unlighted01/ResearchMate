// src/utils/fileImport.js

let pdfjsLib = null;
let pdfJsLoading = false;
let pdfJsLoaded = false;

/**
 * Load PDF.js library dynamically
 */
async function loadPdfJs() {
  if (pdfJsLoaded) return true;
  if (pdfJsLoading) {
    // Wait for existing load
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (pdfJsLoaded || !pdfJsLoading) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
    return pdfJsLoaded;
  }

  pdfJsLoading = true;

  try {
    // Import PDF.js as a module from local vendor folder
    const pdfUrl = chrome.runtime.getURL("src/vendor/pdf.mjs");
    const workerUrl = chrome.runtime.getURL("src/vendor/pdf.worker.mjs");

    const lib = await import(pdfUrl);
    pdfjsLib = lib; // Use the module namespace directly, or lib.default if needed

    // Fallback if it's wrapped in default
    if (!pdfjsLib.getDocument && lib.default) {
      pdfjsLib = lib.default;
    }

    if (pdfjsLib && pdfjsLib.getDocument) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      pdfJsLoaded = true;
      pdfJsLoading = false;
      console.log("PDF.js loaded successfully");
      return true;
    } else {
      throw new Error("PDF.js loaded but getDocument not found");
    }
  } catch (error) {
    console.error("Failed to load PDF.js:", error);
    pdfJsLoading = false;
  }

  return false;
}

/**
 * Initialize file importer
 */
export function initFileImporter(callbacks) {
  const { onPreview, onToast } = callbacks;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".pdf,.txt";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      onToast("Processing file...");

      let text = "";
      const fileName = file.name;

      if (file.type === "text/plain" || fileName.endsWith(".txt")) {
        text = await readTextFile(file);
      } else if (file.type === "application/pdf" || fileName.endsWith(".pdf")) {
        const loaded = await loadPdfJs();
        if (!loaded) {
          onToast("PDF support unavailable. Please use .txt files.");
          return;
        }
        text = await readPdfFile(file);
      } else {
        onToast("Unsupported file type. Use .txt or .pdf files.");
        return;
      }

      if (!text.trim()) {
        onToast("No text found in file.");
        return;
      }

      onPreview(text, fileName);
      onToast(`Imported: ${fileName}`);
      fileInput.value = "";
    } catch (error) {
      console.error("Import error:", error);
      onToast("Failed to import file: " + error.message);
    }
  });

  return () => fileInput.click();
}

/**
 * Read plain text file
 */
async function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Read PDF file using PDF.js
 */
async function readPdfFile(file) {
  if (!pdfjsLib) {
    throw new Error("PDF.js not loaded");
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      fullText += pageText + "\n\n";
    }

    return fullText.trim();
  } catch (error) {
    console.error("PDF parsing error:", error);
    throw new Error("Failed to parse PDF file");
  }
}
