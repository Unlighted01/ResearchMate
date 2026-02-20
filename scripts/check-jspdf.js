const fs = require("fs");
const path = require("path");

function checkDir(dirName, searchDir) {
  console.log(`Checking ${dirName}...`);
  if (!fs.existsSync(searchDir)) {
    console.log(`${dirName} does not exist.`);
    return;
  }
  fs.readdirSync(searchDir).forEach((file) => {
    const fullPath = path.join(searchDir, file);
    if (fs.statSync(fullPath).isDirectory()) return;
    try {
      const content = fs.readFileSync(fullPath, "utf8");
      if (content.includes("pdfobjectnewwindow")) {
        console.log(`  ${file}: contains 'pdfobjectnewwindow' logic`);
        if (content.includes("cdnjs.cloudflare.com")) {
          console.log(`  ${file}: contains cdnjs URL! (DIRTY)`);
        } else {
          console.log(`  ${file}: CLEAN (no cdnjs URL)`);
        }
      } else if (content.includes("cdnjs.cloudflare.com")) {
        console.log(
          `  ${file}: contains cdnjs URL but NO pdfobject logic! (WEIRD)`,
        );
      }
    } catch (e) {
      console.log(`  ${file}: error reading`);
    }
  });
}

checkDir("jspdf dist", path.resolve("node_modules/jspdf/dist"));
checkDir("build dist", path.resolve("dist/assets"));
