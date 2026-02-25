#!/usr/bin/env node
/**
 * Generate PWA icons from the UFP logo SVG using sharp.
 * Run: npx -y -p sharp node scripts/generate-pwa-icons.mjs
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function main() {
  // Dynamic import so this works with npx -p sharp
  const sharp = (await import("sharp")).default;

  const svgBuffer = readFileSync(resolve(root, "public/img/ufp2.svg"));
  const bg = { r: 15, g: 23, b: 42 }; // slate-900 (#0f172a)

  const sizes = [192, 512];

  for (const size of sizes) {
    const outPath = resolve(root, `public/pwa-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size, {
        fit: "contain",
        background: { ...bg, alpha: 1 },
      })
      .flatten({ background: bg })
      .png()
      .toFile(outPath);
    console.log(`✅ Generated ${outPath}`);
  }
}

main().catch((err) => {
  console.error("Failed to generate icons:", err);
  process.exit(1);
});
