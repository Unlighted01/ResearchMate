const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

// Clean dist
if (fs.existsSync("dist")) {
  fs.rmSync("dist", { recursive: true, force: true });
}
fs.mkdirSync("dist", { recursive: true });

// Helper to copy directory recursive
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

console.log("📂 Copying static files...");

// 1. Copy assets
if (fs.existsSync("assets")) {
  copyDir("assets", "dist/assets");
}

// 2. Copy src folder (preserves structure for dynamic imports logic)
copyDir("src", "dist/src");

// 3. Copy manifest
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf-8"));
fs.writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 2));

console.log("✅ Static files copied");

// 4. Bundle popup.js
console.log("📦 Bundling popup.js...");
esbuild
  .build({
    entryPoints: ["src/popup/popup.js"],
    bundle: true,
    outfile: "dist/src/popup/popup.js", // Overwrites the raw copy
    format: "esm",
    platform: "browser",
    target: "es2022",
    allowOverwrite: true,
    external: [], // Add externals if needed
  })
  .then(() => console.log("✅ Bundled popup.js"))
  .catch((err) => {
    console.error("❌ Build failed:", err);
    process.exit(1);
  });

console.log("✅ Build configuration complete!");
