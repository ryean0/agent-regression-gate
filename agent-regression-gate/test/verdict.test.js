import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { CANDIDATES, SCENARIO_SETS, buildRun } from "../js/demo-data.js";
import {
  armMissExceeds,
  interpretSlot,
  requiredValid,
  scoreRun,
  summarizeArm,
} from "../js/verdict.js";

test("5, 7, and 20 coverage floors", () => {
  assert.equal(requiredValid(5), 3);
  assert.equal(requiredValid(7), 5);
  assert.equal(requiredValid(20), 12);
});

test("exactly 5% excluded still produces a verdict", () => {
  assert.equal(armMissExceeds(5, 100), false);
  assert.equal(armMissExceeds(1, 20), false);
  const result = scoreRun([
    scenario("edge", {
      baseline: { scheduled: 100, slots: Array.from({ length: 100 }, () => "pass") },
      candidate: {
        scheduled: 100,
        slots: [
          ...Array.from({ length: 95 }, () => "pass"),
          ...Array.from({ length: 5 }, () => "infra_timeout"),
        ],
      },
    }),
  ]);
  assert.equal(result.verdict, "no_regression");
  assert.equal(result.candidate.excluded, 5);
});

test("6% excluded on one arm invalidates the run", () => {
  assert.equal(armMissExceeds(6, 100), true);
  const result = scoreRun([
    scenario("only", {
      baseline: { scheduled: 100, slots: Array.from({ length: 100 }, () => "pass") },
      candidate: {
        scheduled: 100,
        slots: [
          ...Array.from({ length: 94 }, () => "pass"),
          ...Array.from({ length: 6 }, () => "infra_timeout"),
        ],
      },
    }),
  ]);
  assert.equal(result.verdict, "invalid_run");
  assert.equal(result.meanDelta, null);
  assert.ok(result.invalidReasons.some((reason) => reason.includes("candidate")));
  assert.equal(result.invalidReasons.some((reason) => reason.startsWith("On the baseline side")), false);
});

test("a 6% miss on the baseline arm alone is enough", () => {
  const result = scoreRun([
    scenario("baseline-arm", {
      baseline: {
        scheduled: 100,
        slots: [
          ...Array.from({ length: 94 }, () => "pass"),
          ...Array.from({ length: 6 }, () => "missing"),
        ],
      },
      candidate: { scheduled: 100, slots: Array.from({ length: 100 }, () => "pass") },
    }),
  ]);
  assert.equal(result.verdict, "invalid_run");
  assert.ok(result.invalidReasons.some((reason) => reason.startsWith("On the baseline side")));
});

test("agent timeouts count as fails and infrastructure timeouts are excluded", () => {
  const agent = summarizeArm({
    scheduled: 5,
    slots: ["pass", "agent_timeout", "agent_timeout", "fail", "pass"],
  });
  assert.equal(agent.valid, 5);
  assert.equal(agent.passes, 2);
  assert.equal(agent.excluded, 0);
  assert.equal(interpretSlot("agent_timeout").score, 0);

  const infra = summarizeArm({
    scheduled: 5,
    slots: ["pass", "infra_timeout", "infra_timeout", "pass", "pass"],
  });
  assert.equal(infra.valid, 3);
  assert.equal(infra.passRate, 1);
  assert.equal(infra.excluded, 2);
  assert.equal(interpretSlot("infra_timeout").valid, false);
});

test("a thin scenario invalidates even when the arm miss rate does not", () => {
  const result = scoreRun([
    scenario("thin", {
      baseline: {
        scheduled: 20,
        slots: [
          ...Array.from({ length: 11 }, () => "pass"),
          ...Array.from({ length: 9 }, () => "infra_timeout"),
        ],
      },
      candidate: { scheduled: 20, slots: Array.from({ length: 20 }, () => "pass") },
    }),
    scenario("clean", {
      baseline: { scheduled: 180, slots: Array.from({ length: 180 }, () => "pass") },
      candidate: { scheduled: 180, slots: Array.from({ length: 180 }, () => "pass") },
    }),
  ]);
  assert.equal(armMissExceeds(result.baseline.excluded, result.baseline.scheduled), false);
  assert.equal(result.verdict, "invalid_run");
  assert.ok(result.invalidReasons.some((reason) => reason.includes("at least 12")));
});

test("sitting exactly on the coverage floor is accepted", () => {
  const result = scoreRun([
    scenario("floor", {
      baseline: { scheduled: 5, slots: ["pass", "pass", "pass", "infra_timeout", "missing"] },
      candidate: { scheduled: 5, slots: Array.from({ length: 5 }, () => "pass") },
    }),
    scenario("rest", {
      baseline: { scheduled: 35, slots: Array.from({ length: 35 }, () => "pass") },
      candidate: { scheduled: 35, slots: Array.from({ length: 35 }, () => "pass") },
    }),
  ]);
  assert.equal(result.scenarios[0].baselineNeed, 3);
  assert.equal(armMissExceeds(2, 40), false);
  assert.equal(result.verdict, "no_regression");
});

test("scenario order does not change the simulator verdict", () => {
  for (const set of SCENARIO_SETS) {
    for (const candidate of CANDIDATES) {
      const forward = scoreRun(buildRun(set.id, candidate.id));
      const backward = scoreRun([...buildRun(set.id, candidate.id)].reverse());
      assert.equal(backward.verdict, forward.verdict);
      assert.equal(backward.meanDelta, forward.meanDelta);
      assert.equal(backward.upper, forward.upper);
    }
  }
});

test("simulated presets land on the three verdicts", () => {
  const expected = {
    stable: "no_regression",
    subtle: "likely_regression",
    loops: "likely_regression",
    flaky: "invalid_run",
  };
  for (const set of SCENARIO_SETS) {
    for (const candidate of CANDIDATES) {
      const result = scoreRun(buildRun(set.id, candidate.id));
      assert.equal(result.verdict, expected[candidate.id], `${set.id}/${candidate.id}`);
    }
  }
});

test("demo scenario hashes are the SHA-256 of the scenario text", () => {
  for (const set of SCENARIO_SETS) {
    for (const scenario of set.scenarios) {
      const hex = createHash("sha256").update(scenario.prompt).digest("hex");
      assert.equal(hex, scenario.expectedHash, scenario.id);
    }
  }
});

function scenario(id, arms) {
  return { id, name: id, ...arms };
}
