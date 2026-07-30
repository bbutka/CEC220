import {
  nonRestoringDivisionTrace,
  shiftAddTrace,
} from "../shared/algorithm-core.js";
import { bitsFor } from "../shared/arithmetic-core.js";

const byId = (id) => document.getElementById(id);
const all = (selector) => [...document.querySelectorAll(selector)];

let trace = null;
let stepIndex = 0;
let stepVerified = false;

function selectedAlgorithm() {
  return document.querySelector('input[name="algorithm"]:checked').value;
}

function cleanBits(value) {
  return value.replaceAll(" ", "").replaceAll("_", "");
}

function setFeedback(type, message) {
  const target = byId("algorithmFeedback");
  target.className = `feedback ${type}`;
  target.textContent = message;
}

function clearFeedback() {
  byId("algorithmFeedback").className = "feedback";
  byId("algorithmFeedback").textContent = "";
}

function summaryItem(label, value) {
  return `
    <div class="summary-item">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>`;
}

function registerCard(name, bits, value, active = false) {
  return `
    <article class="register${active ? " active" : ""}">
      <div class="register-name">${name}</div>
      <div class="register-bits">${bits}</div>
      <div class="register-value">${value}</div>
    </article>`;
}

function updateSetupLabels() {
  const divide = selectedAlgorithm() === "divide";
  byId("algorithmALabel").textContent = divide ? "Dividend Q" : "Multiplicand M";
  byId("algorithmBLabel").textContent = divide ? "Divisor M" : "Multiplier Q";
  if (divide) {
    byId("controllerCallout").innerHTML = `
      <strong>One decision controls add or subtract</strong>
      Shift A:Q left. The sign of A selects A−M or A+M; the new sign
      becomes the next quotient bit.
    `;
    byId("algorithmA").value = "13";
    byId("algorithmB").value = "3";
  } else {
    byId("controllerCallout").innerHTML = `
      <strong>One repeated control decision</strong>
      Test Q₀. If it is 1, enable the product-register add. Then shift
      the multiplicand left and multiplier right.
    `;
    byId("algorithmA").value = "7";
    byId("algorithmB").value = "5";
  }
}

function loadAlgorithm() {
  const width = Number(byId("algorithmWidth").value);
  const first = Number(byId("algorithmA").value);
  const second = Number(byId("algorithmB").value);
  const max = 2 ** width - 1;
  const error = byId("algorithmError");

  if (
    !Number.isInteger(first) ||
    !Number.isInteger(second) ||
    first < 0 ||
    first > max ||
    second < 0 ||
    second > max
  ) {
    error.textContent = `Enter whole numbers from 0 through ${max}.`;
    error.classList.add("visible");
    return;
  }

  if (selectedAlgorithm() === "divide" && second === 0) {
    error.textContent = "The divisor must be nonzero.";
    error.classList.add("visible");
    return;
  }

  error.classList.remove("visible");
  trace =
    selectedAlgorithm() === "multiply"
      ? shiftAddTrace(first, second, width)
      : nonRestoringDivisionTrace(first, second, width);
  stepIndex = 0;
  stepVerified = false;
  byId("algorithmResult").classList.remove("visible");
  render();
}

function randomProblem() {
  const width = Number(byId("algorithmWidth").value);
  const max = 2 ** width - 1;
  byId("algorithmA").value = String(Math.floor(Math.random() * (max + 1)));
  byId("algorithmB").value =
    selectedAlgorithm() === "divide"
      ? String(1 + Math.floor(Math.random() * max))
      : String(Math.floor(Math.random() * (max + 1)));
  loadAlgorithm();
}

function expectedStep() {
  if (!trace || stepIndex >= trace.steps.length) return null;
  const step = trace.steps[stepIndex];
  if (trace.kind === "multiply") {
    return {
      action: step.action,
      primary: bitsFor(step.after.product, trace.width * 2),
      secondary: bitsFor(step.after.remainingQ, trace.width),
    };
  }
  return {
    action: step.action,
    primary: bitsFor(step.after.a, trace.width + 1),
    secondary: bitsFor(step.after.q, trace.width),
  };
}

function renderActionOptions(step) {
  if (trace.kind === "multiply") {
    byId("actionPrediction").innerHTML = `
      <option value="">Choose…</option>
      <option value="add">Add shifted M to P</option>
      <option value="hold">Hold P</option>
    `;
    byId("decisionQuestion").textContent =
      `Q₀ is ${step.testedBit}. What should the controller command before the shifts?`;
  } else {
    byId("actionPrediction").innerHTML = `
      <option value="">Choose…</option>
      <option value="subtract">Shift, then subtract M</option>
      <option value="add">Shift, then add M</option>
    `;
    byId("decisionQuestion").textContent =
      `A is ${step.signBefore}. Which operation follows the A:Q left shift?`;
  }
}

function renderRegisters(step) {
  if (trace.kind === "multiply") {
    byId("registerRack").innerHTML = [
      registerCard(
        "P · product accumulator",
        bitsFor(step.before.product, trace.width * 2),
        `unsigned ${step.before.product}`,
        true,
      ),
      registerCard(
        "M · shifted multiplicand",
        bitsFor(step.before.shiftedM, trace.width * 2),
        `unsigned ${step.before.shiftedM}`,
      ),
      registerCard(
        "Q · remaining multiplier",
        bitsFor(step.before.remainingQ, trace.width),
        `unsigned ${step.before.remainingQ}`,
      ),
    ].join("");
    byId("primaryPredictionLabel").textContent = "P after add/hold and shifts";
    byId("secondaryPredictionLabel").textContent = "Q after right shift";
  } else {
    byId("registerRack").innerHTML = [
      registerCard(
        "A · signed partial remainder",
        bitsFor(step.before.a, trace.width + 1),
        `signed ${step.before.a}`,
        true,
      ),
      registerCard(
        "Q · dividend / quotient",
        bitsFor(step.before.q, trace.width),
        `unsigned ${step.before.q}`,
      ),
      registerCard(
        "M · divisor",
        bitsFor(trace.divisor, trace.width),
        `unsigned ${trace.divisor}`,
      ),
    ].join("");
    byId("primaryPredictionLabel").textContent = "A after this clock";
    byId("secondaryPredictionLabel").textContent = "Q after this clock";
  }
}

function traceRows() {
  return trace.steps
    .slice(0, stepIndex)
    .map((step) => {
      if (trace.kind === "multiply") {
        return `
          <tr>
            <td>${step.cycle}</td>
            <td>${step.testedBit}</td>
            <td>${step.action === "add" ? "P ← P + M" : "P holds"}</td>
            <td>${bitsFor(step.before.product, trace.width * 2)}</td>
            <td>${bitsFor(step.before.shiftedM, trace.width * 2)}</td>
            <td>${bitsFor(step.before.remainingQ, trace.width)}</td>
            <td>${bitsFor(step.after.product, trace.width * 2)}</td>
            <td>${bitsFor(step.after.remainingQ, trace.width)}</td>
          </tr>`;
      }
      return `
        <tr>
          <td>${step.cycle}</td>
          <td>${step.signBefore}</td>
          <td>${step.action === "subtract" ? "A ← A − M" : "A ← A + M"}</td>
          <td>${bitsFor(step.before.a, trace.width + 1)}</td>
          <td>${bitsFor(step.before.q, trace.width)}</td>
          <td>${bitsFor(step.after.a, trace.width + 1)}</td>
          <td>${bitsFor(step.after.q, trace.width)}</td>
          <td>${step.quotientBit}</td>
        </tr>`;
    })
    .join("");
}

function renderTrace() {
  if (trace.kind === "multiply") {
    byId("algorithmTrace").innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Cycle</th><th>Q₀</th><th>Control action</th><th>P before</th>
          <th>M before</th><th>Q before</th><th>P after</th><th>Q after</th>
        </tr></thead>
        <tbody>${traceRows() || '<tr><td colspan="8">No completed clocks yet.</td></tr>'}</tbody>
      </table>`;
    byId("traceNote").textContent =
      `Invariant: P + (shifted M × remaining Q) remains ${trace.multiplicand * trace.multiplier}.`;
  } else {
    byId("algorithmTrace").innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Cycle</th><th>A sign</th><th>Control action</th><th>A before</th>
          <th>Q before</th><th>A after</th><th>Q after</th><th>new Q₀</th>
        </tr></thead>
        <tbody>${traceRows() || '<tr><td colspan="8">No completed clocks yet.</td></tr>'}</tbody>
      </table>`;
    byId("traceNote").textContent =
      "A is a signed partial remainder. If it finishes negative, one final A + M correction restores the nonnegative remainder.";
  }
}

function render() {
  if (!trace) return;
  const finished = stepIndex >= trace.steps.length;
  byId("cycleBadge").textContent = finished
    ? "Complete"
    : `Cycle ${stepIndex + 1} of ${trace.steps.length}`;
  byId("decisionBox").hidden = finished;
  byId("advanceAlgorithm").disabled = !stepVerified;
  clearFeedback();
  byId("actionPrediction").value = "";
  byId("primaryPrediction").value = "";
  byId("secondaryPrediction").value = "";
  for (const id of ["actionPrediction", "primaryPrediction", "secondaryPrediction"]) {
    byId(id).classList.remove("invalid");
  }

  if (!finished) {
    const step = trace.steps[stepIndex];
    renderRegisters(step);
    renderActionOptions(step);
  }
  renderTrace();
  if (finished) showResult();
}

function checkStep() {
  const expected = expectedStep();
  if (!expected) return;
  const actionCorrect = byId("actionPrediction").value === expected.action;
  const primaryCorrect =
    cleanBits(byId("primaryPrediction").value) === expected.primary;
  const secondaryCorrect =
    cleanBits(byId("secondaryPrediction").value) === expected.secondary;

  byId("actionPrediction").classList.toggle("invalid", !actionCorrect);
  byId("primaryPrediction").classList.toggle("invalid", !primaryCorrect);
  byId("secondaryPrediction").classList.toggle("invalid", !secondaryCorrect);

  if (!actionCorrect) {
    setFeedback(
      "error",
      trace.kind === "multiply"
        ? "Check Q₀ first; it alone selects add or hold."
        : "The sign of A before the shift selects subtract or add.",
    );
  } else if (!primaryCorrect) {
    setFeedback(
      "error",
      `The control decision is correct. Recompute the next ${trace.kind === "multiply" ? "P" : "A"} register.`,
    );
  } else if (!secondaryCorrect) {
    setFeedback(
      "error",
      `The first register is correct. Check the shift and the new ${trace.kind === "divide" ? "quotient bit" : "Q value"}.`,
    );
  } else {
    stepVerified = true;
    byId("advanceAlgorithm").disabled = false;
    setFeedback(
      "success",
      "Correct. The control decision and both register updates agree.",
    );
  }
}

function revealStep() {
  const expected = expectedStep();
  if (!expected) return;
  byId("actionPrediction").value = expected.action;
  byId("primaryPrediction").value = expected.primary;
  byId("secondaryPrediction").value = expected.secondary;
  stepVerified = true;
  byId("advanceAlgorithm").disabled = false;
  setFeedback(
    "hint",
    "This clock is revealed. Explain which tested condition selected the action before advancing.",
  );
}

function advance() {
  if (!stepVerified) return;
  stepIndex += 1;
  stepVerified = false;
  render();
}

function runToEnd() {
  if (!trace) return;
  stepIndex = trace.steps.length;
  stepVerified = false;
  render();
}

function showResult() {
  if (trace.kind === "multiply") {
    byId("algorithmEquation").textContent =
      `${trace.multiplicand} × ${trace.multiplier} = ${trace.result}`;
    byId("algorithmSummary").innerHTML = [
      summaryItem("Product bits", `${trace.resultBits}₂`),
      summaryItem("Product decimal", trace.result),
      summaryItem("Clock cycles", trace.width),
    ].join("");
    byId("algorithmExplanation").textContent =
      "The datapath never performed a primitive multiply. A controller tested one multiplier bit per clock and selected add or hold while the operands shifted.";
  } else {
    byId("algorithmEquation").textContent =
      `${trace.dividend} = ${trace.divisor} × ${trace.quotient} + ${trace.remainder}`;
    byId("algorithmSummary").innerHTML = [
      summaryItem("Quotient", `${trace.quotientBits}₂ = ${trace.quotient}`),
      summaryItem("Remainder", `${trace.remainderBits}₂ = ${trace.remainder}`),
      summaryItem("Final correction", trace.correctionNeeded ? "A ← A + M" : "Not required"),
    ].join("");
    byId("algorithmExplanation").textContent =
      "The identity dividend = divisor × quotient + remainder verifies the final registers independently of the trace.";
  }
  byId("algorithmResult").classList.add("visible");
}

all('input[name="algorithm"]').forEach((input) => {
  input.addEventListener("change", () => {
    updateSetupLabels();
    loadAlgorithm();
  });
});
byId("loadAlgorithm").addEventListener("click", loadAlgorithm);
byId("randomAlgorithm").addEventListener("click", randomProblem);
byId("checkAlgorithmStep").addEventListener("click", checkStep);
byId("revealAlgorithmStep").addEventListener("click", revealStep);
byId("advanceAlgorithm").addEventListener("click", advance);
byId("runToEnd").addEventListener("click", runToEnd);

loadAlgorithm();

