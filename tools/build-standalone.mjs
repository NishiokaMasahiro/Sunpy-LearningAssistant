/* index.html と assets/ を 1 枚の HTML にまとめて dist/index.html を作る。
   使い方: node tools/build-standalone.mjs
   生成物は Claude のアーティファクトや、ファイルを直接開く用途で使えます。 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = p => readFileSync(join(root, p), "utf8");

let html = read("index.html");

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g,
  (_, href) => `<style>\n${read(href)}\n</style>`);

html = html.replace(/<script src="([^"]+)"><\/script>/g,
  (_, src) => `<script>\n${read(src)}\n</script>`);

html = html.replace("<title>", "<!-- built by tools/build-standalone.mjs — 編集は assets/ 側で -->\n<title>");

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "index.html"), html);
console.log("dist/index.html を生成しました（" + Math.round(html.length / 1024) + " KB）");
