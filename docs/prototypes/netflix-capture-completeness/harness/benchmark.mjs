// Synthetic benchmark for ticket #706. Compares three routes on the same
// simulated pages and checks the candidate gates in PROTOCOL.md.
//   M0: version 0.0.4 collector, member clicks until titles repeat.
//   M1: version 0.0.5 collector, member clicks, checks the popup's verdict.
//   A:  version 0.0.5 collector, bounded assisted traversal.
// Usage: node harness/benchmark.mjs [--json out.json] [--md out.md]
import { writeFileSync } from 'node:fs'
import { runScenario } from './runner.mjs'

// ---- Invented data ---------------------------------------------------------
function list(n, { start = 1001, prefix = 'Invented title', movieEvery = 3 } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(start + i),
    title: `${prefix} ${i + 1}`,
    type: i % movieEvery === 0 ? 'movie' : 'show',
  }))
}
const others = (overlap = []) => [
  { label: 'Weiterschauen', position: 'before', items: [...list(2, { start: 9001, prefix: 'Other continue' }), ...overlap.slice(0, 1)] },
  { label: 'Angesehene Trailer', position: 'after', items: list(20, { start: 9101, prefix: 'Other trailer' }) },
  { label: 'Nochmal ansehen', position: 'after', items: [...list(15, { start: 9201, prefix: 'Other rewatch' }), ...overlap.slice(1)] },
]

// ---- Scenarios ---------------------------------------------------------------
// events: [{at, kind}] relative to Start. kind: profile, navigate, replace, add, remove, reload.
const base77 = list(77)
const SCENARIOS = [
  { id: 'S01', name: '77 titles, de-DE, cards replaced', page: { items: base77, otherRows: others() } },
  { id: 'S02', name: '40 titles, en label "My List"', page: { label: 'My List', items: list(40), otherRows: others() } },
  { id: 'S03', name: '9 titles, all loaded at start', page: { items: list(9), otherRows: others() } },
  { id: 'S04', name: '77 titles, cards reused atomically', page: { items: base77, otherRows: others(), recycle: 'atomic' } },
  { id: 'S05', name: '77 titles, recycled link first, label 120 ms later', page: { items: base77, otherRows: others(), recycle: 'href-first' } },
  { id: 'S06', name: '77 titles, recycled label first, link 120 ms later', page: { items: base77, otherRows: others(), recycle: 'label-first' } },
  { id: 'S07', name: '77 titles, later pages load after 3 s', page: { items: base77, otherRows: others(), fetchDelay: 3000 } },
  { id: 'S08', name: 'Other rows share 3 My List IDs', page: { items: base77, otherRows: others([base77[2], base77[40], base77[70]]) } },
  { id: 'S09', name: 'Two titles share a name, distinct IDs', page: { items: base77.map((item, i) => (i === 50 ? { ...item, title: base77[10].title } : item)), otherRows: others() } },
  { id: 'S10', name: '30 counted, 2 never rendered (unavailable)', page: { items: list(30), unavailable: ['1020', '1027'], otherRows: others() } },
  { id: 'S11', name: 'Title added elsewhere during capture', page: { items: base77, otherRows: others() }, events: [{ at: 5000, kind: 'add', item: { id: '1500', title: 'Invented added', type: 'movie' }, index: 0 }] },
  { id: 'S12', name: 'Unseen title removed during capture', page: { items: base77, otherRows: others() }, events: [{ at: 5000, kind: 'remove', id: '1070' }] },
  { id: 'S13', name: 'Profile switched during capture', page: { items: base77, otherRows: others() }, events: [{ at: 6000, kind: 'profile' }] },
  { id: 'S14', name: 'Navigated away during capture', page: { items: base77, otherRows: others() }, events: [{ at: 6000, kind: 'navigate' }] },
  { id: 'S15', name: 'Netflix re-renders the whole row', page: { items: base77, otherRows: others() }, events: [{ at: 6000, kind: 'replace' }] },
  { id: 'S16', name: 'Tab reloaded, member starts again', page: { items: base77, otherRows: others() }, events: [{ at: 6000, kind: 'reload' }] },
  { id: 'S17', name: 'Empty list, no My List row', page: { items: [], otherRows: others() } },
  { id: 'S18', name: 'Empty list, page state reports 0', page: { items: [], otherRows: others(), emptyRow: 'state-only' } },
  { id: 'S19', name: 'No page-state script', page: { items: base77, otherRows: others(), pageState: false } },
  { id: 'S20', name: 'Legacy grid layout', page: { items: list(25), otherRows: [], layout: 'grid' } },
  { id: 'S21', name: 'Reported total lower than rendered (stale total)', page: { items: base77, otherRows: others(), stateTotal: 75 } },
  { id: 'S22', name: 'Foreign card inside the row', page: { items: base77, otherRows: others(), contaminants: [{ index: 30, item: { id: '9901', title: 'Invented promo', type: 'show' } }] } },
  { id: 'S23', name: 'Adversarial: foreign card plus one unavailable title', page: { items: base77, otherRows: others(), unavailable: ['1060'], contaminants: [{ index: 30, item: { id: '9901', title: 'Invented promo', type: 'show' } }] } },
  { id: 'S24', name: '300 titles, de-DE', page: { items: list(300), otherRows: others() } },
  // Added after the first benchmark run, to probe weaknesses it exposed.
  { id: 'S25', name: 'Adversarial: foreign card at position 3 plus one unavailable title', added: true, page: { items: base77, otherRows: others(), unavailable: ['1060'], contaminants: [{ index: 2, item: { id: '9901', title: 'Invented promo', type: 'show' } }] } },
  { id: 'S26', name: 'Title added elsewhere; member stops when the count matches', added: true, member: 'stop-at-count', page: { items: base77, otherRows: others() }, events: [{ at: 5000, kind: 'add', item: { id: '1500', title: 'Invented added', type: 'movie' }, index: 0 }] },
  { id: 'S27', name: 'Netflix re-renders the row twice, assisted', added: true, page: { items: base77, otherRows: others() }, events: [{ at: 4000, kind: 'replace' }, { at: 12000, kind: 'replace' }] },
]

// ---- Gates -----------------------------------------------------------------
function gates(rows) {
  const v5 = rows.filter(row => row.route !== 'M0')
  const byId = (route, id) => rows.find(row => row.route === route && row.scenario === id)
  const check = (gate, pass, detail) => ({ gate, pass, detail })
  const fc = v5.filter(row => row.falseComplete)
  const completes = v5.filter(row => row.completeness === 'complete')
  return [
    check('G1 False complete', fc.length === 0, `${fc.length} of ${v5.length} version 0.0.5 runs falsely complete${fc.length ? `: ${fc.map(r => `${r.route}/${r.scenario}`).join(', ')}` : ''}`),
    check('G2 Recall when complete', completes.every(r => r.recall === 1 && r.contamination === 0), `${completes.filter(r => r.recall === 1 && r.contamination === 0).length} of ${completes.length} complete runs exact`),
    check('G3 Truthful partial', v5.filter(r => r.completeness !== 'complete').every(r => r.reason && (r.reportedTotal !== null || /reference|grid/.test(r.reason) || r.completeness === 'no file')), `${v5.filter(r => r.completeness !== 'complete').length} non-complete runs, each with a reason`),
    check('G4 Duplicates', ['M1', 'A'].every(rt => byId(rt, 'S09').captured === 77 && byId(rt, 'S01').captured === 77), 'Wrap-around counted once; same-name distinct IDs kept (S01, S09)'),
    check('G5 Other rows', v5.every(r => r.otherRowIds === 0) && ['M1', 'A'].every(rt => byId(rt, 'S08').completeness === 'complete'), `${v5.reduce((n, r) => n + r.otherRowIds, 0)} other-row IDs captured across ${v5.length} runs`),
    check('G6 Recycled cards', ['S04', 'S05', 'S06'].every(id => byId('A', id).recall === 1 && byId('M1', id).recall === 1), ['S04', 'S05', 'S06'].map(id => `${id} M0 ${pct(byId('M0', id).recall)}, M1 ${pct(byId('M1', id).recall)}, A ${pct(byId('A', id).recall)}`).join('; ')),
    check('G7 Lazy loading', byId('A', 'S07').completeness === 'complete', `S07 assisted: ${byId('A', 'S07').completeness}, ${byId('A', 'S07').elapsedS} s`),
    check('G8 Interruption', ['S14', 'S16'].every(id => v5.filter(r => r.scenario === id).every(r => (id === 'S14' ? r.completeness === 'no file' : r.completeness === 'complete' && r.restarted))), 'S14 discards; S16 restart reaches complete with no resume claim'),
    check('G9 Profile change', v5.filter(r => r.scenario === 'S13').every(r => r.completeness === 'no file' && r.code === 'terminated_profile'), 'S13 discarded in both version 0.0.5 routes'),
    check('G10 Unavailable titles', ['M1', 'A'].every(rt => byId(rt, 'S10').completeness === 'partial' && byId(rt, 'S10').reportedTotal === 30), `S10: ${['M1', 'A'].map(rt => `${rt} ${byId(rt, 'S10').completeness} ${byId(rt, 'S10').captured}/${byId(rt, 'S10').reportedTotal}`).join(', ')}`),
    check('G11 Empty list', v5.filter(r => r.scenario === 'S17').every(r => r.completeness === 'no file' && r.code === 'boundary_missing') && v5.filter(r => r.scenario === 'S18').every(r => r.code === 'list_empty'), 'S17 unknown (no row); S18 empty complete from reported 0'),
    check('G12 Bounded traversal', rows.filter(r => r.route === 'A' && r.advanceCap !== null).every(r => r.arrowClicks <= r.advanceCap) && rows.filter(r => r.route === 'A').every(r => r.elapsedS <= 180 + 60), `${rows.filter(r => r.route === 'A' && r.advanceCap !== null).length} assisted runs within their advance cap; max ${Math.max(...rows.filter(r => r.route === 'A').map(r => r.elapsedS))} s`),
    check('G13 Effort', ['S01', 'S07'].every(id => byId('A', id).actions <= 3 && byId('A', id).elapsedS <= 60), `S01 assisted ${byId('A', 'S01').actions} actions, ${byId('A', 'S01').elapsedS} s; manual M1 ${byId('M1', 'S01').actions} actions, ${byId('M1', 'S01').elapsedS} s`),
  ]
}
const pct = v => (v === null || v === undefined ? 'n/a' : `${Math.round(v * 1000) / 10}%`)

// ---- Main --------------------------------------------------------------------
const args = process.argv.slice(2)
const rows = []
for (const scenario of SCENARIOS) {
  for (const route of ['M0', 'M1', 'A']) rows.push(await runScenario(route, scenario))
}
const gateResults = gates(rows)
const out = { generatedAt: new Date().toISOString(), synthetic: true, scenarios: SCENARIOS.length, routes: 3, runs: rows.length, gates: gateResults, rows }
const jsonAt = args.indexOf('--json')
if (jsonAt >= 0) writeFileSync(args[jsonAt + 1], JSON.stringify(out, null, 2) + '\n')
const mdAt = args.indexOf('--md')
if (mdAt >= 0) {
  const lines = ['| Scenario | Route | Truth | Captured | Recall | Foreign | File says | Reason | Actions | Arrow clicks | Time (s) |', '| --- | --- | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: |']
  for (const r of rows) lines.push(`| ${r.scenario} ${r.name} | ${r.route} | ${r.truth} | ${r.captured ?? '-'} | ${pct(r.recall)} | ${r.contamination} | ${r.completeness}${r.falseComplete ? ' (FALSE)' : ''} | ${r.reason ?? r.code} | ${r.actions} | ${r.arrowClicks} | ${r.elapsedS} |`)
  lines.push('', '| Gate | Result | Detail |', '| --- | --- | --- |')
  for (const g of gateResults) lines.push(`| ${g.gate} | ${g.pass ? 'Pass' : 'Fail'} | ${g.detail} |`)
  writeFileSync(args[mdAt + 1], lines.join('\n') + '\n')
}
console.log(JSON.stringify({ runs: rows.length, gates: gateResults.map(g => `${g.pass ? 'PASS' : 'FAIL'} ${g.gate}: ${g.detail}`) }, null, 2))
for (const r of rows) console.log([r.scenario, r.route, r.truth, r.captured, pct(r.recall), r.contamination, r.completeness + (r.falseComplete ? '!!' : ''), r.reason ?? r.code, r.assistOutcome ?? '', r.actions, r.arrowClicks, r.elapsedS].join('\t'))
