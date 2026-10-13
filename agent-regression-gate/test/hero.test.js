import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CARDS = [
  {
    id: "pass",
    label: "Pass",
    pose: "level",
    tone: "white",
    baseline: "92%",
    candidate: "91%",
    gap: "−1 pp",
    note: "lower bound −4 pp",
    bound: "above −5 pp",
  },
  {
    id: "block",
    label: "Block",
    pose: "tip",
    tone: "orange",
    baseline: "92%",
    candidate: "70%",
    gap: "−22 pp",
    note: "upper bound −14 pp",
    bound: "below −5 pp",
  },
  {
    id: "insufficient",
    label: "Insufficient evidence",
    pose: "wobble",
    tone: "grey",
    baseline: "92%",
    candidate: "88%",
    gap: "−4 pp",
    note: "interval −11 to +3 pp",
    bound: null,
  },
];

const GLYPH = ["M32 22V52M22 52H42", "M10 22H54", "M10 22 6 36H18L14 22", "M54 22 50 36H62L58 22"];

function heroHtml() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const start = html.indexOf('class="hero"');
  const end = html.indexOf("</section>", start);
  assert.ok(start > 0 && end > start);
  return html.slice(start, end);
}

function cardChunk(hero, id) {
  const marker = `data-state="${id}"`;
  const start = hero.indexOf(marker);
  assert.ok(start > -1, id);
  const next = hero.indexOf('data-state="', start + marker.length);
  return hero.slice(start, next === -1 ? hero.length : next);
}

test("the hero is one logo scale and three example verdict cards", () => {
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const hero = heroHtml();
  const css = fs.readFileSync(path.join(root, "css/site.css"), "utf8");
  const visible = hero.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  assert.match(home, /Catch agent regressions/);
  assert.equal((hero.match(/class="scale /g) || []).length, 1);
  assert.equal(hero.includes("hero-phase"), false);
  assert.equal(hero.includes("shot-card"), false);
  assert.equal(/\d+\/20\b/.test(visible), false);
  assert.equal(/\bFail\b/.test(visible), false);
  assert.ok(hero.indexOf('class="scale lockup"') < hero.indexOf('class="eyebrow"'));
  assert.ok(hero.indexOf("lockup-name") < hero.indexOf(">CI gate<"));
  assert.deepEqual(
    [...hero.matchAll(/data-state="([^"]+)"/g)].map((match) => match[1]),
    CARDS.map((card) => card.id),
  );

  for (const card of CARDS) {
    const chunk = cardChunk(hero, card.id);
    assert.match(chunk, new RegExp(`data-pose="${card.pose}"`));
    assert.match(chunk, new RegExp(`data-tone="${card.tone}"`));
    assert.equal(chunk.includes(`>${card.label}<`), true, card.id);
    assert.equal((chunk.match(/>Example</g) || []).length, 1, card.id);
    assert.ok(chunk.includes(`>${card.baseline}<`), `${card.id} baseline`);
    assert.ok(chunk.includes(`>${card.candidate}<`), `${card.id} candidate`);
    assert.ok(chunk.includes(card.gap), `${card.id} gap`);
    assert.ok(chunk.includes(card.note), `${card.id} note`);
    if (card.bound) assert.ok(chunk.includes(card.bound), `${card.id} bound`);
    assert.equal(/\d+\/20\b/.test(chunk), false, card.id);
  }

  const mark = home.match(/<svg class="brand-mark"[\s\S]*?<\/svg>/)[0];
  const lockup = hero.match(/<svg class="lockup-svg"[\s\S]*?<\/svg>/)[0];
  for (const part of GLYPH) {
    assert.ok(mark.includes(part), part);
    assert.ok(lockup.includes(part), `lockup ${part}`);
  }

  assert.match(css, /@keyframes lockup-cycle/);
  assert.match(css, /@keyframes lockup-cycle \{[\s\S]*rotate\(0deg\)/);
  assert.match(css, /@keyframes lockup-cycle \{[\s\S]*rotate\(7deg\)/);
  assert.match(css, /@keyframes lockup-cycle \{[\s\S]*rotate\(-3\.5deg\)/);
  assert.match(css, /\.verdict-card\[data-state="pass"\] \{[^}]*animation: card-pass 12s/);
  assert.match(css, /\.verdict-card\[data-state="block"\] \{[^}]*animation: card-block 12s/);
  assert.match(css, /\.verdict-card\[data-state="insufficient"\] \{[^}]*animation: card-gap 12s/);
  assert.match(css, /\.lockup-beam \{[\s\S]*animation: lockup-cycle 12s/);
  assert.match(css, /\.verdict-card\[data-state="block"\] h2 \{ color: var\(--block\); \}/);
  assert.match(css, /\.verdict-card\[data-state="block"\] \{[\s\S]*box-shadow: var\(--block-glow\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.lockup-beam \{[\s\S]*animation: none !important;[\s\S]*transform: none !important;/);
});
