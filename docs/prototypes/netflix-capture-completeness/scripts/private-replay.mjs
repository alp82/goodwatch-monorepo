// Private replay for ticket #706. Runs the collector offline against a
// member's saved My List page and checks earlier capture files against the
// completeness rule. Prints aggregate counts and fixed codes only: never
// titles, Netflix IDs, profile values, page text, paths or error messages.
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
const print = value => console.log(JSON.stringify(value, null, 2))
if (!htmlPath) {
  print({ error: 'usage: node scripts/private-replay.mjs <saved-page.html> [capture.json ...]' })
  process.exit(2)
}

const out = { savedPage: {}, captures: [] }
let window
try {
  let html
  try {
    html = readFileSync(htmlPath, 'utf8')
  } catch {
    throw new Error('page_unreadable')
  }
  const clock = createClock()
  window = new Window({
    url: 'https://www.netflix.com/browse/my-list',
    // Page scripts stay inert: present as text, never run. No resources load.
    settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true, disableIframePageLoading: true },
  })
  window.document.write(html)
  const command = loadCollector({ window }, clock, join(root, 'extension/capture.js'))
  const start = command({ action: 'start' })
  out.savedPage.startCode = start.code
  out.savedPage.reference = { ...start.reference }
  out.savedPage.profileGuard = start.profileGuard
  await clock.advance(1500)
  const status = command({ action: 'stop' })
  out.savedPage.cardsAcceptedOnSavedPage = status.observedCount
  out.savedPage.rejectedCards = status.rejectedCount
  out.savedPage.orderCheck = status.orderCheck
  out.savedPage.verdict = { ...status.verdict }

  // Capture files are compared only when the collector itself accepted the
  // reference; then the same narrow read supplies the loaded IDs in memory.
  const reference = start.reference?.found ? readLoadedIds(window.document) : null
  capturePaths.forEach((path, index) => {
    const label = `capture ${index + 1}`
    let ids
    try {
      const file = JSON.parse(readFileSync(path, 'utf8'))
      if (!Array.isArray(file?.items)) throw new Error()
      ids = new Set(file.items.map(item => String(item?.sourceId)))
      if (!reference) {
        out.captures.push({ file: label, distinctIds: ids.size, ruleVerdict: `unknown (${start.reference?.reason ?? 'reference_missing'})` })
        return
      }
      const loadedPresent = reference.loaded.filter(id => ids.has(id)).length
      const verdict = ids.size > reference.total ? 'partial (above_total)'
        : loadedPresent < reference.loaded.length ? 'partial (loaded_title_missing)'
          : ids.size < reference.total ? 'partial (below_total)'
            : 'count rule met (positions and lap not recorded in the file)'
      out.captures.push({ file: label, fileCompleteness: String(file.completeness).slice(0, 12), distinctIds: ids.size, reportedTotal: reference.total, loadedEdgesPresent: `${loadedPresent}/${reference.loaded.length}`, ruleVerdict: verdict })
    } catch {
      out.captures.push({ file: label, error: 'capture_unreadable' })
    }
  })
} catch (error) {
  out.error = error?.message === 'page_unreadable' ? 'page_unreadable' : 'replay_failed'
  process.exitCode = 1
} finally {
  try {
    window?.happyDOM.abort()
    window?.close()
  } catch {}
}
print(out)

// Same uniqueness rule as the collector: exactly one page-state script and
// exactly one My List section. Called only after the collector accepted the
// reference, so provenance checks have already passed.
function readLoadedIds(doc) {
  const marker = "netflix.reactContext.models.graphql = JSON.parse('"
  const scripts = [...doc.querySelectorAll('script:not([src])')].filter(s => (s.textContent || '').includes(marker))
  if (scripts.length !== 1) return null
  const text = scripts[0].textContent
  let literal = ''
  for (let i = text.indexOf(marker) + marker.length; i < text.length && text[i] !== "'"; i++) {
    if (text[i] !== '\\') { literal += text[i]; continue }
    const n = text[++i]
    if (n === 'x') { literal += String.fromCharCode(parseInt(text.slice(i + 1, i + 3), 16)); i += 2 }
    else if (n === 'u') { literal += String.fromCharCode(parseInt(text.slice(i + 1, i + 5), 16)); i += 4 }
    else literal += { n: '\n', r: '\r', t: '\t' }[n] ?? n
  }
  const data = JSON.parse(literal).data
  const labels = new Set(['My List', 'Meine Liste'])
  const sections = Object.values(data).filter(e => e?.__typename === 'PinotCarouselSection' && labels.has(e.displayString))
  if (sections.length !== 1) return null
  const edges = [...sections[0].entities.edges].sort((a, b) => Number(atob(a.cursor)) - Number(atob(b.cursor)))
  return { total: sections[0].entities.totalCount, loaded: edges.map(edge => String(data[data[edge.node.__ref].unifiedEntity.__ref].videoId)) }
}
