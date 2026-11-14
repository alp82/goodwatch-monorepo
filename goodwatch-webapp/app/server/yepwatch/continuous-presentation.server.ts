import type { Candidate } from "../../../packages/yepwatch-contracts/continuous.ts"
import { FINGERPRINT_META } from "../../../packages/yepwatch-contracts/fingerprint.ts"
import type { CatalogQuery } from "./catalog-stream-links.ts"
import { KeyedReads } from "./read-cache.ts"

import { readTitle, effectColor, notForLine } from "../../domain/fingerprint-effects/title-reading.ts"
import { type CoreScores, VALID_FINGERPRINT_KEYS } from "../utils/fingerprint.ts"
import type { Candidate as ProposalCandidate } from "../../../packages/yepwatch-contracts/proposal.ts"

type TextFingerprint = Pick<ProposalCandidate, "essence" | "effects" | "notFor">
interface TitleRow {
  fingerprint_scores: CoreScores | null; essence_tags: string[] | null
  tmdb_id: number; tagline: string | null; synopsis: string | null; genres: string[] | null
  age_certifications: string[] | null; fingerprint_highlight_keys: string[] | null
  imdb_user_score_original: number | null; rotten_tomatoes_tomato_score_original: number | null
  rotten_tomatoes_audience_score_original: number | null; metacritic_meta_score_original: number | null
}
interface Credit { media_tmdb_id: number; person_tmdb_id: number }
interface Video { media_tmdb_id: number; site_key: string }
const fields = 'tmdb_id, fingerprint_scores, essence_tags, tagline, synopsis, genres, age_certifications, fingerprint_highlight_keys, imdb_user_score_original, rotten_tomatoes_tomato_score_original, rotten_tomatoes_audience_score_original, metacritic_meta_score_original'
/** Same source scales and missing-score rule as MCP titleScores; transport is integer percent. */
const score = (n: number | null, scale = 100) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= scale ? Math.round(n * 100 / scale) : null

/** What a card shows of a title whatever the room's country: its catalog row, people and trailer. */
interface Extras {
  title: TitleRow | null
  /** Null: the credit or person reads failed. */
  people: { directors: string[]; cast: string[] } | null
  /** Undefined: the video read failed; null: no trailer. */
  trailerUrl: string | null | undefined
}
type Kind = 'movie' | 'show'
/**
 * Each title's extras are kept in this process for at most 6 hours (scores, people and trailers change with the
 * daily catalog ingest), when every part of them was read; a partial read is used once and read again next time.
 */
const EXTRAS_TTL_MS = 6 * 3600_000
export const extrasKept = () => new KeyedReads<Extras>(EXTRAS_TTL_MS, 10_000, (e) => e.title !== null && e.people !== null && e.trailerUrl !== undefined)
const shared = extrasKept()

/** One bounded read per catalog part for `ids` of one kind. */
async function readExtras(query: CatalogQuery, mediaType: Kind, ids: number[]): Promise<Map<number, Extras>> {
  const placeholders = ids.map(() => '?').join(',')
  // A missing optional part must not remove verified offers or fabricate catalog facts.
  const [titles, crew, cast, videos] = await Promise.all([
    query<TitleRow>(`SELECT ${fields} FROM doc.${mediaType} WHERE tmdb_id IN (${placeholders}) LIMIT 512`, ids).catch(() => null),
    query<Credit>(`SELECT DISTINCT media_tmdb_id, person_tmdb_id FROM doc.person_worked_on WHERE media_type = ? AND media_tmdb_id IN (${placeholders}) AND job = ? ORDER BY media_tmdb_id, person_tmdb_id LIMIT 10000`, [mediaType, ...ids, mediaType === 'movie' ? 'Director' : 'Creator']).catch(() => null),
    query<Credit>(`SELECT media_tmdb_id, person_tmdb_id FROM doc.person_appeared_in WHERE media_type = ? AND media_tmdb_id IN (${placeholders}) AND order_default < 20 ORDER BY media_tmdb_id, order_default ASC, person_tmdb_id ASC LIMIT 10000`, [mediaType, ...ids]).catch(() => null),
    query<Video>(`SELECT media_tmdb_id, site_key FROM doc.media_video WHERE media_type = ? AND media_tmdb_id IN (${placeholders}) AND site = 'YouTube' AND video_type = 'Trailer' ORDER BY official DESC NULLS LAST, published_at DESC NULLS LAST, tmdb_id ASC LIMIT 10000`, [mediaType, ...ids]).catch(() => null),
  ])
  const personIds = [...new Set([...(crew ?? []), ...(cast ?? [])].map(c => c.person_tmdb_id))]
  const people = personIds.length ? await query<{ tmdb_id: number; name: string }>(`SELECT tmdb_id, name FROM doc.person WHERE tmdb_id IN (${personIds.map(() => '?').join(',')}) LIMIT 10000`, personIds).catch(() => null) : []
  const names = new Map(people?.map(p => [p.tmdb_id, p.name]))
  const creditNames = (rows: Credit[], id: number, limit: number) => [...new Set(rows.filter(c => c.media_tmdb_id === id).flatMap(c => names.get(c.person_tmdb_id) || []))].slice(0, limit)
  const titleMap = new Map(titles?.map(t => [t.tmdb_id, t]))
  return new Map(ids.map(id => {
    const trailer = videos?.find(v => v.media_tmdb_id === id && /^[\w-]{11}$/.test(v.site_key))
    return [id, {
      // A title the read didn't return stays unknown (null), whether the read failed or the row is missing.
      title: titleMap.get(id) ?? null,
      people: people !== null && crew !== null && cast !== null ? { directors: creditNames(crew, id, 2), cast: creditNames(cast, id, 3) } : null,
      trailerUrl: videos === null ? undefined : trailer ? `https://www.youtube.com/watch?v=${trailer.site_key}` : null,
    }]
  }))
}

/** The extras of `ids`, from `kept` where fresh. */
function extras(query: CatalogQuery, mediaType: Kind, ids: number[], kept: KeyedReads<Extras> | null): Promise<Map<number, Extras>> {
  if (!kept) return readExtras(query, mediaType, ids)
  return kept.many(ids.map(id => `${mediaType}_${id}`), async missing => {
    const read = await readExtras(query, mediaType, missing.map(key => Number(key.slice(mediaType.length + 1))))
    return new Map([...read].map(([id, value]) => [`${mediaType}_${id}`, value]))
  }).then(found => new Map([...found].map(([key, value]) => [Number(key.slice(mediaType.length + 1)), value])))
}

/**
 * Starts reading the extras of titles a deck is likely to show (they pass every screen's offers), so the page's
 * enrichment finds them read. Never throws.
 */
export function warmEnrichment(titles: { mediaType: Kind; tmdbId: number }[]) {
  void (async () => {
    const { searchQuery } = await import('../combined-search/catalog.server')
    for (const mediaType of ['movie', 'show'] as const) {
      const ids = [...new Set(titles.filter(t => t.mediaType === mediaType).map(t => t.tmdbId))]
      if (ids.length) shared.warm(ids.map(id => `${mediaType}_${id}`), async missing => {
        const read = await readExtras(searchQuery, mediaType, missing.map(key => Number(key.slice(mediaType.length + 1))))
        return new Map([...read].map(([id, value]) => [`${mediaType}_${id}`, value]))
      })
    }
  })().catch(() => {})
}

/**
 * Bounded page reads over granted catalog tables, never one full details query per card. `kept`: where extras are
 * kept between pages (the process's own by default; none with a custom `read`, unless given).
 */
export async function enrichContinuousCandidates(candidates: Candidate[], country: string, read?: CatalogQuery, kept: KeyedReads<Extras> | null = read ? null : shared): Promise<(Candidate & TextFingerprint)[]> {
  if (!candidates.length) return candidates
  // Highlights are extras: if the reader can't load, cards go out unenriched.
  let query: CatalogQuery
  try { query = read ?? (await import('../combined-search/catalog.server')).searchQuery } catch { return candidates }
  const updates = new Map<string, Partial<Candidate & TextFingerprint>>()
  await Promise.all((['movie', 'show'] as const).map(async mediaType => {
    const ids = [...new Set(candidates.filter(c => (c.identity.kind === 'movie' ? 'movie' : 'show') === mediaType).map(c => c.identity.tmdbId))]
    if (!ids.length) return
    const found = await extras(query, mediaType, ids, kept).catch(() => new Map<number, Extras>())
    for (const id of ids) {
      const { title = null, people = null, trailerUrl = undefined } = found.get(id) ?? {}
      const patch: Partial<Candidate & TextFingerprint> = {}
      if (title) {
        // No reading without actual scores: the reader's low-score fallback is not missing data.
        const scores = title.fingerprint_scores
        if (scores && VALID_FINGERPRINT_KEYS.some(key => Number.isFinite(scores[key]))) {
          const reading = readTitle(scores)
          patch.essence = Array.isArray(title.essence_tags) ? title.essence_tags.filter(tag => typeof tag === 'string').slice(0, 6) : null
          patch.effects = reading.rows.slice(0, 5).map(({ r }) => ({ line: `${r.effect.name}.`, strength: r.strength, color: effectColor(r) }))
          patch.notFor = notForLine(reading.not) || null
        }
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
      if (people) patch.people = { directors: [...people.directors], cast: [...people.cast] }
      if (trailerUrl !== undefined) patch.trailerUrl = trailerUrl
      updates.set(`${mediaType}_${id}`, patch)
    }
  }))
  return candidates.map(c => ({ ...c, ...updates.get(`${c.identity.kind === 'movie' ? 'movie' : 'show'}_${c.identity.tmdbId}`) }))
}
