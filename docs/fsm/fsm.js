import {
  createTransitionRows,
  defaultEncodings,
  deriveDffEquations,
  validateMachine,
  verifyDerivedMachine,
} from "../shared/fsm-core.js";

const byId = (id) => document.getElementById(id);
let machine = null;
let latestDerivation = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseNames(id) {
  return byId(id).value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function setFeedback(id, type, message) {
  const target = byId(id);
  target.className = `feedback ${type}`;
  target.textContent = message;
}

function clearFeedback(id) {
  const target = byId(id);
  target.className = "feedback";
  target.textContent = "";
}

function validateVocabulary(states, inputs, outputs) {
  const errors = [];
  const identifier = /^[A-Za-z][A-Za-z0-9_]*$/;
  if (states.length < 2) errors.push("Enter at least two states.");
  if (inputs.length < 1) errors.push("Enter at least one input.");
  if (outputs.length < 1) errors.push("Enter at least one output.");
  for (const name of [...states, ...inputs, ...outputs]) {
    if (!identifier.test(name)) {
      errors.push(`${name || "(blank)"} is not a simple identifier.`);
    }
  }
  if (new Set(states).size !== states.length) errors.push("State names repeat.");
  const signalNames = [...inputs, ...outputs];
  if (new Set(signalNames).size !== signalNames.length) {
    errors.push("Input and output signal names must be unique.");
  }
  return errors;
}

function machineFromVocabulary() {
  const states = parseNames("states");
  const inputs = parseNames("inputs");
  const outputs = parseNames("outputs");
  const errors = validateVocabulary(states, inputs, outputs);
  if (errors.length) {
    const box = byId("specError");
    box.textContent = errors.join(" ");
    box.classList.add("visible");
    return null;
  }
  byId("specError").classList.remove("visible");
  return {
    states,
    inputs,
    outputs,
    encodings: defaultEncodings(states),
    rows: createTransitionRows(states, inputs, outputs),
  };
}

function stateOptions(selected = "") {
  return [
    '<option value="">Choose…</option>',
    ...machine.states.map(
      (state) =>
        `<option value="${escapeHtml(state)}"${state === selected ? " selected" : ""}>${escapeHtml(state)}</option>`,
    ),
  ].join("");
}

function renderTransitionTable() {
  const headers = [
    "Present state",
    ...machine.inputs,
    "Next state",
    ...machine.outputs,
  ];

  const rows = machine.rows
    .map(
      (row, rowIndex) => `
        <tr data-row="${rowIndex}">
          <td>${escapeHtml(row.presentState)}</td>
          ${machine.inputs.map((input) => `<td class="locked-bit">${Number(row.inputs[input])}</td>`).join("")}
          <td>
            <select aria-label="Next state for row ${rowIndex + 1}" data-next-state="${rowIndex}">
              ${stateOptions(row.nextState)}
            </select>
          </td>
          ${machine.outputs
            .map(
              (output) => `
                <td>
                  <select aria-label="${escapeHtml(output)} for row ${rowIndex + 1}" data-output="${escapeHtml(output)}" data-output-row="${rowIndex}">
                    <option value="0"${Number(row.outputs[output]) === 0 ? " selected" : ""}>0</option>
                    <option value="1"${Number(row.outputs[output]) === 1 ? " selected" : ""}>1</option>
                  </select>
                </td>`,
            )
            .join("")}
        </tr>`,
    )
    .join("");

  byId("transitionTable").innerHTML = `
    <table class="data-table">
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  document.querySelectorAll("[data-next-state]").forEach((select) => {
    select.addEventListener("change", () => {
      machine.rows[Number(select.dataset.nextState)].nextState = select.value;
      latestDerivation = null;
      clearEquationResults();
    });
  });
  document.querySelectorAll("[data-output-row]").forEach((select) => {
    select.addEventListener("change", () => {
      const row = machine.rows[Number(select.dataset.outputRow)];
      row.outputs[select.dataset.output] = Number(select.value);
      latestDerivation = null;
      clearEquationResults();
    });
  });
}

function renderEncodingTable() {
  const width = Object.values(machine.encodings)[0]?.length ?? 1;
  byId("encodingTable").innerHTML = `
    <table class="data-table" style="min-width: 420px">
      <thead><tr><th>State</th><th>${width}-bit encoding</th><th>Meaning</th></tr></thead>
      <tbody>
        ${machine.states
          .map(
            (state, index) => `
              <tr>
                <td>${escapeHtml(state)}</td>
                <td>
                  <input
                    aria-label="Encoding for ${escapeHtml(state)}"
                    value="${machine.encodings[state]}"
                    maxlength="${width}"
                    data-encoding-state="${escapeHtml(state)}"
                  >
                </td>
                <td>${index === 0 ? "Reset / initial state" : "Defined behavior state"}</td>
              </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;

  document.querySelectorAll("[data-encoding-state]").forEach((input) => {
    input.addEventListener("input", () => {
      machine.encodings[input.dataset.encodingState] = input.value.trim();
      latestDerivation = null;
      clearEquationResults();
    });
  });
}

function renderMachine() {
  renderTransitionTable();
  renderEncodingTable();
  latestDerivation = null;
  clearEquationResults();
  clearFeedback("tableFeedback");
  clearFeedback("encodingFeedback");
}

function buildBlank() {
  const nextMachine = machineFromVocabulary();
  if (!nextMachine) return;
  machine = nextMachine;
  renderMachine();
}

function controllerExample() {
  byId("states").value = "IDLE, LOAD, RUN, DONE";
  byId("inputs").value = "start, zero";
  byId("outputs").value = "load, shift, done";
  byId("outputModel").value = "moore";
  machine = machineFromVocabulary();
  if (!machine) return;

  for (const row of machine.rows) {
    const start = row.inputs.start;
    const zero = row.inputs.zero;
    if (row.presentState === "IDLE") {
      row.nextState = start ? "LOAD" : "IDLE";
    } else if (row.presentState === "LOAD") {
      row.nextState = "RUN";
    } else if (row.presentState === "RUN") {
      row.nextState = zero ? "DONE" : "RUN";
    } else {
      row.nextState = "IDLE";
    }
    row.outputs.load = row.presentState === "LOAD" ? 1 : 0;
    row.outputs.shift = row.presentState === "RUN" ? 1 : 0;
    row.outputs.done = row.presentState === "DONE" ? 1 : 0;
  }
  renderMachine();
}

function mooreErrors() {
  if (byId("outputModel").value !== "moore") return [];
  const errors = [];
  for (const state of machine.states) {
    const rows = machine.rows.filter((row) => row.presentState === state);
    for (const output of machine.outputs) {
      const values = new Set(rows.map((row) => Number(row.outputs[output])));
      if (values.size > 1) {
        errors.push(
          `${output} changes with the input while in ${state}; that is Mealy behavior.`,
        );
      }
    }
  }
  return errors;
}

function validateCurrentMachine(showFeedback = true) {
  if (!machine) return { ok: false, errors: ["Build a table first."] };
  const result = validateMachine(machine);
  const errors = [...result.errors, ...mooreErrors()];
  const combined = { ...result, ok: errors.length === 0, errors };
  if (showFeedback) {
    if (combined.ok) {
      setFeedback(
        "tableFeedback",
        "success",
        `Complete: ${machine.rows.length} transitions account for every state and input combination.`,
      );
    } else {
      setFeedback(
        "tableFeedback",
        "error",
        `${errors[0]}${errors.length > 1 ? ` (${errors.length - 1} additional issue${errors.length > 2 ? "s" : ""})` : ""}`,
      );
    }
  }
  return combined;
}

function csvText() {
  const header = [
    "present_state",
    ...machine.inputs,
    "next_state",
    ...machine.outputs,
  ];
  const lines = machine.rows.map((row) =>
    [
      row.presentState,
      ...machine.inputs.map((input) => row.inputs[input]),
      row.nextState,
      ...machine.outputs.map((output) => row.outputs[output]),
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

async function copyText(text, feedbackId, message) {
  try {
    await navigator.clipboard.writeText(text);
    setFeedback(feedbackId, "success", message);
  } catch {
    setFeedback(
      feedbackId,
      "error",
      "Clipboard access was unavailable. Select and copy the text manually.",
    );
  }
}

function parseCsv() {
  if (!machine) {
    setFeedback("csvFeedback", "error", "Build the machine vocabulary first.");
    return;
  }
  const lines = byId("csvInput").value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    setFeedback("csvFeedback", "error", "Paste a header and at least one row.");
    return;
  }
  const expected = [
    "present_state",
    ...machine.inputs,
    "next_state",
    ...machine.outputs,
  ];
  const header = lines[0].split(",").map((cell) => cell.trim());
  if (
    header.length !== expected.length ||
    header.some((name, index) => name !== expected[index])
  ) {
    setFeedback(
      "csvFeedback",
      "error",
      `Expected header: ${expected.join(",")}`,
    );
    return;
  }

  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const inputStart = 1;
    const nextIndex = 1 + machine.inputs.length;
    const outputStart = nextIndex + 1;
    return {
      presentState: cells[0] ?? "",
      inputs: Object.fromEntries(
        machine.inputs.map((name, index) => [
          name,
          Number(cells[inputStart + index]),
        ]),
      ),
      nextState: cells[nextIndex] ?? "",
      outputs: Object.fromEntries(
        machine.outputs.map((name, index) => [
          name,
          Number(cells[outputStart + index]),
        ]),
      ),
    };
  });

  const candidate = { ...machine, rows };
  const result = validateMachine(candidate);
  if (!result.ok) {
    setFeedback("csvFeedback", "error", result.errors[0]);
    return;
  }
  machine.rows = rows;
  renderTransitionTable();
  clearEquationResults();
  setFeedback(
    "csvFeedback",
    "success",
    `Imported ${rows.length} complete transitions. Check representative rows before deriving equations.`,
  );
}

function aiPrompt() {
  const states = parseNames("states");
  const inputs = parseNames("inputs");
  const outputs = parseNames("outputs");
  const columns = [
    "present_state",
    ...inputs,
    "next_state",
    ...outputs,
  ];
  return `You are formatting an FSM specification for independent verification.

States: ${states.join(", ")}
Inputs: ${inputs.join(", ")}
Outputs: ${outputs.join(", ")}

Expand the behavioral specification below into an exhaustive transition table.
Do not choose a state encoding. Do not minimize or derive equations.
Return CSV only, using these exact columns in this exact order:
${columns.join(",")}

Use one row for every present-state and input combination.
Use only 0 or 1 in input and output columns.
If the specification is incomplete, contradictory, or ambiguous, do not invent behavior. Instead return a short list of the unresolved cases.

Behavioral specification:
[PASTE THE SPECIFICATION HERE]`;
}

function clearEquationResults() {
  byId("equationList").innerHTML =
    '<div class="microcopy">Complete and validate the transition table first.</div>';
  byId("verificationResult").innerHTML = "";
  byId("copyEquations").disabled = true;
}

function deriveEquations() {
  const validation = validateCurrentMachine(true);
  if (!validation.ok) {
    setFeedback(
      "encodingFeedback",
      "error",
      "Resolve the transition-table issue before deriving equations.",
    );
    return;
  }

  const derivation = deriveDffEquations(machine);
  if (!derivation.ok) {
    setFeedback("encodingFeedback", "error", derivation.errors[0]);
    return;
  }

  latestDerivation = derivation;
  const verification = verifyDerivedMachine(machine, derivation);
  byId("equationList").innerHTML = derivation.functions
    .map(
      (fn) => `
        <article class="equation-card">
          <div class="equation-name">${fn.kind === "next-state" ? "DFF input" : "output"} · ${escapeHtml(fn.name)}</div>
          <div class="equation-value">${escapeHtml(fn.name)} = ${escapeHtml(fn.expression)}</div>
          <div class="equation-meta">
            On-set minterms: ${fn.minterms.length ? fn.minterms.join(", ") : "none"}
            · Variable order: ${derivation.variables.map(escapeHtml).join(", ")}
          </div>
        </article>`,
    )
    .join("");

  byId("verificationResult").innerHTML = verification.ok
    ? `
      <div class="verification-strip">
        <div class="verification-icon">✓</div>
        <div>
          <strong>Exhaustive verification passed</strong>
          <span>Every generated D-input and output equation reproduces all ${machine.rows.length} transition rows.</span>
        </div>
      </div>`
    : `
      <div class="verification-strip fail">
        <div class="verification-icon">!</div>
        <div>
          <strong>Verification failed</strong>
          <span>First counterexample: ${escapeHtml(JSON.stringify(verification.failures[0]))}</span>
        </div>
      </div>`;

  setFeedback(
    "encodingFeedback",
    verification.ok ? "success" : "error",
    verification.ok
      ? `Encoding is valid. ${derivation.functions.length} equations were derived and checked.`
      : "The derived equations produced a counterexample.",
  );
  byId("copyEquations").disabled = !verification.ok;
}

function equationText() {
  if (!latestDerivation) return "";
  return [
    `Variable order: ${latestDerivation.variables.join(", ")}`,
    ...latestDerivation.functions.map((fn) => `${fn.name} = ${fn.expression}`),
    `Verified against ${machine.rows.length} transition rows.`,
  ].join("\n");
}

byId("loadExample").addEventListener("click", controllerExample);
byId("buildBlank").addEventListener("click", buildBlank);
byId("checkTable").addEventListener("click", () =>
  validateCurrentMachine(true),
);
byId("copyCsv").addEventListener("click", () => {
  if (!machine) return;
  copyText(csvText(), "tableFeedback", "Transition table copied as CSV.");
});
byId("importCsv").addEventListener("click", parseCsv);
byId("copyAiPrompt").addEventListener("click", () =>
  copyText(
    aiPrompt(),
    "promptFeedback",
    "Constrained ChatGPT prompt copied.",
  ),
);
byId("deriveEquations").addEventListener("click", deriveEquations);
byId("copyEquations").addEventListener("click", () =>
  copyText(
    equationText(),
    "encodingFeedback",
    "Verified equations copied.",
  ),
);

controllerExample();

