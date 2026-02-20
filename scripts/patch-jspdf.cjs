const fs = require("fs");
const path = require("path");

const filePaths = [
  "node_modules/jspdf/dist/jspdf.es.min.js",
  "node_modules/jspdf/dist/jspdf.es.js",
  "node_modules/jspdf/dist/jspdf.umd.min.js",
  "node_modules/jspdf/dist/jspdf.umd.js",
  "node_modules/jspdf/dist/jspdf.node.min.js",
  "node_modules/jspdf/dist/jspdf.node.js",
];

const cdnUrlRegex =
  /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdfobject\/[0-9.]+\/pdfobject\.min\.js/g;

let patchedCount = 0;
const log = [];

console.log("Starting jsPDF patch process...");

filePaths.forEach((filePath) => {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    try {
      let content = fs.readFileSync(fullPath, "utf8");
      if (cdnUrlRegex.test(content)) {
        console.log(`Patching ${filePath}...`);
        content = content.replace(cdnUrlRegex, "");
        fs.writeFileSync(fullPath, content, "utf8");
        console.log(`Successfully patched ${filePath}`);
        patchedCount++;
        log.push(`Patched ${filePath}`);
      } else {
        console.log(
          `No CDN URL found in ${filePath} (already patched or clean)`,
        );
        log.push(`Clean: ${filePath}`);
      }
    } catch (e) {
      console.error(`Error processing ${filePath}: ${e.message}`);
      log.push(`Error: ${filePath} - ${e.message}`);
    }
  } else {
    console.log(`File not found: ${filePath}`);
    log.push(`Missing: ${filePath}`);
  }
});

try {
  fs.writeFileSync(
    "patch_status.txt",
    log.join("\n") + `\nTotal Patched: ${patchedCount}\nDone.`,
  );
  console.log("Patch complete. Log written to patch_status.txt");
} catch (e) {
  console.error("Failed to write patch_status.txt", e);
}
