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
export const WEIGHTS = {
  dense: 0.4,
  fingerprint: 0.48,
  bm25: 0.12,
  facet: 0.1,
  coverage: 0.3,
  negation: 0.1,
  negationLabels: 2,
  votes: 0.1,
  goodwatchScore: 0.1,
  profileFingerprint: 0.8,
  profileText: 0.6,
  profileTerms: 0.3,
  peers: 0.3,
  mentions: 0.1,
  agreement: 0.2,
  ownTitles: 1,
  ownTitlesFilmography: 4,
  popularityDamping: 0.2,
  career: 1
};
export function z(values) {
  const n = values.length;
  const out = new Float64Array(n);
  if (!n)
    return out;
  let mean = 0;
  for (let i = 0;i < n; i++)
    mean += values[i];
  mean /= n;
  let variance = 0;
  for (let i = 0;i < n; i++)
    variance += (values[i] - mean) ** 2;
  const sd = Math.sqrt(variance / n);
  if (sd <= 0.000000000001)
    return out;
  for (let i = 0;i < n; i++)
    out[i] = (values[i] - mean) / sd;
  return out;
}
export function filled(values) {
  let sum = 0;
  let count = 0;
  for (let i = 0;i < values.length; i++) {
    if (values[i] > 0) {
      sum += values[i];
      count++;
    }
  }
  const fill = count ? sum / count : 0;
  return Float64Array.from(values, (v) => v > 0 ? v : fill);
}

export { quantizedCosines };
