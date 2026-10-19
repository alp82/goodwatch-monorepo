// Runs a captured file through the shipped GoodWatch wishlist parser
// (goodwatch-webapp/app/server/imports/wishlist.server.ts) and prints counts
// only. No database, preview, import or network. Needs Node.js 23.6 or later.
//
//   node scripts/parser-check.mjs <goodwatch-wishlist-prime-video-*.json>
import { readFileSync } from 'node:fs'
import { parseWishlistFile } from '../../../../../goodwatch-webapp/app/server/imports/wishlist.server.ts'

const path = process.argv[2]
if (!path) {
  console.error('usage: node scripts/parser-check.mjs <file.json>')
  process.exit(2)
}
const parsed = parseWishlistFile(readFileSync(path), (message) => {
  throw new Error(`rejected by parser: ${message}`)
})
const rows = parsed.observations ?? parsed.items ?? []
const tally = (key) => rows.reduce((m, r) => ((m[String(r[key] ?? 'none')] = (m[String(r[key] ?? 'none')] || 0) + 1), m), {})
console.log(JSON.stringify({
  source: parsed.source,
  observations: rows.length,
  byMediaType: tally('mediaType'),
  byOutcome: tally('outcome'),
  warnings: (parsed.warnings ?? []).length,
  withSourceId: rows.filter((r) => r.wishlistEvidence?.sourceId).length,
  sourceIdIsGti: rows.filter((r) => /^amzn1\.dv\.gti\./.test(r.wishlistEvidence?.sourceId ?? '')).length,
  completeness: [...new Set(rows.map((r) => r.wishlistEvidence?.completeness))],
}, null, 2))
