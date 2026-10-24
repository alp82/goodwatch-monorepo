// TheTVDB can retain an episode and its IMDb identity after TMDB drops its old TVDB ID.
// Recover the identity, never reinterpret TVDB season/episode numbers as TMDB numbers.
export interface TvdbEpisodeIdentity {
	imdbId: string | null
	name: string | null
	airDate: string | null
}
/** Ignore presentation punctuation and catalog-added episode labels, not story words or order. */
export const normalizeTvtimeEpisodeTitle = (title: string) =>
	title
		.normalize("NFKC")
		.toLowerCase()
		.replace(/^episode\s+\d+\s*[-:]\s*/u, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
const decode = (text: string) =>
	text.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, (value) => {
		const named: Record<string, string> = {
			"&amp;": "&",
			"&quot;": '"',
			"&apos;": "'",
			"&lt;": "<",
			"&gt;": ">",
		}
		if (named[value]) return named[value]
		const code = value.startsWith("&#x")
			? parseInt(value.slice(3), 16)
			: Number(value.slice(2, -1))
		return Number.isInteger(code) && code > 0 && code <= 0x10ffff
			? String.fromCodePoint(code)
			: value
	})
export function readTvdbEpisode(
	html: string,
	episodeId: number,
): TvdbEpisodeIdentity | null {
	if (
		!html.includes(`data-permission="episode-${episodeId}-edit"`) &&
		!new RegExp(
			`rel="canonical"[^>]+href="https://thetvdb\\.com/series/[^"/]+/episodes/${episodeId}"`,
		).test(html)
	)
		return null
	const ids = [
		...new Set(
			[
				...html.matchAll(
					/href="https:\/\/(?:www\.)?imdb\.com\/title\/(tt\d+)\/?"/g,
				),
			].map((m) => m[1]),
		),
	]
	if (ids.length > 1) return null
	const title = html.match(/data-language="eng"\s+data-title="([^"]+)"/)
	const aired = html.match(
		/<strong>Originally Aired<\/strong>\s*<span>\s*<a href="\/on-today\/(\d{4}-\d\d-\d\d)"/,
	)
	return {
		imdbId: ids[0] ?? null,
		name: title ? decode(title[1]).trim() : null,
		airDate: aired?.[1] ?? null,
	}
}
export async function recoverTvtimeEpisode(
	episodeId: number,
	showId: number | null,
	get: (path: string, params?: Record<string, string>) => Promise<unknown>,
): Promise<{ id: number; show_id: number } | null> {
	const identity = (await get(
		`/tvdb/episode/${episodeId}`,
	)) as TvdbEpisodeIdentity | null
	if (!identity?.imdbId) return null
	const found = (await get(`/find/${identity.imdbId}`, {
		external_source: "imdb_id",
	})) as { tv_episode_results?: { id: number; show_id: number }[] }
	const hits = found.tv_episode_results ?? []
	return hits.length === 1 && (showId === null || hits[0].show_id === showId)
		? hits[0]
		: null
}
