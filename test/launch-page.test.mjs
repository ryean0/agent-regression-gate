import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeStatus, renderResults } from "../main.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const css = read("styles.css");
const workflow = read(".github/workflows/pages.yml");
const readme = read("README.md");

function attr(source, tagPattern) {
  const match = source.match(tagPattern);
  assert.ok(match, `missing ${tagPattern}`);
  return match[1];
}

function channel(hex) {
  const value = parseInt(hex, 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrast(foreground, background) {
  const lum = (hex) => {
    const h = hex.slice(1);
    const r = channel(h.slice(0, 2));
    const g = channel(h.slice(2, 4));
    const b = channel(h.slice(4, 6));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const lighter = Math.max(lum(foreground), lum(background));
  const darker = Math.min(lum(foreground), lum(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test("document is html5 english", () => {
  assert.match(html, /^<!DOCTYPE html>/i);
  assert.match(html, /<html lang="en">/);
});

test("base href is the project pages subpath", () => {
  assert.equal(attr(html, /<base href="([^"]+)"/), "/agent-regression-gate/");
});

test("canonical url is the project pages origin", () => {
  assert.equal(
    attr(html, /<link rel="canonical" href="([^"]+)"/),
    "https://ryean0.github.io/agent-regression-gate/",
  );
});

test("open graph url matches the canonical url", () => {
  assert.equal(
    attr(html, /<meta property="og:url" content="([^"]+)"/),
    "https://ryean0.github.io/agent-regression-gate/",
  );
});

test("open graph title is set", () => {
  assert.equal(attr(html, /<meta property="og:title" content="([^"]+)"/), "Agent Regression Gate");
});

test("favicon is a relative svg that exists", () => {
  const href = attr(html, /<link rel="icon" href="([^"]+)"/);
  assert.equal(href, "favicon.svg");
  assert.equal(fs.existsSync(path.join(root, href)), true);
  assert.match(read("favicon.svg"), /#ff7a1a/i);
});

test("stylesheet and script stay relative to the base path", () => {
  assert.equal(attr(html, /<link rel="stylesheet" href="([^"]+)"/), "styles.css");
  assert.equal(attr(html, /<script type="module" src="([^"]+)"/), "main.js");
});

test("accent color is neon orange", () => {
  assert.match(css, /#ff7a1a/);
  assert.match(css, /--accent:\s*#ff7a1a/);
});

test("reduced motion disables animation", () => {
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.rule,\s*\.caret\s*\{\s*animation:\s*none;/);
});

test("hero and console are present", () => {
  assert.match(html, /id="hero"/);
  assert.match(html, /id="console"/);
  assert.match(html, /<h1>/);
  assert.match(html, /id="console-title"/);
});

test("sample results.json is a preliminary gate run", () => {
  const data = JSON.parse(read("results.json"));
  assert.equal(data.status, "preliminary");
  assert.equal(Array.isArray(data.cases), true);
  assert.ok(data.cases.length >= 1);
  assert.ok(data.cases.some((item) => item.verdict === "fail"));
  assert.equal(data.gate.decision, "fail");
});

test("console markup escapes text and prints verdict words", () => {
  const view = renderResults({
    status: "final",
    gate: { decision: "fail", reason: "drift <script>" },
    cases: [
      {
        id: "x",
        name: "<script>alert(1)</script>",
        suite: "regression",
        verdict: "fail",
        durationMs: 10,
      },
    ],
  });
  assert.equal(view.status, "final");
  assert.match(view.body, /FAIL/);
  assert.doesNotMatch(view.body, /<script>/);
  assert.match(view.body, /&lt;script&gt;/);
});

test("client loads results.json with a relative url", () => {
  const source = read("main.js");
  assert.match(source, /const RESULTS_URL = "results.json"/);
  assert.match(source, /fetch\(RESULTS_URL\)/);
});

test("status label treats only final as final", () => {
  assert.equal(normalizeStatus({ status: "final" }), "final");
  assert.equal(normalizeStatus({ status: "FINAL" }), "final");
  assert.equal(normalizeStatus({ status: "preliminary" }), "preliminary");
  assert.equal(normalizeStatus({}), "preliminary");
});

test("orange on black meets WCAG AA", () => {
  assert.ok(contrast("#ff7a1a", "#000000") >= 4.5);
});

test("white on black meets WCAG AA", () => {
  assert.ok(contrast("#ffffff", "#000000") >= 4.5);
});

test("black on orange meets WCAG AA for the call to action", () => {
  assert.ok(contrast("#000000", "#ff7a1a") >= 4.5);
  assert.match(css, /\.cta\s*\{[^}]*background:\s*var\(--accent\)[^}]*color:\s*#000000/s);
  assert.match(css, /\.badge\s*\{[^}]*background:\s*var\(--accent\)[^}]*color:\s*#000000/s);
});

test("nojekyll marker is present for raw static hosting", () => {
  assert.equal(fs.existsSync(path.join(root, ".nojekyll")), true);
});

test("pages workflow uses the pages actions", () => {
  assert.match(workflow, /actions\/configure-pages@v6/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
});

test("pages workflow sets permissions and concurrency", () => {
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /group:\s*pages/);
});

test("tests run on pull request and deploy waits for them", () => {
  assert.match(workflow, /push:[\s\S]*branches:[\s\S]*- main/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /needs:\s*test/);
  assert.match(workflow, /github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run build/);
});

test("readme covers the live url, preview, results swap, and private pages", () => {
  assert.match(readme, /https:\/\/ryean0\.github\.io\/agent-regression-gate\//);
  assert.match(readme, /npm run preview/);
  assert.match(readme, /127\.0\.0\.1:4173\/agent-regression-gate\//);
  assert.match(readme, /results\.preliminary\.json/);
  assert.match(readme, /preliminary/);
  assert.match(readme, /final/);
  assert.match(readme, /paid GitHub plan/);
  assert.match(readme, /private Pages/);
});

test("build copies the static site into dist", () => {
  execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: root });
  for (const name of ["index.html", "styles.css", "main.js", "results.json", "favicon.svg", ".nojekyll"]) {
    assert.equal(fs.existsSync(path.join(root, "dist", name)), true);
  }
  assert.match(fs.readFileSync(path.join(root, "dist", "index.html"), "utf8"), /\/agent-regression-gate\//);
});
