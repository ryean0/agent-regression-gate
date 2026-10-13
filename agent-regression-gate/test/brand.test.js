import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { BRAND, BRAND_HTML_SPOTS, TAGLINE } from "../js/brand.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function htmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "test") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

test("the brand constant is Anubys and the tagline is fixed", () => {
  assert.equal(BRAND, "Anubys");
  assert.equal(TAGLINE, "Anubys, a CI-native agent regression model harness.");
  assert.ok(BRAND_HTML_SPOTS.includes("title"));
  assert.ok(BRAND_HTML_SPOTS.includes("header wordmark"));
  assert.ok(BRAND_HTML_SPOTS.includes("hero tagline"));
  const brandSource = fs.readFileSync(path.join(root, "js/brand.js"), "utf8");
  assert.equal((brandSource.match(/Anubys/g) || []).length, 1);
});

test("no route still says Mullion", () => {
  const files = htmlFiles(root);
  assert.ok(files.length >= 7);
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    assert.equal(/mullion/i.test(html), false, path.relative(root, file));
    assert.match(html, /<!-- brand:/);
  }
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(home, new RegExp(TAGLINE));
  assert.match(home, /<title>Anubys<\/title>/);
  const css = fs.readFileSync(path.join(root, "css/site.css"), "utf8");
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.scale-beam/);
  assert.match(css, /\.scale-hot/);
});
