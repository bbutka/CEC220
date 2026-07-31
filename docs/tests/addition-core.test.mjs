import assert from "node:assert/strict";
import {
  additionProfile,
  createAdditionState,
  enterAdditionPart,
  expectedAdditionColumn,
  parseAdditionOperand,
} from "../shared/addition-core.js";

const binary = parseAdditionOperand("01011", 2, 5);
assert.equal(binary.ok, true);
assert.equal(binary.value, 11);
assert.equal(parseAdditionOperand("100000", 2, 5).ok, false);
assert.equal(parseAdditionOperand("15", 10, 4).value, 15);
assert.equal(parseAdditionOperand("F", 16, 4).value, 15);

let state = createAdditionState(11, 6, 5);
assert.deepEqual(expectedAdditionColumn(state), {
  total: 1,
  resultBit: 1,
  carryOut: 0,
});
state = enterAdditionPart(state, "result", 1).state;
assert.equal(state.cursor, 4);
state = enterAdditionPart(state, "carry", 0).state;
assert.equal(state.cursor, 3);
assert.equal(state.carryIn[3], 0);

const chain = additionProfile(11, 6, 5);
assert.equal(chain.storedBits, "10001");
assert.equal(chain.finalCarry, 0);
assert.equal(chain.fullBits, "10001");
assert.equal(chain.result, 17);

const beyondWidth = additionProfile(15, 1, 4);
assert.equal(beyondWidth.storedBits, "0000");
assert.equal(beyondWidth.finalCarry, 1);
assert.equal(beyondWidth.fullBits, "10000");

for (let width = 2; width <= 8; width += 1) {
  const modulus = 2 ** width;
  for (let a = 0; a < modulus; a += 1) {
    for (let b = 0; b < modulus; b += 1) {
      const profile = additionProfile(a, b, width);
      assert.equal(profile.result, a + b);
      assert.equal(profile.storedValue, (a + b) % modulus);
      assert.equal(profile.finalCarry, a + b >= modulus ? 1 : 0);
    }
  }
}

console.log("Addition core: named cases and exhaustive widths 2–8 passed.");
