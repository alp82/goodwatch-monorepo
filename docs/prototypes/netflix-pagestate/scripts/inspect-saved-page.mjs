// Offline, counts-only inspection for ticket #730. Reads a member's saved My
// List page and a reference capture file, and reports where reference IDs
// appear and how the My List section is shaped. Never prints titles, IDs,
// cursors, profile values or paths. Inputs stay outside Git.
//
// Usage: node scripts/inspect-saved-page.mjs <saved-page.html> <reference.json>
import { readFileSync } from 'node:fs'

const [htmlPath, refPath] = process.argv.slice(2)
const out = {}
try {
  const html = readFileSync(htmlPath, 'utf8')
  const ref = JSON.parse(readFileSync(refPath, 'utf8')).items.map(item => String(item.sourceId))
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1])
  const kind = body => (body.includes('models.graphql = JSON.parse') ? 'graphql' : body.includes('falcorCache') ? 'falcorCache' : body.includes('netflix.reactContext =') ? 'reactContext' : 'other')
  const dom = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
  const bySource = {}
  let anywhere = 0
  for (const id of ref) {
    const re = new RegExp(`(?<!\\d)${id}(?!\\d)`)
    let found = false
    for (const body of scripts) if (re.test(body)) { bySource[kind(body)] = (bySource[kind(body)] || 0) + 1; found = true }
    if (re.test(dom)) { bySource.dom = (bySource.dom || 0) + 1; found = true }
    if (found) anywhere++
  }
  out.reference = { ids: ref.length, foundAnywhereInPage: anywhere, foundBySource: bySource }

  // The My List section in the inline state: counts and position coverage.
  const marker = "netflix.reactContext.models.graphql = JSON.parse('"
  const body = scripts.find(b => b.includes(marker))
  let literal = ''
  for (let i = body.indexOf(marker) + marker.length; i < body.length && body[i] !== "'"; i++) {
    if (body[i] !== '\\') { literal += body[i]; continue }
    const n = body[++i]
    if (n === 'x') { literal += String.fromCharCode(parseInt(body.slice(i + 1, i + 3), 16)); i += 2 }
    else if (n === 'u') { literal += String.fromCharCode(parseInt(body.slice(i + 1, i + 5), 16)); i += 4 }
    else literal += { n: '\n', r: '\r', t: '\t' }[n] ?? n
  }
  const data = JSON.parse(literal).data
  const sections = Object.values(data).filter(e => e?.__typename === 'PinotCarouselSection' && ['My List', 'Meine Liste'].includes(e.displayString))
  const conn = sections.length === 1 ? Object.entries(sections[0]).find(([k]) => /^entities(\(|$)/.test(k))?.[1] : null
  if (conn) {
    const positions = conn.edges.map(e => Number(Buffer.from(e.cursor, 'base64').toString('latin1'))).sort((a, b) => a - b)
    const ids = conn.edges.map(e => String(data[data[e.node.__ref].unifiedEntity.__ref].videoId))
    out.inlineMyList = {
      sections: sections.length,
      totalCount: conn.totalCount,
      edges: conn.edges.length,
      positionsContiguousFromZero: positions.every((p, k) => p === k),
      hasNextPage: conn.pageInfo?.hasNextPage === true,
      edgesInReference: ids.filter(id => ref.includes(id)).length,
      coverage: `${conn.edges.length}/${conn.totalCount}`,
    }
  } else {
    out.inlineMyList = { sections: sections.length, error: 'section_not_unique' }
  }
} catch {
  out.error = 'inspection_failed'
  process.exitCode = 1
}
console.log(JSON.stringify(out, null, 2))
