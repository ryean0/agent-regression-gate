import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(site, "..");
const ORIGIN = "https://anubys.dev/";
const SHARE_IMAGE = new URL("og.png", ORIGIN).href;

function htmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // The DNS guide is covered by its own test below, so this total can stay
    // put when another route changes the same assertion.
    if (entry.name === "test" || entry.name === "dns-setup") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function attr(html, pattern) {
  const match = html.match(pattern);
  assert.ok(match, `missing ${pattern}`);
  return match[1];
}

function pageCanonical(file) {
  const rel = path.relative(site, file).split(path.sep).join("/");
  const route = rel === "index.html" ? "" : rel.replace(/index\.html$/, "");
  return new URL(route, ORIGIN).href;
}

function retiredAbsoluteSiteUrls(text) {
  const hits = [];
  if (text.includes("ryean0.github.io/anubys")) hits.push("ryean0.github.io/anubys");
  for (const raw of text.match(/https?:\/\/[^\s"'<>)]+/g) || []) {
    const url = new URL(raw);
    const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    const namesFolder = url.hostname.includes("agent-regression-gate") || url.pathname.includes("/agent-regression-gate");
    if (namesFolder && !loopback) hits.push(raw);
  }
  return hits;
}

function publishedText() {
  const files = htmlFiles(site);
  files.push(path.join(site, "docs", "dns-setup", "index.html"));
  files.push(path.join(repo, "README.md"), path.join(site, "README.md"), path.join(repo, "docs/brand-names.md"));
  const docs = path.join(repo, "docs");
  for (const entry of fs.readdirSync(docs, { withFileTypes: true })) {
    const full = path.join(docs, entry.name);
    if (entry.isDirectory()) {
      for (const nested of fs.readdirSync(full)) {
        if (nested.endsWith(".md")) files.push(path.join(full, nested));
      }
    } else if (entry.name.endsWith(".md")) files.push(full);
  }
  return files;
}

test("canonical, Open Graph, Twitter, and JSON-LD use https://anubys.dev/", () => {
  const files = htmlFiles(site);
  assert.equal(files.length, 20);
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    const canonical = pageCanonical(file);
    const label = path.relative(site, file);
    assert.equal(attr(html, /<link rel="canonical" href="([^"]+)"/), canonical, label);
    assert.equal(attr(html, /property="og:url" content="([^"]+)"/), canonical, label);
    assert.equal(attr(html, /property="og:image" content="([^"]+)"/), SHARE_IMAGE, label);
    assert.equal(attr(html, /name="twitter:image" content="([^"]+)"/), SHARE_IMAGE, label);
    assert.equal(canonical.startsWith(ORIGIN), true, label);
    assert.equal(SHARE_IMAGE.startsWith(ORIGIN), true, label);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (label === "index.html") {
      assert.equal(blocks.length, 1);
      assert.equal(JSON.parse(blocks[0][1]).url, canonical);
    } else {
      assert.equal(blocks.length, 0, label);
    }
    for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
      assert.equal(match[1].startsWith(ORIGIN), false, `${label} ${match[1]}`);
      assert.equal(match[1].startsWith("/"), false, `${label} ${match[1]}`);
    }
  }
});

test("site HTML does not name a gemini- version string", () => {
  const version = /gemini-/;
  for (const file of htmlFiles(site)) {
    const html = fs.readFileSync(file, "utf8");
    assert.equal(version.test(html), false, path.relative(site, file));
  }
});

test("published pages and docs drop the old absolute site URLs", () => {
  const files = publishedText();
  assert.ok(files.length >= 18);
  for (const file of files) {
    const hits = retiredAbsoluteSiteUrls(fs.readFileSync(file, "utf8"));
    assert.deepEqual(hits, [], path.relative(repo, file));
  }
  const readme = fs.readFileSync(path.join(repo, "README.md"), "utf8");
  assert.match(readme, /Live site: https:\/\/anubys\.dev\//);
  assert.equal(fs.existsSync(path.join(site, "CNAME")), false);
  for (const name of ["sitemap.xml", "robots.txt"]) {
    const file = path.join(site, name);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    assert.deepEqual(retiredAbsoluteSiteUrls(text), [], name);
    for (const raw of text.match(/https?:\/\/[^\s"'<>)]+/g) || []) {
      assert.equal(raw.startsWith(ORIGIN), true, `${name} ${raw}`);
    }
  }
});

test("dns setup keeps absolute share URLs on https://anubys.dev/", () => {
  const file = path.join(site, "docs", "dns-setup", "index.html");
  const html = fs.readFileSync(file, "utf8");
  const canonical = pageCanonical(file);
  assert.equal(canonical, "https://anubys.dev/docs/dns-setup/");
  assert.equal(attr(html, /<link rel="canonical" href="([^"]+)"/), canonical);
  assert.equal(attr(html, /property="og:url" content="([^"]+)"/), canonical);
  assert.equal(attr(html, /property="og:image" content="([^"]+)"/), SHARE_IMAGE);
  assert.equal(attr(html, /name="twitter:image" content="([^"]+)"/), SHARE_IMAGE);
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    assert.equal(match[1].startsWith(ORIGIN), false, match[1]);
    assert.equal(match[1].startsWith("/"), false, match[1]);
  }
});
