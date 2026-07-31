import { bitsForUnsigned, parseBorrowOperand } from "./borrowing-core.js";

export const parseAdditionOperand = parseBorrowOperand;

export function createAdditionState(a, b, width) {
  const carryIn = Array(width).fill(null);
  carryIn[width - 1] = 0;
  return {
    width,
    a,
    b,
    aBits: [...bitsForUnsigned(a, width)].map(Number),
    bBits: [...bitsForUnsigned(b, width)].map(Number),
    carryIn,
    result: Array(width).fill(null),
    carryOut: Array(width).fill(null),
    cursor: width - 1,
  };
}

export function additionBitPosition(state, index) {
  return state.width - 1 - index;
}

export function expectedAdditionColumn(state) {
  if (state.cursor < 0) return null;
  const total =
    state.aBits[state.cursor] +
    state.bBits[state.cursor] +
    state.carryIn[state.cursor];
  return {
    total,
    resultBit: total % 2,
    carryOut: Math.floor(total / 2),
  };
}

function cloneState(state) {
  return {
    ...state,
    aBits: [...state.aBits],
    bBits: [...state.bBits],
    carryIn: [...state.carryIn],
    result: [...state.result],
    carryOut: [...state.carryOut],
  };
}

export function enterAdditionPart(state, part, digit) {
  if (state.cursor < 0) {
    return { ok: false, state, error: "The problem is complete." };
  }
  if (part !== "result" && part !== "carry") {
    return { ok: false, state, error: "Choose result bit or carry-out." };
  }
  const numeric = Number(digit);
  if (numeric !== 0 && numeric !== 1) {
    return { ok: false, state, error: "Enter one bit: 0 or 1." };
  }

  const expected = expectedAdditionColumn(state);
  const expectedDigit = part === "result" ? expected.resultBit : expected.carryOut;
  if (numeric !== expectedDigit) {
    return {
      ok: false,
      state,
      error: `The ${part === "result" ? "result bit" : "carry-out"} for bit ${additionBitPosition(state, state.cursor)} is not ${digit}.`,
    };
  }

  const next = cloneState(state);
  if (part === "result") next.result[next.cursor] = numeric;
  else next.carryOut[next.cursor] = numeric;

  const columnComplete =
    next.result[next.cursor] !== null && next.carryOut[next.cursor] !== null;
  if (columnComplete) {
    if (next.cursor > 0) {
      next.carryIn[next.cursor - 1] = next.carryOut[next.cursor];
      next.cursor -= 1;
    } else {
      next.cursor = -1;
    }
  }

  return { ok: true, state: next, expected, columnComplete };
}

export function additionProfile(a, b, width) {
  let state = createAdditionState(a, b, width);
  while (state.cursor >= 0) {
    const expected = expectedAdditionColumn(state);
    state = enterAdditionPart(state, "result", expected.resultBit).state;
    state = enterAdditionPart(state, "carry", expected.carryOut).state;
  }
  const finalCarry = state.carryOut[0];
  const storedBits = state.result.join("");
  return {
    result: a + b,
    storedBits,
    storedValue: Number.parseInt(storedBits, 2),
    finalCarry,
    fullBits: finalCarry === 1 ? `1${storedBits}` : storedBits,
    carryColumns: state.carryOut
      .map((carry, index) =>
        carry === 1 ? additionBitPosition(state, index) : null,
      )
      .filter((position) => position !== null),
    carryOut: state.carryOut,
  };
}
