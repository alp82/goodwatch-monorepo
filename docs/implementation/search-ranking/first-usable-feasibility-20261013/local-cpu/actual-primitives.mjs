function quantizedCosines(q, query, rows) {
  const { dim, scale, values } = q;
  const scaled = new Float32Array(dim);
  for (let d = 0;d < dim; d++)
    scaled[d] = query[d] * scale[d];
  const out = [];
  for (let row = 0;row < rows.length; row++) {
    if (!rows[row])
      continue;
    let s = 0;
    const base = row * dim;
    for (let d = 0;d < dim; d++)
      s += values[base + d] * scaled[d];
    out.push(s);
  }
  return out;
}
export function meanSd(values) {
  const n = values.length;
  if (!n)
    return [0, 1];
  let mean = 0;
  for (let i = 0;i < n; i++)
    mean += values[i];
  mean /= n;
  let variance = 0;
  for (let i = 0;i < n; i++)
    variance += (values[i] - mean) ** 2;
  return [mean, Math.sqrt(variance / n) || 1];
}
export function topIds(ids, scores, k) {
  return ids.map((id, i) => [id, scores[i], i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).slice(0, k).map(([id]) => id);
}

export { quantizedCosines };
