import assert from "node:assert/strict";
import {
  analyzeOperation,
  bitsFor,
  buildAnalysis,
  normalizeRaw,
  parseOperand,
  rangeFor,
  toSigned,
  twosComplementDetails,
} from "../shared/arithmetic-core.js";

function testNamedCases() {
  const tenMinusFifteen = buildAnalysis({
    aText: "10",
    bText: "15",
    base: 10,
    width: 5,
    interpretation: "signed",
    operation: "subtract",
    subtractionMethod: "twos",
  });
  assert.equal(tenMinusFifteen.ok, true);
  assert.equal(tenMinusFifteen.mathematicalResult, -5);
  assert.equal(tenMinusFifteen.resultBits, "11011");
  assert.equal(tenMinusFifteen.storedSigned, -5);
  assert.equal(tenMinusFifteen.signedOverflow, false);
  assert.equal(tenMinusFifteen.borrowOut, true);

  const sevenPlusOne = analyzeOperation({
    rawA: 7,
    rawB: 1,
    width: 4,
    interpretation: "signed",
    operation: "add",
  });
  assert.equal(sevenPlusOne.mathematicalResult, 8);
  assert.equal(sevenPlusOne.resultBits, "1000");
  assert.equal(sevenPlusOne.storedSigned, -8);
  assert.equal(sevenPlusOne.signedOverflow, true);

  const zeroMinusOne = analyzeOperation({
    rawA: 0,
    rawB: 1,
    width: 4,
    interpretation: "unsigned",
    operation: "subtract",
    subtractionMethod: "borrow",
  });
  assert.equal(zeroMinusOne.rawResult, 15);
  assert.equal(zeroMinusOne.borrowOut, true);
  assert.equal(zeroMinusOne.unsignedUnderflow, true);

  const minimumNegation = twosComplementDetails(8, 4);
  assert.equal(minimumNegation.negated, 8);
  assert.equal(bitsFor(minimumNegation.negated, 4), "1000");

  const pattern = parseOperand("1010", 2, 4, "signed");
  assert.equal(pattern.ok, true);
  assert.equal(pattern.mathematical, -6);

  const invalidSignedDecimal = parseOperand("10", 10, 4, "signed");
  assert.equal(invalidSignedDecimal.ok, false);
}

function exhaustiveSmallWidths() {
  for (let width = 2; width <= 8; width += 1) {
    const mod = 2 ** width;
    for (const interpretation of ["signed", "unsigned"]) {
      const allowed = rangeFor(width, interpretation);
      for (let rawA = 0; rawA < mod; rawA += 1) {
        for (let rawB = 0; rawB < mod; rawB += 1) {
          for (const operation of ["add", "subtract"]) {
            const result = analyzeOperation({
              rawA,
              rawB,
              width,
              interpretation,
              operation,
              subtractionMethod: operation === "subtract" ? "borrow" : "borrow",
            });
            const aValue = interpretation === "signed" ? toSigned(rawA, width) : rawA;
            const bValue = interpretation === "signed" ? toSigned(rawB, width) : rawB;
            const mathematical =
              operation === "add" ? aValue + bValue : aValue - bValue;

            assert.equal(result.mathematicalResult, mathematical);
            assert.equal(result.rawResult, normalizeRaw(mathematical, width));
            assert.equal(
              result.fits,
              mathematical >= allowed.min && mathematical <= allowed.max,
            );

            const reconstructed = result.columns.reduce(
              (value, column) => value + column.resultBit * (2 ** column.position),
              0,
            );
            assert.equal(reconstructed, result.rawResult);

            if (operation === "subtract") {
              assert.equal(result.borrowOut, rawA < rawB);
              assert.equal(result.carryOut, !result.borrowOut);
            }
          }
        }
      }
    }
  }
}

testNamedCases();
exhaustiveSmallWidths();
console.log("Arithmetic core: named cases and exhaustive widths 2–8 passed.");
