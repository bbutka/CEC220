export function modulus(width) {
  return 2 ** width;
}

export function maskFor(width) {
  return modulus(width) - 1;
}

export function normalizeRaw(value, width) {
  const mod = modulus(width);
  return ((value % mod) + mod) % mod;
}

export function toSigned(raw, width) {
  const normalized = normalizeRaw(raw, width);
  const signWeight = 2 ** (width - 1);
  return normalized >= signWeight ? normalized - modulus(width) : normalized;
}

export function bitsFor(raw, width) {
  return normalizeRaw(raw, width).toString(2).padStart(width, "0");
}

export function hexFor(raw, width) {
  return normalizeRaw(raw, width)
    .toString(16)
    .toUpperCase()
    .padStart(Math.ceil(width / 4), "0");
}

export function rangeFor(width, interpretation) {
  if (interpretation === "signed") {
    return {
      min: -(2 ** (width - 1)),
      max: 2 ** (width - 1) - 1,
    };
  }
  return { min: 0, max: maskFor(width) };
}

function cleanDigits(text) {
  return String(text).trim().replaceAll("_", "").replaceAll(" ", "");
}

export function parseOperand(text, base, width, interpretation) {
  const cleaned = cleanDigits(text);
  if (!cleaned) {
    return { ok: false, error: "Enter a value." };
  }

  let digits = cleaned;
  let sign = 1;
  if (digits.startsWith("-")) {
    sign = -1;
    digits = digits.slice(1);
  } else if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }

  if (base === 2 && /^0b/i.test(digits)) digits = digits.slice(2);
  if (base === 16 && /^0x/i.test(digits)) digits = digits.slice(2);

  const valid =
    base === 2 ? /^[01]+$/ :
    base === 10 ? /^\d+$/ :
    /^[0-9a-f]+$/i;

  if (!valid.test(digits)) {
    return { ok: false, error: `That is not a valid base-${base} value.` };
  }

  const magnitude = Number.parseInt(digits, base);
  if (!Number.isSafeInteger(magnitude)) {
    return { ok: false, error: "The value is too large." };
  }

  const typedValue = sign * magnitude;
  const maxRaw = maskFor(width);

  // Decimal input represents a mathematical value. Binary and hexadecimal
  // without a sign represent the literal bits in the register.
  if (base === 10 || sign < 0) {
    const allowed = rangeFor(width, interpretation);
    if (typedValue < allowed.min || typedValue > allowed.max) {
      return {
        ok: false,
        error: `${typedValue} does not fit in ${width}-bit ${interpretation} form (${allowed.min} through ${allowed.max}).`,
      };
    }
    const raw = normalizeRaw(typedValue, width);
    return {
      ok: true,
      raw,
      mathematical: interpretation === "signed" ? toSigned(raw, width) : raw,
    };
  }

  if (magnitude > maxRaw) {
    return {
      ok: false,
      error: `The bit pattern needs more than ${width} bits.`,
    };
  }

  return {
    ok: true,
    raw: magnitude,
    mathematical: interpretation === "signed" ? toSigned(magnitude, width) : magnitude,
  };
}

export function additionColumns(rawA, rawB, width, initialCarry = 0) {
  const columns = [];
  let carry = initialCarry;

  for (let position = 0; position < width; position += 1) {
    const aBit = (rawA >> position) & 1;
    const bBit = (rawB >> position) & 1;
    const carryIn = carry;
    const total = aBit + bBit + carryIn;
    const resultBit = total & 1;
    carry = total >= 2 ? 1 : 0;
    columns.push({
      position,
      aBit,
      bBit,
      carryIn,
      resultBit,
      carryOut: carry,
    });
  }

  return columns;
}

export function subtractionColumns(rawA, rawB, width) {
  const columns = [];
  let borrow = 0;

  for (let position = 0; position < width; position += 1) {
    const aBit = (rawA >> position) & 1;
    const bBit = (rawB >> position) & 1;
    const borrowIn = borrow;
    let difference = aBit - bBit - borrowIn;
    if (difference < 0) {
      difference += 2;
      borrow = 1;
    } else {
      borrow = 0;
    }
    columns.push({
      position,
      aBit,
      bBit,
      borrowIn,
      resultBit: difference,
      borrowOut: borrow,
    });
  }

  return columns;
}

export function twosComplementDetails(rawB, width) {
  const mask = maskFor(width);
  const inverted = (~rawB) & mask;
  const negated = normalizeRaw(inverted + 1, width);
  return {
    original: rawB,
    inverted,
    negated,
    originalBits: bitsFor(rawB, width),
    invertedBits: bitsFor(inverted, width),
    negatedBits: bitsFor(negated, width),
  };
}

export function analyzeOperation({
  rawA,
  rawB,
  width,
  interpretation,
  operation,
  subtractionMethod = "borrow",
}) {
  const mod = modulus(width);
  const aValue = interpretation === "signed" ? toSigned(rawA, width) : rawA;
  const bValue = interpretation === "signed" ? toSigned(rawB, width) : rawB;
  const mathematicalResult =
    operation === "add" ? aValue + bValue : aValue - bValue;
  const rawResult = normalizeRaw(mathematicalResult, width);
  const storedSigned = toSigned(rawResult, width);
  const storedUnsigned = rawResult;
  const range = rangeFor(width, interpretation);
  const fits = mathematicalResult >= range.min && mathematicalResult <= range.max;

  const aSign = (rawA >> (width - 1)) & 1;
  const bSign = (rawB >> (width - 1)) & 1;
  const resultSign = (rawResult >> (width - 1)) & 1;

  const signedOverflow =
    operation === "add"
      ? aSign === bSign && resultSign !== aSign
      : aSign !== bSign && resultSign !== aSign;

  const carryOut = rawA + rawB >= mod;
  const borrowOut = rawA < rawB;
  const twos = twosComplementDetails(rawB, width);
  const twosCarryOut = rawA + twos.inverted + 1 >= mod;

  let columns;
  if (operation === "add") {
    columns = additionColumns(rawA, rawB, width);
  } else if (subtractionMethod === "twos") {
    // Real subtractors use A + ~B + 1. The +1 enters as the least-significant
    // carry so the final carry-out retains its usual "no borrow" meaning.
    columns = additionColumns(rawA, twos.inverted, width, 1);
  } else {
    columns = subtractionColumns(rawA, rawB, width);
  }

  return {
    width,
    interpretation,
    operation,
    subtractionMethod,
    rawA,
    rawB,
    aValue,
    bValue,
    mathematicalResult,
    rawResult,
    resultBits: bitsFor(rawResult, width),
    storedSigned,
    storedUnsigned,
    fits,
    carryOut: operation === "add" ? carryOut : twosCarryOut,
    borrowOut: operation === "subtract" ? borrowOut : false,
    unsignedOverflow: operation === "add" && carryOut,
    unsignedUnderflow: operation === "subtract" && borrowOut,
    signedOverflow,
    columns,
    twos,
  };
}

export function buildAnalysis({
  aText,
  bText,
  base,
  width,
  interpretation,
  operation,
  subtractionMethod = "borrow",
}) {
  const a = parseOperand(aText, base, width, interpretation);
  const b = parseOperand(bText, base, width, interpretation);
  const errors = [];
  if (!a.ok) errors.push(`A: ${a.error}`);
  if (!b.ok) errors.push(`B: ${b.error}`);
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    ...analyzeOperation({
      rawA: a.raw,
      rawB: b.raw,
      width,
      interpretation,
      operation,
      subtractionMethod,
    }),
  };
}

export function representation(raw, width) {
  return {
    bits: bitsFor(raw, width),
    hex: `0x${hexFor(raw, width)}`,
    unsigned: normalizeRaw(raw, width),
    signed: toSigned(raw, width),
  };
}
