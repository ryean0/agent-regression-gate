/**
 * Exact rational parsing for results.json rates.
 * Accepts "3/5" and "0.6". Never uses parseFloat, which would turn "3/5" into 3.
 */

function assertSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} is not a safe integer`);
  }
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

export function reduceRatio(numerator, denominator) {
  assertSafeInteger(numerator, "numerator");
  assertSafeInteger(denominator, "denominator");
  if (denominator === 0) throw new Error("denominator cannot be zero");
  if (denominator < 0) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const divisor = gcd(numerator, denominator) || 1;
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function parseIntegerToken(token, label) {
  if (!/^[+-]?\d+$/.test(token)) {
    throw new Error(`${label} must be an integer, got ${token}`);
  }
  const value = Number(token);
  assertSafeInteger(value, label);
  return value;
}

/**
 * @param {unknown} input
 * @returns {{ numerator: number, denominator: number }}
 */
export function parseRational(input) {
  if (typeof input !== "string") {
    throw new Error("a rate must be a string such as \"3/5\" or \"0.6\"");
  }
  const text = input.trim();
  if (text.includes("/")) {
    const parts = text.split("/");
    if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
      throw new Error(`invalid fraction: ${input}`);
    }
    const numerator = parseIntegerToken(parts[0], "numerator");
    const denominator = parseIntegerToken(parts[1], "denominator");
    if (denominator <= 0) throw new Error("a rate denominator must be positive");
    if (numerator < 0) throw new Error("a rate numerator cannot be negative");
    return reduceRatio(numerator, denominator);
  }

  if (!/^[+-]?(?:\d+\.\d+|\d+|\.\d+)$/.test(text)) {
    throw new Error(`invalid rate: ${input}`);
  }
  const negative = text.startsWith("-");
  const body = text.replace(/^[+-]/, "");
  const [wholeRaw, fracRaw = ""] = body.split(".");
  const denominator = 10 ** fracRaw.length;
  assertSafeInteger(denominator, "denominator");
  const whole = wholeRaw === "" ? 0 : parseIntegerToken(wholeRaw, "whole");
  const frac = fracRaw === "" ? 0 : parseIntegerToken(fracRaw, "fraction");
  let numerator = whole * denominator + frac;
  if (negative) numerator = -numerator;
  if (numerator < 0) throw new Error("a rate cannot be negative");
  return reduceRatio(numerator, denominator);
}

export function formatRatio(ratio) {
  return `${ratio.numerator}/${ratio.denominator}`;
}

export function ratiosEqual(a, b) {
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

/** Integer ceiling of scheduled × numerator / denominator. */
export function coverageFloor(scheduled, numerator, denominator) {
  assertSafeInteger(scheduled, "scheduled");
  assertSafeInteger(numerator, "numerator");
  assertSafeInteger(denominator, "denominator");
  if (scheduled < 0 || numerator < 0 || denominator <= 0) {
    throw new Error("coverage floor received an invalid argument");
  }
  return Math.floor((scheduled * numerator + denominator - 1) / denominator);
}

/** True when count/total is strictly greater than numerator/denominator. */
export function exceedsRate(count, total, numerator, denominator) {
  assertSafeInteger(count, "count");
  assertSafeInteger(total, "total");
  assertSafeInteger(numerator, "numerator");
  assertSafeInteger(denominator, "denominator");
  if (count < 0 || total < 0 || numerator < 0 || denominator <= 0) {
    throw new Error("rate comparison received a negative count");
  }
  return count * denominator > total * numerator;
}
