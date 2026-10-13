import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { contrastRatio } from "../js/method.js";
import {
  CLEAR_DROP_CLAUSE,
  STORY_INTRO,
  STORY_STEPS,
  STORY_TEXT_PAIRS,
  THRESHOLD_EXAMPLES,
  VERDICT_COPY,
  VERDICT_MARKS,
  WARNING_COPY,
  activationLine,
  classifyGap,
  gapAxis,
  missesInvalidate,
  railIndexFromKey,
  regressionGraphicIds,
  renderStoryHtml,
  sentenceCount,
  storyMotion,
  storyPosition,
  validateStory,
  visibleCopy,
} from "../js/story.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DELTA = 5;

test("the story is eleven plain steps with one idea each", () => {
  assert.deepEqual(validateStory(), []);
  assert.equal(STORY_STEPS.length, 11);
  assert.deepEqual(STORY_STEPS.map((step) => step.terms[0]), [
    "Candidate change",
    "Stochastic outputs",
    "Paired scenario suite",
    "Repeated rollouts",
    "Pass rate",
    "90% confidence interval",
    "Non-inferiority",
    "CI verdict",
    "Miss rate above 5% → invalid_run",
    "Preliminary banner",
    "CI gate",
  ]);
  assert.deepEqual(STORY_STEPS.find((step) => step.id === "limits").terms, ["Preliminary banner", "Sample size"]);
  assert.deepEqual(STORY_STEPS.find((step) => step.id === "threshold").terms, ["Non-inferiority", "δ = 5 pp"]);
});

test("copy rules: four verdicts, a warning, no rollout counts, no customer phrase", () => {
  const copy = visibleCopy();
  assert.equal(copy.includes("before customers notice"), false);
  assert.equal(copy.includes("likely_regression"), false);
  assert.ok(copy.includes(CLEAR_DROP_CLAUSE));
  assert.ok(copy.includes("repeated rollouts per arm"));
  assert.ok(copy.includes("invalid_run"));
  assert.ok(copy.includes(WARNING_COPY));
  assert.match(copy, /only a warning/i);
  assert.equal(sentenceCount(STORY_STEPS.find((step) => step.id === "threshold").support), 1);
  for (const label of Object.values(VERDICT_COPY)) assert.ok(copy.includes(label));
  assert.equal(VERDICT_MARKS.some((mark) => mark.id === "likely_regression"), false);
});

test("non-inferiority uses a 5 point margin and does not score invalid runs", () => {
  assert.equal(classifyGap({ lower: -4, upper: 1 }).verdict, "pass");
  assert.equal(classifyGap({ lower: -4.9, upper: -0.2 }).verdict, "pass");
  assert.deepEqual(classifyGap({ lower: -3, upper: -0.5 }), { verdict: "pass", scored: true, warning: null });

  assert.equal(classifyGap({ lower: -20, upper: -6 }).verdict, "block");
  assert.equal(classifyGap({ lower: -12, upper: -5.01 }).verdict, "block");
  assert.equal(classifyGap({ lower: -16, upper: -7 }).warning, null);

  assert.deepEqual(classifyGap({ lower: -5, upper: 1 }), {
    verdict: "insufficient_evidence",
    scored: true,
    warning: null,
  });
  assert.deepEqual(classifyGap({ lower: -20, upper: -5 }), {
    verdict: "insufficient_evidence",
    scored: true,
    warning: "likely_regression",
  });
  assert.deepEqual(classifyGap({ lower: -12, upper: -2 }), {
    verdict: "insufficient_evidence",
    scored: true,
    warning: "likely_regression",
  });

  assert.deepEqual(classifyGap({ lower: -20, upper: -9, valid: false }), {
    verdict: "invalid_run",
    scored: false,
    warning: null,
  });
  assert.equal(classifyGap({ lower: Number.NaN, upper: -9 }).scored, false);
  assert.equal(classifyGap({ lower: -1, upper: -4 }).verdict, "invalid_run");

  for (let lower = -30; lower <= 10; lower += 1) {
    for (let upper = lower; upper <= 10; upper += 1) {
      const result = classifyGap({ lower, upper, valid: true });
      assert.notEqual(result.verdict, "likely_regression");
      assert.equal(result.scored, true);
      if (lower > -DELTA) assert.equal(result.verdict, "pass");
      else if (upper < -DELTA) assert.equal(result.verdict, "block");
      else assert.equal(result.verdict, "insufficient_evidence");
      if (result.warning) {
        assert.equal(result.verdict, "insufficient_evidence");
        assert.equal(result.warning, "likely_regression");
        assert.ok(upper < 0);
      }
      if (result.verdict === "insufficient_evidence" && upper < 0) {
        assert.equal(result.warning, "likely_regression");
      }
      if (result.verdict !== "insufficient_evidence") assert.equal(result.warning, null);
    }
  }
});

test("threshold pictures sit on the correct side of −5", () => {
  const tick = gapAxis(-DELTA);
  for (const example of THRESHOLD_EXAMPLES) {
    const result = classifyGap(example);
    assert.equal(result.verdict, example.expect);
    const left = gapAxis(example.lower);
    const right = gapAxis(example.upper);
    if (result.verdict === "block") assert.ok(right < tick);
    if (result.verdict === "pass") assert.ok(left > tick);
    if (result.verdict === "insufficient_evidence") assert.ok(left < tick && right > tick);
  }
});

test("a miss rate above 5% invalidates and exactly 5% does not", () => {
  assert.equal(missesInvalidate(1, 20), false);
  assert.equal(missesInvalidate(5, 100), false);
  assert.equal(missesInvalidate(0, 20), false);
  assert.equal(missesInvalidate(6, 100), true);
  assert.equal(missesInvalidate(2, 20), true);
  assert.equal(missesInvalidate(1, 19), true);
});

test("the rail follows the reading line and the keyboard", () => {
  assert.equal(activationLine(100, 800, 0.5), 500);
  assert.deepEqual(storyPosition(0, [100, 200, 400], 500), { index: 0, progress: 0 });
  assert.deepEqual(storyPosition(150, [100, 200, 400], 500), { index: 0, progress: 0.5 / 3 });
  assert.deepEqual(storyPosition(200, [100, 200, 400], 500), { index: 1, progress: 1 / 3 });
  assert.equal(storyPosition(500, [100, 200, 400], 500).index, 2);
  assert.equal(storyPosition(500, [100, 200, 400], 500).progress, 1);
  assert.equal(storyPosition(250, [100, 200, 400], 500).index, 1);
  assert.deepEqual(storyPosition(10, [], 40), { index: 0, progress: 0 });

  assert.equal(railIndexFromKey("ArrowDown", 0, 11), 1);
  assert.equal(railIndexFromKey("ArrowRight", 10, 11), 10);
  assert.equal(railIndexFromKey("ArrowUp", 0, 11), 0);
  assert.equal(railIndexFromKey("ArrowLeft", 4, 11), 3);
  assert.equal(railIndexFromKey("Home", 6, 11), 0);
  assert.equal(railIndexFromKey("End", 1, 11), 10);
  assert.equal(railIndexFromKey("a", 1, 11), null);
  assert.equal(railIndexFromKey("ArrowDown", 0, 0), null);

  assert.deepEqual(storyMotion(true), { reveal: false, animateGraphics: false, railTracksScroll: true });
  assert.equal(storyMotion(false).animateGraphics, true);
});

test("rendered story keeps orange on regression graphics only", () => {
  const html = renderStoryHtml();
  assert.equal((html.match(/<details\b/g) || []).length, 11);
  assert.equal((html.match(/>Deep dive</g) || []).length, 11);
  assert.equal((html.match(/<svg\b/g) || []).length, 11);
  assert.equal((html.match(/data-how-index="/g) || []).length, 11);
  assert.ok(html.includes('aria-label="How it works steps"'));
  assert.ok(html.includes('href="#how-steps"'));
  assert.equal(html.includes("before customers notice"), false);
  assert.deepEqual(regressionGraphicIds(html), ["threshold", "verdict"]);
  assert.ok(html.includes(WARNING_COPY));
  assert.ok(html.includes("invalid_run"));
  for (const step of STORY_STEPS) {
    assert.ok(html.includes(`id="how-${step.id}"`), step.id);
    assert.ok(html.includes(`Deep dive: ${step.headline}`), step.id);
  }
});

test("story text colors meet WCAG AA", () => {
  for (const [foreground, background] of STORY_TEXT_PAIRS) {
    const ratio = contrastRatio(foreground, background);
    assert.ok(ratio >= 4.5, `${foreground} on ${background} is ${ratio.toFixed(2)}`);
  }
});

test("the story route keeps the eleven steps and motion stays optional", () => {
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const how = fs.readFileSync(path.join(root, "how-it-works/index.html"), "utf8");
  assert.ok(home.includes('id="how"'));
  assert.ok(home.includes('id="film-root"'));
  assert.ok(home.includes('href="how-it-works/"'));
  assert.equal(home.includes(STORY_INTRO.lede), false);
  assert.ok(how.includes(STORY_INTRO.title));
  assert.ok(how.includes(STORY_INTRO.lede));
  assert.ok(how.includes('id="how-root"'));
  const css = fs.readFileSync(path.join(root, "css/site.css"), "utf8");
  const howCss = css.slice(css.indexOf("/* how-story */"));
  assert.ok(howCss.length > 40);
  assert.match(howCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(howCss, /\.how-rail/);
  assert.match(howCss, /stroke-dashoffset:\s*0/);
  for (const block of howCss.split("}")) {
    if (!block.includes("var(--accent)") && !block.includes("#ff7a1a")) continue;
    assert.match(block, /how-reg/, block.slice(0, 180));
  }
});
