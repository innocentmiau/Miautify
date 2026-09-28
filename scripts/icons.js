// Makes every icon the app needs from one source image: assets/icon.svg, or assets/icon.png
// if there's no SVG. To change the app's icon everywhere, replace that one file.
//
// Output, in dist/icons/ (generated on every build, never edited by hand):
//   icon-512.png  window and taskbar icon; electron-builder turns it into the installers'
//                 icons too (including Windows' .ico)
//   icon-128.png  the small icon in the app's toolbar
import { existsSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const sources = ["assets/icon.svg", "assets/icon.png"];
const sizes = [512, 128];

export async function buildIcons() {
  const source = sources.find((file) => existsSync(file));
  if (!source) {
    throw new Error(`No app icon found. Add one of: ${sources.join(", ")}`);
  }

  mkdirSync("dist/icons", { recursive: true });
  for (const size of sizes) {
    // `fit: contain` keeps the whole image, centered, if the source isn't square.
    // A high density renders an SVG sharply before it's scaled down.
    await sharp(source, { density: 300 })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(`dist/icons/icon-${size}.png`);
  }
}
