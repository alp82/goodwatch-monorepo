import type { TitleSnapshot, TitleFacts } from '../../title-snapshot/snapshot.server.ts'
export interface EvalTitle { key: number; score?: number; votes?: number; genre?: number; flags?: number; day?: number; year?: number; length?: number; fp?: number[] | null; popularity?: number }
export function evalSnapshot(titles: EvalTitle[], version = 'fixture'): TitleSnapshot {
  const pointIds = Float64Array.from(titles, t => t.key), rows = new Map(titles.map((t, r) => [t.key, r]))
  const c = { pointIds, scores: Uint8Array.from(titles, t => t.score ?? 80), votes: Uint32Array.from(titles, t => t.votes ?? 10000),
    flags: Uint8Array.from(titles, t => t.flags ?? 3), genres: Uint32Array.from(titles, t => t.genre ?? 0), genreNames: ['Drama', 'Reality', 'Talk', 'News', 'Soap'],
    releaseDays: Int32Array.from(titles, t => t.day ?? 19000), popularity: Float32Array.from(titles, t => t.popularity ?? 1), moods: new Uint32Array(titles.length),
    themes: new Uint16Array(titles.length), styles: new Uint16Array(titles.length), ratings: null,
    facts: { releaseYears: Uint16Array.from(titles, t => t.year ?? 2020), lengths: Uint16Array.from(titles, t => t.length ?? 90) } }
  const fps = titles.map(t => t.fp === null ? null : Uint8Array.from([...t.fp ?? [10, 0], ...new Array(74).fill(0)].slice(0, 74)))
  const norms = fps.map(fp => fp ? Math.sqrt(fp.reduce((sum, v) => sum + (v === 255 ? 0 : v * v), 0)) : 0)
  const factsAt = (r: number): TitleFacts => ({ mediaType: pointIds[r] < 2e12 ? 'movie' : 'show', tmdbId: pointIds[r] % 1e12,
    score: c.scores[r], votes: c.votes[r], popularity: c.popularity[r], releaseDay: c.releaseDays[r], genres: c.genreNames.filter((_, i) => c.genres[r] & (1 << i)),
    origin: null, adult: !!(c.flags[r] & 4), anime: false, hasPoster: !!(c.flags[r] & 1), hasBackdrop: !!(c.flags[r] & 2), moods: [] })
  const cosineAt = (row: number, v: Float32Array) => { const fp = fps[row]; if (!fp || !norms[row]) return null; let dot = 0; for (let i = 0; i < fp.length; i++) { if (fp[i] !== 255) dot += fp[i] * v[i] }; return dot / norms[row] }
  return { version, builtAt: new Date(), count: titles.length, columns: c, rowOf: (k: number) => rows.get(k) ?? -1, has: (k: number) => rows.has(k), factsAt,
    facts: (k: number) => rows.has(k) ? factsAt(rows.get(k)!) : null, fingerprint: (k: number) => fps[rows.get(k) ?? -1] ?? null, fingerprintAt: (r: number) => fps[r]!, cosine: (key: number, v: Float32Array) => cosineAt(rows.get(key) ?? -1, v),
    cosineAt, forEach: (fn: (key: number, row: number) => void) => pointIds.forEach((k, r) => fn(k, r)), referenceRows: titles.map((_, r) => r), stats: {} } as unknown as TitleSnapshot
}
