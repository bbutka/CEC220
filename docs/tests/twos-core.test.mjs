import assert from "node:assert/strict";
import {
  createTwosProblem,
  parseFixedBits,
  parseSignedDecimal,
  patternToSigned,
  signedRange,
  signedToPattern,
} from "../shared/twos-core.js";

assert.deepEqual(signedRange(4), { minimum: -8, maximum: 7 });
assert.equal(signedToPattern(-5, 4), "1011");
assert.equal(patternToSigned("1011", 4), -5);
assert.equal(parseFixedBits("10 11", 4).bits, "1011");
assert.equal(parseFixedBits("101", 4).ok, false);
assert.equal(parseSignedDecimal("-8", 4).value, -8);
assert.equal(parseSignedDecimal("8", 4).ok, false);

const subtraction = createTwosProblem(3, 5, "subtract", 4);
assert.equal(subtraction.aBits, "0011");
assert.equal(subtraction.bBits, "0101");
assert.equal(subtraction.invertedBBits, "1010");
assert.equal(subtraction.effectiveBBits, "1011");
assert.equal(subtraction.storedBits, "1110");
assert.equal(subtraction.storedSigned, -2);
assert.equal(subtraction.overflow, false);

const overflow = createTwosProblem(7, 1, "add", 4);
assert.equal(overflow.storedBits, "1000");
assert.equal(overflow.storedSigned, -8);
assert.equal(overflow.carryOut, 0);
assert.equal(overflow.overflow, true);

for (let width = 2; width <= 8; width += 1) {
  const { minimum, maximum } = signedRange(width);
  const modulus = 2 ** width;
  for (let a = minimum; a <= maximum; a += 1) {
    assert.equal(patternToSigned(signedToPattern(a, width), width), a);
    for (let b = minimum; b <= maximum; b += 1) {
      for (const operation of ["add", "subtract"]) {
        const problem = createTwosProblem(a, b, operation, width);
        const mathematical = operation === "add" ? a + b : a - b;
        assert.equal(problem.mathematicalResult, mathematical);
        assert.equal(problem.storedSigned, patternToSigned(((mathematical % modulus) + modulus) % modulus, width));
        assert.equal(problem.overflow, mathematical < minimum || mathematical > maximum);
        assert.equal(problem.overflowBySigns, problem.overflow);
      }
    }
  }
}

console.log("Two’s-complement core: named cases and exhaustive widths 2–8 passed.");
