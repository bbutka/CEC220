import assert from "node:assert/strict";
import {
  defaultEncodings,
  deriveDffEquations,
  evaluateImplicants,
  minimizeSop,
  verifyDerivedMachine,
} from "../shared/fsm-core.js";

const xor = minimizeSop([1, 2], [], ["A", "B"]);
assert.equal(xor.expression.includes("¬A·B"), true);
assert.equal(xor.expression.includes("A·¬B"), true);
for (let value = 0; value < 4; value += 1) {
  const bits = value.toString(2).padStart(2, "0");
  assert.equal(evaluateImplicants(xor.implicants, bits), value === 1 || value === 2 ? 1 : 0);
}

for (let variableCount = 1; variableCount <= 5; variableCount += 1) {
  const variables = Array.from(
    { length: variableCount },
    (_, index) => `X${index}`,
  );
  const universe = 2 ** variableCount;
  for (let scenario = 0; scenario < 40; scenario += 1) {
    const minterms = [];
    const dontCares = [];
    for (let term = 0; term < universe; term += 1) {
      const selector = (term * 17 + scenario * 13 + variableCount) % 11;
      if (selector < 4) minterms.push(term);
      else if (selector === 4) dontCares.push(term);
    }
    const minimized = minimizeSop(minterms, dontCares, variables);
    for (let term = 0; term < universe; term += 1) {
      if (dontCares.includes(term)) continue;
      const bits = term.toString(2).padStart(variableCount, "0");
      assert.equal(
        evaluateImplicants(minimized.implicants, bits),
        minterms.includes(term) ? 1 : 0,
      );
    }
  }
}

const states = ["IDLE", "LOAD", "RUN", "DONE"];
const inputs = ["start", "zero"];
const outputs = ["load", "shift", "done"];
const encodings = defaultEncodings(states);
const rows = [];

for (const presentState of states) {
  for (let start = 0; start <= 1; start += 1) {
    for (let zero = 0; zero <= 1; zero += 1) {
      let nextState;
      if (presentState === "IDLE") nextState = start ? "LOAD" : "IDLE";
      else if (presentState === "LOAD") nextState = "RUN";
      else if (presentState === "RUN") nextState = zero ? "DONE" : "RUN";
      else nextState = "IDLE";
      rows.push({
        presentState,
        inputs: { start, zero },
        nextState,
        outputs: {
          load: presentState === "LOAD" ? 1 : 0,
          shift: presentState === "RUN" ? 1 : 0,
          done: presentState === "DONE" ? 1 : 0,
        },
      });
    }
  }
}

const machine = { states, inputs, outputs, encodings, rows };
const derivation = deriveDffEquations(machine);
assert.equal(derivation.ok, true);
assert.equal(derivation.functions.length, 5);
const verification = verifyDerivedMachine(machine, derivation);
assert.equal(verification.ok, true);
assert.equal(verification.failures.length, 0);

console.log("FSM core: minimization and exhaustive equation verification passed.");
