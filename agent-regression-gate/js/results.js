/**
 * results.json v1.
 *
 * The suite verdict is the file's own likely_regression (or invalid_run).
 * Scenario rows are diagnostics. They never become a per-scenario pass or block.
 */

import { exceedsRate, formatRatio, parseRational } from "./rational.js";

const ARM_NAMES = ["baseline", "candidate"];

export function parseResults(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("results.json must be an object");
  }
  if (doc.version !== 1) {
    throw new Error("results.json version must be 1");
  }
  const status = doc.status;
  if (status !== "preliminary" && status !== "final") {
    throw new Error("status must be \"preliminary\" or \"final\"");
  }
  assertLevel(doc.level);
  if (doc.likely_regression !== true && doc.likely_regression !== false && doc.likely_regression !== null) {
    throw new Error("likely_regression must be true, false, or null");
  }
  const invalidRun = doc.invalid_run === true || doc.likely_regression === null;
  const arms = {};
  for (const name of ARM_NAMES) {
    arms[name] = parseArm(doc.arms?.[name], name);
  }

  const verdict = invalidRun
    ? "invalid_run"
    : doc.likely_regression
      ? "likely_regression"
      : "no_regression";

  return {
    version: 1,
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

function assertLevel(level) {
  if (level === 0.9) return;
  if (typeof level === "string") {
    const ratio = parseRational(level);
    if (ratio.numerator * 10 === ratio.denominator * 9) return;
  }
  throw new Error("level must be 0.9");
}

function parseArm(raw, name) {
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
  return {
    scheduled,
    environmentMisses,
    missCounts,
    passRate,
    passRateText: passRate ? formatRatio(passRate) : "—",
    overMissLimit: exceedsRate(environmentMisses, scheduled, 1, 20),
  };
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
    return {
      id,
      name,
      baselineText: formatRatio(baseline),
      candidateText: formatRatio(candidate),
    };
  });
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
  if (verdict === "likely_regression") return "Likely regression";
  if (verdict === "invalid_run") return "Invalid run";
  return "Pass";
}

function whyFor(verdict) {
  if (verdict === "likely_regression") {
    return "Suite check failed. likely_regression is true at level 0.9. Scenario rows are diagnostics, not separate gates.";
  }
  if (verdict === "invalid_run") {
    return "No suite verdict is published. Scenario rows remain diagnostics.";
  }
  return "Suite check passed. likely_regression is false at level 0.9. Scenario rows are diagnostics, not separate gates.";
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
