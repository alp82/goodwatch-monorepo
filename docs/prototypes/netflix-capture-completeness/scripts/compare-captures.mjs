// Compares private capture files for ticket #706 and prints aggregates only:
// counts, completeness, and pairwise overlap. Never prints titles or IDs.
// Usage: node scripts/compare-captures.mjs <a.json> <b.json> [...]
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const files = process.argv.slice(2).map((path, i) => {
  const data = JSON.parse(readFileSync(path, 'utf8'))
  return { label: `F${i + 1}`, name: basename(path).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60), data, ids: new Set(data.items.map(item => item.sourceId)) }
})
if (files.length < 1) {
  console.error('Usage: node scripts/compare-captures.mjs <a.json> [b.json ...]')
  process.exit(2)
}
console.log(JSON.stringify({
  files: files.map(f => ({ label: f.label, file: f.name, completeness: f.data.completeness, items: f.data.items.length, distinctIds: f.ids.size })),
  pairs: files.flatMap((a, i) => files.slice(i + 1).map(b => ({
    pair: `${a.label}-${b.label}`,
    shared: [...a.ids].filter(id => b.ids.has(id)).length,
    onlyFirst: [...a.ids].filter(id => !b.ids.has(id)).length,
    onlySecond: [...b.ids].filter(id => !a.ids.has(id)).length,
    // Same ID, different title text.
    titleDiffers: a.data.items.filter(x => b.data.items.some(y => y.sourceId === x.sourceId && y.title !== x.title)).length,
  }))),
}, null, 2))
