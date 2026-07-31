export function signedRange(width) {
  return { minimum: -(2 ** (width - 1)), maximum: 2 ** (width - 1) - 1 };
}

export function bitsForPattern(pattern, width) {
  const modulus = 2 ** width;
  const normalized = ((pattern % modulus) + modulus) % modulus;
  return normalized.toString(2).padStart(width, "0");
}

export function signedToPattern(value, width) {
  return bitsForPattern(value, width);
}

export function patternToSigned(pattern, width) {
  const modulus = 2 ** width;
  const unsigned = typeof pattern === "string" ? Number.parseInt(pattern, 2) : pattern;
  return unsigned >= modulus / 2 ? unsigned - modulus : unsigned;
}

export function parseFixedBits(text, width) {
  const bits = String(text).replaceAll(" ", "").replaceAll("_", "").trim();
  if (!/^[01]+$/.test(bits)) {
    return { ok: false, error: "Enter only binary digits." };
  }
  if (bits.length !== width) {
    return { ok: false, error: `Enter exactly ${width} bits, including leading zeros.` };
  }
  return { ok: true, bits, pattern: Number.parseInt(bits, 2) };
}

export function parseSignedDecimal(text, width) {
  const cleaned = String(text).trim();
  if (!/^-?\d+$/.test(cleaned)) {
    return { ok: false, error: "Enter a signed decimal integer." };
  }
  const value = Number(cleaned);
  const { minimum, maximum } = signedRange(width);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    return {
      ok: false,
      error: `${cleaned} does not fit in ${width}-bit two’s-complement form (${minimum} through ${maximum}).`,
    };
  }
  return { ok: true, value };
}

export function createTwosProblem(a, b, operation, width) {
  if (operation !== "add" && operation !== "subtract") {
    throw new Error("Operation must be add or subtract.");
  }
  const modulus = 2 ** width;
  const { minimum, maximum } = signedRange(width);
  const aBits = signedToPattern(a, width);
  const bBits = signedToPattern(b, width);
  const invertedBBits = [...bBits]
    .map((bit) => (bit === "0" ? "1" : "0"))
    .join("");
  const effectiveBBits =
    operation === "subtract"
      ? bitsForPattern(Number.parseInt(invertedBBits, 2) + 1, width)
      : bBits;
  const mathematicalResult = operation === "add" ? a + b : a - b;
  const fits = mathematicalResult >= minimum && mathematicalResult <= maximum;
  const patternSum = Number.parseInt(aBits, 2) + Number.parseInt(effectiveBBits, 2);
  const storedPattern = patternSum % modulus;
  const storedBits = bitsForPattern(storedPattern, width);
  const carryOut = patternSum >= modulus ? 1 : 0;
  const storedSigned = patternToSigned(storedPattern, width);
  const signA = aBits[0];
  const signB = bBits[0];
  const signResult = storedBits[0];
  const overflowBySigns =
    operation === "add"
      ? signA === signB && signResult !== signA
      : signA !== signB && signResult !== signA;

  return {
    width,
    a,
    b,
    operation,
    symbol: operation === "add" ? "+" : "−",
    range: { minimum, maximum },
    aBits,
    bBits,
    invertedBBits,
    effectiveBBits,
    mathematicalResult,
    fits,
    storedBits,
    storedSigned,
    carryOut,
    overflow: !fits,
    overflowBySigns,
  };
}
