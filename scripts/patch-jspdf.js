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

filePaths.forEach((filePath) => {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, "utf8");
    if (cdnUrlRegex.test(content)) {
      console.log(`Patching ${filePath}...`);
      content = content.replace(cdnUrlRegex, "");
      fs.writeFileSync(fullPath, content, "utf8");
      console.log(`Patched ${filePath}`);
    } else {
      console.log(`No CDN URL found in ${filePath}`);
    }
  } else {
    console.log(`File not found: ${filePath}`);
  }
});
