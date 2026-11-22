import { useMemo } from "react"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { letterboxdScore, letterboxdStars } from "~/utils/letterboxd"
import { brandName, getShorterProviderLabel, ignoredProviders } from "~/utils/streaming-links"

import { type TitleSubject, usePublishFeedbackSubject } from "./subject"

/** The title page's subject from what it renders. */
export function titleSubject(
	media: MovieResult | ShowResult,
	country: string,
	grid: EpisodeGrid | null | undefined,
): TitleSubject {
	const d = media.details
	const offers: TitleSubject["offers"] = []
	for (const a of media.streaming_availabilities) {
		if (ignoredProviders.includes(a.streaming_service_id)) continue
		const s = media.streaming_services.find((x) => x.tmdb_id === a.streaming_service_id)
		if (!s) continue
		const types = a.streaming_type === "flatrate_and_buy" ? ["flatrate", "buy"] : [a.streaming_type]
		for (const type of types)
			if (!offers.some((o) => o.providerId === a.streaming_service_id && o.type === type))
				offers.push({
					providerId: a.streaming_service_id,
					name: brandName(getShorterProviderLabel(s.name)),
					logo: s.logo,
					type,
				})
	}
	const score = (id: string, label: string, value: string | null) =>
		value ? [{ id, label, value }] : []
	const fixed = (n: number | null | undefined, digits = 1) => (n ? n.toFixed(digits) : null)
	const whole = (n: number | null | undefined, unit = "") => (n ? `${Math.floor(n)}${unit}` : null)
	const letterboxdOut = (m: MovieResult | ShowResult) => {
		const lb = letterboxdScore(m)
		return lb && `${letterboxdStars(lb.stars)}/5`
	}
	return {
		kind: "title",
		mediaType: media.mediaType,
		tmdbId: d.tmdb_id,
		title: d.title,
		country,
		date:
			(media.mediaType === "movie" ? media.details.release_date : media.details.first_air_date) ||
			null,
		seasons: media.mediaType === "show" ? media.details.number_of_seasons : null,
		episodes: media.mediaType === "show" ? media.details.number_of_episodes : null,
		offers,
		cast: media.cast.map((c) => ({
			id: c.id,
			name: c.name,
			character: c.characters.join(" / "),
			profilePath: c.profile_path || null,
		})),
		castTotal: media.cast_total,
		scores: [
			...score("goodwatch", "GoodWatch score", whole(d.goodwatch_overall_score_normalized_percent)),
			...score("imdb", "IMDb", fixed(d.imdb_user_score_original)),
			...score("letterboxd", "Letterboxd", letterboxdOut(media)),
			...score("metacritic", "Metacritic critics", whole(d.metacritic_meta_score_original)),
			...score("metacritic-user", "Metacritic audience", fixed(d.metacritic_user_score_original)),
			...score(
				"rotten-tomatoes",
				"Rotten Tomatoes critics",
				whole(d.rotten_tomatoes_tomato_score_original, "%"),
			),
			...score(
				"rotten-tomatoes-audience",
				"Rotten Tomatoes audience",
				whole(d.rotten_tomatoes_audience_score_original, "%"),
			),
		],
		grid: (grid?.seasons ?? []).map((s) => ({
			number: s.number,
			episodes: s.episodes.map((e) => ({
				number: e.number,
				name: e.name,
				canonicalSeason: e.canonicalSeason,
				canonicalNumber: e.canonicalNumber,
				score: e.unrated ? null : e.score,
			})),
		})),
	}
}

/** The title page publishes what it shows. */
export function usePublishTitleSubject(
	media: MovieResult | ShowResult,
	country: string,
	grid: EpisodeGrid | null | undefined,
) {
	const subject = useMemo(() => titleSubject(media, country, grid), [media, country, grid])
	usePublishFeedbackSubject(subject)
}
