/** Simulated demo fixtures. Not the results.json file, and not customer results. */

const SUPPORT = [
  {
    id: "reset-locked-account",
    name: "Reset a locked account",
    prompt: "The customer cannot sign in. Unlock the account only after they confirm the email on file.",
    expectedHash: "cbb85ce6e62bd0f7c6f47dd5e993628b70b736d30611f9fc87ec65023c0ebed1",
    baselineScheduled: 20,
    candidateScheduled: 5,
    baseline: { pass: 18, fail: 2 },
  },
  {
    id: "refund-duplicate-charge",
    name: "Refund a duplicate charge",
    prompt: "Two identical charges posted today. Refund one of them and leave the other.",
    expectedHash: "b58599b6b7e736cb4978edc3a4806fe37c186d5b133b225d5454eda7d7cf7675",
    baselineScheduled: 20,
    candidateScheduled: 5,
    baseline: { pass: 17, fail: 3 },
  },
  {
    id: "explain-shipping-delay",
    name: "Explain a shipping delay",
    prompt: "The order is three days late. Tell the customer the new date from the tracking tool. Do not invent a date.",
    expectedHash: "7775ad6ccbba784ca4688e2618dff8ed0824049b78585a831c468b84c4e5adfc",
    baselineScheduled: 20,
    candidateScheduled: 5,
    baseline: { pass: 19, fail: 1 },
  },
  {
    id: "escalate-safety-complaint",
    name: "Escalate a safety complaint",
    prompt: "The customer reports an unsafe product. Stop troubleshooting and open a safety escalation.",
    expectedHash: "70b1d244a60c9312d23310e033c5651dce988074e7dff0bec6abc9c1f411ee25",
    baselineScheduled: 20,
    candidateScheduled: 5,
    baseline: { pass: 16, fail: 4 },
  },
];

const CHECKOUT = [
  {
    id: "apply-promo-code",
    name: "Apply a promo code",
    prompt: "Apply the code WELCOME10 only if the cart qualifies. Otherwise explain why it does not.",
    expectedHash: "54e567f85f036b77fcc442a46a37c2bed735da152796abaf25f50180df47c2c3",
    baselineScheduled: 20,
    candidateScheduled: 5,
    baseline: { pass: 17, fail: 3 },
  },
  {
    id: "change-delivery-address",
    name: "Change a delivery address",
    prompt: "Change the delivery address to the one the customer just typed, before the order ships.",
    expectedHash: "7c1d8206f8dff930031f30488d64c611550c004479ea390e98b5163953af2e7f",
    baselineScheduled: 20,
    candidateScheduled: 5,
    baseline: { pass: 18, fail: 2 },
  },
  {
    id: "recover-abandoned-cart",
    name: "Recover an abandoned cart",
    prompt: "The shopper left a cart. Offer to resume it. Do not add items they did not choose.",
    expectedHash: "aa422002ea90b5d0db3176cbf666eb1cde1305bc2aff7a1fbcc253ce8a600a3b",
    baselineScheduled: 20,
    candidateScheduled: 5,
    baseline: { pass: 15, fail: 5 },
  },
];

export const SCENARIO_SETS = [
  {
    id: "support",
    name: "support-desk",
    summary: "4 scenarios · 20 baseline · 5 candidate",
    scenarios: SUPPORT,
  },
  {
    id: "checkout",
    name: "checkout",
    summary: "3 scenarios · 20 baseline · 5 candidate",
    scenarios: CHECKOUT,
  },
];

export const CANDIDATES = [
  { id: "stable", name: "Candidate v2.1: stable", summary: "Pass rates hold against the current agent." },
  { id: "subtle", name: "Candidate v2.2: regression", summary: "Pass rates drop on the same scenarios." },
  { id: "loops", name: "Candidate v2.3: step-budget timeouts", summary: "Step-budget timeouts score as fails." },
  { id: "flaky", name: "Infra degradation: provider 5xx", summary: "Infrastructure misses exceed the 5% cap." },
];

const CANDIDATE_SLOTS = {
  "reset-locked-account": {
    stable: { pass: 5 },
    subtle: { pass: 3, fail: 2 },
    loops: { pass: 0, agentTimeout: 5 },
    flaky: { pass: 4, infraTimeout: 1 },
  },
  "refund-duplicate-charge": {
    stable: { pass: 4, fail: 1 },
    subtle: { pass: 2, fail: 3 },
    loops: { pass: 1, agentTimeout: 4 },
    flaky: { pass: 3, fail: 1, infraTimeout: 1 },
  },
  "explain-shipping-delay": {
    stable: { pass: 5 },
    subtle: { pass: 3, fail: 2 },
    loops: { pass: 0, agentTimeout: 5 },
    flaky: { pass: 4, fail: 1 },
  },
  "escalate-safety-complaint": {
    stable: { pass: 4, fail: 1 },
    subtle: { pass: 2, fail: 3 },
    loops: { pass: 0, agentTimeout: 5 },
    flaky: { pass: 4, fail: 1 },
  },
  "apply-promo-code": {
    stable: { pass: 4, fail: 1 },
    subtle: { pass: 2, fail: 3 },
    loops: { pass: 0, agentTimeout: 5 },
    flaky: { pass: 4, infraTimeout: 1 },
  },
  "change-delivery-address": {
    stable: { pass: 5 },
    subtle: { pass: 3, fail: 2 },
    loops: { pass: 0, agentTimeout: 5 },
    flaky: { pass: 4, fail: 1 },
  },
  "recover-abandoned-cart": {
    stable: { pass: 4, fail: 1 },
    subtle: { pass: 2, fail: 3 },
    loops: { pass: 1, agentTimeout: 4 },
    flaky: { pass: 4, fail: 1 },
  },
};

export function slotsFromCounts(scheduled, counts) {
  const agentTimeout = counts.agentTimeout ?? 0;
  const infraTimeout = counts.infraTimeout ?? 0;
  const missing = counts.missing ?? 0;
  const fail = counts.fail ?? scheduled - counts.pass - agentTimeout - infraTimeout - missing;
  const parts = [
    Array.from({ length: counts.pass }, () => "pass"),
    Array.from({ length: fail }, () => "fail"),
    Array.from({ length: agentTimeout }, () => "agent_timeout"),
    Array.from({ length: infraTimeout }, () => "infra_timeout"),
    Array.from({ length: missing }, () => "missing"),
  ];
  if (parts.reduce((sum, group) => sum + group.length, 0) !== scheduled || fail < 0) {
    throw new Error(`slot counts must sum to ${scheduled}`);
  }
  const slots = [];
  const index = [0, 0, 0, 0, 0];
  while (slots.length < scheduled) {
    let progressed = false;
    for (let group = 0; group < parts.length; group += 1) {
      if (index[group] < parts[group].length) {
        slots.push(parts[group][index[group]]);
        index[group] += 1;
        progressed = true;
        if (slots.length === scheduled) break;
      }
    }
    if (!progressed) break;
  }
  return slots;
}

export function buildRun(setId, candidateId) {
  const set = SCENARIO_SETS.find((item) => item.id === setId);
  if (!set) throw new Error(`unknown scenario set: ${setId}`);
  return set.scenarios.map((scenario) => {
    const counts = CANDIDATE_SLOTS[scenario.id]?.[candidateId];
    if (!counts) throw new Error(`no ${candidateId} plan for ${scenario.id}`);
    return {
      id: scenario.id,
      name: scenario.name,
      prompt: scenario.prompt,
      expectedHash: scenario.expectedHash,
      recordedHash: scenario.expectedHash,
      baseline: {
        scheduled: scenario.baselineScheduled,
        slots: slotsFromCounts(scenario.baselineScheduled, scenario.baseline),
      },
      candidate: {
        scheduled: scenario.candidateScheduled,
        slots: slotsFromCounts(scenario.candidateScheduled, counts),
      },
    };
  });
}
