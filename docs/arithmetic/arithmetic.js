import {
  bitsFor,
  buildAnalysis,
  rangeFor,
  representation,
  toSigned,
} from "../shared/arithmetic-core.js";

const byId = (id) => document.getElementById(id);
const all = (selector) => [...document.querySelectorAll(selector)];

const presets = {
  "unsigned-carry-chain": {
    width: 5,
    base: 10,
    interpretation: "unsigned",
    operation: "add",
    subtractionMethod: "borrow",
    a: "11",
    b: "6",
    calloutTitle: "Start with the mechanics students already use.",
    callout:
      "Add from the least-significant column. A column total of 2 or 3 writes one result bit and carries 1 into the next position—the same positional rule used for time and decimal arithmetic.",
  },
  "borrow-across-zeros": {
    width: 4,
    base: 10,
    interpretation: "unsigned",
    operation: "subtract",
    subtractionMethod: "borrow",
    a: "8",
    b: "1",
    calloutTitle: "A borrow can travel across several zero columns.",
    callout:
      "Regroup 1000₂ as 0 1 1 2 in column units. The temporary 2 means two units of bit 0—the same value as 10₂—so 2 − 1 writes the result bit 1.",
  },
  "unsigned-overflow": {
    width: 4,
    base: 10,
    interpretation: "unsigned",
    operation: "add",
    subtractionMethod: "borrow",
    a: "15",
    b: "1",
    calloutTitle: "The carry can require another bit.",
    callout:
      "The mathematical result is 10000₂. A four-bit register retains 0000 and reports carry-out, demonstrating why width belongs in every arithmetic problem.",
  },
  "ten-minus-fifteen": {
    width: 5,
    base: 10,
    interpretation: "signed",
    operation: "subtract",
    subtractionMethod: "twos",
    a: "10",
    b: "15",
    calloutTitle: "Knowing −5 is not the same as producing −5.",
    callout:
      "First compare magnitudes: 10 is smaller than 15, so the mathematical result is negative. Fixed-width hardware instead produces a bit pattern and flags; its interpretation supplies the meaning.",
  },
  "signed-overflow": {
    width: 4,
    base: 10,
    interpretation: "signed",
    operation: "add",
    subtractionMethod: "borrow",
    a: "7",
    b: "1",
    calloutTitle: "The bits are valid even when the signed answer is not.",
    callout:
      "Four signed bits can hold −8 through +7. The adder still produces 1000, but that pattern means −8. Overflow says not to trust it as the mathematical sum.",
  },
  "unsigned-underflow": {
    width: 4,
    base: 10,
    interpretation: "unsigned",
    operation: "subtract",
    subtractionMethod: "borrow",
    a: "0",
    b: "1",
    calloutTitle: "A register wraps; a flag preserves the warning.",
    callout:
      "Four unsigned bits cannot represent −1. The stored pattern wraps to 1111 while borrow-out and unsigned underflow report that the mathematical answer did not fit.",
  },
  "signed-minus-one": {
    width: 4,
    base: 10,
    interpretation: "signed",
    operation: "subtract",
    subtractionMethod: "twos",
    a: "0",
    b: "1",
    calloutTitle: "The mechanics stay the same; the interpretation changes.",
    callout:
      "Four-bit subtraction produces 1111. Lecture 1.4 treats that pattern as unsigned 15; Lecture 1.5 gives it the two’s-complement meaning −1.",
  },
  "negative-overflow": {
    width: 4,
    base: 10,
    interpretation: "signed",
    operation: "subtract",
    subtractionMethod: "twos",
    a: "-8",
    b: "1",
    calloutTitle: "Overflow can cross either signed boundary.",
    callout:
      "Four signed bits stop at −8. Subtracting one produces the pattern 0111, which looks positive; the signed-overflow flag identifies that contradiction.",
  },
  "hex-carry": {
    width: 8,
    base: 16,
    interpretation: "unsigned",
    operation: "add",
    subtractionMethod: "borrow",
    a: "AF",
    b: "3D",
    calloutTitle: "Hexadecimal is a compact view of the same adder.",
    callout:
      "Each hexadecimal digit names four bits. Work the binary carry chain first, then regroup the verified result into hexadecimal.",
  },
};

const modeText = {
  learn:
    "Learn mode coaches one decision at a time and provides progressive hints.",
  practice:
    "Practice mode generates a bounded problem. Solve the important steps before revealing anything.",
  verify:
    "Verify mode checks a complete solution and reports the first inconsistency.",
};

let current = null;
let currentMode = "learn";
let hintCounts = {
  representation: 0,
  prediction: 0,
  twos: 0,
  mechanics: 0,
  interpretation: 0,
};

function selectedRadio(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function setRadio(name, value) {
  const target = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (target) target.checked = true;
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function clearFeedback(id) {
  const target = byId(id);
  target.className = "feedback";
  target.textContent = "";
}

function setFeedback(id, type, message) {
  const target = byId(id);
  target.className = `feedback ${type}`;
  target.textContent = message;
}

function clearAnswerState() {
  const ids = [
    "predictionResult",
    "predictionFits",
    "resultBitsAnswer",
    "selectedValueAnswer",
    "carryAnswer",
    "borrowAnswer",
    "signedOverflowAnswer",
    "unsignedFlagAnswer",
  ];
  for (const id of ids) {
    const input = byId(id);
    input.value = "";
    input.classList.remove("invalid");
  }

  for (const id of [
    "representationFeedback",
    "predictionFeedback",
    "twosFeedback",
    "mechanicsFeedback",
    "interpretationFeedback",
  ]) {
    clearFeedback(id);
  }

  byId("resultBanner").classList.remove("visible");
  byId("predictionStage").hidden = true;
  byId("mechanicsStage").hidden = true;
  byId("interpretationStage").hidden = true;
  hintCounts = {
    representation: 0,
    prediction: 0,
    twos: 0,
    mechanics: 0,
    interpretation: 0,
  };
}

function applyPreset(name) {
  const preset = presets[name];
  if (!preset) return;

  byId("width").value = String(preset.width);
  byId("base").value = String(preset.base);
  byId("operandA").value = preset.a;
  byId("operandB").value = preset.b;
  setRadio("interpretation", preset.interpretation);
  setRadio("operation", preset.operation);
  setRadio("subtractionMethod", preset.subtractionMethod);

  all("[data-preset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === name);
  });
  byId("customProblem").classList.remove("active");
  byId("customSubtraction").classList.remove("active");
  byId("customEntryNote").hidden = true;
  byId("customSubtractionPanel").hidden = true;
  byId("representationPanel").hidden = false;

  const callout = byId("conceptCallout");
  callout.innerHTML = "";
  const title = document.createElement("strong");
  title.textContent = preset.calloutTitle;
  callout.append(title, document.createTextNode(preset.callout));
  updateSubtractionControls();
  loadProblem();
}

function startCustomProblem(subtraction = false) {
  all("[data-preset]").forEach((button) => button.classList.remove("active"));
  byId("customProblem").classList.toggle("active", !subtraction);
  byId("customSubtraction").classList.toggle("active", subtraction);
  byId("customEntryNote").hidden = subtraction;
  if (subtraction) {
    byId("width").value = "4";
    byId("base").value = "10";
    setRadio("interpretation", "unsigned");
    setRadio("operation", "subtract");
    setRadio("subtractionMethod", "borrow");
    updateSubtractionControls();
    byId("customOperandA").value = "";
    byId("customOperandB").value = "";
    byId("customSubtractionWidth").value = "4";
    byId("customSubtractionError").textContent = "";
    byId("customSubtractionError").classList.remove("visible");
    byId("customSubtractionPanel").hidden = false;
    byId("representationPanel").hidden = true;
    byId("predictionStage").hidden = true;
    byId("mechanicsStage").hidden = true;
    byId("interpretationStage").hidden = true;
    byId("resultBanner").classList.remove("visible");
  } else {
    byId("customSubtractionPanel").hidden = true;
    byId("representationPanel").hidden = false;
  }
  byId("operandA").value = "";
  byId("operandB").value = "";
  const error = byId("setupError");
  error.textContent = "";
  error.classList.remove("visible");

  const callout = byId("conceptCallout");
  callout.innerHTML = "";
  const title = document.createElement("strong");
  title.textContent = subtraction
    ? "Enter your own unsigned subtraction problem."
    : "Build and test your own arithmetic problem.";
  callout.append(
    title,
    document.createTextNode(
      subtraction
        ? "Use the large A − B editor in the main workspace. Enter any values—including 8 and 1—then start the subtraction."
        : "Choose the width, input base, interpretation, and operation. Enter A and B, then select “Load this problem.”",
    ),
  );
  (subtraction ? byId("customOperandA") : byId("operandA")).focus();
}

function loadCustomSubtraction() {
  byId("width").value = byId("customSubtractionWidth").value;
  byId("base").value = "10";
  setRadio("interpretation", "unsigned");
  setRadio("operation", "subtract");
  setRadio("subtractionMethod", "borrow");
  byId("operandA").value = byId("customOperandA").value;
  byId("operandB").value = byId("customOperandB").value;
  updateSubtractionControls();
  loadProblem();

  const error = byId("customSubtractionError");
  if (!current) {
    error.textContent =
      byId("setupError").textContent || "Enter valid values for A and B.";
    error.classList.add("visible");
    return;
  }

  error.textContent = "";
  error.classList.remove("visible");
  byId("customSubtractionPanel").hidden = true;
  byId("representationPanel").hidden = false;
  byId("representationPanel").scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function cancelCustomSubtraction() {
  byId("customSubtractionPanel").hidden = true;
  byId("representationPanel").hidden = false;
  byId("customSubtraction").classList.remove("active");
}

function randomRaw(width) {
  return Math.floor(Math.random() * (2 ** width));
}

function newPracticeProblem() {
  const widths = [4, 5, 6, 8];
  const width = widths[Math.floor(Math.random() * widths.length)];
  const scope = byId("practiceScope").value;
  const interpretation =
    scope === "mixed"
      ? Math.random() < 0.5
        ? "signed"
        : "unsigned"
      : scope;
  const operation = Math.random() < 0.5 ? "add" : "subtract";
  const subtractionMethod = Math.random() < 0.5 ? "borrow" : "twos";
  const rawA = randomRaw(width);
  const rawB = randomRaw(width);

  byId("width").value = String(width);
  byId("base").value = "10";
  setRadio("interpretation", interpretation);
  setRadio("operation", operation);
  setRadio("subtractionMethod", subtractionMethod);
  byId("operandA").value =
    interpretation === "signed" ? String(toSigned(rawA, width)) : String(rawA);
  byId("operandB").value =
    interpretation === "signed" ? String(toSigned(rawB, width)) : String(rawB);

  updateSubtractionControls();
  loadProblem();
}

function getSetup() {
  return {
    aText: byId("operandA").value,
    bText: byId("operandB").value,
    base: Number(byId("base").value),
    width: Number(byId("width").value),
    interpretation: selectedRadio("interpretation"),
    operation: selectedRadio("operation"),
    subtractionMethod: selectedRadio("subtractionMethod"),
  };
}

function updateSubtractionControls() {
  const subtracting = selectedRadio("operation") === "subtract";
  byId("subtractionMethodField").hidden = !subtracting;
}

function loadProblem() {
  const result = buildAnalysis(getSetup());
  const error = byId("setupError");
  if (!result.ok) {
    error.textContent = result.errors.join(" ");
    error.classList.add("visible");
    current = null;
    return;
  }

  error.textContent = "";
  error.classList.remove("visible");
  current = result;
  clearAnswerState();
  renderRepresentations();
  renderTwosPreparation();
  renderMechanics();
  updateInterpretationLabels();
}

function formatPrimaryValue(raw) {
  const rep = representation(raw, current.width);
  const selected =
    current.interpretation === "signed" ? rep.signed : rep.unsigned;
  return `${selected}`;
}

function renderRepresentations() {
  const range = rangeFor(current.width, current.interpretation);
  const operator = current.operation === "add" ? "+" : "−";
  byId("representationExpression").textContent =
    `${current.aValue} ${operator} ${current.bValue}`;
  byId("predictionExpression").textContent =
    `${current.aValue} ${operator} ${current.bValue} = ?`;
  byId("predictionResultLabel").textContent =
    `Your answer: ${current.aValue} ${operator} ${current.bValue} =`;
  byId("predictionFitsLabel").textContent =
    `Does it fit in ${current.width}-bit ${current.interpretation}?`;

  byId("operandRepresentations").innerHTML = `
    <div class="representation primary">
      <div class="label">Operand A · ${current.interpretation}</div>
      <div class="value">${formatPrimaryValue(current.rawA)}</div>
      <div class="microcopy" id="repAMeta">Convert A to ${current.width}-bit binary below.</div>
    </div>
    <div class="representation primary">
      <div class="label">Operand B · ${current.interpretation}</div>
      <div class="value">${formatPrimaryValue(current.rawB)}</div>
      <div class="microcopy" id="repBMeta">Convert B to ${current.width}-bit binary below.</div>
    </div>
    <div class="representation">
      <div class="label">${current.width}-bit ${current.interpretation} range</div>
      <div class="value">${range.min}…${range.max}</div>
      <div class="microcopy">Available values at this width</div>
    </div>
  `;

  const binaryEntry = (kind) => `
    <div class="binary-entry-card">
      <label for="operandBinary${kind}">
        Operand ${kind} as one ${current.width}-bit binary number
      </label>
      <div class="binary-entry-shell" data-binary-shell="${kind}">
        <input
          class="binary-entry-input"
          id="operandBinary${kind}"
          aria-describedby="operandBinary${kind}Progress"
          aria-label="Operand ${kind} as a ${current.width}-bit binary number"
          inputmode="numeric"
          autocomplete="off"
          maxlength="${current.width}"
          data-operand-kind="${kind}"
        >
        <div class="binary-entry-display" data-binary-display="${kind}" aria-hidden="true"></div>
      </div>
      <div class="binary-entry-position" aria-hidden="true">
        <span>MSB</span>
        <span>LSB</span>
      </div>
      <div class="microcopy" id="operandBinary${kind}Progress">
        0 of ${current.width} bits entered
      </div>
    </div>
  `;

  byId("operandBits").innerHTML = `
    <div class="binary-entry-grid" aria-label="Enter operand bit patterns">
      ${binaryEntry("A")}
      ${binaryEntry("B")}
    </div>
  `;
  for (const input of operandInputsInOrder()) renderOperandEntry(input);
}

function expectedOperandBits(input) {
  return input.dataset.operandKind === "A"
    ? bitsFor(current.rawA, current.width)
    : bitsFor(current.rawB, current.width);
}

function operandInputsInOrder() {
  return ["A", "B"].map((kind) =>
    document.querySelector(`[data-operand-kind="${kind}"]`),
  );
}

function renderOperandEntry(input) {
  const kind = input.dataset.operandKind;
  const expected = expectedOperandBits(input);
  const display = document.querySelector(`[data-binary-display="${kind}"]`);
  const shell = document.querySelector(`[data-binary-shell="${kind}"]`);
  const progress = byId(`operandBinary${kind}Progress`);
  const entered = input.value;

  display.innerHTML = Array.from(
    { length: current.width },
    (_, index) => {
      const digit = entered[index];
      if (digit === undefined) {
        return '<span class="pending">·</span>';
      }
      const state = digit === expected[index] ? "correct" : "incorrect";
      return `<span class="${state}">${digit}</span>`;
    },
  ).join("");

  const hasError = [...entered].some(
    (digit, index) => digit !== expected[index],
  );
  const isComplete = entered.length === current.width;
  const isCorrect = isComplete && entered === expected;
  shell.classList.toggle("has-error", hasError);
  shell.classList.toggle("is-correct", isCorrect);
  progress.textContent = isCorrect
    ? `All ${current.width} bits are correct`
    : `${entered.length} of ${current.width} bits entered`;
}

function resetAfterRepresentationEdit() {
  byId("repAMeta").textContent =
    `Convert A to ${current.width}-bit binary below.`;
  byId("repBMeta").textContent =
    `Convert B to ${current.width}-bit binary below.`;
  byId("predictionStage").hidden = true;
  byId("mechanicsStage").hidden = true;
  byId("interpretationStage").hidden = true;
  byId("resultBanner").classList.remove("visible");
  clearFeedback("representationFeedback");
}

function showRepresentationConfirmation() {
  const a = representation(current.rawA, current.width);
  const b = representation(current.rawB, current.width);
  byId("repAMeta").innerHTML = `${a.bits}<sub>2</sub> · ${a.hex}`;
  byId("repBMeta").innerHTML = `${b.bits}<sub>2</sub> · ${b.hex}`;
}

function checkRepresentation(showFeedback = true) {
  let firstWrong = null;
  for (const input of operandInputsInOrder()) {
    renderOperandEntry(input);
    const correct = input.value === expectedOperandBits(input);
    if (!correct && !firstWrong) firstWrong = input;
  }

  if (firstWrong) {
    if (showFeedback) {
      setFeedback(
        "representationFeedback",
        "error",
        `Operand ${firstWrong.dataset.operandKind} must be entered as one complete ${current.width}-bit binary number. Red digits do not match; include leading zeros.`,
      );
      firstWrong.focus();
    }
    return false;
  }

  showRepresentationConfirmation();
  byId("predictionStage").hidden = false;
  if (showFeedback) {
    setFeedback(
      "representationFeedback",
      "success",
      "Both fixed-width operand patterns are correct. Keep these bits unchanged while performing the arithmetic.",
    );
  }
  return true;
}

function representationHint() {
  hintCounts.representation += 1;
  const unresolved = operandInputsInOrder().find(
    (input) => input.value !== expectedOperandBits(input),
  );
  if (!unresolved) {
    setFeedback(
      "representationFeedback",
      "success",
      "Both operand patterns are complete.",
    );
    return;
  }

  const kind = unresolved.dataset.operandKind;
  const raw = kind === "A" ? current.rawA : current.rawB;
  const selected = kind === "A" ? current.aValue : current.bValue;
  let message;
  if (current.interpretation === "signed" && selected < 0) {
    message =
      `${kind} is negative. Write ${Math.abs(selected)} in ${current.width} bits, invert every bit, and add 1.`;
  } else {
    const powers = Array.from(
      { length: current.width },
      (_, position) => position,
    )
      .filter((position) => ((raw >> position) & 1) === 1)
      .map((position) => `2^${position}`);
    message =
      `${kind} = ${selected}. Its nonzero place values are ${powers.length ? powers.join(" + ") : "none; every bit is 0"}.`;
  }

  if (hintCounts.representation > 1) {
    const expected = expectedOperandBits(unresolved);
    const mismatch = [...unresolved.value].findIndex(
      (digit, index) => digit !== expected[index],
    );
    const nextIndex = mismatch >= 0 ? mismatch : unresolved.value.length;
    const position = current.width - 1 - nextIndex;
    message += ` Focus next on bit ${Math.max(0, position)}.`;
  }
  setFeedback("representationFeedback", "hint", message);
}

function renderTwosPreparation() {
  const show =
    current.operation === "subtract" &&
    current.subtractionMethod === "twos";
  byId("twosPreparation").hidden = !show;
  byId("bitMechanicsWork").hidden = show;
  if (!show) {
    byId("twosTable").innerHTML = "";
    return;
  }

  const positions = Array.from(
    { length: current.width },
    (_, index) => current.width - 1 - index,
  );
  const original = current.twos.originalBits;

  byId("twosTable").innerHTML = `
    <table class="mechanics-table" aria-label="Form the two's complement of operand B">
      <thead><tr><th>bit position</th>${positions.map((position) => `<th>${position}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><td>B</td>${[...original].map((bit) => `<td class="operand">${bit}</td>`).join("")}</tr>
        <tr><td>invert B</td>${positions.map((position) => `<td><input aria-label="Inverted B bit ${position}" inputmode="numeric" maxlength="1" data-twos-kind="invert" data-position="${position}"></td>`).join("")}</tr>
        <tr><td>invert + 1</td>${positions.map((position) => `<td><input aria-label="Negative B bit ${position}" inputmode="numeric" maxlength="1" data-twos-kind="negated" data-position="${position}"></td>`).join("")}</tr>
      </tbody>
    </table>
  `;
}

function mechanicsOperandBits() {
  if (
    current.operation === "subtract" &&
    current.subtractionMethod === "twos"
  ) {
    return current.twos.invertedBits;
  }
  return bitsFor(current.rawB, current.width);
}

function renderMechanics() {
  const positions = Array.from(
    { length: current.width },
    (_, index) => current.width - 1 - index,
  );
  const aBits = bitsFor(current.rawA, current.width);
  const secondBits = mechanicsOperandBits();
  const twosMethod =
    current.operation === "subtract" &&
    current.subtractionMethod === "twos";
  const borrowMethod = current.operation === "subtract" && !twosMethod;
  const flowName = borrowMethod ? "borrow from left" : "carry out";
  const flowInName = borrowMethod ? "lent to right" : "carry in";
  const initialFlow = twosMethod ? 1 : 0;

  byId("mechanicsInstruction").textContent = twosMethod
    ? "Add A + ~B with an initial carry-in of 1 at bit 0. This is the hardware form of A − B."
    : borrowMethod
      ? "Subtract B from A, starting at bit 0. If a column is negative, use the borrow button; A will regroup in place and the borrowed 1 will become 2 in the current column."
      : "Add A and B. A total of 2 or 3 writes a result bit and sends a carry of 1 to the next position.";
  byId("mechanicsFlowNote").textContent = borrowMethod
    ? "Work from right to left. Use the borrow control only when the current subtraction is negative. The supplying column will show “1 lent to right,” and A will change to its regrouped column values."
    : "Work from bit 0 on the right toward the most-significant bit. Enter the result and carry leaving each column; it appears automatically as the carry-in to the next column.";
  byId("borrowProcess").hidden = !borrowMethod;

  const flowInCells = positions
    .map(
      (position) =>
        `<td class="linked-flow" data-flow-in-position="${position}">${position === 0 ? initialFlow : "·"}</td>`,
    )
    .join("");
  const flowInputs = positions
    .map(
      (position) =>
        `<td><input aria-label="${flowName} from bit ${position}" inputmode="numeric" maxlength="1" data-mechanics-kind="flow" data-position="${position}"></td>`,
    )
    .join("");
  const hiddenBorrowInputs = borrowMethod
    ? positions
        .map(
          (position) =>
            `<input type="hidden" value="0" data-mechanics-kind="flow" data-position="${position}">`,
        )
        .join("")
    : "";
  const resultInputs = positions
    .map(
      (position) =>
        `<td><input aria-label="Result bit ${position}" inputmode="numeric" maxlength="1" data-mechanics-kind="result" data-position="${position}"></td>`,
    )
    .join("");
  const workRows = borrowMethod
    ? `
        <tr><td>${flowInName}</td>${flowInCells}</tr>
        <tr><td>result bit</td>${resultInputs}</tr>
      `
    : `
        <tr><td>${flowInName}</td>${flowInCells}</tr>
        <tr><td>result bit</td>${resultInputs}</tr>
        <tr><td>${flowName}</td>${flowInputs}</tr>
      `;

  byId("mechanicsTable").innerHTML = `
    <table class="mechanics-table" aria-label="Bit-by-bit arithmetic">
      <thead><tr><th>bit position</th>${positions.map((position) => `<th>${position}</th>`).join("")}</tr></thead>
      <tbody>
        <tr>
          <td data-a-row-label>A</td>
          ${
            borrowMethod
              ? positions.map((position) => `<td class="operand" data-regrouped-position="${position}">${aBits[current.width - 1 - position]}</td>`).join("")
              : [...aBits].map((bit) => `<td class="operand">${bit}</td>`).join("")
          }
        </tr>
        <tr><td>${twosMethod ? "~B" : "B"}</td>${[...secondBits].map((bit) => `<td class="operand">${bit}</td>`).join("")}</tr>
        ${workRows}
      </tbody>
    </table>
    ${hiddenBorrowInputs}
  `;

  document
    .querySelectorAll('[data-mechanics-kind="flow"]')
    .forEach((input) => input.addEventListener("input", handleFlowInput));
  updateLinkedFlows();
}

function handleFlowInput(event) {
  const input = event.currentTarget;
  input.classList.remove("propagated-borrow");
  delete input.dataset.autoBorrow;

  const borrowMethod =
    current.operation === "subtract" &&
    current.subtractionMethod === "borrow";
  if (!borrowMethod) {
    updateLinkedFlows();
    return;
  }

  all('[data-mechanics-kind="flow"][data-auto-borrow="true"]').forEach(
    (autoInput) => {
      autoInput.value = "";
      autoInput.classList.remove("propagated-borrow", "correct", "incorrect");
      delete autoInput.dataset.autoBorrow;
    },
  );

  const studentLoans = all('[data-mechanics-kind="flow"]')
    .filter(
      (flowInput) =>
        flowInput.value.trim() === "1" &&
        flowInput.dataset.autoBorrow !== "true",
    )
    .map((flowInput) => Number(flowInput.dataset.position))
    .sort((a, b) => a - b);

  for (const start of studentLoans) {
    const startColumn = current.columns.find(
      (column) => column.position === start,
    );
    if (startColumn?.borrowOut !== 1) continue;
    for (let position = start + 1; position < current.width; position += 1) {
      const column = current.columns.find(
        (item) => item.position === position,
      );
      if (column?.borrowOut !== 1) break;
      const propagated = document.querySelector(
        `[data-mechanics-kind="flow"][data-position="${position}"]`,
      );
      propagated.value = "1";
      propagated.dataset.autoBorrow = "true";
      propagated.classList.add("propagated-borrow");
    }
  }
  updateLinkedFlows();
}

function regroupedColumn(position) {
  const column = current.columns.find((item) => item.position === position);
  const loanFromRight =
    position === 0
      ? 0
      : document.querySelector(
            `[data-mechanics-kind="flow"][data-position="${position - 1}"]`,
          )?.value.trim() === "1"
        ? 1
        : 0;
  const loanFromLeft =
    document.querySelector(
      `[data-mechanics-kind="flow"][data-position="${position}"]`,
    )?.value.trim() === "1"
      ? 1
      : 0;
  const value = column.aBit - loanFromRight + 2 * loanFromLeft;
  return {
    position,
    value,
    needsLoan: value < 0,
  };
}

function updateRegroupedMinuend() {
  const hasLoan = all('[data-mechanics-kind="flow"]').some(
    (input) => input.value.trim() === "1",
  );
  const rowLabel = document.querySelector("[data-a-row-label]");
  if (rowLabel) {
    rowLabel.textContent = hasLoan ? "A (regrouped)" : "A";
    rowLabel.classList.toggle("regrouped-active", hasLoan);
  }

  for (let position = 0; position < current.width; position += 1) {
    const target = document.querySelector(
      `[data-regrouped-position="${position}"]`,
    );
    if (!target) continue;
    const regrouped = regroupedColumn(position);
    target.classList.toggle("regrouped-active", hasLoan);
    target.classList.toggle("needs-loan", regrouped.needsLoan);
    target.classList.toggle("temporary-two", regrouped.value === 2);
    if (regrouped.needsLoan) {
      target.innerHTML = '<span class="needs-loan-label">needs<br>loan</span>';
    } else if (regrouped.value === 2) {
      target.innerHTML =
        '<span class="regrouped-two">2 <small>= 10₂</small></span>';
    } else {
      target.textContent = String(regrouped.value);
    }
  }
}

function updateBorrowProcess() {
  const guide = byId("borrowProcess");
  if (!guide || guide.hidden) return;

  const activeLoans = all('[data-mechanics-kind="flow"]')
    .filter((input) => input.value.trim() === "1")
    .map((input) => Number(input.dataset.position));
  const nextBorrowPosition = current.columns.find((column) => {
    const input = document.querySelector(
      `[data-mechanics-kind="flow"][data-position="${column.position}"]`,
    );
    return column.borrowOut === 1 && input?.value.trim() !== "1";
  })?.position;
  const borrowAction =
    nextBorrowPosition === undefined
      ? ""
      : `<button type="button" class="borrow-action" data-borrow-position="${nextBorrowPosition}">
          Regroup A: borrow into bit ${nextBorrowPosition}
        </button>`;

  if (activeLoans.length === 0) {
    guide.innerHTML = `
      <div class="borrow-process-title">How to show a borrow</div>
      <div class="borrow-process-prompt">
        If <strong>A − B − any 1 already lent to the right</strong> is negative,
        use the regrouping button. A will change in place and the matching loan
        will appear in the supplying column automatically.
      </div>
      ${
        nextBorrowPosition === undefined
          ? '<div class="borrow-no-action">No column currently requires regrouping.</div>'
          : borrowAction
      }
    `;
    return;
  }

  const regroupedValues = Array.from(
    { length: current.width },
    (_, index) => current.width - 1 - index,
  ).map((position) => {
    const regrouped = regroupedColumn(position);
    return regrouped.needsLoan ? "needs loan" : String(regrouped.value);
  });
  const propagatedPositions = all(
    '[data-mechanics-kind="flow"][data-auto-borrow="true"]',
  )
    .map((input) => Number(input.dataset.position))
    .sort((a, b) => a - b);

  guide.innerHTML = `
    <div class="borrow-process-title">Borrow process</div>
    <div class="regrouped-transition">
      <span>${bitsFor(current.rawA, current.width)}₂</span>
      <span class="borrow-direction">→</span>
      <span>${regroupedValues.join(" ")}</span>
      <small>column units; 2 means 10₂ in that column</small>
    </div>
    ${
      propagatedPositions.length
        ? `<div class="borrow-propagation-note">The loan passes automatically across zero ${propagatedPositions.length === 1 ? "column" : "columns"} ${propagatedPositions.join(", ")} until it reaches a 1.</div>`
        : ""
    }
    <div class="borrow-loan-list">
      ${activeLoans
        .map((position) => {
          const source = position + 1;
          const column = current.columns.find(
            (item) => item.position === position,
          );
          if (source >= current.width) {
            return `
              <div class="borrow-loan">
                <div class="borrow-flow">
                  <span class="borrow-chip">outside register</span>
                  <span class="borrow-direction">→</span>
                  <span class="borrow-chip">bit ${position} receives 2</span>
                </div>
                <div class="borrow-calculation">
                  The most-significant bit needs a loan from beyond the register.
                </div>
              </div>
            `;
          }
          return `
            <div class="borrow-loan">
              <div class="borrow-flow">
                <span class="borrow-chip">bit ${source} gives 1</span>
                <span class="borrow-direction">→</span>
                <span class="borrow-chip">bit ${position} receives 2</span>
              </div>
              <div class="borrow-calculation">
                At bit ${position}: ${column.aBit} + 2 − ${column.bBit} − ${column.borrowIn}
                = ${column.resultBit}. Bit ${source} now shows “1 lent to right.”
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
    ${borrowAction}
  `;
}

function handleBorrowGuideClick(event) {
  const button = event.target.closest("[data-borrow-position]");
  if (!button) return;
  const position = Number(button.dataset.borrowPosition);
  const input = document.querySelector(
    `[data-mechanics-kind="flow"][data-position="${position}"]`,
  );
  if (!input) return;
  input.value = "1";
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function updateLinkedFlows() {
  if (!current) return;
  const twosMethod =
    current.operation === "subtract" &&
    current.subtractionMethod === "twos";
  const borrowMethod =
    current.operation === "subtract" &&
    current.subtractionMethod === "borrow";
  for (let position = 0; position < current.width; position += 1) {
    const target = document.querySelector(
      `[data-flow-in-position="${position}"]`,
    );
    if (!target) continue;
    if (position === 0) {
      target.textContent = borrowMethod ? "—" : twosMethod ? "1" : "0";
      target.classList.toggle("known", !borrowMethod);
      continue;
    }
    const source = document.querySelector(
      `[data-mechanics-kind="flow"][data-position="${position - 1}"]`,
    );
    const value = source?.value.trim();
    if (borrowMethod && value === "1") {
      target.innerHTML =
        '<span class="borrow-give" aria-label="1 lent to the bit on the right">1 <span aria-hidden="true">→</span></span>';
    } else {
      target.textContent = value === "0" || value === "1" ? value : "·";
    }
    target.classList.toggle("known", value === "0" || value === "1");
  }
  updateRegroupedMinuend();
  updateBorrowProcess();
}

function expectedTwosValue(input) {
  const position = Number(input.dataset.position);
  const bits =
    input.dataset.twosKind === "invert"
      ? current.twos.invertedBits
      : current.twos.negatedBits;
  return bits[current.width - 1 - position];
}

function validateBitInput(input, expected) {
  const value = input.value.trim();
  input.classList.remove("correct", "incorrect");
  if (value === expected) {
    input.classList.add("correct");
    return true;
  }
  input.classList.add("incorrect");
  return false;
}

function checkTwos(showFeedback = true) {
  if (byId("twosPreparation").hidden) return true;
  const inputs = all("[data-twos-kind]");
  let firstWrong = null;
  for (const input of inputs) {
    const correct = validateBitInput(input, expectedTwosValue(input));
    if (!correct && !firstWrong) firstWrong = input;
  }

  if (firstWrong) {
    if (showFeedback) {
      const label =
        firstWrong.dataset.twosKind === "invert" ? "inverted" : "negated";
      setFeedback(
        "twosFeedback",
        "error",
        `Check the ${label} value at bit ${firstWrong.dataset.position}.`,
      );
      firstWrong.focus();
    }
    return false;
  }

  if (showFeedback) {
    setFeedback(
      "twosFeedback",
      "success",
      `Correct: −B is ${current.twos.negatedBits}. The adder implements the same operation as A + ~B + 1.`,
    );
  }
  byId("bitMechanicsWork").hidden = false;
  return true;
}

function expectedMechanicsValue(input) {
  const position = Number(input.dataset.position);
  const column = current.columns.find((item) => item.position === position);
  if (input.dataset.mechanicsKind === "result") {
    return String(column.resultBit);
  }
  if (
    current.operation === "subtract" &&
    current.subtractionMethod === "borrow"
  ) {
    return String(column.borrowOut);
  }
  return String(column.carryOut);
}

function mechanicsInputsInWorkOrder() {
  const ordered = [];
  for (let position = 0; position < current.width; position += 1) {
    ordered.push(
      document.querySelector(
        `[data-mechanics-kind="result"][data-position="${position}"]`,
      ),
      document.querySelector(
        `[data-mechanics-kind="flow"][data-position="${position}"]`,
      ),
    );
  }
  return ordered;
}

function checkMechanics(showFeedback = true) {
  const inputs = mechanicsInputsInWorkOrder();
  let firstWrong = null;
  for (const input of inputs) {
    const correct = validateBitInput(input, expectedMechanicsValue(input));
    if (!correct && !firstWrong) firstWrong = input;
  }

  if (firstWrong) {
    if (showFeedback) {
      const borrowActionMissing =
        firstWrong.dataset.mechanicsKind === "flow" &&
        current.operation === "subtract" &&
        current.subtractionMethod === "borrow";
      const kind =
        firstWrong.dataset.mechanicsKind === "result"
          ? "result bit"
          : borrowActionMissing
            ? "regrouping action"
            : "carry-out";
      setFeedback(
        "mechanicsFeedback",
        "error",
        borrowActionMissing
          ? `Bit ${firstWrong.dataset.position} needs regrouping. Use the highlighted “Regroup A” button, then continue the subtraction.`
          : `The first incorrect step is the ${kind} at bit ${firstWrong.dataset.position}. Recompute that column before moving left.`,
      );
      const borrowButton = borrowActionMissing
        ? byId("borrowProcess").querySelector("[data-borrow-position]")
        : null;
      (borrowButton ?? firstWrong).focus();
    }
    return false;
  }

  if (showFeedback) {
    setFeedback(
      "mechanicsFeedback",
      "success",
      `Every column is correct. Reading the result from the most-significant bit gives ${current.resultBits}.`,
    );
  }
  if (requiresInterpretationStage()) {
    byId("interpretationStage").hidden = false;
  } else {
    byId("interpretationStage").hidden = true;
    showFoundationResult();
  }
  return true;
}

function checkPrediction(showFeedback = true) {
  const resultInput = byId("predictionResult");
  const fitInput = byId("predictionFits");
  const resultCorrect =
    Number(resultInput.value.trim()) === current.mathematicalResult &&
    resultInput.value.trim() !== "";
  const fitCorrect = fitInput.value === yesNo(current.fits);
  resultInput.classList.toggle("invalid", !resultCorrect);
  fitInput.classList.toggle("invalid", !fitCorrect);

  if (!resultCorrect || !fitCorrect) {
    if (showFeedback) {
      const message = !resultCorrect
        ? "Recompute the ordinary mathematical result before considering the register width."
        : `Compare the result with the ${current.width}-bit ${current.interpretation} range shown above.`;
      setFeedback("predictionFeedback", "error", message);
    }
    return false;
  }

  if (showFeedback) {
    const fitText = current.fits ? "does fit" : "does not fit";
    setFeedback(
      "predictionFeedback",
      "success",
      `Correct: the mathematical result is ${current.mathematicalResult}, and it ${fitText} in the selected range.`,
    );
  }
  byId("mechanicsStage").hidden = false;
  return true;
}

function expectedSelectedValue() {
  return current.interpretation === "signed"
    ? current.storedSigned
    : current.storedUnsigned;
}

function checkInterpretation(showFeedback = true) {
  const bitsInput = byId("resultBitsAnswer");
  const valueInput = byId("selectedValueAnswer");
  const cleanedBits = bitsInput.value.replaceAll("_", "").replaceAll(" ", "");
  const bitsCorrect = cleanedBits === current.resultBits;
  const valueCorrect =
    valueInput.value.trim() !== "" &&
    Number(valueInput.value) === expectedSelectedValue();
  const carryCorrect = byId("carryAnswer").value === yesNo(current.carryOut);
  const borrowCorrect = byId("borrowAnswer").value === yesNo(current.borrowOut);
  const signedCorrect =
    byId("signedOverflowAnswer").value === yesNo(current.signedOverflow);
  const unsignedCondition =
    current.operation === "add"
      ? current.unsignedOverflow
      : current.unsignedUnderflow;
  const unsignedCorrect =
    byId("unsignedFlagAnswer").value === yesNo(unsignedCondition);

  const checks = [
    [bitsInput, bitsCorrect, "stored result bits"],
    [valueInput, valueCorrect, `${current.interpretation} stored value`],
    [byId("carryAnswer"), carryCorrect, "carry-out"],
    [byId("borrowAnswer"), borrowCorrect, "borrow-out"],
    [byId("signedOverflowAnswer"), signedCorrect, "signed overflow"],
    [
      byId("unsignedFlagAnswer"),
      unsignedCorrect,
      current.operation === "add"
        ? "unsigned overflow"
        : "unsigned underflow",
    ],
  ];

  let firstWrong = null;
  for (const [input, correct, label] of checks) {
    input.classList.toggle("invalid", !correct);
    if (!correct && !firstWrong) firstWrong = { input, label };
  }

  if (firstWrong) {
    if (showFeedback) {
      setFeedback(
        "interpretationFeedback",
        "error",
        `Check ${firstWrong.label}. Treat each flag as a separate statement about the same operation.`,
      );
      firstWrong.input.focus();
    }
    return false;
  }

  if (showFeedback) {
    setFeedback(
      "interpretationFeedback",
      "success",
      "The bit pattern, stored value, and all four status conditions are consistent.",
    );
  }
  return true;
}

function updateInterpretationLabels() {
  byId("selectedValueLabel").textContent =
    current.interpretation === "signed"
      ? "Signed decimal value"
      : "Unsigned decimal value";
  byId("unsignedFlagLabel").textContent =
    current.operation === "add"
      ? "Unsigned overflow"
      : "Unsigned underflow";
}

function summaryItem(label, value) {
  return `
    <div class="summary-item">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>
  `;
}

function requiresInterpretationStage() {
  return current.interpretation === "signed" || !current.fits;
}

function showFoundationResult() {
  const operator = current.operation === "add" ? "+" : "−";
  byId("resultEquation").textContent =
    `${current.aValue} ${operator} ${current.bValue} = ${current.mathematicalResult} = ${current.resultBits}₂`;
  byId("resultSummary").innerHTML = [
    summaryItem("Decimal result", current.mathematicalResult),
    summaryItem(`${current.width}-bit binary result`, `${current.resultBits}₂`),
  ].join("");
  byId("resultExplanation").textContent =
    `The result fits in the ${current.width}-bit unsigned range. The bit-by-bit arithmetic is complete.`;
  byId("resultBanner").classList.add("visible");
  byId("resultBanner").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showVerifiedResult() {
  const operator = current.operation === "add" ? "+" : "−";
  const stored = expectedSelectedValue();
  byId("resultEquation").textContent =
    `${current.aValue} ${operator} ${current.bValue} = ${current.mathematicalResult} → ${current.resultBits}₂ → ${stored}`;

  const unsignedCondition =
    current.operation === "add"
      ? current.unsignedOverflow
      : current.unsignedUnderflow;
  byId("resultSummary").innerHTML = [
    summaryItem("Stored unsigned", current.storedUnsigned),
    summaryItem("Stored signed", current.storedSigned),
    summaryItem("Carry-out", Number(current.carryOut)),
    summaryItem("Borrow-out", Number(current.borrowOut)),
    summaryItem("Signed overflow", current.signedOverflow ? "YES" : "NO"),
    summaryItem(
      current.operation === "add" ? "Unsigned overflow" : "Unsigned underflow",
      unsignedCondition ? "YES" : "NO",
    ),
  ].join("");

  let explanation;
  if (current.signedOverflow) {
    explanation =
      "Signed overflow means the stored bit pattern is a valid pattern but not a valid representation of the mathematical signed result at this width.";
  } else if (unsignedCondition) {
    explanation =
      `The ${current.width}-bit register wraps modulo ${2 ** current.width}. The unsigned flag reports that the mathematical result lies outside the unsigned range.`;
  } else {
    explanation =
      "The mathematical result fits the selected representation. Carry-out and signed overflow remain different questions and must still be evaluated separately.";
  }
  byId("resultExplanation").textContent = explanation;
  byId("resultBanner").classList.add("visible");
  byId("resultBanner").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function checkAll() {
  byId("resultBanner").classList.remove("visible");
  if (!checkRepresentation(true)) return;
  if (!checkPrediction(true)) return;
  if (!checkTwos(true)) return;
  if (!checkMechanics(true)) return;
  if (!requiresInterpretationStage()) return;
  if (!checkInterpretation(true)) return;
  showVerifiedResult();
}

function firstUnresolvedMechanics() {
  for (const input of mechanicsInputsInWorkOrder()) {
    if (input.value.trim() !== expectedMechanicsValue(input)) return input;
  }
  return null;
}

function revealNext() {
  if (!byId("twosPreparation").hidden) {
    const twosInput = all("[data-twos-kind]").find(
      (input) => input.value.trim() !== expectedTwosValue(input),
    );
    if (twosInput) {
      twosInput.value = expectedTwosValue(twosInput);
      twosInput.classList.remove("incorrect");
      twosInput.classList.add("correct");
      setFeedback(
        "twosFeedback",
        "hint",
        `Revealed bit ${twosInput.dataset.position}. Explain how that bit was obtained before revealing another.`,
      );
      return;
    }
    byId("bitMechanicsWork").hidden = false;
  }

  const input = firstUnresolvedMechanics();
  if (input) {
    input.value = expectedMechanicsValue(input);
    input.classList.remove("incorrect");
    input.classList.add("correct");
    if (
      input.dataset.mechanicsKind === "flow" &&
      current.operation === "subtract" &&
      current.subtractionMethod === "borrow"
    ) {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      updateLinkedFlows();
    }
    setFeedback(
      "mechanicsFeedback",
      "hint",
      `Revealed the ${input.dataset.mechanicsKind === "result" ? "result" : "outgoing status"} at bit ${input.dataset.position}. Recompute the rest from that point.`,
    );
    return;
  }

  setFeedback(
    "mechanicsFeedback",
    "success",
    "All bit-mechanics entries are complete.",
  );
}

function predictionHint() {
  hintCounts.prediction += 1;
  const range = rangeFor(current.width, current.interpretation);
  const hints = [
    `First calculate ${current.aValue} ${current.operation === "add" ? "+" : "−"} ${current.bValue} without using any bit patterns.`,
    `A ${current.width}-bit ${current.interpretation} value must lie from ${range.min} through ${range.max}.`,
    `The mathematical result is ${current.mathematicalResult}. Compare it directly with that range.`,
  ];
  setFeedback(
    "predictionFeedback",
    "hint",
    hints[Math.min(hintCounts.prediction - 1, hints.length - 1)],
  );
}

function twosHint() {
  hintCounts.twos += 1;
  const hints = [
    "The inverted row changes every 0 to 1 and every 1 to 0.",
    "After inversion, add 1 starting at bit 0. Continue the carry only while a column totals 2.",
    `The inverted pattern is ${current.twos.invertedBits}; add one to obtain −B.`,
  ];
  setFeedback(
    "twosFeedback",
    "hint",
    hints[Math.min(hintCounts.twos - 1, hints.length - 1)],
  );
}

function mechanicsHint() {
  hintCounts.mechanics += 1;
  const unresolved = firstUnresolvedMechanics();
  if (!unresolved) {
    setFeedback("mechanicsFeedback", "success", "Every column is complete.");
    return;
  }

  const position = Number(unresolved.dataset.position);
  const column = current.columns.find((item) => item.position === position);
  let detail;
  if (
    current.operation === "subtract" &&
    current.subtractionMethod === "borrow"
  ) {
    detail =
      `At bit ${position}: ${column.aBit} − ${column.bBit} − borrow-in ${column.borrowIn}.`;
  } else {
    detail =
      `At bit ${position}: ${column.aBit} + ${column.bBit} + carry-in ${column.carryIn}.`;
  }
  const suffix =
    hintCounts.mechanics > 1
      ? ` The result bit is ${column.resultBit}.`
      : " Write the low bit of the column total and pass the remaining status left.";
  setFeedback("mechanicsFeedback", "hint", detail + suffix);
}

function interpretationHint() {
  hintCounts.interpretation += 1;
  const hints = [
    `Read the result bits as a ${current.width}-bit ${current.interpretation} pattern; do not substitute the mathematical result if it did not fit.`,
    "Carry-out answers an unsigned addition question. Signed overflow asks whether the sign behavior is possible. They are not interchangeable.",
    current.operation === "subtract"
      ? "Borrow-out reports A < B as unsigned patterns. In two’s-complement subtraction, carry-out usually expresses the complementary no-borrow condition."
      : "For unsigned addition, carry-out and unsigned overflow agree. Signed overflow still follows the operand and result signs.",
  ];
  setFeedback(
    "interpretationFeedback",
    "hint",
    hints[Math.min(hintCounts.interpretation - 1, hints.length - 1)],
  );
}

function switchMode(mode) {
  currentMode = mode;
  document.body.dataset.mode = mode;
  byId("modeNote").textContent = modeText[mode];
  all("[data-mode-button]").forEach((button) => {
    const active = button.dataset.modeButton === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  byId("newPractice").hidden = mode !== "practice";
  byId("practiceScopeField").hidden = mode !== "practice";

  if (mode === "practice") {
    newPracticeProblem();
  } else {
    loadProblem();
  }
}

async function copyProblem() {
  if (!current) return;
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({
    width: String(current.width),
    base: String(byId("base").value),
    interpretation: current.interpretation,
    operation: current.operation,
    method: current.subtractionMethod,
    a: byId("operandA").value,
    b: byId("operandB").value,
  }).toString();
  const button = byId("copyProblem");
  try {
    await navigator.clipboard.writeText(url.toString());
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy unavailable";
  }
  window.setTimeout(() => {
    button.textContent = "Copy problem";
  }, 1500);
}

function loadQueryProblem() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("a") || !params.has("b")) return false;
  const width = params.get("width");
  const base = params.get("base");
  const interpretation = params.get("interpretation");
  const operation = params.get("operation");
  const method = params.get("method");

  if (all("#width option").some((option) => option.value === width)) {
    byId("width").value = width;
  }
  if (["2", "10", "16"].includes(base)) byId("base").value = base;
  if (["signed", "unsigned"].includes(interpretation)) {
    setRadio("interpretation", interpretation);
  }
  if (["add", "subtract"].includes(operation)) setRadio("operation", operation);
  if (["borrow", "twos"].includes(method)) {
    setRadio("subtractionMethod", method);
  }
  byId("operandA").value = params.get("a");
  byId("operandB").value = params.get("b");
  updateSubtractionControls();
  return true;
}

all("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => applyPreset(button.dataset.preset));
});

byId("customProblem").addEventListener("click", () => startCustomProblem(false));
byId("customSubtraction").addEventListener("click", () =>
  startCustomProblem(true),
);
byId("loadCustomSubtraction").addEventListener("click", loadCustomSubtraction);
byId("cancelCustomSubtraction").addEventListener(
  "click",
  cancelCustomSubtraction,
);
byId("borrowProcess").addEventListener("click", handleBorrowGuideClick);

all("[data-mode-button]").forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.modeButton));
});

all('input[name="operation"]').forEach((input) => {
  input.addEventListener("change", updateSubtractionControls);
});

byId("loadProblem").addEventListener("click", loadProblem);
byId("newPractice").addEventListener("click", newPracticeProblem);
byId("practiceScope").addEventListener("change", newPracticeProblem);
byId("copyProblem").addEventListener("click", copyProblem);
byId("operandBits").addEventListener("input", (event) => {
  const input = event.target.closest("[data-operand-kind]");
  if (!input) return;
  const sanitized = input.value.replace(/[^01]/g, "").slice(0, current.width);
  if (input.value !== sanitized) input.value = sanitized;
  renderOperandEntry(input);
  resetAfterRepresentationEdit();
});
byId("checkRepresentation").addEventListener("click", () =>
  checkRepresentation(true),
);
byId("representationHint").addEventListener("click", representationHint);
byId("checkPrediction").addEventListener("click", () => checkPrediction(true));
byId("predictionHint").addEventListener("click", predictionHint);
byId("checkTwos").addEventListener("click", () => checkTwos(true));
byId("twosHint").addEventListener("click", twosHint);
byId("checkMechanics").addEventListener("click", () => checkMechanics(true));
byId("mechanicsHint").addEventListener("click", mechanicsHint);
byId("revealNext").addEventListener("click", revealNext);
byId("checkInterpretation").addEventListener("click", () =>
  checkInterpretation(true),
);
byId("interpretationHint").addEventListener("click", interpretationHint);
byId("checkAll").addEventListener("click", checkAll);

loadQueryProblem();
updateSubtractionControls();
loadProblem();
