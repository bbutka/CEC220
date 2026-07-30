import assert from "node:assert/strict";
import {
  nonRestoringDivisionTrace,
  shiftAddTrace,
} from "../shared/algorithm-core.js";

for (let width = 2; width <= 8; width += 1) {
  const max = 2 ** width - 1;
  for (let a = 0; a <= max; a += 1) {
    for (let b = 0; b <= max; b += 1) {
      const multiply = shiftAddTrace(a, b, width);
      assert.equal(multiply.result, a * b);
      for (const step of multiply.steps) {
        assert.equal(step.invariant, a * b);
      }
    }
  }

  for (let dividend = 0; dividend <= max; dividend += 1) {
    for (let divisor = 1; divisor <= max; divisor += 1) {
      const divide = nonRestoringDivisionTrace(dividend, divisor, width);
      assert.equal(divide.ok, true);
      assert.equal(divide.quotient, Math.floor(dividend / divisor));
      assert.equal(divide.remainder, dividend % divisor);
      assert.equal(
        divisor * divide.quotient + divide.remainder,
        dividend,
      );
      assert.equal(divide.remainder < divisor, true);
    }
  }
}

assert.equal(nonRestoringDivisionTrace(7, 0, 4).ok, false);
console.log("Algorithm core: exhaustive multiply/divide widths 2–8 passed.");

