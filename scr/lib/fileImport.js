// scr/lib/fileImport.js

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
    // Load PDF.js script
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("scr/lib/pdf.min.js");
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // Get pdfjsLib from window
    pdfjsLib = window.pdfjsLib || window["pdfjs-dist/build/pdf"];

    if (pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
        "scr/lib/pdf.worker.min.js"
      );
      pdfJsLoaded = true;
      pdfJsLoading = false;
      console.log("PDF.js loaded successfully");
      return true;
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

/**
 * Auto-save imported text to Firestore
 */
export async function autoSaveImport(
  text,
  fileName,
  { db, user, projectId, serverTimestamp, addDoc, collection }
) {
  if (!user || !text) return false;

  try {
    await addDoc(
      collection(db, `users/${user.uid}/projects/${projectId}/items`),
      {
        text: text.slice(0, 10000),
        sourceTitle: fileName,
        sourceUrl: "",
        tags: ["imported"],
        note: "",
        createdAt: serverTimestamp(),
      }
    );
    return true;
  } catch (error) {
    console.error("Auto-save error:", error);
    return false;
  }
}
