// Writes a title snapshot from a sample of the catalog into a development Redis, so the webapp's title snapshot loader
// can be developed without the Windmill publisher. It reads the most voted movies and shows with a fingerprint from
// Crate (SELECT only), writes the chunks of a new version, swaps `title-snapshot:current`, and deletes the chunks of
// versions older than the previous one, as the publisher does.
//
//   set -a; source .env; set +a
//   TITLE_SNAPSHOT_REDIS_URL=redis://localhost:6379 npx vite-node --config scripts/arena-vite.config.mjs \
//     scripts/write-title-snapshot.ts [--movies=6000] [--shows=3000] [--pad-to=240000]
//
// Then start the webapp with the same TITLE_SNAPSHOT_REDIS_URL. --pad-to repeats the sample under made-up ids (tmdb
// ids from 900,000,000) until the snapshot has that many titles, to measure load time and memory at production size;
// don't use a padded snapshot for anything else. It never writes to the Redis cluster the webapp's .env names.
//
// It also writes the ratings sidecar (the age and content filter's data; start the webapp with REC_AGE_FILTER=on), from
// the titles' age_certifications and content_advisories and the age_certification table. How a rating code becomes an
// age, which advisories make which kind of content, and how a ladder is built are kept minimal here: the publisher's
// Python (goodwatch-flows) is the source of truth, and this sample may differ from what it publishes.
import Redis from "ioredis"
import {
	CONTENT_KINDS,
	type ContentKind,
	type LadderStep,
	MAX_AGE,
} from "~/domain/age-content"
import {
	CURRENT_KEY,
	FINGERPRINT_LENGTH,
	MAX_RATING_COUNTRIES,
	MISSING_SCORE,
	MOVIE_BASE,
	type RatingRow,
	SHOW_BASE,
	type SnapshotRow,
	chunkKey,
	encodeRatings,
	encodeSnapshot,
	ratingsChunkKey,
} from "~/server/title-snapshot/format.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { query } from "~/utils/crate"

const arg = (name: string, fallback: number) => {
	const value = process.argv
		.find((a) => a.startsWith(`--${name}=`))
		?.slice(name.length + 3)
	return value ? Number(value) : fallback
}
const MOVIES = arg("movies", 6000)
const SHOWS = arg("shows", 3000)
const PAD_TO = arg("pad-to", 0)
const BATCH = 500
const PADDING_BASE = 900_000_000

const url = process.env.TITLE_SNAPSHOT_REDIS_URL
if (!url)
	throw new Error("Set TITLE_SNAPSHOT_REDIS_URL to the development Redis")
if (process.env.REDIS_HOST && url.includes(process.env.REDIS_HOST))
	throw new Error("TITLE_SNAPSHOT_REDIS_URL names the webapp's Redis cluster")

type Row = {
	tmdb_id: number
	fingerprint_scores: Record<string, number | null> | null
	genres: string[] | null
	day: number | null
	score: number | null
	votes: number | null
	popularity: number | null
	production_country_codes: string[] | null
	original_language_code: string | null
	poster_path: string | null
	backdrop_path: string | null
	adult: boolean | null
	is_anime: boolean | null
	age_certifications: string[] | null
	content_advisories: string[] | null
}

// --- Ratings (minimal; the publisher's Python is the source of truth) ------------------------------------------------

// Countries whose codes are words.
const WORD_AGES: Record<string, Record<string, number>> = {
	US: {
		G: 0,
		PG: 8,
		"PG-13": 13,
		R: 17,
		"NC-17": 18,
		"TV-Y": 0,
		"TV-Y7": 7,
		"TV-G": 0,
		"TV-PG": 8,
		"TV-14": 14,
		"TV-MA": 17,
	},
	GB: { U: 0, PG: 8, "12A": 12, "12": 12, "15": 15, "18": 18, R18: 18 },
	AU: { G: 0, PG: 8, M: 15, "MA 15+": 15, "R 18+": 18, "X 18+": 18 },
}
const ALL_AGES = new Set(["AL", "ALL", "TP", "U", "T", "A", "AA", "L", "G"])

/** The age a rating code stands for; null for a code that isn't an age rating (NR, Unrated). */
function ageOfCode(country: string, code: string): number | null {
	const known = WORD_AGES[country]?.[code]
	if (known !== undefined) return known
	const number = code.match(/\d+/)
	if (number) return Math.min(MAX_AGE, Number(number[0]))
	return ALL_AGES.has(code.toUpperCase()) ? 0 : null
}

const ADVISORY_KINDS: Record<string, ContentKind> = {
	Violence: "violence",
	Nudity: "sex",
	"Sexual Content": "sex",
	"Strong Language": "language",
	"Drug Use": "drugs",
	"Suicide Themes": "disturbing",
	"Disturbing Imagery": "disturbing",
}

function toRatingRow(pointId: number, r: Row): RatingRow {
	// "DE_12", "AU_MA 15+": the strictest rating per country.
	const ages: Record<string, number> = {}
	for (const certification of r.age_certifications ?? []) {
		const at = certification.indexOf("_")
		if (at < 0) continue
		const country = certification.slice(0, at)
		const age = ageOfCode(country, certification.slice(at + 1))
		if (age !== null) ages[country] = Math.max(ages[country] ?? 0, age)
	}
	// The median across the countries that rated it, the lower one of an even count.
	const sorted = Object.values(ages).sort((a, b) => a - b)
	let content = 0
	for (const advisory of r.content_advisories ?? []) {
		const kind = ADVISORY_KINDS[advisory]
		if (kind) content |= 1 << CONTENT_KINDS.indexOf(kind)
	}
	return {
		pointId,
		content,
		estimate: sorted.length ? sorted[(sorted.length - 1) >> 1] : null,
		ages,
	}
}

const US_LADDER: LadderStep[] = [
	{ age: 0, label: "G", show: "TV-G" },
	{ age: 8, label: "PG", show: "TV-PG" },
	{ age: 14, label: "PG-13", show: "TV-14" },
	{ age: 17, label: "R", show: "TV-MA" },
]

/** A ladder per country with at least two steps, for the countries that rated the most titles of the sample. */
async function readLadders(
	ratingRows: RatingRow[],
): Promise<Record<string, LadderStep[]>> {
	const codes = await query<{
		country_code: string
		certification_code: string
		media_type: "movie" | "show"
	}>(
		`SELECT country_code, certification_code, media_type FROM age_certification
		 ORDER BY country_code, order_default LIMIT 10000`,
	)
	// Movie codes label a step; show codes add the steps movies lack.
	const steps = new Map<string, Map<number, string>>()
	for (const type of ["movie", "show"] as const)
		for (const row of codes) {
			if (row.media_type !== type) continue
			const age = ageOfCode(row.country_code, row.certification_code)
			if (age === null) continue
			const byAge = steps.get(row.country_code) ?? new Map<number, string>()
			steps.set(row.country_code, byAge)
			if (!byAge.has(age))
				byAge.set(
					age,
					row.country_code === "DE"
						? `FSK ${row.certification_code}`
						: row.certification_code,
				)
		}
	const rated = new Map<string, number>()
	for (const r of ratingRows)
		for (const country of Object.keys(r.ages))
			rated.set(country, (rated.get(country) ?? 0) + 1)
	const ladders: Record<string, LadderStep[]> = {}
	const countries = [...steps.keys()]
		.filter((country) => /^[A-Z]{2}$/.test(country))
		.sort((a, b) => (rated.get(b) ?? 0) - (rated.get(a) ?? 0))
	for (const country of countries) {
		const ladder =
			country === "US"
				? US_LADDER
				: [...(steps.get(country) ?? [])]
						.sort((a, b) => a[0] - b[0])
						.map(([age, label]) => ({ age, label }))
		if (ladder.length < 2) continue
		ladders[country] = ladder
		if (Object.keys(ladders).length === MAX_RATING_COUNTRIES) break
	}
	return ladders
}

const DAY_MS = 86_400_000

function toRow(type: "movie" | "show", r: Row): SnapshotRow {
	const fingerprint = new Uint8Array(FINGERPRINT_LENGTH).fill(MISSING_SCORE)
	VALID_FINGERPRINT_KEYS.forEach((key, k) => {
		const v = r.fingerprint_scores?.[key]
		if (typeof v === "number" && Number.isFinite(v))
			fingerprint[k] = Math.max(0, Math.min(10, Math.round(v)))
	})
	return {
		pointId: (type === "movie" ? MOVIE_BASE : SHOW_BASE) + r.tmdb_id,
		genres: r.genres ?? [],
		releaseDay: r.day == null ? null : Math.floor(Number(r.day) / DAY_MS),
		votes: r.votes ?? 0,
		popularity: r.popularity ?? 0,
		fingerprint,
		score: r.score,
		origin: r.production_country_codes?.[0] || r.original_language_code || null,
		hasPoster: !!r.poster_path,
		hasBackdrop: !!r.backdrop_path,
		adult: !!r.adult,
		anime: !!r.is_anime,
	}
}

async function sample(type: "movie" | "show", limit: number) {
	const ids = await query<{ tmdb_id: number }>(
		`SELECT tmdb_id FROM ${type} WHERE fingerprint_scores IS NOT NULL
		 ORDER BY goodwatch_overall_score_voting_count DESC NULLS LAST, tmdb_id LIMIT ${Math.floor(limit)}`,
	)
	const day = type === "movie" ? "release_date" : "last_air_date"
	const rows: SnapshotRow[] = []
	const ratingRows: RatingRow[] = []
	for (let i = 0; i < ids.length; i += BATCH) {
		const batch = ids.slice(i, i + BATCH).map((r) => Number(r.tmdb_id))
		const found = await query<Row>(
			`SELECT tmdb_id, fingerprint_scores, genres, ${day} AS day,
			 goodwatch_overall_score_normalized_percent AS score, goodwatch_overall_score_voting_count AS votes,
			 popularity, production_country_codes, original_language_code, poster_path, backdrop_path, adult, is_anime,
			 age_certifications, content_advisories
			 FROM ${type} WHERE tmdb_id IN (${batch.join(",")}) LIMIT ${batch.length}`,
		)
		for (const r of found) {
			const row = toRow(type, r)
			rows.push(row)
			ratingRows.push(toRatingRow(row.pointId, r))
		}
	}
	return { rows, ratingRows }
}

const startedAt = performance.now()
const movies = await sample("movie", MOVIES)
const shows = await sample("show", SHOWS)
const rows = [...movies.rows, ...shows.rows]
const ratingRows = [...movies.ratingRows, ...shows.ratingRows]
const sampled = rows.length
for (let i = 0; rows.length < PAD_TO; i++) {
	const source = rows[i % sampled]
	const base = source.pointId >= SHOW_BASE ? SHOW_BASE : MOVIE_BASE
	const pointId = base + PADDING_BASE + i
	rows.push({ ...source, pointId })
	ratingRows.push({ ...ratingRows[i % sampled], pointId })
}

const version = `dev-${new Date().toISOString().replace(/[-:]|\.\d+/g, "")}`
const { manifest, chunks } = encodeSnapshot({
	version,
	rows,
	keyOrder: VALID_FINGERPRINT_KEYS,
})
// Like the publisher, a failure here leaves the snapshot published without ratings.
let ratings: ReturnType<typeof encodeRatings> | null = null
try {
	ratings = encodeRatings({
		rows: ratingRows,
		ladders: await readLadders(ratingRows),
	})
	manifest.ratings = ratings.manifest
} catch (error) {
	console.error("No ratings sidecar:", error)
}

const redis = new Redis(url)
const previous = JSON.parse((await redis.get(CURRENT_KEY)) ?? "null") as {
	version: string
} | null
for (const [n, chunk] of chunks.entries())
	await redis.set(chunkKey(version, n), Buffer.from(chunk))
for (const [n, chunk] of ratings?.chunks.entries() ?? [])
	await redis.set(ratingsChunkKey(version, n), Buffer.from(chunk))
await redis.set(CURRENT_KEY, JSON.stringify(manifest))
const keep = new Set([version, previous?.version])
let pruned = 0
for await (const keys of redis.scanStream({ match: "title-snapshot:*:*" }))
	for (const key of keys as string[]) {
		const keyVersion = key.split(":")[1]
		if (!keep.has(keyVersion)) pruned += await redis.del(key)
	}
redis.disconnect()

console.info(
	`Wrote title snapshot ${version}: ${manifest.count} titles (${sampled} sampled), ${manifest.chunks} chunks, ${manifest.genres.length} genres, ${manifest.origins.length} origins, ${ratings ? `ratings for ${ratings.manifest.countries.length} countries` : "no ratings"}, pruned ${pruned} old chunks, in ${Math.round(performance.now() - startedAt)} ms`,
)
process.exit(0)
