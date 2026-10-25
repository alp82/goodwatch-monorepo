// What the open page is about, for the Feedback tab's fix mode: the title page and the person page publish their own
// data here (the props they render), so the questions offer the page's real services, cast, episodes and credits.
// Other pages publish nothing and get the generic areas (areas.ts). Kept tiny: the pages import it eagerly; the Feedback
// drawer that reads it loads later.
import { useEffect, useMemo, useSyncExternalStore } from "react"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	brandName,
	getShorterProviderLabel,
	ignoredProviders,
} from "~/utils/streaming-links"

/** A title page: the media as shown (country and language picks applied), its offers' country, the episode grid. */
export type TitleSubject = {
	kind: "title"
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
	/** The country the page's offers are for. */
	country: string
	/** Release date (movie) or first air date (show), as the page has it (YYYY-MM-DD). */
	date: string | null
	seasons: number | null
	episodes: number | null
	/** The page's offers for `country`, one per service and offer type. */
	offers: { providerId: number; name: string; logo: string; type: string }[]
	cast: {
		id: number
		name: string
		character: string
		profilePath: string | null
	}[]
	castTotal: number
	scores: { id: string; label: string; value: string }[]
	/** The episode grid's seasons, as far as the page has them. */
	grid: {
		number: number
		episodes: { number: number; name: string; score: number | null }[]
	}[]
}

/** A person page: who it is and the credits the page shows. */
export type PersonSubject = {
	kind: "person"
	tmdbId: number
	name: string
	department: string | null
	firstYear: number | null
	lastYear: number | null
	titleCount: number
	credits: {
		tmdbId: number
		mediaType: "movie" | "tv"
		title: string
		year: string | null
		role: string
	}[]
}

export type FeedbackSubject = TitleSubject | PersonSubject

let current: FeedbackSubject | null = null
const listeners = new Set<() => void>()
const emit = () => {
	for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
	listeners.add(l)
	return () => {
		listeners.delete(l)
	}
}

/** Publishes the page's subject while the page is mounted (client only: effects don't run on the server). */
export function usePublishFeedbackSubject(subject: FeedbackSubject | null) {
	useEffect(() => {
		current = subject
		emit()
		return () => {
			if (current === subject) {
				current = null
				emit()
			}
		}
	}, [subject])
}

/** The subject of the page that is open now, or null. */
export const useFeedbackSubject = () =>
	useSyncExternalStore(
		subscribe,
		() => current,
		() => null,
	)

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
		const s = media.streaming_services.find(
			(x) => x.tmdb_id === a.streaming_service_id,
		)
		if (!s) continue
		const types =
			a.streaming_type === "flatrate_and_buy"
				? ["flatrate", "buy"]
				: [a.streaming_type]
		for (const type of types)
			if (
				!offers.some(
					(o) => o.providerId === a.streaming_service_id && o.type === type,
				)
			)
				offers.push({
					providerId: a.streaming_service_id,
					name: brandName(getShorterProviderLabel(s.name)),
					logo: s.logo,
					type,
				})
	}
	const score = (id: string, label: string, value: string | null) =>
		value ? [{ id, label, value }] : []
	const fixed = (n: number | null | undefined, digits = 1) =>
		n ? n.toFixed(digits) : null
	const whole = (n: number | null | undefined, unit = "") =>
		n ? `${Math.floor(n)}${unit}` : null
	return {
		kind: "title",
		mediaType: media.mediaType,
		tmdbId: d.tmdb_id,
		title: d.title,
		country,
		date:
			(media.mediaType === "movie"
				? media.details.release_date
				: media.details.first_air_date) || null,
		seasons:
			media.mediaType === "show" ? media.details.number_of_seasons : null,
		episodes:
			media.mediaType === "show" ? media.details.number_of_episodes : null,
		offers,
		cast: media.cast.map((c) => ({
			id: c.id,
			name: c.name,
			character: c.characters.join(" / "),
			profilePath: c.profile_path || null,
		})),
		castTotal: media.cast_total,
		scores: [
			...score(
				"goodwatch",
				"GoodWatch score",
				whole(d.goodwatch_overall_score_normalized_percent),
			),
			...score("imdb", "IMDb", fixed(d.imdb_user_score_original)),
			...score(
				"metacritic",
				"Metacritic critics",
				whole(d.metacritic_meta_score_original),
			),
			...score(
				"metacritic-user",
				"Metacritic audience",
				fixed(d.metacritic_user_score_original),
			),
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
	const subject = useMemo(
		() => titleSubject(media, country, grid),
		[media, country, grid],
	)
	usePublishFeedbackSubject(subject)
}
