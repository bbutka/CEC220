import {
  createTwosProblem,
  parseFixedBits,
  parseSignedDecimal,
  signedRange,
} from "../shared/twos-core.js";

const byId = (id) => document.getElementById(id);
const all = (selector) => [...document.querySelectorAll(selector)];

let mode = "test";
let problem = null;
let currentStage = 1;
let mistakes = 0;

function setFeedback(id, type, message) {
  const target = byId(id);
  target.className = `stage-feedback${type ? ` ${type}` : ""}`;
  target.textContent = message;
}

function mark(control, correct) {
  control.classList.remove("correct", "incorrect");
  control.classList.add(correct ? "correct" : "incorrect");
}

function clearAnswers() {
  [
    "aBitsAnswer",
    "bBitsAnswer",
    "mathAnswer",
    "invertBAnswer",
    "negativeBAnswer",
    "storedBitsAnswer",
    "signedResultAnswer",
  ].forEach((id) => {
    const control = byId(id);
    control.value = "";
    control.classList.remove("correct", "incorrect");
  });
  ["fitsAnswer", "carryAnswer", "overflowAnswer"].forEach((id) => {
    const control = byId(id);
    control.value = "";
    control.classList.remove("correct", "incorrect");
  });
  [
    "encodingFeedback",
    "predictionFeedback",
    "preparationFeedback",
    "mechanicsFeedback",
    "interpretationFeedback",
  ].forEach((id) => setFeedback(id, "", ""));
  byId("twosSummary").className = "twos-summary";
  byId("twosSummary").textContent = "";
}

function renderProgress() {
  for (let stage = 1; stage <= 5; stage += 1) {
    const panel = byId(`stage${stage}`);
    panel.classList.toggle("locked", stage > currentStage);
    panel.classList.toggle("complete", stage < currentStage);
    panel.querySelectorAll("input, select, button").forEach((control) => {
      control.disabled = stage !== currentStage;
    });
  }
  byId("completedStages").textContent = `${Math.min(currentStage - 1, 5)} / 5`;
  byId("mistakeCount").textContent = String(mistakes);

  if (currentStage >= 3) {
    byId("shownBBits").textContent = problem.bBits;
    byId("unchangedBBits").textContent = problem.bBits;
  } else {
    byId("shownBBits").textContent = "";
    byId("unchangedBBits").textContent = "";
  }
  if (currentStage >= 4) {
    byId("adderABits").textContent = problem.aBits;
    byId("adderBBits").textContent = problem.effectiveBBits;
  } else {
    byId("adderABits").textContent = "";
    byId("adderBBits").textContent = "";
  }
}

function startProblem(a, b, operation, width) {
  problem = createTwosProblem(a, b, operation, width);
  currentStage = 1;
  mistakes = 0;
  clearAnswers();
  byId("twosProblemText").textContent = `${a} ${problem.symbol} ${b}`;
  byId("twosRangeText").textContent = `${width}-bit signed range: ${problem.range.minimum} through ${problem.range.maximum}`;
  all("[data-width-label]").forEach((target) => {
    target.textContent = String(width);
  });
  byId("subtractPreparation").hidden = operation !== "subtract";
  byId("addPreparation").hidden = operation !== "add";
  renderProgress();
  byId("aBitsAnswer").focus();
}

function switchMode(nextMode) {
  mode = nextMode;
  all("[data-twos-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.twosMode === mode);
  });
  byId("testSetup").hidden = mode !== "test";
  byId("customSetup").hidden = mode !== "custom";
  if (mode === "custom") byId("customA").focus();
}

function randomSignedValue(width) {
  const { minimum, maximum } = signedRange(width);
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

function randomProblem() {
  const width = Number(byId("testWidth").value);
  const focus = byId("testFocus").value;
  for (let attempt = 0; attempt < 3000; attempt += 1) {
    const operation =
      focus === "subtract"
        ? "subtract"
        : focus === "add"
          ? "add"
          : Math.random() < 0.5
            ? "add"
            : "subtract";
    const a = randomSignedValue(width);
    const b = randomSignedValue(width);
    if (operation === "subtract" && b === 0) continue;
    const candidate = createTwosProblem(a, b, operation, width);
    if (focus === "overflow" && !candidate.overflow) continue;
    if (focus === "fits" && candidate.overflow) continue;
    startProblem(a, b, operation, width);
    return;
  }
  startProblem(3, 5, "subtract", 4);
}

function loadCustomProblem() {
  const width = Number(byId("customWidth").value);
  const operation = byId("customOperation").value;
  const a = parseSignedDecimal(byId("customA").value, width);
  const b = parseSignedDecimal(byId("customB").value, width);
  const error = byId("twosSetupError");
  if (!a.ok || !b.ok) {
    error.textContent = `${!a.ok ? `A: ${a.error}` : ""} ${!b.ok ? `B: ${b.error}` : ""}`.trim();
    error.classList.add("visible");
    return;
  }
  error.textContent = "";
  error.classList.remove("visible");
  startProblem(a.value, b.value, operation, width);
}

function advanceStage(messageId, message) {
  setFeedback(messageId, "success", message);
  currentStage += 1;
  renderProgress();
  if (currentStage <= 5) {
    byId(`stage${currentStage}`).scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function recordMistake(messageId, message) {
  mistakes += 1;
  byId("mistakeCount").textContent = String(mistakes);
  setFeedback(messageId, "error", message);
}

function checkEncoding() {
  if (currentStage !== 1) return;
  const aControl = byId("aBitsAnswer");
  const bControl = byId("bBitsAnswer");
  const a = parseFixedBits(aControl.value, problem.width);
  const b = parseFixedBits(bControl.value, problem.width);
  const aCorrect = a.ok && a.bits === problem.aBits;
  const bCorrect = b.ok && b.bits === problem.bBits;
  mark(aControl, aCorrect);
  mark(bControl, bCorrect);
  if (!aCorrect || !bCorrect) {
    recordMistake(
      "encodingFeedback",
      `At least one encoding is incorrect. Use exactly ${problem.width} bits and remember that negative values have an MSB of 1.`,
    );
    return;
  }
  advanceStage(
    "encodingFeedback",
    `Correct. A is ${problem.aBits}; B is ${problem.bBits}. The same width must be preserved through the entire problem.`,
  );
}

function checkPrediction() {
  if (currentStage !== 2) return;
  const mathControl = byId("mathAnswer");
  const fitsControl = byId("fitsAnswer");
  const mathCorrect =
    mathControl.value.trim() !== "" &&
    Number(mathControl.value) === problem.mathematicalResult;
  const fitsCorrect = fitsControl.value === (problem.fits ? "yes" : "no");
  mark(mathControl, mathCorrect);
  mark(fitsControl, fitsCorrect);
  if (!mathCorrect || !fitsCorrect) {
    recordMistake(
      "predictionFeedback",
      "Recalculate the decimal operation and compare it with the displayed signed range.",
    );
    return;
  }
  advanceStage(
    "predictionFeedback",
    `Correct. The mathematical result is ${problem.mathematicalResult}, and it ${problem.fits ? "fits" : "does not fit"} the selected signed range.`,
  );
}

function checkPreparation() {
  if (currentStage !== 3 || problem.operation !== "subtract") return;
  const invertControl = byId("invertBAnswer");
  const negativeControl = byId("negativeBAnswer");
  const inverted = parseFixedBits(invertControl.value, problem.width);
  const negative = parseFixedBits(negativeControl.value, problem.width);
  const invertCorrect = inverted.ok && inverted.bits === problem.invertedBBits;
  const negativeCorrect = negative.ok && negative.bits === problem.effectiveBBits;
  mark(invertControl, invertCorrect);
  mark(negativeControl, negativeCorrect);
  if (!invertCorrect || !negativeCorrect) {
    recordMistake(
      "preparationFeedback",
      "Check both operations independently: invert every B bit, then add exactly 1 at the least-significant end.",
    );
    return;
  }
  advanceStage(
    "preparationFeedback",
    `Correct. The adder will perform ${problem.aBits} + ${problem.effectiveBBits}.`,
  );
}

function confirmUnchangedB() {
  if (currentStage !== 3 || problem.operation !== "add") return;
  advanceStage(
    "preparationFeedback",
    `Correct. The adder will perform ${problem.aBits} + ${problem.bBits}; no negation is needed.`,
  );
}

function checkMechanics() {
  if (currentStage !== 4) return;
  const storedControl = byId("storedBitsAnswer");
  const carryControl = byId("carryAnswer");
  const stored = parseFixedBits(storedControl.value, problem.width);
  const storedCorrect = stored.ok && stored.bits === problem.storedBits;
  const carryCorrect = carryControl.value === String(problem.carryOut);
  mark(storedControl, storedCorrect);
  mark(carryControl, carryCorrect);
  if (!storedCorrect || !carryCorrect) {
    recordMistake(
      "mechanicsFeedback",
      "Recheck the bit addition. Store only the selected register width, but preserve the carry leaving the MSB as a separate observation.",
    );
    return;
  }
  advanceStage(
    "mechanicsFeedback",
    `Correct. The register stores ${problem.storedBits}, and the final carry-out is ${problem.carryOut}.`,
  );
}

function checkInterpretation() {
  if (currentStage !== 5) return;
  const signedControl = byId("signedResultAnswer");
  const overflowControl = byId("overflowAnswer");
  const signedCorrect =
    signedControl.value.trim() !== "" &&
    Number(signedControl.value) === problem.storedSigned;
  const overflowCorrect = overflowControl.value === (problem.overflow ? "yes" : "no");
  mark(signedControl, signedCorrect);
  mark(overflowControl, overflowCorrect);
  if (!signedCorrect || !overflowCorrect) {
    recordMistake(
      "interpretationFeedback",
      "Interpret the stored pattern using its sign bit, then use the predicted mathematical range—not carry-out—to decide signed overflow.",
    );
    return;
  }
  currentStage = 6;
  setFeedback(
    "interpretationFeedback",
    "Correct. You have completed the representation, mechanics, and interpretation separately.",
  );
  byId("interpretationFeedback").classList.add("success");
  renderProgress();
  const summary = byId("twosSummary");
  summary.className = "twos-summary visible";
  summary.innerHTML = problem.overflow
    ? `<strong>Overflow:</strong> ${problem.a} ${problem.symbol} ${problem.b} = ${problem.mathematicalResult}, outside ${problem.range.minimum}…${problem.range.maximum}. The stored pattern ${problem.storedBits} reads as ${problem.storedSigned}. Carry-out ${problem.carryOut} did not determine signed overflow.`
    : `<strong>No overflow:</strong> ${problem.a} ${problem.symbol} ${problem.b} = ${problem.mathematicalResult}. The stored pattern ${problem.storedBits} correctly reads as ${problem.storedSigned}. Carry-out ${problem.carryOut} is a separate unsigned observation.`;
}

function showHint(kind) {
  const hints = {
    encoding:
      problem.a < 0 || problem.b < 0
        ? `For a negative value x, add 2^${problem.width} to x and write that unsigned value in ${problem.width} bits.`
        : `Convert each positive decimal value to binary and pad on the left to exactly ${problem.width} bits.`,
    prediction: `The signed range is ${problem.range.minimum} through ${problem.range.maximum}. Compute ${problem.a} ${problem.symbol} ${problem.b} before considering the bit patterns.`,
    preparation: "Invert means change every 0 to 1 and every 1 to 0. Then add 1 at the rightmost bit.",
    mechanics: "Use the same right-to-left addition mechanics as Binary Addition Practice. The extra bit beyond the register is carry-out.",
    interpretation: `If the stored MSB is 1, subtract 2^${problem.width} from the pattern’s unsigned value. Overflow occurs exactly when the mathematical result does not fit the signed range.`,
  };
  setFeedback(`${kind}Feedback`, "hint", hints[kind]);
}

byId("checkEncoding").addEventListener("click", checkEncoding);
byId("checkPrediction").addEventListener("click", checkPrediction);
byId("checkPreparation").addEventListener("click", checkPreparation);
byId("confirmUnchangedB").addEventListener("click", confirmUnchangedB);
byId("checkMechanics").addEventListener("click", checkMechanics);
byId("checkInterpretation").addEventListener("click", checkInterpretation);
byId("newTwosProblem").addEventListener("click", randomProblem);
byId("loadTwosProblem").addEventListener("click", loadCustomProblem);
all("[data-twos-mode]").forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.twosMode));
});
all("[data-hint]").forEach((button) => {
  button.addEventListener("click", () => showHint(button.dataset.hint));
});

switchMode("test");
startProblem(3, 5, "subtract", 4);
