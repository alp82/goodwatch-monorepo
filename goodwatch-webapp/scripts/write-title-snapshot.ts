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
import Redis from "ioredis"
import {
	CURRENT_KEY,
	FINGERPRINT_LENGTH,
	MISSING_SCORE,
	MOVIE_BASE,
	SHOW_BASE,
	type SnapshotRow,
	chunkKey,
	encodeSnapshot,
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
	for (let i = 0; i < ids.length; i += BATCH) {
		const batch = ids.slice(i, i + BATCH).map((r) => Number(r.tmdb_id))
		const found = await query<Row>(
			`SELECT tmdb_id, fingerprint_scores, genres, ${day} AS day,
			 goodwatch_overall_score_normalized_percent AS score, goodwatch_overall_score_voting_count AS votes,
			 popularity, production_country_codes, original_language_code, poster_path, backdrop_path, adult, is_anime
			 FROM ${type} WHERE tmdb_id IN (${batch.join(",")}) LIMIT ${batch.length}`,
		)
		for (const r of found) rows.push(toRow(type, r))
	}
	return rows
}

const startedAt = performance.now()
const rows = [
	...(await sample("movie", MOVIES)),
	...(await sample("show", SHOWS)),
]
const sampled = rows.length
for (let i = 0; rows.length < PAD_TO; i++) {
	const source = rows[i % sampled]
	const base = source.pointId >= SHOW_BASE ? SHOW_BASE : MOVIE_BASE
	rows.push({ ...source, pointId: base + PADDING_BASE + i })
}

const version = `dev-${new Date().toISOString().replace(/[-:]|\.\d+/g, "")}`
const { manifest, chunks } = encodeSnapshot({
	version,
	rows,
	keyOrder: VALID_FINGERPRINT_KEYS,
})

const redis = new Redis(url)
const previous = JSON.parse((await redis.get(CURRENT_KEY)) ?? "null") as {
	version: string
} | null
for (const [n, chunk] of chunks.entries())
	await redis.set(chunkKey(version, n), Buffer.from(chunk))
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
	`Wrote title snapshot ${version}: ${manifest.count} titles (${sampled} sampled), ${manifest.chunks} chunks, ${manifest.genres.length} genres, ${manifest.origins.length} origins, pruned ${pruned} old chunks, in ${Math.round(performance.now() - startedAt)} ms`,
)
process.exit(0)
