// Lab-universe normalization, then the pinned production person and Sides computations.
import { createHash } from 'node:crypto'
import { readPerson, K } from './prod/server/taste-portrait/person.server'
import { MOOD_BY_KEY, moodsOf } from './prod/domain/moods'
import { buildSides, franchiseOf } from './prod/server/taste-portrait/sides.server'
import { NO_TASTE } from './stubs/taste'

export function makePerson(c: any) {
  const titles = [...c.titles].sort((a, b) => a.key - b.key)
  const byKey = new Map(titles.map((t: any) => [t.key, t]))
  const pool = titles.filter((t: any) => t.in_pool && t.fingerprint)
  if (!pool.length) throw new Error('empty normalization pool')
  for (const t of titles) {
    if (typeof t.hasPoster !== 'boolean') throw new Error('hasPoster must be explicit')
    if (t.fingerprint && (t.fingerprint.length !== K || t.fingerprint.some((x: number) => !Number.isInteger(x) || (x !== 255 && (x < 0 || x > 10))))) throw new Error('invalid fingerprint')
  }
  const value = (t: any, k: number) => t.fingerprint[k] === 255 ? 0 : t.fingerprint[k]
  const mean = Array.from({length: K}, (_, k) => pool.reduce((s, t) => s + value(t, k), 0) / pool.length)
  const sd = mean.map((m, k) => Math.sqrt(pool.reduce((s, t) => s + (value(t, k) - m) ** 2, 0) / pool.length) || 1)
  const facts = (t: any) => ({mediaType: t.media_type, tmdbId: t.key - (t.media_type === 'show' ? 2e12 : 1e12),
    releaseDay: t.release_day ?? null, genres: t.genres ?? [], origin: t.origin ?? null,
    score: t.public_score ?? null, votes: t.votes ?? 0, adult: t.adult ?? false,
    hasPoster: t.hasPoster, hasBackdrop: false, moods: moodsOf(t.fingerprint, t.genres), anime: t.anime ?? false})
  const snapshot: any = {version: createHash('sha256').update(JSON.stringify(titles)).digest('hex'), stats: {mean, sd},
    referenceRows: titles.flatMap((t, i) => t.in_pool && t.fingerprint ? [i] : []),
    facts: (key: number) => byKey.has(key) ? facts(byKey.get(key)) : null,
    factsAt: (row: number) => facts(titles[row]),
    fingerprint: (key: number) => byKey.get(key)?.fingerprint ? Uint8Array.from(byKey.get(key).fingerprint) : null,
    fingerprintAt: (row: number) => Uint8Array.from(titles[row].fingerprint)}
  const scores = new Map<number, number>(c.early.map((r: any) => [r.title_key, r.score]))
  const input: any = {kind: 'member', scores, chosen: new Set(scores.keys()), wantToSee: new Set(), skipped: new Set(),
    notInterested: new Set(), country: '', services: [], taste: NO_TASTE}
  const person = readPerson(snapshot, input)
  // No suggestion or edge computation enters this screen. Their only input is unseen.
  person.unseen = []
  return person
}

// index.server.ts's display pruning, before Here takes its first four examples.
// The pack carries a display title for every eligible example. No title I/O runs here.
export function displayView(view: any, catalog: any[]) {
  const titles = new Map(catalog.map(t => [t.key, t]))
  return {...view, sides: view.sides.map((side: any) => {
    const seen = new Set<string>()
    const here = side.here.filter((key: number) => {
      const title = titles.get(key)?.title
      if (!title) return false
      const franchise = franchiseOf(title)
      if (seen.has(franchise)) return false
      seen.add(franchise)
      return true
    }).slice(0, 4)
    return {...side, here}
  })}
}

// A text walk through the group picker, then each panel in picker order.
// Fields and static copy follow the pinned SidesOfYou / RatedPoster components.
export function template(view: any, catalog: any[], scores: Map<number, number>) {
  const titles = new Map(catalog.map(t => [t.key, t]))
  const lines: string[] = []
  const named: number[] = []
  const printed: number[] = []
  if (!view.sides.length) return {text: '', numbers_only: '', named_titles: [], printed_mean: null}
  if (view.headline) {
    const first = view.sides.find((s: any) => s.id === view.headline.first)!.name.toLowerCase()
    const second = view.sides.find((s: any) => s.id === view.headline.second)!.name.toLowerCase()
    lines.push(`You love ${first}, and just as much ${second}.`)
  }
  lines.push("What you rate highly, grouped by what it shares, and close to each, what you've barely tried.")
  lines.push(...view.sides.map((s: any) => s.name))
  for (const side of view.sides) {
    lines.push('Fits your taste', side.name)
    for (const key of side.here) {
      named.push(key)
      const score = scores.get(key)
      // Poster title/alt text supplies the textual example, followed by its visible score.
      lines.push(titles.get(key)!.title)
      if (score != null) {
        lines.push(String(score))
        printed.push(score)
      }
    }
    // T5's S screen has no unseen-title/suggestion branch, just as item 015.
    // These are the exact fallback lines that the component renders for that view.
    if (side.edges.length || side.moreOfThis.length) throw new Error('unexpected S-screen suggestions')
    const lower = side.name.charAt(0).toLowerCase() + side.name.slice(1)
    lines.push(`Nothing you've barely tried is close to ${lower} yet.`)
    lines.push(...side.attributes.map((a: any) => a.label))
    if (side.moods.length) lines.push(`Open ${side.moods.map((m: string) => MOOD_BY_KEY[m].name).join(' + ')} in Watch next`)
    lines.push('More of this', 'Nothing more to suggest here yet.')
  }
  // Retain every numeric token in the displayed text, in the same line positions.
  // This includes digits inside example titles; no hidden count/average/share is added.
  return {text: lines.join('\n'), numbers_only: lines.map(line => (line.match(/\d+(?:\.\d+)?/g) ?? []).join(' ')).join('\n'),
    named_titles: [...new Set(named)].sort((a,b)=>a-b),
    printed_mean: printed.length ? printed.reduce((a,b)=>a+b,0)/printed.length : null}
}

export function render(c: any) {
  const person = makePerson(c)
  // Omit OrderTitles: production's fallback preserves the supplied order.
  const raw = buildSides(person)
  const view = displayView(raw, c.titles)
  return {...template(view, c.titles, new Map(c.early.map((r: any) => [r.title_key, r.score]))),
    empty: view.status === 'empty', losses: c.early.length - person.rated.length, raw_view: raw, view,
    normalization: {universe: 'in_pool && has_fingerprint', count: person.snapshot.referenceRows.length,
      missing: 'zero', sd_fallback: 1, backdrop: 'unknown treated as false; imagery omitted',
      hasPoster: 'explicit catalog fact', suggestions: 'unseen emptied; no edges or suggestions',
      personal_order: 'buildSides default identity fallback; no personal-order payload at cutoff',
      mean: person.snapshot.stats.mean, sd: person.snapshot.stats.sd}}
}
if (import.meta.main) console.log(JSON.stringify(render(JSON.parse(await Bun.stdin.text()))))
