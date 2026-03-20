#!/usr/bin/env node
// Generates StepScribe app icons from an SVG source.
// Produces: icon.icns (macOS), icon.ico (Windows), icon.png (1024x1024), tray-icon.png (22x22)
// Requires: sips + iconutil (macOS built-in)

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ASSETS = path.join(__dirname, "..", "assets");
const TMP = path.join(__dirname, "..", ".icon-tmp");

// StepScribe icon as SVG — flame on a dark circular background
const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e1b4b"/>
      <stop offset="100%" style="stop-color:#0f172a"/>
    </linearGradient>
    <linearGradient id="flame" x1="50%" y1="100%" x2="50%" y2="0%">
      <stop offset="0%" style="stop-color:#dc2626"/>
      <stop offset="30%" style="stop-color:#f59e0b"/>
      <stop offset="70%" style="stop-color:#eab308"/>
      <stop offset="100%" style="stop-color:#fde68a"/>
    </linearGradient>
    <linearGradient id="innerFlame" x1="50%" y1="100%" x2="50%" y2="0%">
      <stop offset="0%" style="stop-color:#f59e0b"/>
      <stop offset="100%" style="stop-color:#fef3c7"/>
    </linearGradient>
  </defs>
  <!-- Background circle -->
  <circle cx="512" cy="512" r="480" fill="url(#bg)" stroke="#eab308" stroke-width="8" stroke-opacity="0.3"/>
  <!-- Outer flame -->
  <path d="M512 200
    C512 200 620 340 650 440
    C680 540 680 600 660 660
    C640 720 600 760 560 790
    C540 808 520 810 512 812
    C504 810 484 808 464 790
    C424 760 384 720 364 660
    C344 600 344 540 374 440
    C404 340 512 200 512 200Z"
    fill="url(#flame)" opacity="0.95"/>
  <!-- Inner flame -->
  <path d="M512 380
    C512 380 575 460 590 520
    C605 580 600 620 585 655
    C570 690 545 710 525 725
    C518 730 512 732 512 732
    C512 732 506 730 499 725
    C479 710 454 690 439 655
    C424 620 419 580 434 520
    C449 460 512 380 512 380Z"
    fill="url(#innerFlame)" opacity="0.9"/>
  <!-- Bright core -->
  <ellipse cx="512" cy="640" rx="35" ry="55" fill="#fef9c3" opacity="0.7"/>
  <!-- Book/journal base -->
  <path d="M380 750 L380 780 C380 800 420 810 512 810 C604 810 644 800 644 780 L644 750
    C644 740 604 748 512 748 C420 748 380 740 380 750Z"
    fill="#eab308" opacity="0.4"/>
</svg>`;

// Write SVG
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });
if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true });

const svgPath = path.join(TMP, "icon.svg");
fs.writeFileSync(svgPath, SVG);

console.log("Generating icons...");

// Check for qlmanage or sips alternatives to convert SVG
// On macOS, we can use qlmanage for SVG -> PNG, or use sips with a TIFF intermediary
// Actually, the simplest reliable approach on macOS: use the `rsvg-convert` or `qlmanage`

// Try qlmanage first (built into macOS)
const png1024 = path.join(TMP, "icon_1024.png");

try {
  // qlmanage can render SVG thumbnails
  execSync(`qlmanage -t -s 1024 -o "${TMP}" "${svgPath}" 2>/dev/null`, { stdio: "ignore" });
  const qlOutput = path.join(TMP, "icon.svg.png");
  if (fs.existsSync(qlOutput)) {
    fs.renameSync(qlOutput, png1024);
  }
} catch {
  // Fallback: try rsvg-convert (from librsvg, installable via brew)
  try {
    execSync(`rsvg-convert -w 1024 -h 1024 "${svgPath}" > "${png1024}"`, { stdio: "pipe" });
  } catch {
    // Final fallback: check if convert (ImageMagick) is available
    try {
      execSync(`convert -background none -size 1024x1024 "${svgPath}" "${png1024}"`, { stdio: "pipe" });
    } catch {
      console.error("ERROR: Cannot convert SVG to PNG.");
      console.error("Install one of: librsvg (brew install librsvg), ImageMagick (brew install imagemagick)");
      console.error("Or use qlmanage (should be built-in on macOS).");
      process.exit(1);
    }
  }
}

if (!fs.existsSync(png1024)) {
  console.error("Failed to generate 1024px PNG. Aborting.");
  process.exit(1);
}

// Copy the 1024 as the base icon
fs.copyFileSync(png1024, path.join(ASSETS, "icon.png"));
console.log("  ✓ icon.png (1024x1024)");

// Generate tray icon (22x22)
const trayPath = path.join(ASSETS, "tray-icon.png");
execSync(`sips -z 22 22 "${png1024}" --out "${trayPath}" 2>/dev/null`);
console.log("  ✓ tray-icon.png (22x22)");

// Generate .icns for macOS
const iconsetDir = path.join(TMP, "icon.iconset");
if (fs.existsSync(iconsetDir)) fs.rmSync(iconsetDir, { recursive: true });
fs.mkdirSync(iconsetDir, { recursive: true });

const sizes = [16, 32, 64, 128, 256, 512, 1024];
for (const size of sizes) {
  const outFile = path.join(iconsetDir, `icon_${size}x${size}.png`);
  execSync(`sips -z ${size} ${size} "${png1024}" --out "${outFile}" 2>/dev/null`);

  // @2x version (half the name size, double the pixels)
  if (size <= 512) {
    const halfSize = size;
    const out2x = path.join(iconsetDir, `icon_${halfSize / 2}x${halfSize / 2}@2x.png`);
    if (halfSize / 2 >= 16) {
      execSync(`sips -z ${size} ${size} "${png1024}" --out "${out2x}" 2>/dev/null`);
    }
  }
}

// Fix: iconutil needs exact filenames. Let's do it properly.
if (fs.existsSync(iconsetDir)) fs.rmSync(iconsetDir, { recursive: true });
fs.mkdirSync(iconsetDir, { recursive: true });

const iconsetSizes = [
  { name: "icon_16x16.png", size: 16 },
  { name: "icon_16x16@2x.png", size: 32 },
  { name: "icon_32x32.png", size: 32 },
  { name: "icon_32x32@2x.png", size: 64 },
  { name: "icon_128x128.png", size: 128 },
  { name: "icon_128x128@2x.png", size: 256 },
  { name: "icon_256x256.png", size: 256 },
  { name: "icon_256x256@2x.png", size: 512 },
  { name: "icon_512x512.png", size: 512 },
  { name: "icon_512x512@2x.png", size: 1024 },
];

for (const { name, size } of iconsetSizes) {
  const outFile = path.join(iconsetDir, name);
  execSync(`sips -z ${size} ${size} "${png1024}" --out "${outFile}" 2>/dev/null`);
}

try {
  execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(ASSETS, "icon.icns")}"`);
  console.log("  ✓ icon.icns (macOS)");
} catch (e) {
  console.error("  ✗ Failed to create .icns:", e.message);
}

// Generate .ico for Windows (using sips to create PNGs, then embed)
// Simple approach: create a multi-resolution PNG and rename
// For a proper ICO, we'd need a tool like png2ico or ImageMagick
// electron-builder can actually accept a 256x256 PNG and convert it
const ico256 = path.join(TMP, "icon_256.png");
execSync(`sips -z 256 256 "${png1024}" --out "${ico256}" 2>/dev/null`);
fs.copyFileSync(ico256, path.join(ASSETS, "icon.ico.png"));

// Try to create real ICO if png2ico or convert is available
try {
  const ico16 = path.join(TMP, "ico_16.png");
  const ico32 = path.join(TMP, "ico_32.png");
  const ico48 = path.join(TMP, "ico_48.png");
  const ico256f = path.join(TMP, "ico_256.png");
  execSync(`sips -z 16 16 "${png1024}" --out "${ico16}" 2>/dev/null`);
  execSync(`sips -z 32 32 "${png1024}" --out "${ico32}" 2>/dev/null`);
  execSync(`sips -z 48 48 "${png1024}" --out "${ico48}" 2>/dev/null`);
  execSync(`sips -z 256 256 "${png1024}" --out "${ico256f}" 2>/dev/null`);

  // Try ImageMagick convert
  execSync(`convert "${ico16}" "${ico32}" "${ico48}" "${ico256f}" "${path.join(ASSETS, "icon.ico")}"`, { stdio: "pipe" });
  console.log("  ✓ icon.ico (Windows)");
} catch {
  // electron-builder can also use a 256x256 PNG as icon on Windows
  fs.copyFileSync(ico256, path.join(ASSETS, "icon.ico"));
  console.log("  ⚠ icon.ico (256px PNG fallback — electron-builder will convert)");
}

// Cleanup
fs.rmSync(TMP, { recursive: true, force: true });

console.log("\nDone! Icons are in desktop/assets/");
