import type { Candidate } from "../../../packages/yepwatch-contracts/continuous.ts"
import { FINGERPRINT_META } from "../../../packages/yepwatch-contracts/fingerprint.ts"
import type { CatalogQuery } from "./catalog-stream-links.ts"

interface TitleRow {
  tmdb_id: number; tagline: string | null; synopsis: string | null; genres: string[] | null
  age_certifications: string[] | null; fingerprint_highlight_keys: string[] | null
  imdb_user_score_original: number | null; rotten_tomatoes_tomato_score_original: number | null
  rotten_tomatoes_audience_score_original: number | null; metacritic_meta_score_original: number | null
}
interface Credit { media_tmdb_id: number; person_tmdb_id: number }
interface Video { media_tmdb_id: number; site_key: string }
const fields = 'tmdb_id, tagline, synopsis, genres, age_certifications, fingerprint_highlight_keys, imdb_user_score_original, rotten_tomatoes_tomato_score_original, rotten_tomatoes_audience_score_original, metacritic_meta_score_original'
/** Same source scales and missing-score rule as MCP titleScores; transport is integer percent. */
const score = (n: number | null, scale = 100) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= scale ? Math.round(n * 100 / scale) : null

/** Bounded page reads over granted catalog tables, never one full details query per card. */
export async function enrichContinuousCandidates(candidates: Candidate[], country: string, read?: CatalogQuery): Promise<Candidate[]> {
  if (!candidates.length) return candidates
  const query = read ?? (await import('../combined-search/catalog.server')).searchQuery
  const updates = new Map<string, Partial<Candidate>>()
  await Promise.all((['movie', 'show'] as const).map(async mediaType => {
    const ids = [...new Set(candidates.filter(c => (c.identity.kind === 'movie' ? 'movie' : 'show') === mediaType).map(c => c.identity.tmdbId))]
    if (!ids.length) return
    const placeholders = ids.map(() => '?').join(',')
    // A missing optional part must not remove verified offers or fabricate catalog facts.
    const [titles, crew, cast, videos] = await Promise.all([
      query<TitleRow>(`SELECT ${fields} FROM doc.${mediaType} WHERE tmdb_id IN (${placeholders}) LIMIT 512`, ids).catch(() => null),
      query<Credit>(`SELECT DISTINCT media_tmdb_id, person_tmdb_id FROM doc.person_worked_on WHERE media_type = ? AND media_tmdb_id IN (${placeholders}) AND job = ? ORDER BY media_tmdb_id, person_tmdb_id LIMIT 10000`, [mediaType, ...ids, mediaType === 'movie' ? 'Director' : 'Creator']).catch(() => null),
      query<Credit>(`SELECT media_tmdb_id, person_tmdb_id FROM doc.person_appeared_in WHERE media_type = ? AND media_tmdb_id IN (${placeholders}) ORDER BY media_tmdb_id, order_default ASC, person_tmdb_id ASC LIMIT 10000`, [mediaType, ...ids]).catch(() => null),
      query<Video>(`SELECT media_tmdb_id, site_key FROM doc.media_video WHERE media_type = ? AND media_tmdb_id IN (${placeholders}) AND site = 'YouTube' AND video_type = 'Trailer' ORDER BY official DESC, published_at DESC, tmdb_id ASC LIMIT 10000`, [mediaType, ...ids]).catch(() => null),
    ])
    const personIds = [...new Set([...(crew ?? []), ...(cast ?? [])].map(c => c.person_tmdb_id))]
    const people = personIds.length ? await query<{ tmdb_id: number; name: string }>(`SELECT tmdb_id, name FROM doc.person WHERE tmdb_id IN (${personIds.map(() => '?').join(',')}) LIMIT 10000`, personIds).catch(() => null) : []
    const names = new Map(people?.map(p => [p.tmdb_id, p.name]))
    const creditNames = (rows: Credit[], id: number, limit: number) => [...new Set(rows.filter(c => c.media_tmdb_id === id).flatMap(c => names.get(c.person_tmdb_id) || []))].slice(0, limit)
    const titleMap = new Map(titles?.map(t => [t.tmdb_id, t]))
    for (const id of ids) {
      const title = titleMap.get(id)
      const patch: Partial<Candidate> = {}
      if (title) {
        const cert = title.age_certifications?.find(c => c.startsWith(`${country}_`))?.slice(country.length + 1) || null
        Object.assign(patch, {
          tagline: title.tagline || null,
          overview: title.synopsis || title.tagline || null,
          genres: title.genres ?? [],
          certification: cert && country === 'DE' && /^\d+$/.test(cert) ? `FSK ${cert}` : cert,
          scores: { imdb: score(title.imdb_user_score_original, 10), rtCritics: score(title.rotten_tomatoes_tomato_score_original), rtAudience: score(title.rotten_tomatoes_audience_score_original), metacritic: score(title.metacritic_meta_score_original) },
          highlights: [...new Set(title.fingerprint_highlight_keys ?? [])].filter(key => Object.prototype.hasOwnProperty.call(FINGERPRINT_META, key)).slice(0, 3).map(key => ({ key, label: FINGERPRINT_META[key].label })),
        })
      }
      if (people !== null && crew !== null && cast !== null) patch.people = { directors: creditNames(crew, id, 2), cast: creditNames(cast, id, 3) }
      if (videos !== null) {
        const trailer = videos.find(v => v.media_tmdb_id === id && /^[\w-]{11}$/.test(v.site_key))
        patch.trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.site_key}` : null
      }
      updates.set(`${mediaType}_${id}`, patch)
    }
  }))
  return candidates.map(c => ({ ...c, ...updates.get(`${c.identity.kind === 'movie' ? 'movie' : 'show'}_${c.identity.tmdbId}`) }))
}
