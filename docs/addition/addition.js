import {
  additionBitPosition,
  additionProfile,
  createAdditionState,
  enterAdditionPart,
  expectedAdditionColumn,
  parseAdditionOperand,
} from "../shared/addition-core.js";

const byId = (id) => document.getElementById(id);
const all = (selector) => [...document.querySelectorAll(selector)];

let mode = "test";
let state = null;
let startingProblem = null;
let mistakes = 0;
let feedback = { type: "", message: "" };

function setFeedback(type, message) {
  feedback = { type, message };
  renderFeedback();
}

function renderFeedback() {
  const target = byId("additionFeedback");
  target.className = `addition-feedback${feedback.type ? ` ${feedback.type}` : ""}`;
  target.textContent = feedback.message;
}

function startProblem(a, b, width) {
  startingProblem = { a, b, width };
  state = createAdditionState(a, b, width);
  mistakes = 0;
  feedback = { type: "", message: "" };
  render();
}

function switchMode(nextMode) {
  mode = nextMode;
  all("[data-addition-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.additionMode === mode);
  });
  byId("testSetup").hidden = mode !== "test";
  byId("customSetup").hidden = mode !== "custom";
  if (mode === "custom") byId("customAdditionA").focus();
}

function hasCarryChain(carryOut) {
  return carryOut.some(
    (carry, index) => carry === 1 && carryOut[index + 1] === 1,
  );
}

function randomProblem() {
  const width = Number(byId("testWidth").value);
  const difficulty = byId("testDifficulty").value;
  const maximum = 2 ** width - 1;
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const a = Math.floor(Math.random() * (maximum + 1));
    const b = Math.floor(Math.random() * (maximum + 1));
    const profile = additionProfile(a, b, width);
    if (profile.carryColumns.length === 0) continue;
    if (difficulty === "chain" && !hasCarryChain(profile.carryOut)) continue;
    startProblem(a, b, width);
    return;
  }
  startProblem(2 ** (width - 1) - 1, 1, width);
}

function loadCustomProblem() {
  const base = Number(byId("customAdditionBase").value);
  const width = Number(byId("customAdditionWidth").value);
  const a = parseAdditionOperand(byId("customAdditionA").value, base, width);
  const b = parseAdditionOperand(byId("customAdditionB").value, base, width);
  const error = byId("additionSetupError");
  if (!a.ok || !b.ok) {
    error.textContent = `${!a.ok ? `A: ${a.error}` : ""} ${!b.ok ? `B: ${b.error}` : ""}`.trim();
    error.classList.add("visible");
    return;
  }
  error.textContent = "";
  error.classList.remove("visible");
  startProblem(a.value, b.value, width);
}

function answerCell(index, part, value, label) {
  const active = index === state.cursor;
  const complete = value !== null;
  return `
    <div class="addition-grid-cell ${active ? "active-column" : ""}">
      <input
        class="addition-answer-input ${complete ? "correct" : ""}"
        data-addition-part="${part}"
        data-addition-index="${index}"
        inputmode="numeric"
        maxlength="1"
        aria-label="${label}"
        value="${complete ? value : ""}"
        ${active && !complete ? "" : "disabled"}
      >
    </div>
  `;
}

function renderGrid() {
  const width = state.width;
  const active = state.cursor;
  const positions = Array.from({ length: width }, (_, index) => width - 1 - index);
  const rows = [
    ['<div class="addition-grid-cell label position">bit position</div>', ...positions.map(
      (position, index) =>
        `<div class="addition-grid-cell position ${index === active ? "active-column" : ""}">${position}</div>`,
    )],
    ['<div class="addition-grid-cell label">A</div>', ...state.aBits.map(
      (bit, index) => `<div class="addition-grid-cell ${index === active ? "active-column" : ""}">${bit}</div>`,
    )],
    ['<div class="addition-grid-cell label">B</div>', ...state.bBits.map(
      (bit, index) => `<div class="addition-grid-cell ${index === active ? "active-column" : ""}">${bit}</div>`,
    )],
    ['<div class="addition-grid-cell label">carry in</div>', ...state.carryIn.map(
      (carry, index) => `<div class="addition-grid-cell ${carry === 1 ? "propagated-carry" : ""} ${index === active ? "active-column" : ""}">${carry === null ? "·" : carry}</div>`,
    )],
    ['<div class="addition-grid-cell label">result bit</div>', ...state.result.map(
      (value, index) => answerCell(index, "result", value, `Result bit ${positions[index]}`),
    )],
    ['<div class="addition-grid-cell label">carry out</div>', ...state.carryOut.map(
      (value, index) => answerCell(index, "carry", value, `Carry out from bit ${positions[index]}`),
    )],
  ];

  const grid = byId("additionGrid");
  grid.style.setProperty("--addition-width", width);
  grid.innerHTML = rows.flat().join("");
}

function renderInstruction() {
  const target = byId("additionInstruction");
  if (state.cursor < 0) {
    const profile = additionProfile(
      startingProblem.a,
      startingProblem.b,
      startingProblem.width,
    );
    target.innerHTML = `<strong>Complete.</strong> The stored ${state.width}-bit result is ${profile.storedBits}; the final carry-out is ${profile.finalCarry}.`;
    return;
  }
  const position = additionBitPosition(state, state.cursor);
  const resultDone = state.result[state.cursor] !== null;
  const carryDone = state.carryOut[state.cursor] !== null;
  const remaining = resultDone
    ? "Now enter the carry-out."
    : carryDone
      ? "Now enter the result bit."
      : "Enter the result bit and carry-out.";
  target.innerHTML = `<strong>Bit ${position}: ${state.aBits[state.cursor]} + ${state.bBits[state.cursor]} + carry-in ${state.carryIn[state.cursor]}.</strong> ${remaining}`;
}

function renderHistory() {
  const completed = state.result
    .map((resultBit, index) => ({ resultBit, index }))
    .filter(({ resultBit, index }) => resultBit !== null && state.carryOut[index] !== null)
    .reverse();
  byId("additionHistory").innerHTML = completed
    .map(({ resultBit, index }) => {
      const position = additionBitPosition(state, index);
      const total = state.aBits[index] + state.bBits[index] + state.carryIn[index];
      const destination = position === state.width - 1 ? "beyond the register" : `into bit ${position + 1}`;
      return `
        <div class="addition-history-item">
          <span>Bit ${position}: ${state.aBits[index]} + ${state.bBits[index]} + ${state.carryIn[index]} = ${total}</span>
          <code>result ${resultBit}, carry ${state.carryOut[index]} ${destination}</code>
        </div>
      `;
    })
    .join("");
}

function render() {
  byId("additionProblemText").textContent = `${state.aBits.join("")} + ${state.bBits.join("")}`;
  byId("completedColumns").textContent = String(
    state.result.filter((digit, index) => digit !== null && state.carryOut[index] !== null).length,
  );
  byId("mistakeCount").textContent = String(mistakes);
  renderInstruction();
  renderGrid();
  renderFeedback();
  renderHistory();
  if (state.cursor >= 0) {
    const nextPart = state.result[state.cursor] === null ? "result" : "carry";
    document.querySelector(
      `[data-addition-index="${state.cursor}"][data-addition-part="${nextPart}"]`,
    )?.focus();
  }
}

function submitPart(input) {
  const value = input.value.trim();
  if (!/^[01]$/.test(value)) {
    input.classList.add("incorrect");
    setFeedback("error", "Enter one bit: 0 or 1.");
    return;
  }
  const part = input.dataset.additionPart;
  const result = enterAdditionPart(state, part, value);
  if (!result.ok) {
    mistakes += 1;
    input.classList.add("incorrect");
    setFeedback("error", result.error);
    byId("mistakeCount").textContent = String(mistakes);
    return;
  }
  state = result.state;
  if (state.cursor < 0) {
    const profile = additionProfile(
      startingProblem.a,
      startingProblem.b,
      startingProblem.width,
    );
    feedback = {
      type: "success",
      message: `Correct. ${startingProblem.a} + ${startingProblem.b} = ${profile.fullBits}₂ = ${profile.result}. The register stores ${profile.storedBits}; carry-out is ${profile.finalCarry}.`,
    };
  } else {
    feedback = {
      type: "success",
      message: result.columnComplete
        ? "Column complete. Its carry-out now appears as the carry-in one column to the left."
        : `Correct ${part === "result" ? "result bit" : "carry-out"}. Complete the other entry for this column.`,
    };
  }
  render();
}

function showHint() {
  if (state.cursor < 0) {
    setFeedback("hint", "The problem is complete. Start a new one for more practice.");
    return;
  }
  const expected = expectedAdditionColumn(state);
  setFeedback(
    "hint",
    `${state.aBits[state.cursor]} + ${state.bBits[state.cursor]} + ${state.carryIn[state.cursor]} = ${expected.total}. Write ${expected.resultBit} in this column and carry ${expected.carryOut} to the next column.`,
  );
}

byId("additionGrid").addEventListener("input", (event) => {
  const input = event.target.closest("[data-addition-part]");
  if (!input || input.disabled) return;
  input.value = input.value.replace(/[^01]/g, "").slice(0, 1);
  if (input.value) submitPart(input);
});

all("[data-addition-mode]").forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.additionMode));
});
byId("newAdditionProblem").addEventListener("click", randomProblem);
byId("loadAdditionProblem").addEventListener("click", loadCustomProblem);
byId("additionHint").addEventListener("click", showHint);
byId("resetAdditionProblem").addEventListener("click", () =>
  startProblem(startingProblem.a, startingProblem.b, startingProblem.width),
);

switchMode("test");
startProblem(11, 6, 5);
