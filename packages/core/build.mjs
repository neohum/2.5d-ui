import { build } from "esbuild";
import { bundle } from "lightningcss";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "dist");
mkdirSync(out, { recursive: true });

const css = bundle({
  filename: resolve(here, "src/css/index.css"),
  minify: true,
  targets: { chrome: 111 << 16 },
});
writeFileSync(resolve(out, "iso.min.css"), css.code);

await build({
  entryPoints: [resolve(here, "src/index.ts")],
  outfile: resolve(out, "iso.min.js"),
  bundle: true,
  minify: true,
  format: "esm",
  target: "chrome111",
  charset: "utf8",
});
