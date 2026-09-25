// Builds the main process, the preload script and the renderer with esbuild. The renderer
// needs a bundler because a web page can't import npm packages (like i18next) by name.
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
  // Only our own code is bundled. The main process runs in Node, which loads npm packages
  // (and Electron) from node_modules itself; bundling them breaks packages that still use
  // CommonJS require(), like music-metadata's dependencies.
  packages: "external",
  sourcemap: true,
});

// Preload scripts run sandboxed, and a sandboxed preload can't be an ES module, so this
// one is bundled as CommonJS (.cjs).
await build({
  entryPoints: ["src/preload/preload.ts"],
  outfile: "dist/preload/preload.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
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
