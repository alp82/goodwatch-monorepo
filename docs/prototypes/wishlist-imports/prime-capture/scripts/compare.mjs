// Compares a capture with the owner's private reference and prints counts only.
// Titles are printed only with --show-titles, for the owner's own terminal.
//
//   node scripts/compare.mjs <wishlist.json> <reference.json> [--show-titles]
//
// Two reference modes (private, never in Git):
//
// Full membership: every Watchlist entry, each with a detail link, or a title
// and year. This is the only mode that can establish exact membership. Any
// entry with neither a year nor a link withholds the exact verdict.
//   { "members": [ { "title": "…", "year": 2001 }, { "link": "https://…/detail/…" } ] }
//
// Sampled evidence: counts, a sample of entries and some non-members. It can't
// establish exact membership: misses and extras outside the sample can cancel.
//   { "counts": { "movies": 0, "shows": 0 }, "sample": ["…"], "notOnWatchlist": ["…"] }
//
// A full reference can also be a plain .txt file, one entry per line: a
// copied detail link (fastest and exact), or "Title (Year)". Lines starting
// with # are ignored.
import { readFileSync } from 'node:fs'

const [wishPath, refPath, flag] = process.argv.slice(2)
if (!wishPath || !refPath) {
  console.error('usage: node scripts/compare.mjs <wishlist.json> <reference.json> [--show-titles]')
  process.exit(2)
}
const wish = JSON.parse(readFileSync(wishPath, 'utf8'))
function readReference(path) {
  const text = readFileSync(path, 'utf8')
  if (!path.endsWith('.txt')) return JSON.parse(text)
  const members = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const year = /^(.*\S)\s*\((\d{4})\)$/.exec(line)
    members.push(/^https?:\/\//.test(line) ? { link: line } : year ? { title: year[1], year: Number(year[2]) } : { title: line })
  }
  return { members }
}
const ref = readReference(refPath)
const norm = (t) => String(t ?? '').normalize('NFKC').toLowerCase().replace(/[’']/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()
const tokenOf = (url) => {
  try {
    const parts = new URL(url).pathname.split('/')
    const at = parts.indexOf('detail')
    return at >= 0 && /^[A-Za-z0-9]{8,40}$/.test(parts[at + 1] || '') ? parts[at + 1] : null
  } catch {
    return null
  }
}
const captured = wish.items.map((i, index) => ({ index, title: i.title, n: norm(i.title), year: i.year, mediaType: i.mediaType, token: tokenOf(i.sourceUrl) ?? (/^[A-Za-z0-9]{8,40}$/.test(i.sourceId) ? i.sourceId : null), sourceId: i.sourceId }))
const byType = { movie: 0, show: 0, unknown: 0 }
for (const i of captured) byType[i.mediaType] = (byType[i.mediaType] || 0) + 1
const duplicateSourceIds = captured.length - new Set(captured.map((i) => i.sourceId)).size
const privateLines = []

let out
if (Array.isArray(ref.members)) {
  // One-to-one: links first (exact), then title and year. A reference entry
  // with more than one unassigned candidate is ambiguous and stays unassigned.
  const used = new Set()
  let matched = 0
  let ambiguous = 0
  const missed = []
  const members = ref.members.map((m) => ({ ...m, token: m.link ? tokenOf(m.link) : null }))
  const ordered = [...members.filter((m) => m.token), ...members.filter((m) => !m.token)]
  for (const m of ordered) {
    const candidates = captured.filter((c) => !used.has(c.index) && (m.token ? c.token === m.token : c.n === norm(m.title) && (m.year === undefined || c.year === m.year)))
    if (candidates.length === 1) {
      used.add(candidates[0].index)
      matched++
    } else if (candidates.length > 1) {
      ambiguous++
      missed.push(m)
    } else missed.push(m)
  }
  const extras = captured.filter((c) => !used.has(c.index))
  out = {
    evidence: 'full',
    completeness: wish.completeness,
    reference: members.length,
    captured: captured.length,
    capturedByType: byType,
    matched,
    missed: missed.length - ambiguous,
    extra: extras.length,
    ambiguous,
    duplicateSourceIds,
    referenceWithoutYearOrLink: members.filter((m) => !m.token && m.year === undefined).length,
    recall: members.length ? matched / members.length : null,
    // A title alone can match the wrong same-name entry, so any entry without
    // a year or link withholds the exact verdict.
    exactMembership: members.some((m) => !m.token && m.year === undefined)
      ? 'withheld'
      : matched === members.length && extras.length === 0 && ambiguous === 0 && duplicateSourceIds === 0,
  }
  privateLines.push(['Missing or ambiguous reference entries:', missed.map((m) => m.title || m.link)], ['Captured entries not in the reference:', extras.map((c) => `${c.title} (${c.year ?? '?'})`)])
} else {
  const has = (t) => captured.some((i) => i.n === norm(t) || i.n.startsWith(`${norm(t)} -`) || i.n.startsWith(`${norm(t)}:`))
  const counts = ref.counts || {}
  const refTotal = Number.isInteger(counts.all) ? counts.all : (counts.movies ?? 0) + (counts.shows ?? 0)
  const sample = Array.isArray(ref.sample) ? ref.sample : []
  const probes = Array.isArray(ref.notOnWatchlist) ? ref.notOnWatchlist : []
  const missing = sample.filter((t) => !has(t))
  const contaminated = probes.filter((t) => has(t))
  out = {
    evidence: 'sampled',
    exactMembership: 'not established',
    note: 'Sampled evidence only. Counts can agree while a miss and an extra cancel out, and titles alone cannot separate same-name entries.',
    completeness: wish.completeness,
    referenceCounts: { total: refTotal, ...counts },
    captured: { total: captured.length, ...byType },
    difference: captured.length - refTotal,
    typeDifference: Number.isInteger(counts.movies) ? { movies: byType.movie - counts.movies, shows: byType.show - (counts.shows ?? 0) } : null,
    sample: { size: sample.length, found: sample.length - missing.length },
    contaminationProbes: { size: probes.length, found: contaminated.length },
    duplicateSourceIds,
  }
  privateLines.push(['Missing sample titles:', missing], ['Probe titles found in the capture:', contaminated])
}
console.log(JSON.stringify(out, null, 2))
if (flag === '--show-titles') for (const [label, list] of privateLines) console.log(`\nPrivate. ${label}`, list)
