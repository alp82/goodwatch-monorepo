// PROTOTYPE - throwaway. Round 8 filters chapter: round 7's real Discover steps, plus where they start. The story now
// opens on every movie and show GoodWatch knows (the catalog, counted in Crate), and the first switch is the floor
// Discover itself stands on: titles with a title analysis (only those are in Discover's title snapshot, see
// goodwatch-flows/windmill/f/sync/copy/title_snapshot.py: `WHERE dna_updated_at IS NOT NULL`). Counted once, kept
// on disk.
import type { LandingCard } from "~/server/prototype-landing.server"
import { query } from "~/utils/crate"
import { titleKey } from "~/utils/title-key"

export type R8Title = { key: string; title: string; poster: string | null; score: number | null }

export type R8Catalog = {
	movies: number
	shows: number
	/** Of those, the ones with a title analysis: Discover's own universe. */
	analysedMovies: number
	analysedShows: number
	/** Adult-flagged entries among all, and among the analysed. */
	adult: number
	analysedAdult: number
	/** Real long-tail titles for the first two steps: known to the catalog but never analysed and barely rated; and
	 * analysed but under Discover's 1,000-vote floor. Recent-ish, with a poster, most popular first. */
	tail: R8Title[]
	analysedTail: R8Title[]
	/** Layers between the whole catalog and Discover, for choosing the honest opening number. */
	layers: Record<string, number>
}

const SNAPSHOT =
	"/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/8a85384e-6a6e-4f4f-9bbd-023729f9c3f3/scratchpad/intro-r8filter.json"

let cached: Promise<R8Catalog> | null = null

export function load(_request: Request, _landing: LandingCard[]): Promise<R8Catalog> {
	if (!cached) {
		cached = fromDiskOrBuild()
		cached.catch(() => {
			cached = null
		})
	}
	return cached
}

async function fromDiskOrBuild(): Promise<R8Catalog> {
	const fs = await import("node:fs/promises")
	try {
		return JSON.parse(await fs.readFile(SNAPSHOT, "utf8")) as R8Catalog
	} catch {}
	const data = await build()
	await fs.writeFile(SNAPSHOT, JSON.stringify(data)).catch(() => {})
	return data
}

const n = async (sql: string) => Number(((await query(sql)) as { n: number }[])[0]?.n ?? 0)

async function build(): Promise<R8Catalog> {
	const [movies, shows, analysedMovies, analysedShows, adultM, adultS, aAdultM, aAdultS] = await Promise.all([
		n("SELECT count(*) AS n FROM movie"),
		n("SELECT count(*) AS n FROM show"),
		n("SELECT count(*) AS n FROM movie WHERE dna_updated_at IS NOT NULL"),
		n("SELECT count(*) AS n FROM show WHERE dna_updated_at IS NOT NULL"),
		n("SELECT count(*) AS n FROM movie WHERE adult = true"),
		n("SELECT count(*) AS n FROM show WHERE adult = true"),
		n("SELECT count(*) AS n FROM movie WHERE dna_updated_at IS NOT NULL AND adult = true"),
		n("SELECT count(*) AS n FROM show WHERE dna_updated_at IS NOT NULL AND adult = true"),
	])
	const pick = async (where: string) =>
		((await query(
			`SELECT tmdb_id, title, poster_path, goodwatch_overall_score_normalized_percent AS score FROM movie
			 WHERE poster_path IS NOT NULL AND release_year BETWEEN 1995 AND 2025 AND ${where}
			 ORDER BY popularity DESC LIMIT 12`,
		)) as { tmdb_id: number; title: string; poster_path: string; score: number | null }[]).map((r) => ({
			key: String(titleKey("movie", r.tmdb_id)),
			title: r.title,
			poster: r.poster_path,
			score: r.score == null ? null : Math.round(r.score),
		}))
	const [tail, analysedTail] = await Promise.all([
		pick("dna_updated_at IS NULL AND (goodwatch_overall_score_voting_count IS NULL OR goodwatch_overall_score_voting_count < 50)"),
		pick("dna_updated_at IS NOT NULL AND goodwatch_overall_score_voting_count BETWEEN 50 AND 900"),
	])
	const both = async (where: string) =>
		(await n(`SELECT count(*) AS n FROM movie WHERE ${where}`)) + (await n(`SELECT count(*) AS n FROM show WHERE ${where}`))
	const layers: Record<string, number> = {
		poster: await both("poster_path IS NOT NULL"),
		posterRated: await both("poster_path IS NOT NULL AND goodwatch_overall_score_voting_count > 0"),
		votes10: await both("goodwatch_overall_score_voting_count >= 10"),
		votes100: await both("goodwatch_overall_score_voting_count >= 100"),
		votes1000: await both("goodwatch_overall_score_voting_count >= 1000"),
		analysedVotes1000: await both("dna_updated_at IS NOT NULL AND goodwatch_overall_score_voting_count >= 1000"),
		analysedPoster: await both("dna_updated_at IS NOT NULL AND poster_path IS NOT NULL"),
	}
	return { movies, shows, analysedMovies, analysedShows, adult: adultM + adultS, analysedAdult: aAdultM + aAdultS, tail, analysedTail, layers }
}
