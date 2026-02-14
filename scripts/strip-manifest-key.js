import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.resolve(__dirname, "../dist/manifest.json");

if (fs.existsSync(manifestPath)) {
  console.log("Found dist/manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  if (manifest.key) {
    console.log("Removing key from manifest...");
    delete manifest.key;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log("Key successfully removed!");
  } else {
    console.log("No key found in manifest.");
  }
} else {
  console.error("Error: dist/manifest.json not found!");
  process.exit(1);
}
