import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const files = ["index.html", "styles.css", "main.js", "results.json", "favicon.svg", ".nojekyll"];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const name of files) {
  fs.copyFileSync(path.join(root, name), path.join(dist, name));
}
console.log(`built ${files.length} files into dist/`);
