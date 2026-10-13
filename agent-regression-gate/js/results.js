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
 * Version 2.1.0 may also set schema_version to "2.1.0", record
 * verdicts.overall.model_ids.baseline and .candidate, and copy gate settings
 * from suite.yaml. Those ids are preferred over the per-arm model_id when they
 * are present. Gate settings are display-only. When they are missing the page
 * shows δ = 5 pp / 90%.
 *
 * Harness PR #13 was not readable here, so the optional gate keys this reader
 * accepts are delta, alpha, min_valid, ci_level, and miss_cap, either under
 * gate or at the top level of the file.
 */

import { exceedsRate, formatRatio, parseRational } from "./rational.js";

const ARM_NAMES = ["baseline", "candidate"];
const V2_VERSION = /^2\.\d+\.\d+$/;
const GATE_KEYS = ["delta", "alpha", "min_valid", "ci_level", "miss_cap"];
/** Shown when the file does not record gate settings. */
export const GATE_FALLBACK = "δ = 5 pp / 90%";

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
  if (doc.likely_regression !== true && doc.likely_regression !== false && doc.likely_regression !== null) {
    throw new Error("likely_regression must be true, false, or null");
  }
  const invalidRun = doc.invalid_run === true;
  const overallModels = readOverallModelIds(doc);
  const modelIdSources = {};
  const arms = {};
  for (const name of ARM_NAMES) {
    const resolved = resolveModelId(doc.arms?.[name], name, overallModels?.[name] ?? "");
    modelIdSources[name] = resolved.source;
    arms[name] = parseArm(doc.arms?.[name], name, resolved.modelId);
  }

  const verdict = invalidRun
    ? "invalid_run"
    : doc.likely_regression === null
      ? "insufficient_evidence"
      : doc.likely_regression
        ? "likely_regression"
        : "no_regression";

  return {
    version,
    schemaVersion: schemaVersionOf(doc),
    status,
    level: 0.9,
    likelyRegression: doc.likely_regression,
    invalidRun,
    verdict,
    headline: headlineFor(verdict),
    why: whyFor(verdict),
    banner: bannerFor(status),
    summaryNote: noteText(doc.notes, "summary"),
    suite: typeof doc.suite === "string" ? doc.suite : "",
    modelIds: {
      baseline: arms.baseline.modelId || "",
      candidate: arms.candidate.modelId || "",
    },
    modelIdSources,
    gate: readGate(doc),
    arms,
    scenarios: parseScenarios(doc.scenarios),
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

function readOverallModelIds(doc) {
  if (doc.verdicts == null) return null;
  if (typeof doc.verdicts !== "object" || Array.isArray(doc.verdicts)) {
    throw new Error("verdicts must be an object");
  }
  if (doc.verdicts.overall == null) return null;
  if (typeof doc.verdicts.overall !== "object" || Array.isArray(doc.verdicts.overall)) {
    throw new Error("verdicts.overall must be an object");
  }
  if (doc.verdicts.overall.model_ids == null) return null;
  const modelIds = doc.verdicts.overall.model_ids;
  if (typeof modelIds !== "object" || Array.isArray(modelIds)) {
    throw new Error("verdicts.overall.model_ids must be an object");
  }
  return {
    baseline: readNamedModelId(modelIds, "baseline"),
    candidate: readNamedModelId(modelIds, "candidate"),
  };
}

function readNamedModelId(modelIds, name) {
  if (!Object.prototype.hasOwnProperty.call(modelIds, name)) return "";
  return readModelId(modelIds[name], `verdicts.overall.model_ids.${name}`);
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

function readGate(doc) {
  const nested = doc.gate != null;
  if (nested && (typeof doc.gate !== "object" || Array.isArray(doc.gate))) {
    throw new Error("gate must be an object");
  }
  const bag = nested ? doc.gate : doc;
  const prefix = nested ? "gate." : "";
  const values = {};
  let fromFile = false;
  for (const key of GATE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(bag, key)) {
      values[key] = null;
      continue;
    }
    values[key] = readGateValue(bag[key], `${prefix}${key}`);
    if (values[key] != null) fromFile = true;
  }
  return {
    fromFile,
    text: gateText(values, fromFile),
    delta: values.delta,
    alpha: values.alpha,
    minValid: values.min_valid,
    ciLevel: values.ci_level,
    missCap: values.miss_cap,
  };
}

function readGateValue(value, label) {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${label} must be a non-negative number or a string`);
    }
    return value;
  }
  if (typeof value === "string") {
    const text = value.trim();
    return text ? text : null;
  }
  throw new Error(`${label} must be a non-negative number or a string`);
}

function gateText(values, fromFile) {
  if (!fromFile) return GATE_FALLBACK;
  const parts = [values.delta == null ? "δ = 5 pp" : formatDelta(values.delta)];
  if (values.alpha != null) parts.push(`α = ${rawText(values.alpha)}`);
  if (values.min_valid != null) parts.push(`min valid ${formatRate(values.min_valid)}`);
  parts.push(values.ci_level == null ? "90%" : formatCi(values.ci_level));
  if (values.miss_cap != null) parts.push(`miss cap ${formatRate(values.miss_cap)}`);
  return parts.join(" · ");
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

function formatRate(value) {
  return ratePercent(value) || rawText(value);
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
