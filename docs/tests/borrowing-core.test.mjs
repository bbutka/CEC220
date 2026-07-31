import assert from "node:assert/strict";
import {
  borrowProfile,
  chooseBorrowSource,
  correctBorrowSource,
  createBorrowState,
  enterResultDigit,
  needsBorrow,
  parseBorrowOperand,
} from "../shared/borrowing-core.js";

const binary = parseBorrowOperand("1000", 2, 4);
assert.equal(binary.ok, true);
assert.equal(binary.value, 8);
assert.equal(parseBorrowOperand("10000", 2, 4).ok, false);

const notebook = borrowProfile(36, 9, 6);
assert.equal(notebook.ok, true);
assert.equal(notebook.transformedA, "012012");
assert.equal(notebook.resultBits, "011011");
assert.equal(notebook.result, 27);

let state = createBorrowState(8, 1, 4);
assert.equal(needsBorrow(state), true);
assert.equal(correctBorrowSource(state), 0);
assert.equal(chooseBorrowSource(state, 2).ok, false);
const loan = chooseBorrowSource(state, 0);
assert.equal(loan.ok, true);
state = loan.state;
assert.deepEqual(state.aDigits, [0, 1, 1, 2]);
state = enterResultDigit(state, 1).state;
assert.equal(state.result[3], 1);

for (let width = 2; width <= 8; width += 1) {
  const maximum = 2 ** width - 1;
  for (let a = 0; a <= maximum; a += 1) {
    for (let b = 0; b <= a; b += 1) {
      const profile = borrowProfile(a, b, width);
      assert.equal(profile.ok, true);
      assert.equal(Number.parseInt(profile.resultBits, 2), a - b);
    }
  }
}

console.log("Borrowing core: notebook example and exhaustive widths 2–8 passed.");
