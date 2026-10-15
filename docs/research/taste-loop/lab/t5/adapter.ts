// Lab-universe normalization, then the pinned production person and Sides computations.
import { createHash } from 'node:crypto'
import { readPerson, K } from './prod/server/taste-portrait/person.server'
import { buildSides } from './prod/server/taste-portrait/sides.server'
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
    hasPoster: t.hasPoster, hasBackdrop: false})
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

export function render(c: any) {
  const person = makePerson(c)
  const view = buildSides(person)
  const title = new Map(c.titles.map((t: any) => [t.key, t]))
  const numbers: string[] = []
  const lines: string[] = []
  const named: number[] = []
  const add = (words: string, numeric = '') => { lines.push(words); numbers.push(numeric) }
  if (view.headline) {
    const a = view.sides.find(s => s.id === view.headline!.first)!
    const b = view.sides.find(s => s.id === view.headline!.second)!
    add(`You love ${a.name}, and just as much ${b.name}.`)
  }
  for (const side of view.sides) {
    add(side.name)
    add(side.attributes.map(a => a.label).join(', '))
    add(`${(side.share * 100).toFixed(1)}% of loved titles; mean rating ${side.average.toFixed(1)}`,
      `${(side.share * 100).toFixed(1)}; ${side.average.toFixed(1)}`)
    for (const key of side.here) {
      named.push(key)
      add(`Here: ${JSON.stringify(title.get(key).title)} — ${person.ratedByKey.get(key)!.score}`,
        `${person.ratedByKey.get(key)!.score}`)
    }
  }
  return {text: lines.join('\n'), numbers_only: numbers.join('\n'), named_titles: [...new Set(named)].sort((a,b)=>a-b),
    empty: view.status === 'empty', printed_mean: view.sides.length ? view.sides.reduce((s, v) => s + v.share * v.average, 0) / view.sides.reduce((s,v)=>s+v.share,0) : null,
    losses: c.early.length - person.rated.length, view,
    normalization: {universe: 'in_pool && has_fingerprint', count: person.snapshot.referenceRows.length,
      missing: 'zero', sd_fallback: 1, backdrop: 'unknown treated as false; imagery omitted',
      hasPoster: 'explicit catalog fact; filters here examples only', suggestions: 'unseen emptied; no edges or suggestions',
      mean: person.snapshot.stats.mean, sd: person.snapshot.stats.sd}}
}
if (import.meta.main) {
  const c = JSON.parse(await Bun.stdin.text())
  console.log(JSON.stringify(render(c)))
}
