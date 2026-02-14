import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputSvg = path.join(__dirname, "../src/assets/icon.svg");
const outputDir = path.join(__dirname, "../public/icons");

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const sizes = [16, 48, 128];

async function generateIcons() {
  console.log(`Generating icons from ${inputSvg}...`);

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon${size}.png`);
    try {
      await sharp(inputSvg).resize(size, size).png().toFile(outputPath);
      console.log(`Generated ${outputPath}`);
    } catch (err) {
      console.error(`Error generating ${size}x${size} icon:`, err);
    }
  }
}

generateIcons();
