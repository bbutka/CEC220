import assert from "node:assert/strict";
import {
  encodeHamming,
  hammingDistance,
  injectError,
  minimumDistance,
  syndromeForPositions,
} from "../shared/hamming-core.js";

for (let dataWidth = 1; dataWidth <= 9; dataWidth += 1) {
  for (let value = 0; value < 2 ** dataWidth; value += 1) {
    const data = value.toString(2).padStart(dataWidth, "0");
    const encoded = encodeHamming(data);
    assert.equal(encoded.ok, true);
    assert.equal(syndromeForPositions(encoded.positions).syndrome, 0);
    for (let position = 1; position <= encoded.total; position += 1) {
      const corrupted = injectError(encoded, position);
      assert.equal(corrupted.syndrome, position);
      const corrected = [...corrupted.positions];
      corrected[corrupted.syndrome] ^= 1;
      assert.deepEqual(corrected, encoded.positions);
    }
  }
}

assert.equal(hammingDistance("000", "111"), 3);
const distance = minimumDistance(["000", "111", "101"]);
assert.equal(distance.ok, true);
assert.equal(distance.minimum, 1);
assert.equal(distance.detectable, 0);
assert.equal(distance.correctable, 0);
console.log("Hamming core: exhaustive single-error correction passed.");

