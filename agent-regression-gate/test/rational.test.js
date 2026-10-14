import assert from "node:assert/strict";
import test from "node:test";

import { coverageFloor, parseRational, parseSignedRational, ratiosEqual } from "../js/rational.js";

test("coverage floor uses exact rational arithmetic", () => {
  assert.equal(coverageFloor(5, 3, 5), 3);
  assert.equal(coverageFloor(7, 3, 5), 5);
  assert.equal(coverageFloor(20, 3, 5), 12);
  assert.equal(Math.ceil(0.55 * 100), 56);
  assert.equal(coverageFloor(100, 11, 20), 55);
});

test("fraction strings are not parsed with parseFloat", () => {
  assert.equal(parseFloat("3/5"), 3);
  const ratio = parseRational("3/5");
  assert.deepEqual(ratio, { numerator: 3, denominator: 5 });
  assert.notEqual(ratio.numerator / ratio.denominator, parseFloat("3/5"));
});

test("decimal strings become exact rationals", () => {
  assert.ok(ratiosEqual(parseRational("0.6"), parseRational("3/5")));
  assert.deepEqual(parseRational("0.6"), { numerator: 3, denominator: 5 });
  assert.deepEqual(parseRational("0.55"), { numerator: 11, denominator: 20 });
  assert.deepEqual(parseRational("0.8"), { numerator: 4, denominator: 5 });
});

test("numeric rates are rejected", () => {
  assert.throws(() => parseRational(0.6), /string/);
  assert.throws(() => parseSignedRational(0.05), /string/);
});

test("signed fraction strings stay exact", () => {
  assert.deepEqual(parseSignedRational("-0.3"), { numerator: -3, denominator: 10 });
  assert.deepEqual(parseSignedRational("-1/20"), { numerator: -1, denominator: 20 });
  assert.ok(ratiosEqual(parseSignedRational("0.05"), parseRational("1/20")));
  assert.throws(() => parseRational("-0.05"), /negative/);
});
