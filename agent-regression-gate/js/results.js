/**
 * results.json v1, harness schema 2.0.0, and schema 2.1.0.
 *
 * RESULTS_PATH is the only file the page loads. Replace that file in place
 * with real harness output (expected around 30 October 2026). No other path
 * is consulted.
 *
 * parseResults still accepts version 1. A 2.x.y file, including 2.0.0 and
 * 2.1.0, is read by parseResultsV2.
 *
 * Suite labels come from the file, not from scenario rows:
 *   likely_regression false → Pass
 *   likely_regression true → Block
 *   likely_regression null, and invalid_run is not true → Insufficient evidence
 *   invalid_run true → Invalid run
 *
 * Scenario rows are diagnostics. They never become a per-scenario pass or block.
 * Version 2.0.0 adds an optional one-sentence caption on each scenario and arm,
 * and an optional model_id on each arm. A decimal such as 0.05 or an amount
 * such as $1.25 is ordinary caption text. A model id is shown when present and
 * does not change the suite label.
 *
 * Schema 2.1.0 is schema_version "2.1.0". It records run_kind,
 * baseline_pool_model_id, min_valid_fraction_per_scenario, equal
 * rollouts_per_scenario counts, and diagnostics. verdicts.overall carries
 * delta, difference_ci, a required likely_regression boolean, and required
 * model_ids. Those ids are preferred over the per-arm model_id. Alpha and the
 * miss cap stay in suite.yaml. There is no gate block in results.json. When
 * delta and the CI level are missing, the page shows δ = 5 pp / 90%.
 */

import { exceedsRate, formatRatio, parseRational, parseSignedRational } from "./rational.js";

const ARM_NAMES = ["baseline", "candidate"];
const V2_VERSION = /^2\.\d+\.\d+$/;
const RUN_KINDS = new Set(["screening", "baseline", "aa", "gate"]);
/** Shown when verdicts.overall does not record delta and a CI level. */
export const INTERVAL_FALLBACK = "δ = 5 pp / 90%";

/** Drop real harness output at this path. The page requests nothing else. */
export const RESULTS_PATH = "data/results.preliminary.json";

export function parseResults(doc) {
  const version = requireSupported(doc);
  if (version === 1) return buildView(doc, version);
  return parseResultsV2(doc);
}

/** Harness results schema 2.0.0 and 2.1.0, and any later 2.x.y file. Version 1 is rejected here. */
export function parseResultsV2(doc) {
  const version = requireSupported(doc);
  if (version === 1) throw new Error("unsupported results version 1");
  return buildView(doc, version);
}

function requireSupported(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("results.json must be an object");
  }
  return supportedVersion(doc);
}

function buildView(doc, version) {
  const status = doc.status;
  if (status !== "preliminary" && status !== "final") {
    throw new Error("status must be \"preliminary\" or \"final\"");
  }
  assertLevel(doc.level);
  const schema210 = isSchema210(doc, version);
  const likelyRegression = readLikelyRegression(doc, schema210);
  const invalidRun = doc.invalid_run === true;
  const overall = readOverall(doc, schema210);
  const modelIdSources = {};
  const arms = {};
  for (const name of ARM_NAMES) {
    const resolved = resolveModelId(doc.arms?.[name], name, overall.modelIds?.[name] ?? "");
    modelIdSources[name] = resolved.source;
    arms[name] = parseArm(doc.arms?.[name], name, resolved.modelId);
  }

  const verdict = invalidRun
    ? "invalid_run"
    : likelyRegression === null
      ? "insufficient_evidence"
      : likelyRegression
        ? "likely_regression"
        : "no_regression";

  return {
    version,
    schemaVersion: schemaVersionOf(doc),
    status,
    level: 0.9,
    likelyRegression,
    invalidRun,
    verdict,
    headline: headlineFor(verdict),
    why: whyFor(verdict),
    banner: bannerFor(status),
    summaryNote: noteText(doc.notes, "summary"),
    suite: typeof doc.suite === "string" ? doc.suite : "",
    runKind: readRunKind(doc),
    baselinePoolModelId: readPoolModelId(doc),
    minValidFraction: readMinValidFraction(doc),
    rolloutsPerScenario: readRolloutsPerScenario(doc),
    modelIds: {
      baseline: arms.baseline.modelId || "",
      candidate: arms.candidate.modelId || "",
    },
    modelIdSources,
    interval: intervalView(overall),
    arms,
    scenarios: parseScenarios(doc.scenarios),
    diagnostics: parseDiagnostics(doc.diagnostics),
    charts: {
      mde: parseChart(doc, "mde", {
        status: "preliminary",
        title: "Smallest drop we can reliably catch",
        xLabel: "Rollout budget",
        yLabel: "Smallest drop",
      }),
      aa: parseChart(doc, "aa", {
        status: "coming_soon",
        title: "The gate doesn't cry wolf",
        xLabel: "",
        yLabel: "",
      }),
    },
  };
}

function supportedVersion(doc) {
  const version = doc.version;
  const schemaVersion = doc.schema_version;
  if (schemaVersion != null && (typeof schemaVersion !== "string" || !V2_VERSION.test(schemaVersion))) {
    throw new Error("schema_version must be a 2.x.y string");
  }
  if (version === 1) {
    if (schemaVersion != null) throw new Error("schema_version is not used on results version 1");
    return 1;
  }
  if (typeof version === "string" && V2_VERSION.test(version)) {
    if (schemaVersion != null && schemaVersion !== version) {
      throw new Error("schema_version must match version");
    }
    return version;
  }
  if ((version == null || version === "") && schemaVersion) return schemaVersion;
  throw new Error(`unsupported results version ${versionToken(version)}`);
}

function schemaVersionOf(doc) {
  return typeof doc.schema_version === "string" ? doc.schema_version : null;
}

function isSchema210(doc, version) {
  return version === "2.1.0" || doc.schema_version === "2.1.0";
}

function readLikelyRegression(doc, schema210) {
  if (schema210) {
    const value = doc.verdicts?.overall?.likely_regression;
    if (typeof value !== "boolean") {
      throw new Error("verdicts.overall.likely_regression must be a boolean");
    }
    if (doc.likely_regression !== undefined && doc.likely_regression !== true && doc.likely_regression !== false && doc.likely_regression !== null) {
      throw new Error("likely_regression must be true, false, or null");
    }
    return value;
  }
  if (doc.likely_regression !== true && doc.likely_regression !== false && doc.likely_regression !== null) {
    throw new Error("likely_regression must be true, false, or null");
  }
  return doc.likely_regression;
}

function versionToken(version) {
  if (typeof version === "string" || typeof version === "number" || typeof version === "boolean") {
    return String(version);
  }
  if (version == null) return "missing";
  return "unrecognized";
}

function assertLevel(level) {
  if (level === 0.9) return;
  if (typeof level === "string") {
    const ratio = parseRational(level);
    if (ratio.numerator * 10 === ratio.denominator * 9) return;
  }
  throw new Error("level must be 0.9");
}

function readOverall(doc, required) {
  if (doc.verdicts == null) {
    if (required) throw new Error("verdicts.overall is required");
    return { modelIds: null, delta: null, ciLevel: null };
  }
  if (typeof doc.verdicts !== "object" || Array.isArray(doc.verdicts)) {
    throw new Error("verdicts must be an object");
  }
  if (doc.verdicts.overall == null) {
    if (required) throw new Error("verdicts.overall is required");
    return { modelIds: null, delta: null, ciLevel: null };
  }
  const overall = doc.verdicts.overall;
  if (typeof overall !== "object" || Array.isArray(overall)) {
    throw new Error("verdicts.overall must be an object");
  }
  return {
    modelIds: readModelIdPair(overall.model_ids, "verdicts.overall.model_ids", required),
    delta: overall.delta === undefined ? null : readFraction(overall.delta, "verdicts.overall.delta").text,
    ciLevel: overall.difference_ci === undefined ? null : readDifferenceCi(overall.difference_ci, "verdicts.overall.difference_ci").level,
  };
}

function readModelIdPair(modelIds, label, required) {
  if (modelIds == null) {
    if (required) throw new Error(`${label} is required`);
    return null;
  }
  if (typeof modelIds !== "object" || Array.isArray(modelIds)) {
    throw new Error(`${label} must be an object`);
  }
  return {
    baseline: readNamedModelId(modelIds, "baseline", label, required),
    candidate: readNamedModelId(modelIds, "candidate", label, required),
  };
}

function readNamedModelId(modelIds, name, label, required) {
  if (!Object.prototype.hasOwnProperty.call(modelIds, name)) {
    if (required) throw new Error(`${label}.${name} is required`);
    return "";
  }
  const id = readModelId(modelIds[name], `${label}.${name}`);
  if (required && !id) throw new Error(`${label}.${name} is required`);
  return id;
}

function readRunKind(doc) {
  if (doc.run_kind == null) return "";
  if (!RUN_KINDS.has(doc.run_kind)) {
    throw new Error("run_kind must be screening, baseline, aa, or gate");
  }
  return doc.run_kind;
}

function readPoolModelId(doc) {
  if (doc.baseline_pool_model_id == null) return "";
  return readModelId(doc.baseline_pool_model_id, "baseline_pool_model_id");
}

function readMinValidFraction(doc) {
  if (doc.min_valid_fraction_per_scenario == null) return null;
  const fraction = readFraction(doc.min_valid_fraction_per_scenario, "min_valid_fraction_per_scenario");
  return fraction;
}

function readRolloutsPerScenario(doc) {
  if (doc.rollouts_per_scenario == null) return null;
  const pair = readCountPair(doc.rollouts_per_scenario, "rollouts_per_scenario");
  if (pair.baseline !== pair.candidate) {
    throw new Error("rollouts_per_scenario baseline and candidate must be equal");
  }
  return pair;
}

function readFraction(value, label) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string such as "0.6"`);
  }
  const text = value.trim();
  if (!text) throw new Error(`${label} must be a string such as "0.6"`);
  return { text, ratio: parseRational(text) };
}

function readSignedFraction(value, label) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string such as "0.05" or "-0.05"`);
  }
  const text = value.trim();
  if (!text) throw new Error(`${label} must be a string such as "0.05" or "-0.05"`);
  return { text, ratio: parseSignedRational(text) };
}

function readDifferenceCi(raw, label) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${label} must be an object`);
  }
  const lower = readSignedFraction(raw.lower, `${label}.lower`);
  const upper = readSignedFraction(raw.upper, `${label}.upper`);
  assertLevel(raw.level);
  return { lower, upper, level: raw.level };
}

function readCountPair(raw, label) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${label} must be an object`);
  }
  return {
    baseline: requireCount(raw.baseline, `${label}.baseline`),
    candidate: requireCount(raw.candidate, `${label}.candidate`),
  };
}

function readCountMap(raw, label) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${label} must be an object`);
  }
  const counts = {};
  for (const key of Object.keys(raw)) {
    counts[key] = requireCount(raw[key], `${label}.${key}`);
  }
  return counts;
}

function readStringList(raw, label) {
  if (!Array.isArray(raw)) throw new Error(`${label} must be an array`);
  return raw.map((item, index) => {
    if (typeof item !== "string") throw new Error(`${label}[${index}] must be a string`);
    return item;
  });
}

function parseDiagnostics(raw) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error("diagnostics must be an array");
  return raw.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`diagnostics[${index}] must be an object`);
    }
    const label = `diagnostics[${index}]`;
    const scenarioId = readModelId(row.scenario_id, `${label}.scenario_id`);
    if (!scenarioId) throw new Error(`${label}.scenario_id is required`);
    const familyId = readModelId(row.family_id, `${label}.family_id`);
    if (!familyId) throw new Error(`${label}.family_id is required`);
    const baseline = readFraction(row.baseline_pass_rate, `${label}.baseline_pass_rate`);
    const candidate = readFraction(row.candidate_pass_rate, `${label}.candidate_pass_rate`);
    const difference = readSignedFraction(row.difference, `${label}.difference`);
    const differenceCi = readDifferenceCi(row.difference_ci, `${label}.difference_ci`);
    const cassette = row.missing_cassette_keys;
    if (!cassette || typeof cassette !== "object" || Array.isArray(cassette)) {
      throw new Error(`${label}.missing_cassette_keys must be an object`);
    }
    return {
      scenarioId,
      familyId,
      scheduledRollouts: readCountPair(row.scheduled_rollouts, `${label}.scheduled_rollouts`),
      missCounts: {
        baseline: readCountMap(row.miss_counts?.baseline, `${label}.miss_counts.baseline`),
        candidate: readCountMap(row.miss_counts?.candidate, `${label}.miss_counts.candidate`),
      },
      missingCassetteKeys: {
        baseline: readStringList(cassette.baseline, `${label}.missing_cassette_keys.baseline`),
        candidate: readStringList(cassette.candidate, `${label}.missing_cassette_keys.candidate`),
      },
      baselineText: formatRatio(baseline.ratio),
      candidateText: formatRatio(candidate.ratio),
      differenceText: formatRatio(difference.ratio),
      differenceCi: {
        lowerText: formatRatio(differenceCi.lower.ratio),
        upperText: formatRatio(differenceCi.upper.ratio),
        level: differenceCi.level,
      },
    };
  });
}

function intervalView(overall) {
  if (overall.delta == null && overall.ciLevel == null) {
    return { fromFile: false, text: INTERVAL_FALLBACK, delta: null, ciLevel: null };
  }
  const deltaText = overall.delta == null ? "δ = 5 pp" : formatDelta(overall.delta);
  const ciText = overall.ciLevel == null ? "90%" : formatCi(overall.ciLevel);
  return {
    fromFile: true,
    text: `${deltaText} · ${ciText}`,
    delta: overall.delta,
    ciLevel: overall.ciLevel,
  };
}

function resolveModelId(raw, name, preferred) {
  const fromArm = readModelId(raw?.model_id, `arms.${name}.model_id`);
  if (preferred) return { modelId: preferred, source: "overall" };
  if (fromArm) return { modelId: fromArm, source: "arm" };
  return { modelId: "", source: "none" };
}

function parseArm(raw, name, modelId) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`arms.${name} is required`);
  }
  for (const field of ["scheduled_rollouts", "environment_misses", "miss_counts"]) {
    if (raw[field] === undefined) {
      throw new Error(`arms.${name}.${field} is required`);
    }
  }
  const scheduled = requireCount(raw.scheduled_rollouts, `arms.${name}.scheduled_rollouts`);
  const environmentMisses = requireCount(raw.environment_misses, `arms.${name}.environment_misses`);
  const missCounts = parseMissCounts(raw.miss_counts, name);
  const counted = Object.values(missCounts).reduce((sum, value) => sum + value, 0);
  if (counted !== environmentMisses) {
    throw new Error(
      `arms.${name}.environment_misses (${environmentMisses}) must equal the sum of miss_counts (${counted})`,
    );
  }
  const passRate = raw.pass_rate === undefined ? null : parseRational(raw.pass_rate);
  const caption = readCaption(raw.caption, `arms.${name}.caption`);
  const arm = {
    scheduled,
    environmentMisses,
    missCounts,
    passRate,
    passRateText: passRate ? formatRatio(passRate) : "—",
    overMissLimit: exceedsRate(environmentMisses, scheduled, 1, 20),
  };
  if (caption) arm.caption = caption;
  if (modelId) arm.modelId = modelId;
  return arm;
}

function parseMissCounts(raw, arm) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`arms.${arm}.miss_counts must be an object`);
  }
  const counts = {};
  const keys = Object.keys(raw);
  if (keys.length === 0) {
    throw new Error(`arms.${arm}.miss_counts must name each miss kind`);
  }
  for (const key of keys) {
    counts[key] = requireCount(raw[key], `arms.${arm}.miss_counts.${key}`);
  }
  return counts;
}

function requireCount(value, label) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function parseScenarios(raw) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error("scenarios must be an array");
  return raw.map((scenario, index) => {
    if (!scenario || typeof scenario !== "object") {
      throw new Error(`scenarios[${index}] must be an object`);
    }
    const id = typeof scenario.id === "string" && scenario.id ? scenario.id : `scenario-${index + 1}`;
    const name = typeof scenario.name === "string" && scenario.name ? scenario.name : id;
    const baseline = readScenarioRate(scenario, "baseline", index);
    const candidate = readScenarioRate(scenario, "candidate", index);
    const caption = readCaption(scenario.caption, `scenarios[${index}].caption`);
    const row = {
      id,
      name,
      baselineText: formatRatio(baseline),
      candidateText: formatRatio(candidate),
    };
    if (caption) row.caption = caption;
    return row;
  });
}

function readCaption(value, label) {
  if (value == null) return "";
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value.trim();
}

function readModelId(value, label) {
  if (value == null) return "";
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value.trim();
}

function rawText(value) {
  return typeof value === "string" ? value.trim() : String(value);
}

function ratioOf(value) {
  try {
    return parseRational(rawText(value));
  } catch {
    return null;
  }
}

function ratePercent(value) {
  const ratio = ratioOf(value);
  if (!ratio || ratio.numerator > ratio.denominator) return null;
  const scaled = ratio.numerator * 100;
  if (scaled % ratio.denominator === 0) return `${scaled / ratio.denominator}%`;
  const tenths = Math.round((scaled * 10) / ratio.denominator);
  const whole = Math.trunc(tenths / 10);
  const frac = Math.abs(tenths % 10);
  return `${whole}.${frac}%`;
}

function formatDelta(value) {
  const raw = rawText(value);
  if (/pp/i.test(raw)) return raw.includes("δ") ? raw : `δ = ${raw}`;
  const pct = ratePercent(value);
  if (pct) return `δ = ${pct.slice(0, -1)} pp`;
  return `δ = ${raw} pp`;
}

function formatCi(value) {
  const raw = rawText(value);
  if (/ci/i.test(raw)) return raw;
  if (raw.includes("%")) return `${raw} CI`;
  const pct = ratePercent(value);
  if (pct) return `${pct} CI`;
  return `${raw} CI`;
}

function readScenarioRate(scenario, arm, index) {
  const flat = scenario[`${arm}_rate`];
  const nested = scenario[arm]?.pass_rate;
  const value = flat !== undefined ? flat : nested;
  if (value === undefined) {
    throw new Error(`scenarios[${index}] needs ${arm}_rate or ${arm}.pass_rate`);
  }
  return parseRational(value);
}

function parseChart(doc, id, defaults) {
  const raw = doc.charts?.[id] ?? {};
  const status = raw.status ?? defaults.status;
  if (status !== "preliminary" && status !== "final" && status !== "coming_soon") {
    throw new Error(`charts.${id}.status is not recognized`);
  }
  const caption = stringNote(raw.notes) || noteText(doc.notes, id) || "";
  const points = status === "coming_soon" ? [] : parsePoints(raw.points, id);
  return {
    id,
    status,
    title: typeof raw.title === "string" && raw.title ? raw.title : defaults.title,
    caption,
    xLabel: typeof raw.x_label === "string" && raw.x_label ? raw.x_label : defaults.xLabel,
    yLabel: typeof raw.y_label === "string" && raw.y_label ? raw.y_label : defaults.yLabel,
    points,
  };
}

function parsePoints(raw, id) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`charts.${id}.points must be an array`);
  return raw.map((point, index) => {
    const budget = point?.budget;
    if (typeof budget !== "number" || !Number.isInteger(budget) || budget < 0) {
      throw new Error(`charts.${id}.points[${index}].budget must be a non-negative integer`);
    }
    const drop = parseRational(point.drop);
    return { budget, dropText: formatRatio(drop) };
  });
}

function noteText(notes, key) {
  if (!notes) return "";
  if (typeof notes === "string") return key === "summary" ? notes : "";
  if (typeof notes === "object") return stringNote(notes[key]);
  return "";
}

function stringNote(value) {
  return typeof value === "string" ? value.trim() : "";
}

function headlineFor(verdict) {
  if (verdict === "likely_regression") return "Block";
  if (verdict === "insufficient_evidence") return "Insufficient evidence";
  if (verdict === "invalid_run") return "Invalid run";
  return "Pass";
}

function whyFor(verdict) {
  if (verdict === "likely_regression") {
    return "The check fails on Block. Scenario rows are diagnostics, not separate gates.";
  }
  if (verdict === "insufficient_evidence") {
    return "No suite verdict is published. likely_regression is null and the run is not marked invalid. Scenario rows remain diagnostics.";
  }
  if (verdict === "invalid_run") {
    return "An invalid run isn't scored. Scenario rows remain diagnostics.";
  }
  return "The suite check passes. Scenario rows are diagnostics, not separate gates.";
}

export function bannerFor(status) {
  if (status === "preliminary") {
    return {
      tone: "preliminary",
      title: "Preliminary",
      body: "Not a final gate, and not a customer benchmark.",
    };
  }
  return {
    tone: "final",
    title: "Final",
    body: "This results file is the recorded suite check.",
  };
}
