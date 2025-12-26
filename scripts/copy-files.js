const fs = require("fs");
const path = require("path");

function copyFileSync(source, target) {
  let targetFile = target;
  if (fs.existsSync(target) && fs.lstatSync(target).isDirectory()) {
    targetFile = path.join(target, path.basename(source));
  }
  fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync(source, target) {
  let files = [];
  const targetFolder = path.join(target, path.basename(source));

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
}

console.log("📂 Copying files...");

// Create dist
if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist", { recursive: true });
}

// Copy manifest
fs.copyFileSync("manifest.json", "dist/manifest.json");

// Copy assets
if (fs.existsSync("assets")) {
  copyFolderRecursiveSync("assets", "dist"); // copies assets folder into dist
}

// Copy src
if (fs.existsSync("src")) {
  copyFolderRecursiveSync("src", "dist"); // copies src folder into dist
}

console.log("✅ simple file copy complete!");
