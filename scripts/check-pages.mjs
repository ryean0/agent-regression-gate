import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RESULTS_PATH, parseResultsV2 } from "../agent-regression-gate/js/results.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "agent-regression-gate");
const origin = "https://ryean0.github.io/agent-regression-gate/";
const page = new URL(origin);
const html = fs.readFileSync(path.join(site, "index.html"), "utf8");

function attr(source, pattern) {
  const match = source.match(pattern);
  assert.ok(match, `missing ${pattern}`);
  return match[1];
}

function fileFor(url, label) {
  const resolved = new URL(url);
  assert.equal(resolved.origin, page.origin, `${label} origin`);
  assert.ok(
    resolved.pathname === "/agent-regression-gate" || resolved.pathname.startsWith("/agent-regression-gate/"),
    `${label} is outside /agent-regression-gate/: ${resolved.href}`,
  );
  const rel = decodeURIComponent(resolved.pathname.slice("/agent-regression-gate/".length));
  const file = path.resolve(site, rel);
  assert.ok(file === site || file.startsWith(site + path.sep), `${label} escapes the site folder`);
  assert.equal(fs.existsSync(file), true, `${label} does not exist at ${rel}`);
  return file;
}

const dataBase = attr(html, /<html[^>]*\sdata-base="([^"]*)"/);
const assetBase = new URL(dataBase, page);
assert.equal(assetBase.href, origin, "data-base resolves at the project page");

assert.equal(attr(html, /<link rel="canonical" href="([^"]+)"/), origin);
assert.equal(attr(html, /<meta property="og:url" content="([^"]+)"/), origin);
assert.equal(attr(html, /<meta property="og:image" content="([^"]+)"/), `${origin}og.png`);
assert.equal(attr(html, /<meta name="twitter:image" content="([^"]+)"/), `${origin}og.png`);
assert.equal(attr(html, /<meta property="og:image:width" content="([^"]+)"/), "1200");
assert.equal(attr(html, /<meta property="og:image:height" content="([^"]+)"/), "630");
assert.match(html, /"url": "https:\/\/ryean0\.github\.io\/agent-regression-gate\/"/);

const favicon = fileFor(new URL(attr(html, /<link rel="icon" href="([^"]+)"/), page).href, "favicon");
assert.match(fs.readFileSync(favicon, "utf8"), /#ff7a1a|#070708/i);
fileFor(new URL(attr(html, /<link rel="stylesheet" href="([^"]+)"/), page).href, "stylesheet");

const seen = new Set();
function walkScript(url) {
  if (seen.has(url)) return;
  seen.add(url);
  const file = fileFor(url, url);
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/from\s+"(\.[^"]+)"/g)) {
    walkScript(new URL(match[1], url).href);
  }
  for (const match of source.matchAll(/asset\(\s*"([^"]+)"\s*\)/g)) {
    const fetched = new URL(match[1], assetBase);
    const results = fileFor(fetched.href, match[1]);
    if (match[1].endsWith(".json")) {
      const doc = JSON.parse(fs.readFileSync(results, "utf8"));
      const versionOk = doc.version === 1 || (typeof doc.version === "string" && /^2\.\d+\.\d+$/.test(doc.version));
      assert.equal(versionOk, true, `${match[1]} version`);
      assert.ok(doc.status === "preliminary" || doc.status === "final");
    }
  }
}

walkScript(new URL(attr(html, /<script type="module" src="([^"]+)"/), page).href);
assert.ok(seen.has(`${origin}js/main.js`));
assert.ok([...seen].some((url) => url.endsWith("/js/results.js")));

assert.equal(RESULTS_PATH, "data/results.preliminary.json");
const shipped = JSON.parse(fs.readFileSync(path.join(site, RESULTS_PATH), "utf8"));
assert.equal(shipped.version, "2.1.0");
assert.equal(shipped.schema_version, "2.1.0");
assert.ok(shipped.status === "preliminary" || shipped.status === "final");
const shippedView = parseResultsV2(shipped);
assert.equal(shippedView.version, "2.1.0");
assert.equal(shippedView.schemaVersion, "2.1.0");
assert.equal(shippedView.headline, "Pass");
assert.equal(shippedView.gate.fromFile, true);
assert.equal(shippedView.modelIdSources.baseline, "overall");
assert.equal(shippedView.modelIdSources.candidate, "overall");
assert.equal(typeof shippedView.arms.baseline.modelId, "string");
assert.equal(shippedView.arms.baseline.modelId.length > 0, true);
assert.equal(typeof shippedView.arms.candidate.modelId, "string");
assert.equal(shippedView.arms.candidate.modelId.length > 0, true);

const mainSource = fs.readFileSync(path.join(site, "js/main.js"), "utf8");
assert.match(mainSource, /parseResultsV2/);
assert.match(mainSource, /RESULTS_PATH/);
assert.doesNotMatch(mainSource, /asset\(\s*"data\/results\.preliminary\.json"\s*\)/);

const og = fileFor(`${origin}og.png`, "og.png");
const png = fs.readFileSync(og);
assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);

assert.equal(fs.existsSync(path.join(site, ".nojekyll")), true);
assert.match(fs.readFileSync(path.join(site, "css/site.css"), "utf8"), /#ff7a1a/);
assert.match(html, /Catch agent regressions/);
assert.match(html, /<title>Mullion<\/title>/);
assert.match(html, /property="og:title" content="Mullion"/);
assert.match(html, /name="twitter:title" content="Mullion"/);
assert.match(html, /"name": "Mullion"/);
assert.doesNotMatch(html, /CI Agent Regression Harness/);
assert.match(html, /id="integrations"/);
assert.match(html, /adapter example/);
assert.match(html, /Gemini 3\.5 Flash-Lite/);
assert.match(html, /gemini-3\.5-flash-lite/);
assert.match(html, /in progress/);
assert.match(html, /OpenAI Agents SDK · adapter example/);
assert.match(html, /Claude Agent SDK · adapter example/);
assert.match(html, /GitHub Action · planned/);
assert.match(html, /Record\/replay cassettes · planned/);
assert.match(html, /No official partnerships/);
assert.doesNotMatch(html, /gpt-4\.1-nano/i);
assert.doesNotMatch(html, /GPT-4\.1-nano/);

function rejectNano(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rejectNano(file);
      continue;
    }
    if (!/\.(html|js|css|md|json|svg)$/.test(entry.name)) continue;
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, /gpt-4\.1-nano/i, `${path.relative(site, file)} mentions GPT-4.1-nano`);
  }
}
rejectNano(site);
assert.equal((html.match(/href="https:\/\/ryean0\.github\.io\/agent-regression-gate\/"/g) || []).length > 0, true);

const workflow = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
assert.match(workflow, /pull_request:/);
assert.match(workflow, /path:\s*agent-regression-gate/);
assert.match(workflow, /include-hidden-files:\s*true/);
assert.match(workflow, /needs:\s*test/);
assert.match(workflow, /enablement:\s*true/);
assert.match(workflow, /continue-on-error:\s*true/);

console.log(`pages check ok (${seen.size} scripts, results file, favicon, og.png)`);
