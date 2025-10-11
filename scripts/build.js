const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

// Clean dist
if (fs.existsSync("dist")) {
  fs.rmSync("dist", { recursive: true });
}
fs.mkdirSync("dist", { recursive: true });

// Bundle popup.js with Supabase
esbuild
  .build({
    entryPoints: ["scr/UI/popup/popup.js"],
    bundle: true,
    outfile: "dist/scr/UI/popup/popup.js",
    format: "esm",
    platform: "browser",
    target: "es2020",
    external: [],
  })
  .then(() => console.log("✅ Bundled popup.js"));

// Copy background.js WITHOUT bundling (to avoid Supabase issues)
fs.mkdirSync("dist/scr/background", { recursive: true });
fs.copyFileSync(
  "scr/background/background.js",
  "dist/scr/background/background.js"
);
console.log("✅ Copied background.js");

// Copy other files
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.copyFileSync("manifest.json", "dist/manifest.json");
copyDir("assets", "dist/assets");
fs.mkdirSync("dist/scr/UI/popup", { recursive: true });
fs.mkdirSync("dist/scr/content", { recursive: true });

fs.copyFileSync("scr/UI/popup/popup.html", "dist/scr/UI/popup/popup.html");
fs.copyFileSync("scr/UI/popup/popup.css", "dist/scr/UI/popup/popup.css");
fs.copyFileSync("scr/content/content.js", "dist/scr/content/content.js");

console.log("✅ Build complete!");
