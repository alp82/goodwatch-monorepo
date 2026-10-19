// Compares private capture files for ticket #706. Prints aggregates and fixed
// codes only, with anonymous labels (F1, F2, ...): never titles, IDs, file
// names, paths or error messages.
// Usage: node scripts/compare-captures.mjs <a.json> <b.json> [...]
import { readFileSync } from 'node:fs'

const paths = process.argv.slice(2)
if (!paths.length) {
  console.log(JSON.stringify({ error: 'usage: node scripts/compare-captures.mjs <a.json> [b.json ...]' }))
  process.exit(2)
}
const files = paths.map((path, i) => {
  const label = `F${i + 1}`
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    if (!Array.isArray(data?.items)) throw new Error()
    const titles = new Map(data.items.map(item => [String(item?.sourceId), item?.title]))
    return { label, completeness: String(data.completeness).slice(0, 12), items: data.items.length, titles }
  } catch {
    return { label, error: 'capture_unreadable' }
  }
})
const readable = files.filter(f => !f.error)
console.log(JSON.stringify({
  files: files.map(f => (f.error ? { label: f.label, error: f.error } : { label: f.label, completeness: f.completeness, items: f.items, distinctIds: f.titles.size })),
  pairs: readable.flatMap((a, i) => readable.slice(i + 1).map(b => ({
    pair: `${a.label}-${b.label}`,
    shared: [...a.titles.keys()].filter(id => b.titles.has(id)).length,
    onlyFirst: [...a.titles.keys()].filter(id => !b.titles.has(id)).length,
    onlySecond: [...b.titles.keys()].filter(id => !a.titles.has(id)).length,
    // Same ID, different title text.
    titleDiffers: [...a.titles].filter(([id, title]) => b.titles.has(id) && b.titles.get(id) !== title).length,
  }))),
}, null, 2))
if (files.some(f => f.error)) process.exitCode = 1
