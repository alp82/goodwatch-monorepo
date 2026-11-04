// "Also in": other titles that carry a trope, for its poster row. SELECT only.
// The title↔trope links are the per-title `trope` rows (media_type, media_tmdb_id, url), the same rows the page's
// "N titles have it" counts. Per media type one statement picks the trope's titles with a poster from the movie or
// show table, most voted first; then the well-scored ones lead (score 70+), so a common trope shows its classics and
// a rare one shows whatever has it. The title itself is skipped.
import { query } from "~/utils/crate"

export interface AlsoInTitle {
	type: "movie" | "show"
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	goodwatch_overall_score_normalized_percent: number | null
	votes: number
}
export interface AlsoIn {
	url: string
	titles: AlsoInTitle[]
}

const PER_TYPE = 24

async function ofType(type: "movie" | "show", url: string) {
	return query<Omit<AlsoInTitle, "type">>(
		`SELECT tmdb_id, title, release_year, poster_path, goodwatch_overall_score_normalized_percent,
		        coalesce(goodwatch_overall_score_voting_count, 0) AS votes
		   FROM ${type}
		  WHERE tmdb_id IN (SELECT media_tmdb_id FROM trope WHERE url = ? AND media_type = ? LIMIT 20000)
		    AND poster_path IS NOT NULL
		  ORDER BY votes DESC
		  LIMIT ${PER_TYPE}`,
		[url, type],
		{ timeoutMs: 3000 },
	)
}

export async function loadAlsoIn(
	url: string,
	skip: { type: "movie" | "show"; id: number } | null,
	n = 8,
): Promise<AlsoIn> {
	const [movies, shows] = await Promise.all([
		ofType("movie", url).catch(() => []),
		ofType("show", url).catch(() => []),
	])
	const all: AlsoInTitle[] = [
		...movies.map((t) => ({
			...t,
			type: "movie" as const,
			votes: Number(t.votes),
		})),
		...shows.map((t) => ({
			...t,
			type: "show" as const,
			votes: Number(t.votes),
		})),
	].filter((t) => !(skip && t.type === skip.type && t.tmdb_id === skip.id))
	// Popular and well scored first: votes weighed up for a high score, so a much-voted mediocre title steps back.
	const weight = (t: AlsoInTitle) => {
		const score = t.goodwatch_overall_score_normalized_percent ?? 50
		return (
			Math.log10(10 + t.votes) * (score >= 70 ? 1.6 : score >= 60 ? 1.15 : 0.7)
		)
	}
	all.sort((a, b) => weight(b) - weight(a))
	// Titles scored under 55 only fill a row that has too few others.
	const good = all.filter(
		(t) => (t.goodwatch_overall_score_normalized_percent ?? 50) >= 55,
	)
	const picked = good.length >= Math.min(n, 4) ? good : all
	return { url, titles: picked.slice(0, n) }
}
