// Bundles the main process and the renderer with esbuild. The renderer needs a bundler
// because a web page can't import npm packages (like i18next) by name.
// Type checking is separate: `npm run typecheck`.
import { cpSync, rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/main/main.ts"],
  outfile: "dist/main/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  // Electron provides this module at runtime, so it must not be bundled.
  external: ["electron"],
  sourcemap: true,
});

await build({
  entryPoints: ["src/renderer/app.ts"],
  outfile: "dist/renderer/app.js",
  bundle: true,
  platform: "browser",
  format: "esm",
  sourcemap: true,
});

// esbuild only outputs the bundles, so the HTML and CSS are copied next to them.
cpSync("src/renderer", "dist/renderer", {
  recursive: true,
  filter: (source) => !source.endsWith(".ts"),
});
