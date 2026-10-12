import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseResults } from "../js/results.js";

const bundled = JSON.parse(
  readFileSync(new URL("../data/results.preliminary.json", import.meta.url), "utf8"),
);

test("the bundled preliminary file parses and banners", () => {
  const view = parseResults(bundled);
  assert.equal(view.status, "preliminary");
  assert.equal(view.banner.tone, "preliminary");
  assert.match(view.banner.title, /Preliminary/);
  assert.equal(view.verdict, "no_regression");
  assert.equal(view.likelyRegression, false);
  assert.equal(view.arms.candidate.passRateText, "3/5");
  assert.equal(view.arms.candidate.environmentMisses, 1);
  assert.equal(view.arms.candidate.overMissLimit, false);
  assert.equal(view.scenarios[0].candidateText, "3/5");
  assert.equal(view.scenarios[2].candidateText, "4/5");
  assert.equal(view.charts.mde.status, "preliminary");
  assert.equal(view.charts.mde.title, "Smallest drop we can reliably catch");
  assert.match(view.charts.mde.caption, /Smallest drop/);
  assert.equal(view.charts.aa.status, "coming_soon");
  assert.match(view.charts.aa.caption, /cry wolf/);
  assert.equal(view.charts.aa.points.length, 0);
});

test("scenario diagnostics never carry a pass or block", () => {
  const view = parseResults({
    ...bundled,
    scenarios: [
      {
        id: "reset-locked-account",
        name: "Reset a locked account",
        baseline_rate: "18/20",
        candidate_rate: "0.6",
        blocked: true,
        passed: false,
        verdict: "likely_regression",
      },
    ],
  });
  assert.equal(view.scenarios.length, 1);
  assert.deepEqual(Object.keys(view.scenarios[0]).sort(), [
    "baselineText",
    "candidateText",
    "id",
    "name",
  ]);
});

test("a final file does not use the preliminary banner", () => {
  const view = parseResults({ ...bundled, status: "final" });
  assert.equal(view.banner.tone, "final");
  assert.doesNotMatch(view.banner.title, /Preliminary/);
});

test("suite likely_regression true is the only regression call", () => {
  const view = parseResults({ ...bundled, likely_regression: true });
  assert.equal(view.verdict, "likely_regression");
  assert.equal(view.headline, "Likely regression");
  assert.equal(view.scenarios.some((row) => "verdict" in row), false);
});

test("null likely_regression is an invalid run, not a per-scenario block", () => {
  const view = parseResults({ ...bundled, likely_regression: null });
  assert.equal(view.verdict, "invalid_run");
  assert.equal(view.scenarios.length, bundled.scenarios.length);
});

test("6% environment misses are recorded without becoming scenario verdicts", () => {
  const view = parseResults({
    ...bundled,
    likely_regression: null,
    invalid_run: true,
    arms: {
      ...bundled.arms,
      candidate: {
        scheduled_rollouts: 100,
        environment_misses: 6,
        miss_counts: { missing: 1, infrastructure: 5 },
        pass_rate: "90/94",
      },
    },
  });
  assert.equal(view.verdict, "invalid_run");
  assert.equal(view.arms.candidate.overMissLimit, true);
  assert.equal(view.arms.baseline.overMissLimit, false);
});

test("exactly 5% environment misses are not over the limit", () => {
  const view = parseResults({
    ...bundled,
    arms: {
      ...bundled.arms,
      candidate: {
        scheduled_rollouts: 100,
        environment_misses: 5,
        miss_counts: { infrastructure: 5 },
        pass_rate: "0.6",
      },
    },
  });
  assert.equal(view.arms.candidate.overMissLimit, false);
  assert.equal(view.arms.candidate.passRateText, "3/5");
});

test("miss_counts must sum to environment_misses", () => {
  const broken = structuredClone(bundled);
  broken.arms.candidate.environment_misses = 4;
  assert.throws(() => parseResults(broken), /miss_counts/);
});

test("coming soon charts drop any stray series", () => {
  const view = parseResults({
    ...bundled,
    charts: {
      ...bundled.charts,
      aa: {
        status: "coming_soon",
        title: "The gate doesn't cry wolf",
        points: [{ budget: 20, drop: "1/10" }],
      },
    },
  });
  assert.deepEqual(view.charts.aa.points, []);
});
