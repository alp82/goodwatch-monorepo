// Randomized timing and layout stress for ticket #706. Seeded, so reruns match.
// Checks that no version 0.0.7 capture is marked complete unless it is exact.
// Usage: node harness/stress.mjs [runs=300] [seed=706] [--json out.json]
import { writeFileSync } from 'node:fs'
import { runScenario } from './runner.mjs'

const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
const RUNS = Number(args[0] || 300)
let seed = Number(args[1] || 706)
const rand = () => {
  // mulberry32
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))
const pick = values => values[Math.floor(rand() * values.length)]

function scenario(i) {
  const n = pick([1, 3, 7, 12, 13, 14, 25, int(15, 120), int(60, 200), int(200, 400)])
  const items = Array.from({ length: n }, (_, k) => ({ id: String(100001 + k), title: `Stress title ${k + 1}`, type: k % 2 ? 'show' : 'movie' }))
  // Occasionally two titles share a name.
  if (n > 5 && rand() < 0.2) items[n - 1] = { ...items[n - 1], title: items[1].title }
  const unavailable = n > 20 && rand() < 0.15 ? [items[int(14, n - 1)].id] : []
  const events = []
  const roll = rand()
  if (roll < 0.06) events.push({ at: int(1000, 20000), kind: 'add', item: { id: '199999', title: 'Stress added', type: 'movie' }, index: int(0, n) })
  else if (roll < 0.12 && n > 1) events.push({ at: int(1000, 20000), kind: 'remove', id: items[int(0, n - 1)].id })
  else if (roll < 0.2) events.push({ at: int(1000, 20000), kind: 'replace' })
  const page = {
    label: pick(['Meine Liste', 'My List']),
    items,
    otherRows: [
      { label: 'Weiterschauen', position: 'before', items: [{ id: '900001', title: 'Other A', type: 'show' }, ...(n ? [items[0]] : [])] },
      { label: 'Nochmal ansehen', position: 'after', items: [{ id: '900002', title: 'Other B', type: 'movie' }, ...(n > 30 ? [items[30]] : [])] },
    ],
    visible: int(4, 8),
    peek: int(0, 1),
    loaded: pick([13, 13, 20]),
    fetchSize: pick([13, 26, 40]),
    fetchDelay: int(100, 4000),
    renderDelay: int(200, 1500),
    recycle: pick(['replace', 'atomic', 'href-first', 'label-first']),
    staggerMs: int(0, 350),
    unavailable,
  }
  return { id: `R${String(i + 1).padStart(3, '0')}`, name: 'random', page, events, clickMs: int(400, 2500) }
}

const rows = []
const dumpAt = process.argv.indexOf('--dump')
for (let i = 0; i < RUNS; i++) {
  const s = scenario(i)
  if (dumpAt >= 0) {
    if (s.id === process.argv[dumpAt + 1]) {
      console.log(JSON.stringify(s))
      process.exit(0)
    }
    continue
  }
  for (const route of ['M1', 'A']) {
    const r = await runScenario(route, s)
    rows.push({
      ...r, n: s.page.items.length, visible: s.page.visible, renderDelay: s.page.renderDelay, fetchDelay: s.page.fetchDelay,
      recycle: s.page.recycle, visibleCards: s.page.visible, staggerMs: s.page.staggerMs, clickMs: s.clickMs, event: s.events[0]?.kind ?? null, eventDetail: s.events[0] ?? null, unavailable: s.page.unavailable.length,
    })
  }
}
const summary = {}
for (const route of ['M1', 'A']) {
  const mine = rows.filter(r => r.route === route)
  const complete = mine.filter(r => r.completeness === 'complete')
  const changed = mine.filter(r => r.event === 'add' || r.event === 'remove' || r.unavailable)
  summary[route] = {
    runs: mine.length,
    complete: complete.length,
    falseComplete: mine.filter(r => r.falseComplete).length,
    partial: mine.filter(r => r.completeness === 'partial').length,
    // Runs where an exact capture was achievable (no unavailable title, no list change).
    achievable: mine.length - changed.length,
    completeWhenAchievable: complete.filter(r => !(r.event === 'add' || r.event === 'remove' || r.unavailable)).length,
    g12Violations: mine.filter(r => r.protocolAdvanceCap !== null && r.lastRunAdvances !== null && (r.lastRunAdvances > r.protocolAdvanceCap || r.collectorElapsedMs > 180000)).length,
    meanRecall: Math.round((mine.reduce((sum, r) => sum + (r.recall ?? 0), 0) / mine.length) * 1000) / 10,
    medianSeconds: [...mine.map(r => r.elapsedS)].sort((a, b) => a - b)[Math.floor(mine.length / 2)],
    maxSeconds: Math.max(...mine.map(r => r.elapsedS)),
    partialReasons: Object.entries(mine.filter(r => r.completeness === 'partial').reduce((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] || 0) + 1 }), {})),
  }
}
const out = { generatedAt: new Date().toISOString(), synthetic: true, seed: Number(args[1] || 706), scenarios: RUNS, summary, falseCompletes: rows.filter(r => r.falseComplete), rows }
const jsonAt = process.argv.indexOf('--json')
if (jsonAt >= 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify(out, null, 2) + '\n')
console.log(JSON.stringify({ scenarios: RUNS, summary, falseCompletes: out.falseCompletes.map(r => ({ id: r.scenario, route: r.route, n: r.n, captured: r.captured, recall: r.recall, contamination: r.contamination, event: r.event })) }, null, 2))
