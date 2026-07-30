import { bitsFor, maskFor } from "./arithmetic-core.js";

export function shiftAddTrace(multiplicand, multiplier, width) {
  const operandMask = maskFor(width);
  const productMask = maskFor(width * 2);
  const m = multiplicand & operandMask;
  const q = multiplier & operandMask;
  let product = 0;
  let shiftedM = m;
  let remainingQ = q;
  const steps = [];

  for (let cycle = 0; cycle < width; cycle += 1) {
    const before = { product, shiftedM, remainingQ };
    const testedBit = remainingQ & 1;
    const action = testedBit ? "add" : "hold";
    const afterAdd = testedBit
      ? (product + shiftedM) & productMask
      : product;
    product = afterAdd;
    shiftedM = (shiftedM << 1) & productMask;
    remainingQ >>= 1;
    const after = { product, shiftedM, remainingQ };
    steps.push({
      cycle,
      testedBit,
      action,
      before,
      afterAdd,
      after,
      invariant: product + shiftedM * remainingQ,
    });
  }

  return {
    kind: "multiply",
    width,
    multiplicand: m,
    multiplier: q,
    steps,
    result: product,
    resultBits: bitsFor(product, width * 2),
  };
}

export function nonRestoringDivisionTrace(dividend, divisor, width) {
  const mask = maskFor(width);
  const qInitial = dividend & mask;
  const m = divisor & mask;
  if (m === 0) {
    return { ok: false, error: "Division by zero is undefined." };
  }

  let a = 0;
  let q = qInitial;
  const steps = [];

  for (let cycle = 0; cycle < width; cycle += 1) {
    const before = { a, q };
    const signBefore = a >= 0 ? "nonnegative" : "negative";
    const qMsb = (q >> (width - 1)) & 1;
    const shiftedA = a * 2 + qMsb;
    const shiftedQ = (q << 1) & mask;
    const action = a >= 0 ? "subtract" : "add";
    a = action === "subtract" ? shiftedA - m : shiftedA + m;
    const quotientBit = a >= 0 ? 1 : 0;
    q = shiftedQ | quotientBit;
    steps.push({
      cycle,
      before,
      signBefore,
      qMsb,
      shiftedA,
      shiftedQ,
      action,
      quotientBit,
      after: { a, q },
    });
  }

  const correctionNeeded = a < 0;
  const beforeCorrection = a;
  if (correctionNeeded) a += m;

  return {
    ok: true,
    kind: "divide",
    width,
    dividend: qInitial,
    divisor: m,
    steps,
    correctionNeeded,
    beforeCorrection,
    quotient: q,
    remainder: a,
    quotientBits: bitsFor(q, width),
    remainderBits: bitsFor(a, width + 1),
  };
}

