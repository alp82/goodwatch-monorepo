// Compares a capture with the owner's private reference and prints counts only.
// Titles are printed only with --show-titles, for the owner's own terminal.
//
//   node scripts/compare.mjs <wishlist.json> <reference.json> [--show-titles]
//
// reference.json (private, never in Git):
// {
//   "counts": { "movies": 0, "shows": 0 },   // or { "all": 0 } when there are no filters
//   "sample": ["title", "..."],              // titles that ARE on the Watchlist
//   "notOnWatchlist": ["title", "..."]       // titles shown nearby that are NOT
// }
import { readFileSync } from 'node:fs'

const [wishPath, refPath, flag] = process.argv.slice(2)
if (!wishPath || !refPath) {
  console.error('usage: node scripts/compare.mjs <wishlist.json> <reference.json> [--show-titles]')
  process.exit(2)
}
const wish = JSON.parse(readFileSync(wishPath, 'utf8'))
const ref = JSON.parse(readFileSync(refPath, 'utf8'))
const norm = (t) => String(t).normalize('NFKC').toLowerCase().replace(/[’']/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()
const captured = wish.items.map((i) => ({ ...i, n: norm(i.title) }))
const has = (t) => captured.some((i) => i.n === norm(t) || i.n.startsWith(`${norm(t)} -`) || i.n.startsWith(`${norm(t)}:`))

const byType = { movie: 0, show: 0, unknown: 0 }
for (const i of captured) byType[i.mediaType] = (byType[i.mediaType] || 0) + 1
const counts = ref.counts || {}
const refTotal = Number.isInteger(counts.all) ? counts.all : (counts.movies ?? 0) + (counts.shows ?? 0)
const sample = Array.isArray(ref.sample) ? ref.sample : []
const probes = Array.isArray(ref.notOnWatchlist) ? ref.notOnWatchlist : []
const missing = sample.filter((t) => !has(t))
const contaminated = probes.filter((t) => has(t))

const out = {
  completeness: wish.completeness,
  reference: { total: refTotal, ...counts },
  captured: { total: captured.length, ...byType },
  difference: captured.length - refTotal,
  typeDifference: Number.isInteger(counts.movies) ? { movies: byType.movie - counts.movies, shows: byType.show - (counts.shows ?? 0) } : null,
  // Count agreement is not recall: equal counts can hide a miss plus an extra.
  countsAgree: refTotal === captured.length,
  sample: { size: sample.length, found: sample.length - missing.length },
  contaminationProbes: { size: probes.length, found: contaminated.length },
  distinctSourceIds: new Set(captured.map((i) => i.sourceId)).size,
  duplicateSourceIds: captured.length - new Set(captured.map((i) => i.sourceId)).size,
}
console.log(JSON.stringify(out, null, 2))
if (flag === '--show-titles') {
  console.log('\nPrivate. Missing sample titles:', missing)
  console.log('Private. Probe titles found in the capture:', contaminated)
}
