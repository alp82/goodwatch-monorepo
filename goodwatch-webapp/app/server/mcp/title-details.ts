import type { EpisodeGrid } from "../episode-grid.server.ts"
import type { MovieResult, ShowResult } from "../types/details-types.tsx"
import { personPath } from "../../utils/helpers.ts"
import type { ReadArgs } from "./tools.server.ts"

export const DEFAULT_TITLE_INCLUDE = ["cast", "scores", "analysis"] as const
const present = (value: number | null | undefined) =>
	typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: null

export function personLink(
	person: { id: number; name: string },
	origin: string,
) {
	const url = new URL(personPath(person.id, person.name), origin).href
	return {
		id: person.id,
		name: person.name,
		url,
		link: `[${person.name.replace(/[\\[\]]/g, "\\$&")}](${url})`,
	}
}

/** Scores retain their provider's own scale, including absent values. */
export function titleScores(
	details: MovieResult["details"] | ShowResult["details"],
) {
	const score = (value: number | undefined, out_of: number, url?: string) => ({
		score: present(value),
		out_of,
		url: url || null,
	})
	return {
		goodwatch: score(details.goodwatch_overall_score_normalized_percent, 100),
		imdb: score(details.imdb_user_score_original, 10, details.imdb_url),
		metacritic_critics: score(
			details.metacritic_meta_score_original,
			100,
			details.metacritic_url,
		),
		metacritic_audience: score(
			details.metacritic_user_score_original,
			10,
			details.metacritic_url,
		),
		rotten_tomatoes_critics: score(
			details.rotten_tomatoes_tomato_score_original,
			100,
			details.rotten_tomatoes_url,
		),
		rotten_tomatoes_audience: score(
			details.rotten_tomatoes_audience_score_original,
			100,
			details.rotten_tomatoes_url,
		),
	}
}

/** Use the same rated grid and reviewed presentation as the site, never tracking coordinates as score coordinates. */
export function titleSeasons(
	media: ShowResult,
	grid: EpisodeGrid | null,
	args: ReadArgs,
) {
	const catalogs = new Map(
		media.seasons.map((season) => [season.season_number, season]),
	)
	const rated = new Map(
		grid?.seasons.map((season) => [season.number, season]) ?? [],
	)
	const numbers = grid?.presentationVersion
		? [...rated.keys()]
		: [...new Set([...catalogs.keys(), ...rated.keys()])]
	const seasons = numbers
		.sort((a, b) => Number(a < 0) - Number(b < 0) || a - b)
		.map((number) => {
			const season = rated.get(number)
			const catalog = grid?.presentationVersion
				? undefined
				: catalogs.get(number)
			return {
				season_number: number,
				name:
					catalog?.name ??
					(number < 0
						? "Additional episodes"
						: number === 0
							? "Specials"
							: `Season ${number}`),
				catalog_episode_count: catalog?.episode_count ?? null,
				max_episode_number: season?.maxEpisodeNumber ?? null,
				scores: season?.scores ?? null,
			}
		})
	const episodes = [
		...(grid?.seasons.flatMap((season) =>
			season.episodes.map((episode) => ({
				season_number: season.number,
				episode_number: episode.number,
				name: episode.name,
				episode_tmdb_id: episode.tmdbId ?? null,
				canonical_label: episode.canonicalLabel ?? null,
				imdb: {
					score: episode.unrated ? null : present(episode.score),
					out_of: 10,
					votes: episode.unrated ? null : episode.votes,
				},
			})),
		) ?? []),
		...(grid?.specials.map((episode) => ({
			season_number: null,
			episode_number: null,
			name: episode.name,
			episode_tmdb_id: episode.tmdbId ?? null,
			canonical_label: episode.canonicalLabel ?? null,
			imdb: {
				score: episode.unrated ? null : present(episode.score),
				out_of: 10,
				votes: episode.unrated ? null : episode.votes,
			},
		})) ?? []),
	].filter(
		(episode) =>
			args.season_number === undefined ||
			episode.season_number === args.season_number,
	)
	const offset = Number(args.episode_cursor?.slice(7) ?? 0)
	const limit = args.episode_limit ?? 20
	return {
		season_numbering: grid?.presentationVersion
			? "reviewed_site_presentation"
			: "imdb_ratings_with_tmdb_catalog_seasons",
		season_note: [
			grid?.note,
			"Episode ratings use the website’s displayed numbering, which can differ from tracking. Unrated episodes may be absent. Season scores use provider scales: IMDb/TMDB/Metacritic audience 0–10, other providers 0–100.",
		]
			.filter(Boolean)
			.join(" "),
		...(args.include?.includes("seasons") ? { seasons } : {}),
		...(args.include?.includes("episodes")
			? {
					episodes: {
						items: episodes.slice(offset, offset + limit),
						total: episodes.length,
						next_cursor:
							offset + limit < episodes.length
								? `offset:${offset + limit}`
								: null,
						season_number: args.season_number ?? null,
					},
				}
			: {}),
	}
}

export function compactTitleDetails(
	media: MovieResult | ShowResult,
	origin: string,
	args: ReadArgs,
) {
	const include = args.include ?? DEFAULT_TITLE_INCLUDE
	const trailer = media.videos.trailers?.find((video) =>
		/^[\w-]{11}$/.test(video.key),
	)
	return {
		trailer_url: trailer
			? `https://www.youtube.com/watch?v=${trailer.key}`
			: null,
		...(include.includes("cast")
			? {
					cast: media.credits.actors
						.slice(0, 5)
						.map((person) => personLink(person, origin)),
					directors: media.credits.directors.map((person) =>
						personLink(person, origin),
					),
				}
			: {}),
		...(include.includes("scores")
			? { scores: titleScores(media.details) }
			: {}),
	}
}
