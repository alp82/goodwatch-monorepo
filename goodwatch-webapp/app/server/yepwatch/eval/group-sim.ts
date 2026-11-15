import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { readOnlyCrate } from './read-only.ts'
import { evalSnapshot, type EvalTitle } from './snapshot.ts'
import { rankDeck, RANK_WEIGHTS } from '../proposal-ranker.ts'
import { qualityPriors, passesFloor } from '../proposal-pool.ts'
import type { PersonSignal } from '../proposal-person-signal.ts'
import { VALID_FINGERPRINT_KEYS } from '../../utils/fingerprint.ts'
export interface EvalData { titles: (EvalTitle & { services: number[] })[]; members: { ratings: { key: number; score: number }[] }[] }
type BuildTaste = (ratings: { key: number; score: number }[]) => PersonSignal | null
const random = (seed: number) => { let value = seed >>> 0; return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296 } }
/** Fixed holdout/group sample across the entire grid. Missing held-out judgements reduce coverage, never count as likes. */
export function groupSimulation(data: EvalData, build: BuildTaste, options: { groups?: number; seed?: number } = {}) {
  const rng = random(options.seed ?? 821), snapshot = evalSnapshot(data.titles, 'eval-copy')
  const members = data.members.filter(m => m.ratings.length >= 40).map(m => {
    const training: typeof m.ratings = [], hidden = new Map<number, number>()
    for (const rating of m.ratings) { if (rng() < .3) hidden.set(rating.key, rating.score); else training.push(rating) }
    return { taste: build(training), seen: new Set(training.map(r => r.key)), hidden }
  })
  if (members.length < 4) throw new Error('Simulation needs at least four members with 40 ratings')
  const groups = Array.from({ length: options.groups ?? 100 }, () => {
    const size = 2 + Math.floor(rng() * 3), chosen = new Set<number>()
    while (chosen.size < size) chosen.add(Math.floor(rng() * members.length))
    return [...chosen].map(i => members[i])
  })
  const configurations = [
    { name: 'popularity-baseline', weights: RANK_WEIGHTS, leastMisery: .65, floor: 0 },
    ...[.35, .45, .55].flatMap(taste => [.5, .65, .8].flatMap(leastMisery => [0, 1, 2].map(floor => ({
      name: `taste-${taste}-minimum-${leastMisery}-floor-${floor}`, weights: { ...RANK_WEIGHTS, taste }, leastMisery, floor,
    })))),
  ]
  const results = configurations.map(config => {
    let positive = 0, misery = 0, known = 0, dealt = 0, short = 0
    const baseline = config.name === 'popularity-baseline'
    const pool = data.titles.filter(t => t.services.length && (baseline ? (t.flags ?? 3) & 1 && !((t.flags ?? 3) & 4) && t.score !== 255 : passesFloor(snapshot, t.key, config.floor))).map(t => t.key)
    const quality = qualityPriors(snapshot, pool)
    pool.sort(baseline ? (a, b) => snapshot.columns.popularity[snapshot.rowOf(b)] - snapshot.columns.popularity[snapshot.rowOf(a)] : (a, b) => quality.get(b)! - quality.get(a)!)
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g], excluded = new Set(group.flatMap(m => [...m.seen])), people = group.map(m => m.taste).filter((t): t is PersonSignal => !!t)
      const deck = baseline ? pool.filter(k => !excluded.has(k)).slice(0, 20) : rankDeck({ pool, snapshot, people, ideas: [], wishlist: new Map(), excluded,
        seed: `eval-${g}`, peopleCount: group.length, quality, weights: config.weights, leastMisery: config.leastMisery }, 20).map(r => r.key)
      dealt += deck.length; if (deck.length < 20) short++
      for (const key of deck) {
        const ratings = group.map(m => m.hidden.get(key))
        if (ratings.every(r => r !== undefined)) known++
        if (ratings.every(r => r !== undefined && r >= 7)) positive++
        if (ratings.some(r => r !== undefined && r <= 4)) misery++
      }
    }
    return { configuration: config.name, groups: groups.length, precisionAt20: positive / (groups.length * 20), miseryAt20: misery / (groups.length * 20),
      coverage: known / Math.max(1, dealt), shortDeckRate: short / groups.length }
  })
  const baseline = results[0]
  const eligible = results.slice(1).filter(r => r.precisionAt20 >= baseline.precisionAt20 && r.miseryAt20 <= baseline.miseryAt20 && r.coverage > 0)
    .sort((a, b) => b.precisionAt20 - a.precisionAt20 || a.miseryAt20 - b.miseryAt20 || a.shortDeckRate - b.shortDeckRate)
  return { seed: options.seed ?? 821, sampledMembers: members.length, results, recommendation: eligible[0]?.configuration ?? null,
    limitation: 'Sparse overlapping holdout ratings can make coverage too low to tune. Do not ship a weight change on zero coverage.' }
}
async function fromCrate(): Promise<EvalData> {
  const sql = readOnlyCrate(), country = process.env.YEPWATCH_EVAL_COUNTRY ?? 'DE', services = (process.env.YEPWATCH_EVAL_SERVICES ?? '8,9').split(',').map(Number)
  const users = await sql<{ user_id: string }>('SELECT user_id FROM user_score GROUP BY user_id HAVING count(*)>=40 ORDER BY user_id LIMIT 200')
  const ratings = await sql<{ user_id: string; tmdb_id: number; media_type: string; score: number }>('SELECT user_id,tmdb_id,media_type,score FROM user_score WHERE user_id=ANY(?) LIMIT 1000000', [users.map(u => u.user_id)])
  if (ratings.length === 1000000) throw new Error('Rating limit reached')
  const offered = await sql<{ media_type: string; media_tmdb_id: number; service_ids: number[] }>("SELECT media_type,media_tmdb_id,collect_set(streaming_service_id) AS service_ids FROM streaming_availability WHERE country_code=? AND streaming_type IN ('flatrate','free','ads') AND streaming_service_id=ANY(?) GROUP BY media_type,media_tmdb_id LIMIT 200000", [country, services])
  const availability = new Map(offered.map(r => [(r.media_type === 'movie' ? 1e12 : 2e12) + Number(r.media_tmdb_id), r.service_ids]))
  const titles: EvalData['titles'] = []
  for (const kind of ['movie', 'show'] as const) {
    const rows = await sql<{ tmdb_id: number; score: number; votes: number; popularity: number; fingerprint_scores: Record<string, number>; genres: string[]; year: number; day: number; poster_path: string; adult: boolean }>(
      `SELECT tmdb_id,goodwatch_overall_score_normalized_percent AS score,goodwatch_overall_score_voting_count AS votes,popularity,fingerprint_scores,genres,release_year AS year,${kind === 'movie' ? 'release_date' : 'first_air_date'} AS day,poster_path,adult FROM ${kind} WHERE fingerprint_scores IS NOT NULL ORDER BY tmdb_id LIMIT 200000`)
    if (rows.length === 200000) throw new Error('Title limit reached')
    for (const r of rows) { const key = (kind === 'movie' ? 1e12 : 2e12) + Number(r.tmdb_id); titles.push({ key, score: r.score ?? 255, votes: r.votes ?? 0, popularity: r.popularity ?? 0,
      fp: VALID_FINGERPRINT_KEYS.map(k => r.fingerprint_scores[k] ?? 255), genre: ['Drama', 'Reality', 'Talk', 'News', 'Soap'].reduce((mask, name, bit) => mask | (r.genres?.includes(name) ? 1 << bit : 0), 0),
      flags: (r.poster_path ? 1 : 0) | (r.adult ? 4 : 0), year: r.year, day: r.day == null ? -2147483648 : Math.floor(new Date(r.day).getTime() / 86400000), services: availability.get(key) ?? [] }) }
  }
  return { titles, members: users.map(u => ({ ratings: ratings.filter(r => r.user_id === u.user_id).map(r => ({ key: (r.media_type === 'movie' ? 1e12 : 2e12) + Number(r.tmdb_id), score: r.score })) })) }
}
async function main() {
  const file = process.argv.find(a => a.startsWith('--fixture='))?.slice(10)
  const data: EvalData = file ? JSON.parse(await readFile(file, 'utf8')) : await fromCrate()
  const snapshot = evalSnapshot(data.titles, 'eval-copy')
  // Run with tsx from goodwatch-webapp so GoodWatch's own formula resolves its ~/ imports.
  const [{ tasteVector, quantileTable }, { tastePool, poolCosines }] = await Promise.all([import('../../taste/formula.server'), import('../../taste/pool.server')])
  const pool = tastePool(snapshot)
  console.info(JSON.stringify({ event: 'yepwatch_group_simulation', ...groupSimulation(data, ratings => {
    const built = tasteVector(snapshot, { ratings: ratings.map(r => ({ ...r, at: 0 })), wantToSee: [] })
    return built.vector ? { vector: built.vector, quantiles: quantileTable(poolCosines(pool, built.vector)), confidence: Math.min(1, built.liked / 8), unseen: new Set(), source: 'member', snapshotVersion: snapshot.version } : null
  }) }))
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Group simulation failed; no member or title rows logged'); process.exitCode = 1 })
