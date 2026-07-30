export function bitsNeeded(stateCount) {
  return Math.max(1, Math.ceil(Math.log2(Math.max(1, stateCount))));
}

export function binaryEncoding(index, width) {
  return index.toString(2).padStart(width, "0");
}

export function defaultEncodings(states) {
  const width = bitsNeeded(states.length);
  return Object.fromEntries(
    states.map((state, index) => [state, binaryEncoding(index, width)]),
  );
}

export function inputCombinations(inputCount) {
  const count = 2 ** inputCount;
  return Array.from({ length: count }, (_, value) =>
    binaryEncoding(value, inputCount),
  );
}

export function createTransitionRows(states, inputs, outputs) {
  const combinations = inputCombinations(inputs.length);
  return states.flatMap((presentState) =>
    combinations.map((inputBits) => ({
      presentState,
      inputs: Object.fromEntries(
        inputs.map((name, index) => [name, Number(inputBits[index])]),
      ),
      nextState: "",
      outputs: Object.fromEntries(outputs.map((name) => [name, 0])),
    })),
  );
}

export function validateMachine({ states, inputs, outputs, encodings, rows }) {
  const errors = [];
  const width = bitsNeeded(states.length);
  const stateSet = new Set(states);
  const encodingSet = new Set();

  if (states.length < 2) errors.push("Define at least two states.");
  if (new Set(states).size !== states.length) errors.push("State names must be unique.");
  if (new Set(inputs).size !== inputs.length) errors.push("Input names must be unique.");
  if (new Set(outputs).size !== outputs.length) errors.push("Output names must be unique.");

  for (const state of states) {
    const code = encodings[state];
    if (!new RegExp(`^[01]{${width}}$`).test(code ?? "")) {
      errors.push(`${state} needs a ${width}-bit binary encoding.`);
    } else if (encodingSet.has(code)) {
      errors.push(`Encoding ${code} is assigned more than once.`);
    } else {
      encodingSet.add(code);
    }
  }

  const expectedKeys = new Set();
  for (const state of states) {
    for (const combination of inputCombinations(inputs.length)) {
      expectedKeys.add(`${state}|${combination}`);
    }
  }

  const seenKeys = new Set();
  rows.forEach((row, index) => {
    const inputBits = inputs.map((name) => row.inputs[name]).join("");
    const key = `${row.presentState}|${inputBits}`;
    if (!stateSet.has(row.presentState)) {
      errors.push(`Row ${index + 1} uses unknown present state ${row.presentState}.`);
    }
    if (seenKeys.has(key)) errors.push(`Transition ${key} appears more than once.`);
    seenKeys.add(key);
    if (!stateSet.has(row.nextState)) {
      errors.push(`Row ${index + 1} needs a valid next state.`);
    }
    for (const input of inputs) {
      if (![0, 1].includes(Number(row.inputs[input]))) {
        errors.push(`Row ${index + 1} input ${input} must be 0 or 1.`);
      }
    }
    for (const output of outputs) {
      if (![0, 1].includes(Number(row.outputs[output]))) {
        errors.push(`Row ${index + 1} output ${output} must be 0 or 1.`);
      }
    }
  });

  for (const key of expectedKeys) {
    if (!seenKeys.has(key)) errors.push(`Missing transition ${key}.`);
  }

  return { ok: errors.length === 0, errors, width };
}

function combinePatterns(a, b) {
  let differences = 0;
  let combined = "";
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] === b[index]) {
      combined += a[index];
    } else if (a[index] !== "-" && b[index] !== "-") {
      differences += 1;
      combined += "-";
    } else {
      return null;
    }
  }
  return differences === 1 ? combined : null;
}

function uniqueImplicants(implicants) {
  const byPattern = new Map();
  for (const implicant of implicants) {
    if (!byPattern.has(implicant.pattern)) {
      byPattern.set(implicant.pattern, {
        pattern: implicant.pattern,
        terms: new Set(implicant.terms),
      });
    } else {
      const target = byPattern.get(implicant.pattern);
      for (const term of implicant.terms) target.terms.add(term);
    }
  }
  return [...byPattern.values()];
}

function primeImplicants(minterms, dontCares, variableCount) {
  let current = uniqueImplicants(
    [...new Set([...minterms, ...dontCares])].map((term) => ({
      pattern: binaryEncoding(term, variableCount),
      terms: new Set([term]),
    })),
  );
  const primes = [];

  while (current.length) {
    const used = new Set();
    const next = [];
    for (let left = 0; left < current.length; left += 1) {
      for (let right = left + 1; right < current.length; right += 1) {
        const pattern = combinePatterns(
          current[left].pattern,
          current[right].pattern,
        );
        if (pattern !== null) {
          used.add(left);
          used.add(right);
          next.push({
            pattern,
            terms: new Set([
              ...current[left].terms,
              ...current[right].terms,
            ]),
          });
        }
      }
    }
    current.forEach((implicant, index) => {
      if (!used.has(index)) primes.push(implicant);
    });
    current = uniqueImplicants(next);
  }

  return uniqueImplicants(primes).filter((implicant) =>
    [...implicant.terms].some((term) => minterms.includes(term)),
  );
}

function patternCovers(pattern, minterm, variableCount) {
  const bits = binaryEncoding(minterm, variableCount);
  return [...pattern].every(
    (bit, index) => bit === "-" || bit === bits[index],
  );
}

function literalCount(pattern) {
  return [...pattern].filter((bit) => bit !== "-").length;
}

function chooseCover(primes, minterms, variableCount) {
  const uncovered = new Set(minterms);
  const selected = new Set();

  for (const minterm of minterms) {
    const covering = primes
      .map((prime, index) => ({ prime, index }))
      .filter(({ prime }) => patternCovers(prime.pattern, minterm, variableCount));
    if (covering.length === 1) selected.add(covering[0].index);
  }

  for (const index of selected) {
    for (const minterm of [...uncovered]) {
      if (patternCovers(primes[index].pattern, minterm, variableCount)) {
        uncovered.delete(minterm);
      }
    }
  }

  if (uncovered.size === 0) {
    return [...selected].map((index) => primes[index]);
  }

  const candidates = primes
    .map((prime, index) => ({ prime, index }))
    .filter(({ index }) => !selected.has(index))
    .filter(({ prime }) =>
      [...uncovered].some((term) =>
        patternCovers(prime.pattern, term, variableCount),
      ),
    );

  let best = null;
  function search(start, chosen, remaining) {
    if (remaining.size === 0) {
      const score = [
        chosen.length,
        chosen.reduce(
          (total, index) => total + literalCount(primes[index].pattern),
          0,
        ),
      ];
      if (
        best === null ||
        score[0] < best.score[0] ||
        (score[0] === best.score[0] && score[1] < best.score[1])
      ) {
        best = { indices: [...chosen], score };
      }
      return;
    }
    if (best && chosen.length >= best.score[0]) return;

    const target = remaining.values().next().value;
    for (let offset = start; offset < candidates.length; offset += 1) {
      const { prime, index } = candidates[offset];
      if (!patternCovers(prime.pattern, target, variableCount)) continue;
      const nextRemaining = new Set(
        [...remaining].filter(
          (term) => !patternCovers(prime.pattern, term, variableCount),
        ),
      );
      search(offset + 1, [...chosen, index], nextRemaining);
    }
  }

  search(0, [], uncovered);
  const extra = best ? best.indices : [];
  return [...new Set([...selected, ...extra])].map((index) => primes[index]);
}

export function minimizeSop(minterms, dontCares, variables) {
  const variableCount = variables.length;
  const universeSize = 2 ** variableCount;
  const onSet = [...new Set(minterms)].sort((a, b) => a - b);
  const dcSet = [...new Set(dontCares)]
    .filter((term) => !onSet.includes(term))
    .sort((a, b) => a - b);

  if (onSet.length === 0) {
    return { expression: "0", implicants: [], minterms: onSet };
  }
  if (onSet.length + dcSet.length === universeSize) {
    return {
      expression: "1",
      implicants: [{ pattern: "-".repeat(variableCount), terms: new Set(onSet) }],
      minterms: onSet,
    };
  }

  const primes = primeImplicants(onSet, dcSet, variableCount);
  const cover = chooseCover(primes, onSet, variableCount);
  const terms = cover.map((implicant) => {
    const literals = [...implicant.pattern]
      .map((bit, index) => {
        if (bit === "-") return "";
        return bit === "1" ? variables[index] : `¬${variables[index]}`;
      })
      .filter(Boolean);
    return literals.length ? literals.join("·") : "1";
  });

  return {
    expression: terms.join(" + "),
    implicants: cover,
    minterms: onSet,
  };
}

function rowIndex(row, inputs, encodings) {
  const stateBits = encodings[row.presentState];
  const inputBits = inputs.map((name) => row.inputs[name]).join("");
  return Number.parseInt(`${stateBits}${inputBits}`, 2);
}

export function deriveDffEquations({
  states,
  inputs,
  outputs,
  encodings,
  rows,
}) {
  const validation = validateMachine({
    states,
    inputs,
    outputs,
    encodings,
    rows,
  });
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const stateWidth = validation.width;
  const stateVariables = Array.from(
    { length: stateWidth },
    (_, index) => `Q${stateWidth - 1 - index}`,
  );
  const variables = [...stateVariables, ...inputs];
  const unusedCodes = [];
  for (let value = 0; value < 2 ** stateWidth; value += 1) {
    const code = binaryEncoding(value, stateWidth);
    if (!Object.values(encodings).includes(code)) unusedCodes.push(code);
  }
  const dontCares = unusedCodes.flatMap((stateCode) =>
    inputCombinations(inputs.length).map((inputBits) =>
      Number.parseInt(`${stateCode}${inputBits}`, 2),
    ),
  );

  const functions = [];
  for (let bitIndex = 0; bitIndex < stateWidth; bitIndex += 1) {
    const name = `D${stateWidth - 1 - bitIndex}`;
    const minterms = rows
      .filter((row) => encodings[row.nextState][bitIndex] === "1")
      .map((row) => rowIndex(row, inputs, encodings));
    functions.push({
      name,
      kind: "next-state",
      ...minimizeSop(minterms, dontCares, variables),
    });
  }

  for (const output of outputs) {
    const minterms = rows
      .filter((row) => Number(row.outputs[output]) === 1)
      .map((row) => rowIndex(row, inputs, encodings));
    functions.push({
      name: output,
      kind: "output",
      ...minimizeSop(minterms, dontCares, variables),
    });
  }

  return {
    ok: true,
    stateWidth,
    variables,
    dontCares,
    functions,
  };
}

export function evaluateImplicants(implicants, assignmentBits) {
  if (implicants.length === 0) return 0;
  return implicants.some((implicant) =>
    [...implicant.pattern].every(
      (bit, index) => bit === "-" || bit === assignmentBits[index],
    ),
  )
    ? 1
    : 0;
}

export function verifyDerivedMachine(machine, derivation) {
  const failures = [];
  for (const row of machine.rows) {
    const assignment =
      machine.encodings[row.presentState] +
      machine.inputs.map((name) => row.inputs[name]).join("");
    for (const fn of derivation.functions) {
      const actual = evaluateImplicants(fn.implicants, assignment);
      let expected;
      if (fn.kind === "next-state") {
        const bit = Number(fn.name.slice(1));
        expected =
          machine.encodings[row.nextState][derivation.stateWidth - 1 - bit] === "1"
            ? 1
            : 0;
      } else {
        expected = Number(row.outputs[fn.name]);
      }
      if (actual !== expected) {
        failures.push({
          presentState: row.presentState,
          inputs: Object.fromEntries(
            machine.inputs.map((name) => [name, row.inputs[name]]),
          ),
          functionName: fn.name,
          expected,
          actual,
        });
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

