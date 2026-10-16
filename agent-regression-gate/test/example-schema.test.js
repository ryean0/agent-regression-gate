import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const resultsSchema = JSON.parse(readFileSync(new URL("../schema/results.schema.json", import.meta.url), "utf8"));
const stepSchema = JSON.parse(readFileSync(new URL("../schema/step.schema.json", import.meta.url), "utf8"));
const steps = JSON.parse(readFileSync(new URL("../data/step.example.json", import.meta.url), "utf8"));
const example = JSON.parse(readFileSync(new URL("../data/results.preliminary.json", import.meta.url), "utf8"));

const FORBIDDEN = [
  [/\d+\/20\b/, "n/20"],
  [/\bFail\b/, "Fail verdict"],
  [/gemini-/i, "model version"],
  [/hard stop/i, "hard stop"],
  [/p95/i, "p95"],
  [/\u2014/, "em dash"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, "email"],
];

function rejectCopy(text, label) {
  for (const [pattern, name] of FORBIDDEN) {
    assert.doesNotMatch(text, pattern, `${label} ${name}`);
  }
}

function tokenField(schema, name) {
  const field = schema.properties[name];
  assert.equal(field.type, "integer", name);
  assert.equal(field.minimum, 0, name);
  assert.equal(Array.isArray(schema.required) && schema.required.includes(name), false, `${name} required`);
}

function stepAccepts(step) {
  for (const name of ["thinking_tokens", "cached_tokens"]) {
    if (!Object.hasOwn(step, name)) continue;
    const value = step[name];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return false;
  }
  return step && typeof step === "object" && !Array.isArray(step);
}

test("step.schema.json keeps thinking_tokens and cached_tokens optional", () => {
  assert.equal(stepSchema.title, "Step");
  assert.equal(stepSchema.additionalProperties, true);
  tokenField(stepSchema, "thinking_tokens");
  tokenField(stepSchema, "cached_tokens");
  assert.equal(stepSchema.required, undefined);
  assert.match(stepSchema.description, /2\.1\.0/);
  assert.match(stepSchema.description, /not schema 3\.0\.0/);
  assert.equal(steps.length, 2);
  assert.equal(stepAccepts(steps[0]), true);
  assert.equal(steps[0].thinking_tokens, 12);
  assert.equal(steps[0].cached_tokens, 30);
  assert.equal(Object.hasOwn(steps[1], "thinking_tokens"), false);
  assert.equal(stepAccepts(steps[1]), true);
  assert.equal(stepAccepts({}), true);
  assert.equal(stepAccepts({ thinking_tokens: "12" }), false);
  assert.equal(stepAccepts({ cached_tokens: -1 }), false);
  assert.equal(stepAccepts({ cached_tokens: 1.5 }), false);
  rejectCopy(JSON.stringify(stepSchema), "step schema");
  rejectCopy(JSON.stringify(steps), "step example");
});

test("results schema 2.1.0 keeps suite_id and run_summary optional", () => {
  assert.equal(resultsSchema.properties.schema_version.pattern, "^2\\.\\d+\\.\\d+$");
  assert.equal(resultsSchema.required.includes("suite_id"), false);
  assert.equal(resultsSchema.required.includes("run_summary"), false);
  assert.equal(resultsSchema.properties.suite_id.type, "string");
  const summary = resultsSchema.$defs.runSummary.properties;
  for (const name of [
    "planned_rollouts",
    "completed_rollouts",
    "infra_misses",
    "stopped",
    "total_cost_usd",
    "total_cached_input_tokens",
    "rollout_duration_p50_s",
    "rollout_duration_max_s",
  ]) {
    assert.ok(summary[name], name);
  }
  assert.deepEqual(summary.stopped.oneOf, [{ type: "null" }, { const: "monthly_cap" }]);
  assert.equal(Object.hasOwn(summary, "rollout_duration_p95_s"), false);
  assert.match(resultsSchema.description, /not 3\.0\.0/);
  assert.equal(example.schema_version, "2.1.0");
  assert.equal(example.version, "2.1.0");
  assert.equal(Object.hasOwn(example, "suite_id"), false);
  assert.equal(example.scenarios.map((row) => row.id).join(","), "example.clean.v1,example.broken.v1");
  assert.equal(example.diagnostics.map((row) => row.scenario_id).join(","), "example.clean.v1,example.broken.v1");
  assert.equal(typeof example.arms.baseline.model_id, "string");
  assert.equal(typeof example.arms.candidate.model_id, "string");
  assert.notEqual(example.arms.baseline.model_id, example.arms.candidate.model_id);
  assert.equal(example.run_summary.stopped, null);
  rejectCopy(JSON.stringify(example), "example results");
  rejectCopy(JSON.stringify(resultsSchema), "results schema");
});
