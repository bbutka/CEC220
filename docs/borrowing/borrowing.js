import {
  bitPosition,
  borrowProfile,
  chooseBorrowSource,
  correctBorrowSource,
  createBorrowState,
  enterResultDigit,
  needsBorrow,
  parseBorrowOperand,
} from "../shared/borrowing-core.js";

const byId = (id) => document.getElementById(id);
const all = (selector) => [...document.querySelectorAll(selector)];

let mode = "test";
let state = null;
let startingProblem = null;
let mistakes = 0;
let lastWrongSource = null;
let feedback = { type: "", message: "" };

function setFeedback(type, message) {
  feedback = { type, message };
  renderFeedback();
}

function renderFeedback() {
  const target = byId("borrowFeedback");
  target.className = `borrow-feedback${feedback.type ? ` ${feedback.type}` : ""}`;
  target.textContent = feedback.message;
}

function startProblem(a, b, width) {
  startingProblem = { a, b, width };
  state = createBorrowState(a, b, width);
  mistakes = 0;
  lastWrongSource = null;
  feedback = { type: "", message: "" };
  render();
}

function switchMode(nextMode) {
  mode = nextMode;
  all("[data-borrow-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.borrowMode === mode);
  });
  byId("testSetup").hidden = mode !== "test";
  byId("customSetup").hidden = mode !== "custom";
  if (mode === "custom") byId("customBorrowA").focus();
}

function randomProblem() {
  const width = Number(byId("testWidth").value);
  const difficulty = byId("testDifficulty").value;
  const maximum = 2 ** width - 1;
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const a = 1 + Math.floor(Math.random() * maximum);
    const b = Math.floor(Math.random() * (a + 1));
    const profile = borrowProfile(a, b, width);
    if (!profile.ok || profile.loans.length === 0) continue;
    const crossesZero = profile.loans.some(
      (loan) => loan.sourceIndex + 1 < loan.targetIndex,
    );
    if (difficulty === "zeros" && !crossesZero) continue;
    startProblem(a, b, width);
    return;
  }
  startProblem(8, 1, Math.max(4, width));
}

function loadCustomProblem() {
  const base = Number(byId("customBorrowBase").value);
  const width = Number(byId("customBorrowWidth").value);
  const a = parseBorrowOperand(byId("customBorrowA").value, base, width);
  const b = parseBorrowOperand(byId("customBorrowB").value, base, width);
  const error = byId("borrowSetupError");
  if (!a.ok || !b.ok) {
    error.textContent = `${!a.ok ? `A: ${a.error}` : ""} ${!b.ok ? `B: ${b.error}` : ""}`.trim();
    error.classList.add("visible");
    return;
  }
  if (a.value < b.value) {
    error.textContent =
      "This unsigned mechanics exercise requires A ≥ B. Negative results belong in the later signed-number lesson.";
    error.classList.add("visible");
    return;
  }
  error.textContent = "";
  error.classList.remove("visible");
  startProblem(a.value, b.value, width);
}

function aDigitMarkup(value) {
  return value === 2
    ? '<span class="temporary-two">2 <small>= 10₂</small></span>'
    : String(value);
}

function renderGrid() {
  const width = state.width;
  const active = state.cursor;
  const borrowing = needsBorrow(state);
  const positions = Array.from({ length: width }, (_, index) => width - 1 - index);
  const header = [
    '<div class="borrow-grid-cell label position">bit position</div>',
    ...positions.map(
      (position, index) =>
        `<div class="borrow-grid-cell position ${index === active ? "active-column" : ""}">${position}</div>`,
    ),
  ];
  const aRow = ['<div class="borrow-grid-cell label">A</div>'];
  const bRow = ['<div class="borrow-grid-cell label">B</div>'];
  const resultRow = ['<div class="borrow-grid-cell label">result</div>'];

  for (let index = 0; index < width; index += 1) {
    const candidate = borrowing && index < active;
    const changed = state.aDigits[index] !== Number(state.originalA[index]);
    aRow.push(`
      <div class="borrow-grid-cell ${candidate ? "source-candidate" : ""} ${changed ? "changed" : ""} ${index === active ? "active-column" : ""}">
        <button type="button" class="borrow-digit ${candidate ? "candidate" : ""}" data-source-index="${index}" ${candidate ? "" : "disabled"} aria-label="A bit ${bitPosition(state, index)} has value ${state.aDigits[index]}">
          ${aDigitMarkup(state.aDigits[index])}
        </button>
      </div>
    `);
    bRow.push(
      `<div class="borrow-grid-cell ${index === active ? "active-column" : ""}">${state.bBits[index]}</div>`,
    );
    const completed = state.result[index] !== null;
    resultRow.push(`
      <div class="borrow-grid-cell ${index === active ? "active-column" : ""}">
        <input class="borrow-result-input ${completed ? "correct" : ""}" data-result-index="${index}" inputmode="numeric" maxlength="1" aria-label="Result bit ${positions[index]}" value="${completed ? state.result[index] : ""}" ${index === active && !borrowing ? "" : "disabled"}>
      </div>
    `);
  }

  const grid = byId("borrowGrid");
  grid.style.setProperty("--borrow-width", width);
  grid.innerHTML = [...header, ...aRow, ...bRow, ...resultRow].join("");
}

function renderInstruction() {
  const target = byId("borrowInstruction");
  if (state.cursor < 0) {
    target.innerHTML = `<strong>Complete.</strong> The transformed A row is ${state.aDigits.join("")}; the result is ${state.result.join("")}.`;
    return;
  }
  const position = bitPosition(state, state.cursor);
  const aDigit = state.aDigits[state.cursor];
  const bDigit = state.bBits[state.cursor];
  if (needsBorrow(state)) {
    target.innerHTML = `<strong>Bit ${position}: ${aDigit} − ${bDigit} needs a borrow.</strong> Click the bit in A that should supply the loan.`;
  } else {
    target.innerHTML = `<strong>Bit ${position}: ${aDigit} − ${bDigit}.</strong> Enter the result bit in the highlighted column.`;
  }
}

function renderHistory() {
  byId("borrowHistory").innerHTML = state.loans
    .map(
      (loan) => `
        <div class="borrow-history-item">
          <span>Bit ${loan.sourcePosition} supplies bit ${loan.targetPosition}:</span>
          <code>${loan.before} → ${loan.after}</code>
        </div>
      `,
    )
    .join("");
}

function render() {
  byId("borrowProblemText").textContent =
    `${state.originalA} − ${state.bBits.join("")}`;
  byId("completedColumns").textContent = String(
    state.result.filter((digit) => digit !== null).length,
  );
  byId("mistakeCount").textContent = String(mistakes);
  renderInstruction();
  renderGrid();
  renderFeedback();
  renderHistory();
  if (state.cursor >= 0 && !needsBorrow(state)) {
    document.querySelector(`[data-result-index="${state.cursor}"]`)?.focus();
  }
}

function chooseSource(index) {
  const result = chooseBorrowSource(state, index);
  if (!result.ok) {
    mistakes += 1;
    lastWrongSource = index;
    setFeedback("error", result.error);
    byId("mistakeCount").textContent = String(mistakes);
    return;
  }
  state = result.state;
  lastWrongSource = null;
  feedback = {
    type: "success",
    message: `Correct: bit ${result.loan.sourcePosition} supplies bit ${result.loan.targetPosition}. A changes from ${result.loan.before} to ${result.loan.after}.`,
  };
  render();
}

function submitResult(input) {
  const value = input.value.trim();
  if (!/^[01]$/.test(value)) {
    input.classList.add("incorrect");
    setFeedback("error", "Enter one result bit: 0 or 1.");
    return;
  }
  const result = enterResultDigit(state, value);
  if (!result.ok) {
    mistakes += 1;
    input.classList.add("incorrect");
    setFeedback("error", result.error);
    byId("mistakeCount").textContent = String(mistakes);
    return;
  }
  state = result.state;
  feedback = {
    type: "success",
    message:
      state.cursor < 0
        ? `Correct. ${startingProblem.a} − ${startingProblem.b} = ${state.result.join("")}₂ = ${startingProblem.a - startingProblem.b}.`
        : "Correct. Move one column to the left.",
  };
  render();
}

function showHint() {
  if (state.cursor < 0) {
    setFeedback("hint", "The problem is complete. Start a new one for more practice.");
    return;
  }
  if (needsBorrow(state)) {
    const source = correctBorrowSource(state);
    const targetPosition = bitPosition(state, state.cursor);
    const sourcePosition = source === null ? null : bitPosition(state, source);
    setFeedback(
      "hint",
      source === null
        ? "No 1 exists to the left; this would be an unsigned negative result."
        : `Start at bit ${targetPosition} and scan left. The first nonzero A digit is at bit ${sourcePosition}.`,
    );
  } else {
    setFeedback(
      "hint",
      `Subtract the highlighted column only: ${state.aDigits[state.cursor]} − ${state.bBits[state.cursor]}.`,
    );
  }
}

byId("borrowGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-source-index]");
  if (!button || button.disabled) return;
  chooseSource(Number(button.dataset.sourceIndex));
});

byId("borrowGrid").addEventListener("input", (event) => {
  const input = event.target.closest("[data-result-index]");
  if (!input || input.disabled) return;
  input.value = input.value.replace(/[^01]/g, "").slice(0, 1);
  if (input.value) submitResult(input);
});

all("[data-borrow-mode]").forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.borrowMode));
});
byId("newBorrowProblem").addEventListener("click", randomProblem);
byId("loadBorrowProblem").addEventListener("click", loadCustomProblem);
byId("borrowHint").addEventListener("click", showHint);
byId("resetBorrowProblem").addEventListener("click", () =>
  startProblem(startingProblem.a, startingProblem.b, startingProblem.width),
);

switchMode("test");
startProblem(36, 9, 6);
