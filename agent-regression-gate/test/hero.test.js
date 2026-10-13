import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STATES = [
  { id: "pass", label: "Pass", pose: "level", tone: "white", gap: "−2.5 pp", note: "lower above −5 pp" },
  { id: "insufficient", label: "Insufficient evidence", pose: "wobble", tone: "grey", gap: "−3.0 pp", note: "interval crosses −5 pp" },
  { id: "block", label: "Block", pose: "tip", tone: "orange", gap: "−37.5 pp", note: "upper below −5 pp" },
];

function heroHtml() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const start = html.indexOf('class="hero-run"');
  const end = html.indexOf("</aside>", start);
  assert.ok(start > 0 && end > start);
  return html.slice(start, end);
}

function phaseChunk(hero, id) {
  const marker = `data-state="${id}"`;
  const start = hero.indexOf(marker);
  assert.ok(start > -1, id);
  const next = hero.indexOf('data-state="', start + marker.length);
  return hero.slice(start, next === -1 ? hero.length : next);
}

test("the hero label, scale, and console stay on one verdict per state", () => {
  const hero = heroHtml();
  const css = fs.readFileSync(path.join(root, "css/site.css"), "utf8");
  assert.match(fs.readFileSync(path.join(root, "index.html"), "utf8"), /Catch agent regressions/);
  assert.deepEqual(
    [...hero.matchAll(/data-state="([^"]+)"/g)].map((match) => match[1]),
    STATES.map((state) => state.id),
  );

  for (const state of STATES) {
    const phase = phaseChunk(hero, state.id);
    assert.match(phase, new RegExp(`data-pose="${state.pose}"`));
    assert.match(phase, new RegExp(`data-tone="${state.tone}"`));
    assert.match(phase, new RegExp(`data-verdict="${state.label}"`));
    const label = phase.match(/class="scale-state">([^<]+)</)[1];
    const verdict = phase.match(/class="resolved">([^<]+)</)[1];
    assert.equal(label, state.label, `${state.id} label`);
    assert.equal(verdict, state.label, `${state.id} console`);
    assert.equal(label, verdict, `${state.id} label and console`);
    assert.ok(phase.includes(state.gap), `${state.id} gap`);
    assert.ok(phase.includes(state.note), `${state.id} note`);
    assert.equal(phase.includes("Scoring"), false, `${state.id} still says Scoring`);
  }

  const block = phaseChunk(hero, "block");
  assert.ok(block.includes('class="scale-beam-line scale-hot"'));
  assert.ok(block.includes('class="scale-hot"'));
  assert.equal(phaseChunk(hero, "pass").includes("scale-hot"), false);
  assert.equal(phaseChunk(hero, "insufficient").includes("scale-hot"), false);

  assert.match(css, /\.hero-phase \.shot-status \.resolved \{[^}]*opacity:\s*1/);
  assert.match(css, /\.hero-phase \.shot-status \.resolved \{[^}]*animation:\s*none/);
  assert.match(css, /\[data-state="pass"\] \.scale-beam \{ transform: none; \}/);
  assert.match(css, /\[data-state="pass"\] \.scale-state,\s*\n\.hero-phase\[data-state="pass"\] \.shot-status \.resolved \{ color: #f4f4f5; text-shadow: none; \}/);
  assert.match(css, /\[data-state="insufficient"\] \.scale-svg path \{ stroke: #9a9aa3; \}/);
  assert.match(css, /\[data-state="insufficient"\] \.scale-beam \{ animation: beam-wobble/);
  assert.match(css, /\[data-state="insufficient"\] \.scale-state,\s*\n\.hero-phase\[data-state="insufficient"\] \.shot-status \.resolved \{ color: #9a9aa3; text-shadow: none; \}/);
  assert.match(css, /\[data-state="block"\] \.scale-beam \{ transform: rotate\(7deg\); \}/);
  assert.match(css, /\[data-state="block"\] \.scale-state,\s*\n\.hero-phase\[data-state="block"\] \.shot-status \.resolved \{\s*color: #ff7a1a;/);
  assert.match(css, /\.scale-svg path\.scale-hot \{\s*stroke: #ff7a1a;\s*filter: drop-shadow\(0 0 6px rgba\(255, 122, 26, 0\.75\)\);/);
  assert.match(css, /@keyframes beam-wobble/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.scale-beam \{ animation: none !important; \}/);
});
