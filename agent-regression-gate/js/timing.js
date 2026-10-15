/**
 * Efficiency timings shaped like a future results.json `timing` field.
 *
 * The performance page renders data/timing.sample.json. A results document
 * with no timing field is an empty view: nothing is invented, and nothing is
 * thrown. Per-rollout figures are p50 and max. Family rows are wall-clock
 * only, slowest first, with no verdict.
 */

export const TIMING_SAMPLE_PATH = "data/timing.sample.json";

const BARE_KEYS = ["gate_wall_clock_s", "rollout_s", "retries_429", "per_family_wall_clock_s"];

export function readTiming(doc) {
  const source = timingSource(doc);
  if (!source) return emptyTiming();
  return {
    present: true,
    gateWallClockS: {
      live: readSeconds(source.gate_wall_clock_s, "live"),
      replay: readSeconds(source.gate_wall_clock_s, "replay"),
    },
    rolloutS: {
      p50: readSeconds(source.rollout_s, "p50"),
      max: readSeconds(source.rollout_s, "max"),
    },
    retries429: readNumber(source.retries_429),
    families: readFamilies(source.per_family_wall_clock_s),
  };
}

export function renderTimingHtml(view) {
  const timing = view && view.present ? view : emptyTiming();
  if (!timing.present) {
    return '<p class="timing-missing">No timing field in this file.</p>';
  }
  const groups = [
    {
      title: "Gate wall-clock",
      cells: [
        ["Live", formatSeconds(timing.gateWallClockS.live)],
        ["Replay", formatSeconds(timing.gateWallClockS.replay)],
      ],
    },
    {
      title: "Per rollout",
      cells: [
        ["p50", formatSeconds(timing.rolloutS.p50)],
        ["Max", formatSeconds(timing.rolloutS.max)],
      ],
    },
    {
      title: "429 retries",
      cells: [["Count", formatCount(timing.retries429)]],
    },
  ];
  const cards = groups.map((group) => {
    const cells = group.cells.map(([label, value]) => metric(label, value)).join("");
    return `<article class="timing-card"><h3>${esc(group.title)}</h3>${cells}</article>`;
  }).join("");
  return `<div class="timing-panel"><div class="timing-grid">${cards}</div>${familiesHtml(timing.families)}</div>`;
}

function emptyTiming() {
  return {
    present: false,
    gateWallClockS: { live: null, replay: null },
    rolloutS: { p50: null, max: null },
    retries429: null,
    families: [],
  };
}

function timingSource(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
  if (Object.prototype.hasOwnProperty.call(doc, "timing") || looksLikeResults(doc)) {
    const timing = doc.timing;
    if (!timing || typeof timing !== "object" || Array.isArray(timing)) return null;
    return timing;
  }
  if (BARE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(doc, key))) return doc;
  return null;
}

function looksLikeResults(doc) {
  return ["version", "schema_version", "status", "arms", "verdicts"].some((key) => (
    Object.prototype.hasOwnProperty.call(doc, key)
  ));
}

function readSeconds(group, key) {
  if (!group || typeof group !== "object" || Array.isArray(group)) return null;
  return readNumber(group[key]);
}

function readNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function readFamilies(rows) {
  if (!Array.isArray(rows)) return [];
  const families = [];
  rows.forEach((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    if (typeof row.family_id !== "string" || row.family_id.length === 0) return;
    families.push({ familyId: row.family_id, seconds: readNumber(row.seconds), index });
  });
  families.sort((a, b) => {
    if (a.seconds == null && b.seconds == null) return a.index - b.index;
    if (a.seconds == null) return 1;
    if (b.seconds == null) return -1;
    if (a.seconds !== b.seconds) return b.seconds - a.seconds;
    return a.index - b.index;
  });
  return families.map(({ familyId, seconds }) => ({ familyId, seconds }));
}

function formatSeconds(value) {
  if (value == null) return null;
  return `${formatNumber(value)} s`;
}

function formatCount(value) {
  if (value == null) return null;
  return formatNumber(value);
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1000) / 1000);
}

function metric(label, value) {
  const figure = value == null
    ? '<span class="timing-missing-value">Not in this file</span>'
    : `<span class="timing-figure"><b>${esc(value)}</b><span class="example-tag">Example</span></span>`;
  return `<div class="timing-metric"><span>${esc(label)}</span>${figure}</div>`;
}

function familiesHtml(families) {
  const rows = families.length
    ? `<ol class="timing-families">${families.map((row) => {
      const figure = row.seconds == null
        ? '<span class="timing-missing-value">Not in this file</span>'
        : `<span class="timing-figure"><b>${esc(formatSeconds(row.seconds))}</b><span class="example-tag">Example</span></span>`;
      return `<li><span class="timing-family">${esc(row.familyId)}</span>${figure}</li>`;
    }).join("")}</ol>`
    : '<p class="timing-missing">No family rows in this file.</p>';
  return `<section class="timing-slow" aria-label="Slowest families by wall-clock"><h3>Slowest families by wall-clock</h3>${rows}<p class="timing-note">No per-family verdict.</p></section>`;
}

function esc(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}
