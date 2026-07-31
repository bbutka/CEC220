export function bitsForUnsigned(value, width) {
  return Number(value).toString(2).padStart(width, "0");
}

export function parseBorrowOperand(text, base, width) {
  const cleaned = String(text).trim().replaceAll("_", "").replaceAll(" ", "");
  if (!cleaned) return { ok: false, error: "Enter a value." };
  const digits =
    base === 2 && /^0b/i.test(cleaned)
      ? cleaned.slice(2)
      : base === 16 && /^0x/i.test(cleaned)
        ? cleaned.slice(2)
        : cleaned;
  const valid = base === 2 ? /^[01]+$/ : base === 10 ? /^\d+$/ : /^[0-9a-f]+$/i;
  if (!valid.test(digits)) {
    return { ok: false, error: `That is not a valid base-${base} value.` };
  }
  const value = Number.parseInt(digits, base);
  const maximum = 2 ** width - 1;
  if (!Number.isSafeInteger(value) || value > maximum) {
    return {
      ok: false,
      error: `${cleaned} does not fit in ${width} unsigned bits (0 through ${maximum}).`,
    };
  }
  return { ok: true, value, bits: bitsForUnsigned(value, width) };
}

export function createBorrowState(a, b, width) {
  return {
    width,
    a,
    b,
    originalA: bitsForUnsigned(a, width),
    bBits: [...bitsForUnsigned(b, width)].map(Number),
    aDigits: [...bitsForUnsigned(a, width)].map(Number),
    result: Array(width).fill(null),
    cursor: width - 1,
    loans: [],
  };
}

export function bitPosition(state, index) {
  return state.width - 1 - index;
}

export function needsBorrow(state) {
  if (state.cursor < 0) return false;
  return state.aDigits[state.cursor] < state.bBits[state.cursor];
}

export function correctBorrowSource(state) {
  if (!needsBorrow(state)) return null;
  for (let index = state.cursor - 1; index >= 0; index -= 1) {
    if (state.aDigits[index] > 0) return index;
  }
  return null;
}

function cloneState(state) {
  return {
    ...state,
    aDigits: [...state.aDigits],
    result: [...state.result],
    loans: state.loans.map((loan) => ({ ...loan })),
  };
}

export function chooseBorrowSource(state, sourceIndex) {
  if (!needsBorrow(state)) {
    return { ok: false, state, error: "This column does not need a borrow." };
  }
  if (sourceIndex >= state.cursor) {
    return {
      ok: false,
      state,
      error: "The source must be a higher bit to the left of the active column.",
    };
  }

  const expected = correctBorrowSource(state);
  if (expected === null) {
    return {
      ok: false,
      state,
      error: "No bit in A can supply this loan; the unsigned result would be negative.",
    };
  }
  if (sourceIndex !== expected) {
    const sourcePosition = bitPosition(state, sourceIndex);
    if (state.aDigits[sourceIndex] === 0) {
      return {
        ok: false,
        state,
        error: `Bit ${sourcePosition} contains 0, so it cannot supply the loan.`,
      };
    }
    return {
      ok: false,
      state,
      error: `Bit ${bitPosition(state, expected)} is the nearest higher bit that can supply the loan.`,
    };
  }

  const next = cloneState(state);
  const before = next.aDigits.join("");
  next.aDigits[sourceIndex] -= 1;
  for (let index = sourceIndex + 1; index < next.cursor; index += 1) {
    next.aDigits[index] = 1;
  }
  next.aDigits[next.cursor] += 2;
  const loan = {
    targetIndex: next.cursor,
    targetPosition: bitPosition(next, next.cursor),
    sourceIndex,
    sourcePosition: bitPosition(next, sourceIndex),
    before,
    after: next.aDigits.join(""),
  };
  next.loans.push(loan);
  return { ok: true, state: next, loan };
}

export function enterResultDigit(state, digit) {
  if (state.cursor < 0) return { ok: false, state, error: "The problem is complete." };
  if (needsBorrow(state)) {
    return { ok: false, state, error: "Choose the source of the borrow first." };
  }
  const numeric = Number(digit);
  const expected = state.aDigits[state.cursor] - state.bBits[state.cursor];
  if (numeric !== expected) {
    return {
      ok: false,
      state,
      error: `At bit ${bitPosition(state, state.cursor)}, ${state.aDigits[state.cursor]} − ${state.bBits[state.cursor]} is not ${digit}.`,
    };
  }
  const next = cloneState(state);
  next.result[next.cursor] = numeric;
  next.cursor -= 1;
  return { ok: true, state: next, expected };
}

export function borrowProfile(a, b, width) {
  let state = createBorrowState(a, b, width);
  while (state.cursor >= 0) {
    if (needsBorrow(state)) {
      const source = correctBorrowSource(state);
      if (source === null) {
        return { ok: false, error: "Unsigned subtraction requires A ≥ B." };
      }
      state = chooseBorrowSource(state, source).state;
    }
    state = enterResultDigit(
      state,
      state.aDigits[state.cursor] - state.bBits[state.cursor],
    ).state;
  }
  return {
    ok: true,
    loans: state.loans,
    transformedA: state.aDigits.join(""),
    resultBits: state.result.join(""),
    result: a - b,
  };
}
