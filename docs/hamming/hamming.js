import {
  encodeHamming,
  injectError,
  isParityPosition,
  minimumDistance,
} from "../shared/hamming-core.js";

const byId = (id) => document.getElementById(id);
let encoded = null;
let corrupted = null;

function setFeedback(id, type, message) {
  const target = byId(id);
  target.className = `feedback ${type}`;
  target.textContent = message;
}

function summaryItem(label, value) {
  return `
    <div class="summary-item">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>`;
}

function buildCode() {
  const result = encodeHamming(byId("dataBits").value);
  const error = byId("hammingError");
  if (!result.ok || result.dataBits.length > 11) {
    error.textContent =
      result.error ?? "Use no more than 11 data bits.";
    error.classList.add("visible");
    return;
  }
  error.classList.remove("visible");
  encoded = result;
  corrupted = null;
  renderPositions();
  renderErrorSelector();
  byId("codewordBanner").classList.remove("visible");
  byId("errorRepresentations").innerHTML = "";
  byId("syndromeAnswer").value = "";
  setFeedback("parityFeedback", "", "");
  setFeedback("syndromeFeedback", "", "");
}

function renderPositions() {
  byId("positionGrid").innerHTML = Array.from(
    { length: encoded.total },
    (_, offset) => offset + 1,
  )
    .map((position) => {
      const parity = isParityPosition(position);
      return `
        <div class="position-cell${parity ? " parity" : ""}">
          <div class="position-label">position ${position}</div>
          <div class="position-role">${parity ? `parity P${position}` : "data"}</div>
          ${
            parity
              ? `<input aria-label="Parity bit at position ${position}" maxlength="1" inputmode="numeric" data-parity-position="${position}">`
              : `<div class="position-value">${encoded.positions[position]}</div>`
          }
        </div>`;
    })
    .join("");
}

function renderErrorSelector() {
  byId("errorPosition").innerHTML = Array.from(
    { length: encoded.total },
    (_, offset) => offset + 1,
  )
    .map(
      (position) =>
        `<option value="${position}">Position ${position}${isParityPosition(position) ? " · parity" : " · data"}</option>`,
    )
    .join("");
}

function checkParity() {
  const inputs = [...document.querySelectorAll("[data-parity-position]")];
  let firstWrong = null;
  for (const input of inputs) {
    const position = Number(input.dataset.parityPosition);
    const correct = input.value.trim() === String(encoded.positions[position]);
    input.classList.toggle("invalid", !correct);
    if (!correct && !firstWrong) firstWrong = position;
  }
  if (firstWrong) {
    setFeedback(
      "parityFeedback",
      "error",
      `Recheck parity position ${firstWrong}. XOR the other bits in its group so the complete group has even parity.`,
    );
    return false;
  }
  setFeedback(
    "parityFeedback",
    "success",
    `All ${encoded.parityCount} parity bits are correct.`,
  );
  byId("encodedWord").textContent = encoded.codeword;
  byId("codewordBanner").classList.add("visible");
  return true;
}

function showParityGroups() {
  const text = encoded.parityDetails
    .map(
      (detail) =>
        `P${detail.parity} checks positions ${detail.group.join(", ")}`,
    )
    .join(" · ");
  setFeedback("parityFeedback", "hint", text);
}

function injectSelectedError() {
  if (!checkParity()) {
    setFeedback(
      "syndromeFeedback",
      "error",
      "Complete the parity bits before injecting an error.",
    );
    return;
  }
  const position = Number(byId("errorPosition").value);
  corrupted = injectError(encoded, position);
  byId("syndromeAnswer").value = "";
  byId("errorRepresentations").innerHTML = [
    summaryItem("Transmitted", encoded.codeword),
    summaryItem("Received", corrupted.codeword),
    summaryItem("Changed position", position),
  ].join("");
  setFeedback(
    "syndromeFeedback",
    "hint",
    "Recalculate every parity check. Interpret the failed checks as the binary bits of the error position.",
  );
}

function checkSyndrome() {
  if (!corrupted) {
    setFeedback("syndromeFeedback", "error", "Inject an error first.");
    return;
  }
  const answer = Number(byId("syndromeAnswer").value);
  if (
    byId("syndromeAnswer").value.trim() === "" ||
    answer !== corrupted.syndrome
  ) {
    byId("syndromeAnswer").classList.add("invalid");
    const failed = corrupted.checks
      .filter((check) => check.result)
      .map((check) => `P${check.parity}`)
      .join(", ");
    setFeedback(
      "syndromeFeedback",
      "error",
      `The failed parity checks are ${failed || "none"}. Add their position weights.`,
    );
    return;
  }
  byId("syndromeAnswer").classList.remove("invalid");
  const corrected = [...corrupted.positions];
  corrected[corrupted.syndrome] ^= 1;
  const correctedWord = corrected.slice(1).reverse().join("");
  byId("errorRepresentations").innerHTML = [
    summaryItem("Received", corrupted.codeword),
    summaryItem("Syndrome", `${corrupted.syndrome} → position ${corrupted.syndrome}`),
    summaryItem("Corrected", correctedWord),
  ].join("");
  setFeedback(
    "syndromeFeedback",
    "success",
    `Correct. Syndrome ${corrupted.syndrome} identifies and corrects the flipped bit.`,
  );
}

function calculateDistance() {
  const words = byId("codewordSet").value
    .split(/\r?\n/)
    .map((word) => word.trim())
    .filter(Boolean);
  const result = minimumDistance(words);
  if (!result.ok) {
    setFeedback("distanceFeedback", "error", result.error);
    byId("distanceSummary").innerHTML = "";
    return;
  }
  setFeedback(
    "distanceFeedback",
    "success",
    `Checked ${result.pairs.length} codeword pairs. The smallest separation controls the guarantee.`,
  );
  byId("distanceSummary").innerHTML = [
    summaryItem("Minimum distance", result.minimum),
    summaryItem("Guaranteed detection", `${result.detectable} error${result.detectable === 1 ? "" : "s"}`),
    summaryItem("Guaranteed correction", `${result.correctable} error${result.correctable === 1 ? "" : "s"}`),
  ].join("");
}

function randomData() {
  const width = 4 + Math.floor(Math.random() * 5);
  byId("dataBits").value = Array.from(
    { length: width },
    () => (Math.random() < 0.5 ? "0" : "1"),
  ).join("");
  buildCode();
}

byId("buildCode").addEventListener("click", buildCode);
byId("randomCode").addEventListener("click", randomData);
byId("checkParity").addEventListener("click", checkParity);
byId("parityHint").addEventListener("click", showParityGroups);
byId("injectError").addEventListener("click", injectSelectedError);
byId("checkSyndrome").addEventListener("click", checkSyndrome);
byId("calculateDistance").addEventListener("click", calculateDistance);

buildCode();
calculateDistance();

