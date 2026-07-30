export function parityCountFor(dataCount) {
  let parityCount = 0;
  while (2 ** parityCount < dataCount + parityCount + 1) parityCount += 1;
  return parityCount;
}

export function isParityPosition(position) {
  return position > 0 && (position & (position - 1)) === 0;
}

export function encodeHamming(dataBits) {
  const cleaned = String(dataBits).replaceAll(" ", "").replaceAll("_", "");
  if (!/^[01]+$/.test(cleaned)) {
    return { ok: false, error: "Data must contain only 0 and 1." };
  }
  const parityCount = parityCountFor(cleaned.length);
  const total = cleaned.length + parityCount;
  const positions = Array(total + 1).fill(0);
  let dataIndex = 0;
  for (let position = 1; position <= total; position += 1) {
    if (!isParityPosition(position)) {
      positions[position] = Number(cleaned[dataIndex]);
      dataIndex += 1;
    }
  }

  const parityDetails = [];
  for (let parity = 1; parity <= total; parity *= 2) {
    const group = [];
    let xor = 0;
    for (let position = 1; position <= total; position += 1) {
      if ((position & parity) !== 0) {
        group.push(position);
        if (position !== parity) xor ^= positions[position];
      }
    }
    positions[parity] = xor;
    parityDetails.push({ parity, group, value: xor });
  }

  return {
    ok: true,
    dataBits: cleaned,
    parityCount,
    total,
    positions,
    parityDetails,
    codeword: positions.slice(1).reverse().join(""),
  };
}

export function syndromeForPositions(positions) {
  const total = positions.length - 1;
  let syndrome = 0;
  const checks = [];
  for (let parity = 1; parity <= total; parity *= 2) {
    let xor = 0;
    const group = [];
    for (let position = 1; position <= total; position += 1) {
      if ((position & parity) !== 0) {
        group.push(position);
        xor ^= Number(positions[position]);
      }
    }
    if (xor) syndrome += parity;
    checks.push({ parity, group, result: xor });
  }
  return { syndrome, checks };
}

export function injectError(encoded, position) {
  if (position < 1 || position > encoded.total) {
    return { ok: false, error: "Error position is outside the codeword." };
  }
  const positions = [...encoded.positions];
  positions[position] = positions[position] ? 0 : 1;
  return {
    ok: true,
    position,
    positions,
    codeword: positions.slice(1).reverse().join(""),
    ...syndromeForPositions(positions),
  };
}

export function hammingDistance(left, right) {
  if (left.length !== right.length) return null;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance;
}

export function minimumDistance(codewords) {
  const cleaned = codewords.map((word) =>
    String(word).replaceAll(" ", "").replaceAll("_", ""),
  );
  if (cleaned.length < 2) {
    return { ok: false, error: "Enter at least two codewords." };
  }
  const width = cleaned[0].length;
  if (
    width === 0 ||
    cleaned.some((word) => word.length !== width || !/^[01]+$/.test(word))
  ) {
    return {
      ok: false,
      error: "Codewords must be equal-length binary strings.",
    };
  }

  const pairs = [];
  let minimum = Number.POSITIVE_INFINITY;
  for (let left = 0; left < cleaned.length; left += 1) {
    for (let right = left + 1; right < cleaned.length; right += 1) {
      const distance = hammingDistance(cleaned[left], cleaned[right]);
      minimum = Math.min(minimum, distance);
      pairs.push({
        left: cleaned[left],
        right: cleaned[right],
        distance,
      });
    }
  }
  return {
    ok: true,
    minimum,
    detectable: Math.max(0, minimum - 1),
    correctable: Math.max(0, Math.floor((minimum - 1) / 2)),
    pairs,
  };
}

