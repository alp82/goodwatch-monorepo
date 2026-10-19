// Private replay for ticket #706. Runs the version 0.0.5 collector offline
// against a member's saved My List page and checks earlier capture files
// against the completeness rule. Prints aggregate counts only: never titles,
// Netflix IDs, profile values or page text. Inputs stay outside Git.
//
// Usage: node scripts/private-replay.mjs <saved-page.html> [capture.json ...]
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClock, loadCollector } from '../harness/sim.mjs'

const require = createRequire(import.meta.url)
const { Window } = require('happy-dom')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const [htmlPath, ...capturePaths] = process.argv.slice(2)
if (!htmlPath) {
  console.error('Usage: node scripts/private-replay.mjs <saved-page.html> [capture.json ...]')
  process.exit(2)
}

const clock = createClock()
const window = new Window({
  url: 'https://www.netflix.com/browse/my-list',
  // Page scripts stay inert: present as text, never run. No resources load.
  settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true, disableIframePageLoading: true },
})
window.document.write(readFileSync(htmlPath, 'utf8'))
const command = loadCollector({ window }, clock, join(root, 'extension/capture.js'))
const out = { savedPage: {}, captures: [] }
try {
  const start = command({ action: 'start' })
  out.savedPage.startCode = start.code
  out.savedPage.reference = start.reference
  out.savedPage.profileGuard = start.profileGuard
  await clock.advance(1500)
  const status = command({ action: 'status' })
  out.savedPage.cardsAcceptedOnSavedPage = status.observedCount
  out.savedPage.rejectedCards = status.rejectedCount
  out.savedPage.verdictOnSavedPageAlone = status.verdict
  // Start-order check: do the cards shown at Start follow Netflix's positions?
  out.savedPage.startOrderCheck = status.orderCheck
  const loadedIds = new Set()
  const stopped = command({ action: 'stop' })
  out.savedPage.verdictAfterStop = stopped.verdict

  // Read the reference again, independently of the collector's state, to
  // compare capture files. IDs stay in memory only.
  const reference = readReferenceIds(window.document)
  for (const id of reference.loaded) loadedIds.add(id)
  for (const path of capturePaths) {
    const file = JSON.parse(readFileSync(path, 'utf8'))
    const ids = new Set(file.items.map(item => item.sourceId))
    const loadedPresent = [...loadedIds].filter(id => ids.has(id)).length
    const verdict = !reference.total ? 'unknown'
      : ids.size > reference.total ? 'partial (above_total)'
        : loadedPresent < loadedIds.size ? 'partial (loaded_title_missing)'
          : ids.size < reference.total ? 'partial (below_total)'
            : 'count rule met (lap evidence not recorded by 0.0.4)'
    out.captures.push({
      file: `capture ${out.captures.length + 1}`,
      fileCompleteness: file.completeness,
      distinctIds: ids.size,
      reportedTotal: reference.total,
      loadedEdgesPresent: `${loadedPresent}/${loadedIds.size}`,
      ruleVerdict: verdict,
    })
  }
} finally {
  window.happyDOM.abort()
  window.close()
}
console.log(JSON.stringify(out, null, 2))

// Same narrow read as the collector, kept separate so the replay can compare
// files without exposing the collector's internals.
function readReferenceIds(doc) {
  const marker = "netflix.reactContext.models.graphql = JSON.parse('"
  const script = [...doc.querySelectorAll('script:not([src])')].find(s => (s.textContent || '').includes(marker))
  if (!script) return { total: null, loaded: [] }
  const text = script.textContent
  let i = text.indexOf(marker) + marker.length
  let literal = ''
  for (; i < text.length && text[i] !== "'"; i++) {
    if (text[i] !== '\\') { literal += text[i]; continue }
    const n = text[++i]
    if (n === 'x') { literal += String.fromCharCode(parseInt(text.slice(i + 1, i + 3), 16)); i += 2 }
    else if (n === 'u') { literal += String.fromCharCode(parseInt(text.slice(i + 1, i + 5), 16)); i += 4 }
    else literal += { n: '\n', r: '\r', t: '\t' }[n] ?? n
  }
  const data = JSON.parse(literal).data
  const labels = new Set(['My List', 'Meine Liste'])
  const section = Object.values(data).find(e => e?.__typename === 'PinotCarouselSection' && labels.has(e.displayString))
  if (!section) return { total: null, loaded: [] }
  const loaded = section.entities.edges.map(edge => String(data[data[edge.node.__ref].unifiedEntity.__ref].videoId))
  return { total: section.entities.totalCount, loaded }
}
