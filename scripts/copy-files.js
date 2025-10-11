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

// Create dist structure
fs.mkdirSync("dist/scr/background", { recursive: true });
fs.mkdirSync("dist/scr/content", { recursive: true });
fs.mkdirSync("dist/scr/UI/popup", { recursive: true });
fs.mkdirSync("dist/scr/lib", { recursive: true });
fs.mkdirSync("dist/assets", { recursive: true });

// Copy manifest
fs.copyFileSync("manifest.json", "dist/manifest.json");

// Copy assets
fs.readdirSync("assets").forEach((file) => {
  fs.copyFileSync(path.join("assets", file), path.join("dist/assets", file));
});

// Copy background
fs.readdirSync("scr/background").forEach((file) => {
  fs.copyFileSync(
    path.join("scr/background", file),
    path.join("dist/scr/background", file)
  );
});

// Copy content
fs.readdirSync("scr/content").forEach((file) => {
  fs.copyFileSync(
    path.join("scr/content", file),
    path.join("dist/scr/content", file)
  );
});

// Copy UI/popup
fs.readdirSync("scr/UI/popup").forEach((file) => {
  fs.copyFileSync(
    path.join("scr/UI/popup", file),
    path.join("dist/scr/UI/popup", file)
  );
});

// Copy lib files (except firebase-init.ts which gets bundled)
fs.readdirSync("scr/lib").forEach((file) => {
  if (file.endsWith(".js") && file !== "firebase-init.js") {
    fs.copyFileSync(
      path.join("scr/lib", file),
      path.join("dist/scr/lib", file)
    );
  }
  // Copy PDF files
  if (file.includes("pdf")) {
    fs.copyFileSync(
      path.join("scr/lib", file),
      path.join("dist/scr/lib", file)
    );
  }
});

console.log("✅ Build complete! All files copied to dist/");
