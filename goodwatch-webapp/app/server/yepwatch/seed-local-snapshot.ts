/** Tiny real-catalog sample for LOCAL smoke. No fabricated IDs; SELECT only against catalog. */
export {}
if (process.env.YEPWATCH_SEED_LOCAL_SAMPLE !== '1') throw new Error('Explicit YEPWATCH_SEED_LOCAL_SAMPLE=1 required')
const redisUrl = process.env.TITLE_SNAPSHOT_REDIS_URL
if (!redisUrl || !['127.0.0.1', 'localhost'].includes(new URL(redisUrl).hostname)) throw new Error('Snapshot writes restricted to explicit loopback Redis')
if (process.env.YEPWATCH_LOAD_LOCAL_ENV === '1') process.loadEnvFile('.env')
const [{ searchQuery }, { encodeSnapshot, FINGERPRINT_LENGTH, MISSING_SCORE, MOVIE_BASE, SHOW_BASE, CURRENT_KEY, chunkKey }, { VALID_FINGERPRINT_KEYS }, { default: Redis }] = await Promise.all([import('../combined-search/catalog.server'), import('../title-snapshot/format.server'), import('../utils/fingerprint'), import('ioredis')])
type Row = { tmdb_id: number; fingerprint_scores: Record<string, number | null> | null; genres: string[] | null; day: number | null; score: number | null; votes: number | null; popularity: number | null; production_country_codes: string[] | null; original_language_code: string | null; poster_path: string | null; backdrop_path: string | null; adult: boolean | null; is_anime: boolean | null }
const rows = []
for (const type of ['movie', 'show'] as const) {
  // Indexed human-title lookup, then bounded canonical PK reads. This is a test sample, NOT the product universe.
  const terms = type === 'movie' ? ['Inception', 'Interstellar', 'Matrix', 'Dune'] : ['Breaking Bad', 'Dark', 'Stranger Things', 'Severance']
  const ids = [...new Set((await Promise.all(terms.map(term => searchQuery<{ tmdb_id: number }>(`SELECT tmdb_id FROM ${type} WHERE MATCH((title,original_title),?) ORDER BY popularity DESC,tmdb_id LIMIT 5`, [term])))).flat().map(r => r.tmdb_id))]
  if (!ids.length) continue
  const records = await searchQuery<Row>(`SELECT tmdb_id,fingerprint_scores,genres,${type === 'movie' ? 'release_date' : 'last_air_date'} AS day,goodwatch_overall_score_normalized_percent AS score,goodwatch_overall_score_voting_count AS votes,popularity,production_country_codes,original_language_code,poster_path,backdrop_path,adult,is_anime FROM ${type} WHERE tmdb_id=ANY(?)`, [ids])
  for (const r of records) {
    const fingerprint = new Uint8Array(FINGERPRINT_LENGTH).fill(MISSING_SCORE)
    VALID_FINGERPRINT_KEYS.forEach((key, index) => { const value = r.fingerprint_scores?.[key]; if (typeof value === 'number' && Number.isFinite(value)) fingerprint[index] = Math.max(0, Math.min(10, Math.round(value))) })
    rows.push({ pointId: (type === 'movie' ? MOVIE_BASE : SHOW_BASE) + r.tmdb_id, genres: r.genres ?? [], releaseDay: r.day == null ? null : Math.floor(new Date(r.day).getTime() / 86400_000), score: r.score, votes: r.votes ?? 0, popularity: r.popularity ?? 0, origin: r.production_country_codes?.[0] || r.original_language_code || null, hasPoster: !!r.poster_path, hasBackdrop: !!r.backdrop_path, adult: !!r.adult, anime: !!r.is_anime, fingerprint })
  }
}
if (!rows.length) throw new Error('No real catalog sample returned')
const version = `yepwatch-local-${Date.now()}`
const { manifest, chunks } = encodeSnapshot({ version, builtAt: new Date(), rows, keyOrder: VALID_FINGERPRINT_KEYS })
const redis = new Redis(redisUrl)
try { for (const [index, chunk] of chunks.entries()) await redis.set(chunkKey(version, index), Buffer.from(chunk)); await redis.set(CURRENT_KEY, JSON.stringify(manifest)); console.log(JSON.stringify({ check: 'local_real_sample_published', count: manifest.count, padded: false, ratingsSidecar: false })) }
finally { redis.disconnect(); setTimeout(() => process.exit(0), 50).unref() }
