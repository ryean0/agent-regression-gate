import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { BRAND, BRAND_HTML_SPOTS, TAGLINE, WORDMARK } from "../js/brand.js";

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

const WORDMARK_MARKUP =
  '<span class="wordmark"><span class="wordmark-name">Anubys</span><span class="wordmark-tld">.dev</span></span>';

test("the brand constant is Anubys and the tagline is fixed", () => {
  assert.equal(BRAND, "Anubys");
  assert.equal(WORDMARK, "Anubys.dev");
  assert.equal(TAGLINE, "Anubys, a CI-native agent regression model harness.");
  assert.equal(WORDMARK.startsWith(BRAND), true);
  assert.ok(BRAND_HTML_SPOTS.includes("title"));
  assert.ok(BRAND_HTML_SPOTS.includes("header wordmark"));
  assert.ok(BRAND_HTML_SPOTS.includes("hero wordmark"));
  assert.ok(BRAND_HTML_SPOTS.includes("hero tagline"));
  const brandSource = fs.readFileSync(path.join(root, "js/brand.js"), "utf8");
  assert.equal((brandSource.match(/Anubys/g) || []).length, 1);
  assert.match(brandSource, /WORDMARK = `\$\{BRAND\}\.dev`/);
});

test("the wordmark markup is Anubys.dev on every route", () => {
  const files = htmlFiles(root);
  assert.ok(files.length >= 7);
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
    assert.ok(header.includes(WORDMARK_MARKUP), `${path.relative(root, file)} header`);
    assert.ok(footer.includes(WORDMARK_MARKUP), `${path.relative(root, file)} footer`);
    assert.equal(/<title>[^<]*Anubys\.dev/.test(html), false, path.relative(root, file));
    assert.equal(/property="og:title" content="Anubys\.dev"/.test(html), false, path.relative(root, file));
  }
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const heroStart = home.indexOf('class="hero"');
  const heroEnd = home.indexOf("</section>", heroStart);
  const hero = home.slice(heroStart, heroEnd);
  assert.match(hero, /class="lockup-name">\s*<span class="wordmark"><span class="wordmark-name">Anubys<\/span><span class="wordmark-tld">\.dev<\/span><\/span>/);
  assert.match(home, /<p class="lede">Anubys, a CI-native agent regression model harness\.<\/p>/);
  assert.equal(home.includes("Anubys.dev, a CI-native"), false);
  const css = fs.readFileSync(path.join(root, "css/site.css"), "utf8");
  assert.match(css, /\.wordmark-name\s*\{[^}]*color:\s*var\(--block\)/);
  assert.match(css, /\.wordmark-name\s*\{[^}]*text-shadow:[^}]*rgba\(255,\s*122,\s*26/);
  assert.match(css, /\.wordmark-tld\s*\{[^}]*color:\s*#fff/);
  assert.match(css, /\.verdict-card\[data-state="block"\]\s*\{[^}]*border-color:\s*var\(--block\)/);
  assert.match(css, /\.verdict-card\[data-state="pass"\][^{]*\{[^}]*border-color:\s*rgba\(255,\s*255,\s*255/);
  assert.match(css, /\.verdict-card\[data-state="insufficient"\][^{]*\{[^}]*border-color:\s*rgba\(154,\s*154,\s*163/);
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
