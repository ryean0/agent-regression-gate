import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DOCS_INDEX } from "../js/docs-index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HARNESS = "https://github.com/rphua-dev/ci-agent-regression-harness";

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function htmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "test") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

test("install guide exists, is marked beta, and has no real-looking key", () => {
  const rel = path.join("docs", "install", "index.html");
  assert.equal(fs.existsSync(path.join(root, rel)), true);
  const html = read(rel);
  assert.match(html, /https:\/\/anubys\.dev\/docs\/install\//);
  assert.match(html, /class="beta-banner">\(beta testing\)</);
  assert.match(html, /GEMINI_API_KEY/);
  assert.match(html, /your-key-here/);
  assert.match(html, /Coming soon/);
  assert.match(html, /milestone M3/);
  assert.match(html, /class="code-copy"/);
  assert.match(html, /class="wordmark"/);
  assert.doesNotMatch(html, /AIza[0-9A-Za-z\-_]{10,}/);
  assert.doesNotMatch(html, /\bsk-[A-Za-z0-9]{8,}/);
  assert.doesNotMatch(html, /\bAKIA[0-9A-Z]{8,}/);
  assert.doesNotMatch(html, /\bghp_[A-Za-z0-9]{8,}/);
  assert.doesNotMatch(html, /\bgithub_pat_[A-Za-z0-9_]{8,}/);
  assert.doesNotMatch(html, /GEMINI_API_KEY=(?!your-key-here\b)\S+/);
  assert.equal(html.includes("your-key-here"), true);
  assert.doesNotMatch(html, /\bFail\b/);
  assert.doesNotMatch(html, /\d+\/20\b/);
  assert.doesNotMatch(html, /gemini-/);
  for (const amount of ["$38", "$40"]) {
    const at = html.indexOf(amount);
    assert.ok(at > -1, amount);
    assert.match(html.slice(Math.max(0, at - 80), at), /Example/);
  }
  const page = DOCS_INDEX.find((item) => item.path === "install/");
  assert.ok(page);
  assert.equal(page.title, "Install and setup");
  for (const heading of page.headings) {
    assert.ok(html.includes(`id="${heading.id}"`), heading.id);
    assert.ok(html.includes(heading.text), heading.text);
  }
});

test("every harness link on the install guide carries the beta label", () => {
  const html = read("docs/install/index.html");
  const links = [...html.matchAll(/<a\b[^>]*href="(https:\/\/github\.com\/rphua-dev\/ci-agent-regression-harness[^"]*)"[^>]*>[\s\S]*?<\/a>/g)];
  assert.ok(links.length >= 3, `expected harness links, found ${links.length}`);
  for (const match of links) {
    assert.equal(match[1].startsWith(HARNESS), true, match[1]);
    const after = html.slice(match.index, match.index + match[0].length + 60);
    assert.match(after, /\(beta testing\)/, match[1]);
  }
  assert.match(html, /docs\/BACKGROUND\.md/);
});

test("install nav links resolve and the landing page offers Get started", () => {
  const page = read("docs/install/index.html");
  for (const match of page.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const clean = href.split("#")[0].split("?")[0];
    if (!clean) continue;
    const abs = path.resolve(path.join(root, "docs", "install"), clean);
    const target = fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? path.join(abs, "index.html") : abs;
    assert.equal(fs.existsSync(target), true, href);
  }
  const home = read("index.html");
  assert.match(home, /class="btn btn-primary" href="docs\/install\/">Get started</);
  assert.match(home, /href="docs\/install\/">Install</);
  for (const file of htmlFiles(root)) {
    const html = fs.readFileSync(file, "utf8");
    const label = path.relative(root, file);
    const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
    assert.match(footer, />Install<\/a>/, `${label} footer`);
    if (label.startsWith(`docs${path.sep}`)) {
      assert.match(html, /aria-label="Documentation"[\s\S]*?>Install<\/a>/, `${label} sidebar`);
    }
  }
});
