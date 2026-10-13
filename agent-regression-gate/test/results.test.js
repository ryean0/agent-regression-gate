import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { GATE_FALLBACK, parseResults, parseResultsV2 } from "../js/results.js";

const bundled = JSON.parse(
  readFileSync(new URL("../data/results.preliminary.json", import.meta.url), "utf8"),
);

test("the bundled preliminary file parses and banners", () => {
  const view = parseResults(bundled);
  assert.equal(view.version, "2.1.0");
  assert.equal(view.schemaVersion, "2.1.0");
  assert.equal(view.headline, "Pass");
  assert.equal(view.status, "preliminary");
  assert.equal(view.banner.tone, "preliminary");
  assert.match(view.banner.title, /Preliminary/);
  assert.equal(view.verdict, "no_regression");
  assert.equal(view.arms.baseline.modelId, "gemini-2.5-flash-lite-001");
  assert.equal(view.arms.candidate.modelId, "gemini-3.5-flash-lite");
  assert.equal(view.modelIdSources.baseline, "overall");
  assert.equal(view.modelIdSources.candidate, "overall");
  assert.equal(view.modelIds.baseline, "gemini-2.5-flash-lite-001");
  assert.equal(view.modelIds.candidate, "gemini-3.5-flash-lite");
  assert.equal(view.gate.fromFile, true);
  assert.equal(view.gate.text, "δ = 5 pp · α = 0.1 · min valid 60% · 90% CI · miss cap 5%");
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
  assert.equal(view.headline, "Block");
  assert.equal(view.scenarios.some((row) => "verdict" in row), false);
});

test("null likely_regression without invalid_run is insufficient evidence", () => {
  const view = parseResults({ ...bundled, likely_regression: null });
  assert.equal(view.verdict, "insufficient_evidence");
  assert.equal(view.headline, "Insufficient evidence");
  assert.equal(view.invalidRun, false);
  assert.equal(view.scenarios.length, bundled.scenarios.length);
  assert.equal(view.scenarios.some((row) => "verdict" in row), false);
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

test("version 1 files stay free of caption fields", () => {
  const view = parseResults(asVersion1());
  assert.equal(view.version, 1);
  assert.equal(view.headline, "Pass");
  assert.equal(view.verdict, "no_regression");
  assert.equal("caption" in view.arms.baseline, false);
  assert.equal("caption" in view.arms.candidate, false);
  assert.equal("modelId" in view.arms.baseline, false);
  assert.equal("modelId" in view.arms.candidate, false);
  assert.equal(view.scenarios.every((row) => !("caption" in row)), true);
});

test("a version 1 file still shows a model id when one is recorded", () => {
  const doc = asVersion1();
  doc.arms.candidate.model_id = "gemini-3.5-flash-lite";
  const view = parseResults(doc);
  assert.equal(view.version, 1);
  assert.equal("modelId" in view.arms.baseline, false);
  assert.equal(view.arms.candidate.modelId, "gemini-3.5-flash-lite");
  assert.equal(view.headline, "Pass");
});

test("the page's shipped data file parses via the 2.1.0 path", () => {
  assert.equal(bundled.version, "2.1.0");
  assert.equal(bundled.schema_version, "2.1.0");
  const viaV2 = parseResultsV2(bundled);
  assert.deepEqual(parseResults(bundled), viaV2);
  assert.equal(viaV2.version, "2.1.0");
  assert.equal(viaV2.schemaVersion, "2.1.0");
  assert.equal(viaV2.headline, "Pass");
  assert.equal(viaV2.verdict, "no_regression");
  assert.equal(viaV2.arms.baseline.modelId, "gemini-2.5-flash-lite-001");
  assert.equal(viaV2.arms.candidate.modelId, "gemini-3.5-flash-lite");
  assert.equal(viaV2.modelIdSources.baseline, "overall");
  assert.equal(viaV2.modelIdSources.candidate, "overall");
  assert.equal(viaV2.gate.fromFile, true);
  assert.match(viaV2.arms.baseline.caption, /0\.05/);
  assert.match(viaV2.arms.candidate.caption, /\$1\.25/);
  assert.equal(viaV2.scenarios.every((row) => typeof row.caption === "string" && row.caption.length > 0), true);
  assert.throws(() => parseResultsV2(asVersion1()), /unsupported results version 1/);
});

test("version 2.0.0 still parses from per-arm model ids and falls back the gate line", () => {
  const doc = asVersion2();
  const view = parseResultsV2(doc);
  assert.equal(view.version, "2.0.0");
  assert.equal(view.schemaVersion, null);
  assert.equal(view.headline, "Pass");
  assert.equal(view.verdict, "no_regression");
  assert.equal(view.modelIdSources.baseline, "arm");
  assert.equal(view.modelIdSources.candidate, "arm");
  assert.equal(view.arms.baseline.modelId, "gemini-2.5-flash-lite-001");
  assert.equal(view.arms.candidate.modelId, "gemini-3.5-flash-lite");
  assert.equal(view.modelIds.baseline, view.arms.baseline.modelId);
  assert.equal(view.modelIds.candidate, view.arms.candidate.modelId);
  assert.equal(view.gate.fromFile, false);
  assert.equal(view.gate.text, GATE_FALLBACK);
  assert.match(view.arms.baseline.caption, /0\.05/);
  assert.match(view.arms.candidate.caption, /\$1\.25/);
});

test("verdict labels are Pass, Block, Insufficient evidence, and Invalid run", () => {
  assert.equal(parseResults({ ...bundled, likely_regression: false, invalid_run: false }).headline, "Pass");
  assert.equal(parseResults({ ...bundled, likely_regression: true, invalid_run: false }).headline, "Block");
  assert.equal(parseResults({ ...bundled, likely_regression: null, invalid_run: false }).headline, "Insufficient evidence");
  assert.equal(parseResults({ ...bundled, likely_regression: true, invalid_run: true }).headline, "Invalid run");
});

test("a model id that is not a string is rejected", () => {
  const doc = structuredClone(bundled);
  doc.arms.baseline.model_id = 3;
  assert.throws(() => parseResultsV2(doc), /arms\.baseline\.model_id must be a string/);
});

test("model ids are omitted when the file does not record them", () => {
  const doc = structuredClone(bundled);
  delete doc.arms.baseline.model_id;
  delete doc.arms.candidate.model_id;
  delete doc.verdicts;
  delete doc.schema_version;
  const view = parseResultsV2(doc);
  assert.equal("modelId" in view.arms.baseline, false);
  assert.equal("modelId" in view.arms.candidate, false);
  assert.equal(view.modelIdSources.baseline, "none");
  assert.equal(view.modelIdSources.candidate, "none");
  assert.equal(view.version, "2.1.0");
  assert.equal(view.gate.fromFile, true);
});

test("version 2.0.0 accepts arm and scenario captions, including decimals and amounts", () => {
  const doc = {
    ...bundled,
    version: "2.0.0",
    arms: {
      baseline: {
        ...bundled.arms.baseline,
        caption: "  Baseline stayed within 0.05 of the previous gate.  ",
      },
      candidate: {
        ...bundled.arms.candidate,
        caption: "Candidate fees stayed at $1.25. <b>not bold</b>",
      },
    },
    scenarios: [
      {
        id: "reset-locked-account",
        name: "Reset a locked account",
        baseline_rate: "18/20",
        candidate_rate: "0.6",
        caption: "Locked resets missed by 0.05 after the $1.25 credit.",
      },
      {
        id: "refund-duplicate-charge",
        name: "Refund a duplicate charge",
        baseline_rate: "17/20",
        candidate_rate: "4/5",
      },
    ],
  };
  delete doc.schema_version;
  const view = parseResults(doc);
  assert.equal(view.version, "2.0.0");
  assert.equal(view.verdict, "no_regression");
  assert.equal(view.arms.baseline.caption, "Baseline stayed within 0.05 of the previous gate.");
  assert.equal(view.arms.candidate.caption, "Candidate fees stayed at $1.25. <b>not bold</b>");
  assert.equal(view.arms.candidate.passRateText, "3/5");
  assert.equal(view.scenarios[0].caption, "Locked resets missed by 0.05 after the $1.25 credit.");
  assert.equal(view.scenarios[0].candidateText, "3/5");
  assert.equal("caption" in view.scenarios[1], false);
  assert.deepEqual(Object.keys(view.scenarios[0]).sort(), [
    "baselineText",
    "candidateText",
    "caption",
    "id",
    "name",
  ]);
});

test("a later 2.x file without captions still parses", () => {
  const doc = structuredClone(bundled);
  doc.version = "2.1.0";
  delete doc.arms.baseline.caption;
  delete doc.arms.candidate.caption;
  for (const scenario of doc.scenarios) delete scenario.caption;
  const view = parseResults(doc);
  assert.equal(view.version, "2.1.0");
  assert.equal(view.scenarios[0].name, bundled.scenarios[0].name);
  assert.equal("caption" in view.scenarios[0], false);
  assert.equal(view.arms.candidate.modelId, bundled.arms.candidate.model_id);
});

test("any other major version names itself instead of failing quietly", () => {
  assert.throws(
    () => parseResults({ ...bundled, version: "3.0.0" }),
    (error) => {
      assert.equal(error.message, "unsupported results version 3.0.0");
      return true;
    },
  );
  assert.throws(
    () => parseResults({ ...bundled, version: 2 }),
    /unsupported results version 2/,
  );
  assert.throws(
    () => parseResults({ ...bundled, version: "1.0.0" }),
    /unsupported results version 1\.0\.0/,
  );
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

test("schema 2.1.0 prefers verdicts.overall.model_ids over the per-arm model_id", () => {
  const doc = structuredClone(bundled);
  doc.arms.baseline.model_id = "arm-baseline-id";
  doc.arms.candidate.model_id = "arm-candidate-id";
  doc.verdicts.overall.model_ids.baseline = "gemini-2.5-flash-lite-001";
  doc.verdicts.overall.model_ids.candidate = "gemini-3.5-flash-lite";
  const view = parseResults(doc);
  assert.equal(view.version, "2.1.0");
  assert.equal(view.schemaVersion, "2.1.0");
  assert.equal(view.headline, "Pass");
  assert.equal(view.arms.baseline.modelId, "gemini-2.5-flash-lite-001");
  assert.equal(view.arms.candidate.modelId, "gemini-3.5-flash-lite");
  assert.equal(view.modelIdSources.baseline, "overall");
  assert.equal(view.modelIdSources.candidate, "overall");
});

test("a 2.1.0 file without overall model ids keeps the per-arm model_id", () => {
  const doc = structuredClone(bundled);
  delete doc.verdicts;
  const view = parseResultsV2(doc);
  assert.equal(view.version, "2.1.0");
  assert.equal(view.modelIdSources.baseline, "arm");
  assert.equal(view.modelIdSources.candidate, "arm");
  assert.equal(view.arms.baseline.modelId, "gemini-2.5-flash-lite-001");
  assert.equal(view.arms.candidate.modelId, "gemini-3.5-flash-lite");
  assert.equal(view.headline, "Pass");
});

test("one overall model id does not erase the other arm's model id", () => {
  const doc = structuredClone(bundled);
  delete doc.verdicts.overall.model_ids.candidate;
  doc.arms.baseline.model_id = "arm-baseline-id";
  const view = parseResults(doc);
  assert.equal(view.modelIdSources.baseline, "overall");
  assert.equal(view.modelIdSources.candidate, "arm");
  assert.equal(view.arms.baseline.modelId, "gemini-2.5-flash-lite-001");
  assert.equal(view.arms.candidate.modelId, "gemini-3.5-flash-lite");
});

test("gate settings are optional and fall back to δ = 5 pp / 90%", () => {
  const missing = structuredClone(bundled);
  delete missing.gate;
  const blank = parseResults(missing);
  assert.equal(blank.gate.fromFile, false);
  assert.equal(blank.gate.text, "δ = 5 pp / 90%");
  assert.equal(blank.gate.text, GATE_FALLBACK);
  assert.equal(blank.headline, "Pass");

  const version1 = parseResults(asVersion1());
  assert.equal(version1.version, 1);
  assert.equal(version1.schemaVersion, null);
  assert.equal(version1.gate.fromFile, false);
  assert.equal(version1.gate.text, GATE_FALLBACK);

  const partial = structuredClone(bundled);
  partial.gate = { alpha: "0.1", min_valid: "3/5" };
  const partialView = parseResults(partial);
  assert.equal(partialView.gate.fromFile, true);
  assert.equal(partialView.gate.text, "δ = 5 pp · α = 0.1 · min valid 60% · 90%");
  assert.equal(partialView.headline, "Pass");
});

test("top-level gate keys are read when the gate object is absent", () => {
  const doc = asVersion2();
  doc.delta = "0.05";
  doc.alpha = 0.1;
  doc.min_valid = "0.6";
  doc.ci_level = "0.9";
  doc.miss_cap = "1/20";
  const view = parseResultsV2(doc);
  assert.equal(view.version, "2.0.0");
  assert.equal(view.gate.fromFile, true);
  assert.equal(view.gate.delta, "0.05");
  assert.equal(view.gate.alpha, 0.1);
  assert.equal(view.gate.minValid, "0.6");
  assert.equal(view.gate.ciLevel, "0.9");
  assert.equal(view.gate.missCap, "1/20");
  assert.equal(view.gate.text, "δ = 5 pp · α = 0.1 · min valid 60% · 90% CI · miss cap 5%");
  assert.equal(view.headline, "Pass");
});

test("schema_version 2.1.0 can stand in for version and must agree when both are set", () => {
  const doc = structuredClone(bundled);
  delete doc.version;
  const view = parseResults(doc);
  assert.equal(view.version, "2.1.0");
  assert.equal(view.schemaVersion, "2.1.0");
  assert.equal(view.headline, "Pass");

  const mismatch = structuredClone(bundled);
  mismatch.version = "2.0.0";
  assert.throws(() => parseResults(mismatch), /schema_version must match version/);

  const bad = structuredClone(bundled);
  bad.schema_version = 2.1;
  assert.throws(() => parseResults(bad), /schema_version must be a 2\.x\.y string/);
});

test("a non-string overall model id is rejected", () => {
  const doc = structuredClone(bundled);
  doc.verdicts.overall.model_ids.candidate = 3;
  assert.throws(
    () => parseResultsV2(doc),
    /verdicts\.overall\.model_ids\.candidate must be a string/,
  );
});

test("gate settings do not change Pass, Block, Insufficient evidence, or Invalid run", () => {
  const withGate = (likely, invalid) => parseResults({
    ...bundled,
    likely_regression: likely,
    invalid_run: invalid,
  }).headline;
  assert.equal(withGate(false, false), "Pass");
  assert.equal(withGate(true, false), "Block");
  assert.equal(withGate(null, false), "Insufficient evidence");
  assert.equal(withGate(true, true), "Invalid run");

  const broken = structuredClone(bundled);
  broken.gate = { delta: { pp: 5 } };
  assert.throws(() => parseResults(broken), /gate\.delta must be a non-negative number or a string/);
});

function asVersion2(doc = bundled) {
  const copy = structuredClone(doc);
  copy.version = "2.0.0";
  delete copy.schema_version;
  delete copy.verdicts;
  delete copy.gate;
  return copy;
}

function asVersion1(doc = bundled) {
  const copy = structuredClone(doc);
  copy.version = 1;
  delete copy.schema_version;
  delete copy.verdicts;
  delete copy.gate;
  for (const name of ["baseline", "candidate"]) {
    delete copy.arms[name].caption;
    delete copy.arms[name].model_id;
  }
  for (const scenario of copy.scenarios) delete scenario.caption;
  return copy;
}
