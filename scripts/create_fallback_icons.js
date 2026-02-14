const fs = require("fs");
const path = require("path");
const { fileURLToPath } = require("url");

const outputDir = path.join("public", "icons");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Simple 1x1 Blue pixel PNG base64
// Ideally we'd use a real icon, but this ensures file existence and validity.
// Actually, let's use a slightly better one if possible, but for now a blue square is better than a broken build.
// This is a 128x128 blue square PNG.
const blueSquareBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABTSURBVHhe7cBxAQAAAMKg909tDj8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOXgFv8AAB15ySgAAAAABJRU5ErkJggg==";

const sizes = [16, 48, 128];

sizes.forEach((size) => {
  const filePath = path.join(outputDir, `icon${size}.png`);
  fs.writeFileSync(filePath, Buffer.from(blueSquareBase64, "base64"));
  console.log(`Created ${filePath}`);
});
