import { derive, showAiredBy, utcDay } from "../../domain/tracking/machine"
import { recordFromRows } from "../../domain/tracking/storage"
import {
	type MediaKey,
	type UserData,
	parseMediaKey,
} from "../../types/user-data"
import { evaluateAvailability } from "../../utils/availability-evidence"
import { titlePath } from "../../utils/helpers"
import { canonicalTitleId } from "../../utils/title-identity"
import { titleKey } from "../../utils/title-key"
import { getAvailabilityEvidence } from "../availability.server"
import { searchQuery } from "../combined-search/catalog.server"
import { getDetailsForMovie, getDetailsForShow } from "../details.server"
import { getMyShows } from "../my-shows.server"
import { getShowTrackingPage } from "../show-tracking.server"
import { loadTaste } from "../taste/index.server"
import { getDisplayFields } from "../title-cards.server"
import { getTitleSnapshot } from "../title-snapshot/index.server"
import { getTonightsPick } from "../tonight.server"
import { getUserData } from "../userData.server"
import { getMemberViewerContext } from "../viewer.server"
import type { ReadArgs, ReadToolName } from "./tools.server.ts"

interface CatalogTitle {
	media_type: "movie" | "show"
	tmdb_id: number
	title: string
	release_year: number | null
}
const summary = (title: CatalogTitle, origin: string) => ({
	id: `${title.media_type}:${title.tmdb_id}`,
	name: title.title,
	year: title.release_year,
	url: new URL(titlePath(title.media_type, title.tmdb_id, title.title), origin)
		.href,
})
const offsetOf = (args: ReadArgs) => Number(args.cursor?.slice(7) ?? 0)
const page = <T>(items: T[], args: ReadArgs) => {
	const offset = offsetOf(args)
	const limit = args.limit ?? 20
	return {
		items: items.slice(offset, offset + limit),
		total: items.length,
		next_cursor:
			offset + limit < items.length ? `offset:${offset + limit}` : null,
	}
}

const iso = (value: Date | string | null | undefined) =>
	value == null ? null : new Date(value).toISOString()
function marks(user: UserData, key: MediaKey) {
	const state = user.watchState[key]
	const watchedAt = iso(state?.watchedAt)
	return {
		score: user.scores[key]?.score ?? null,
		want_to_see: key in user.wishlist,
		not_interested: key in user.notInterested,
		status: state?.state ?? (key.startsWith("show-") ? "not_started" : null),
		pass: state?.pass ?? null,
		watch_count: state?.count ?? 0,
		episodes_watched: state?.episodesWatched ?? null,
		latest_recorded_watch_date: watchedAt,
		watch_date_note: watchedAt
			? "Latest recorded watch date"
			: state?.count
				? "No date recorded"
				: "No watches recorded",
	}
}

async function library(user: UserData, origin: string, args: ReadArgs) {
	const keys = [
		...new Set([
			...Object.keys(user.scores),
			...Object.keys(user.wishlist),
			...Object.keys(user.watchState),
			...Object.keys(user.notInterested),
		]),
	] as MediaKey[]
	const filtered = keys
		.filter((key) => {
			switch (args.filter) {
				case "want_to_see":
					return key in user.wishlist
				case "seen":
					return user.watchState[key]?.state === "seen" || key in user.scores
				case "not_interested":
					return key in user.notInterested
				case "rated":
					return key in user.scores
				case "unrated":
					return user.watchState[key]?.state === "seen" && !(key in user.scores)
				case "watching":
				case "on_hold":
				case "dropped":
					return user.watchState[key]?.state === args.filter
				default:
					return true
			}
		})
		.sort()
	const slice = page(filtered, args)
	const displays = await getDisplayFields(
		slice.items.map((key) => {
			const parsed = parseMediaKey(key)
			return titleKey(parsed.mediaType, parsed.tmdbId)
		}),
	)
	return {
		...slice,
		items: slice.items.flatMap((key) => {
			const { mediaType, tmdbId } = parseMediaKey(key)
			const title = displays.get(titleKey(mediaType, tmdbId))
			return title ? [{ ...summary(title, origin), ...marks(user, key) }] : []
		}),
	}
}

async function lookup(
	query: string,
	offset: number,
	limit: number,
	year?: number,
): Promise<CatalogTitle[]> {
	const text = query.trim()
	const where = [
		"(adult IS NULL OR adult = false)",
		...(text
			? [
					"MATCH((title,original_title), ?) USING best_fields WITH (operator = 'and')",
				]
			: []),
		...(year ? ["release_year = ?"] : []),
	].join(" AND ")
	const params = [...(text ? [text] : []), ...(year ? [year] : [])]
	return searchQuery<CatalogTitle>(
		`SELECT * FROM (
		SELECT 'movie' AS media_type, tmdb_id, title, release_year FROM movie WHERE ${where}
		UNION ALL SELECT 'show' AS media_type, tmdb_id, title, release_year FROM show WHERE ${where}
	) AS titles ORDER BY title, media_type, tmdb_id LIMIT ? OFFSET ?`,
		[...params, ...params, limit, offset],
	)
}

async function resolve(
	args: ReadArgs,
	origin: string,
): Promise<{ title: CatalogTitle } | { result: Record<string, unknown> }> {
	let titles: CatalogTitle[]
	if (args.title_id) {
		const [type, rawId] = args.title_id.split(":")
		const mediaType = type === "show" ? "show" : "movie"
		const id = canonicalTitleId(mediaType, Number(rawId))
		const display = (await getDisplayFields([titleKey(mediaType, id)])).get(
			titleKey(mediaType, id),
		)
		titles = display ? [display] : []
	} else {
		titles = await lookup(args.title_name ?? "", 0, 21, args.year)
		const normalized = (value: string) =>
			value.normalize("NFC").trim().toLocaleLowerCase()
		const exact = titles.filter(
			(title) => normalized(title.title) === normalized(args.title_name ?? ""),
		)
		if (exact.length) titles = exact
	}
	if (!titles.length)
		return {
			result: {
				status: "title_not_found",
				message: "No matching catalog title",
			},
		}
	if (titles.length !== 1)
		return {
			result: {
				status: "ambiguous_title",
				message: "Choose a title_id from these catalog matches",
				choices: titles.slice(0, 20).map((title) => summary(title, origin)),
				more: titles.length > 20,
			},
		}
	return { title: titles[0] }
}

export async function readMemberTool(
	userId: string,
	origin: string,
	name: ReadToolName,
	args: ReadArgs,
): Promise<Record<string, unknown>> {
	if (name === "search_titles") {
		const offset = offsetOf(args)
		const limit = args.limit ?? 20
		const found = await lookup(args.query ?? "", offset, limit + 1)
		return {
			items: found.slice(0, limit).map((title) => summary(title, origin)),
			next_cursor: found.length > limit ? `offset:${offset + limit}` : null,
			ranked: false,
		}
	}
	if (name === "get_library")
		return library(await getUserData({ user_id: userId }), origin, args)
	if (name === "get_taste") {
		const [taste, user] = await Promise.all([
			loadTaste({ kind: "member", userId }),
			getUserData({ user_id: userId }),
		])
		return {
			signal: taste.signal,
			rated_titles: Object.keys(user.scores).length,
			wishlist_titles: Object.keys(user.wishlist).length,
			liked_titles_with_fingerprint: taste.liked,
			leanings: taste.leanings(10),
			message: !getTitleSnapshot()
				? "The catalog taste model is not loaded; no taste attributes are inferred."
				: taste.signal === "none"
					? "At least five liked titles with fingerprints are needed to infer taste."
					: "Strongest attributes from your ratings and Want to See.",
		}
	}
	if (name === "get_tonight") {
		const ctx = await getMemberViewerContext(userId, "US")
		const pick = await getTonightsPick(ctx)
		return {
			pick: pick
				? {
						title: summary(pick.title, origin),
						reason: pick.reason,
						episode: pick.episode ?? null,
						match: pick.title.match,
					}
				: null,
			country: ctx.country,
			service_ids: ctx.services,
		}
	}
	if (name === "get_my_shows") {
		const ctx = await getMemberViewerContext(userId, "US")
		const taste = await loadTaste(ctx.viewer)
		const shows = await getMyShows(
			{ userId, country: ctx.country, services: ctx.services, taste },
			{ episodeLists: offsetOf(args) + (args.limit ?? 20) },
		)
		const rows = (
			["continue", "pickUp", "waiting", "start", "onHold", "dropped"] as const
		).flatMap((group) =>
			shows[group].map((row) => ({
				...summary(
					{
						media_type: "show",
						tmdb_id: row.id,
						title: row.title,
						release_year: null,
					},
					origin,
				),
				group:
					group === "pickUp"
						? "pick_up"
						: group === "onHold"
							? "on_hold"
							: group,
				...("state" in row
					? {
							status: row.state,
							episodes_watched: row.watched,
							aired_episodes: row.aired,
							next_episode: row.next,
							upcoming_episode: row.upcoming,
						}
					: { status: "not_started", want_to_see: true }),
			})),
		)
		return page(rows, args)
	}
	if (name === "get_show_progress") {
		const resolved = await resolve(args, origin)
		if ("result" in resolved) return resolved.result
		const title = resolved.title
		if (title.media_type !== "show")
			return {
				status: "invalid_title_kind",
				message: "Show progress requires a show",
			}
		const [tracking, user] = await Promise.all([
			getShowTrackingPage(userId, title.tmdb_id),
			getUserData({ user_id: userId }),
		])
		const key: MediaKey = `show-${title.tmdb_id}`
		const record = recordFromRows(tracking.state, tracking.log, {
			score: user.scores[key]?.score ?? null,
			wantToSee: key in user.wishlist,
			notInterested: key in user.notInterested,
		})
		const derived = derive({
			show: showAiredBy(
				tracking.episodes,
				utcDay(Date.now()),
				tracking.running,
			),
			record,
		})
		const next = derived.next
			? tracking.episodes.find((episode) => episode.id === derived.next?.id)
			: null
		return {
			title: summary(title, origin),
			status: derived.state,
			label: derived.label,
			pass: derived.pass,
			episodes_watched: derived.watched,
			aired_episodes: derived.aired,
			next_episode: next
				? {
						season: next.season,
						number: next.number,
						name: next.name,
						air_date: next.airDate,
						...(next.displaySeason === undefined
							? {}
							: {
									display_season: next.displaySeason,
									display_number: next.displayNumber,
								}),
					}
				: null,
			watches: page(
				[...tracking.log]
					.sort(
						(a, b) =>
							(b.watched_at ?? -1) - (a.watched_at ?? -1) ||
							b.created_at - a.created_at ||
							a.watch_id.localeCompare(b.watch_id),
					)
					.map((watch) => ({
						id: watch.watch_id,
						season: watch.season_number,
						episode: watch.episode_number,
						pass: watch.pass,
						date:
							watch.watched_at === null
								? null
								: new Date(watch.watched_at).toISOString().slice(0, 10),
						date_precision: watch.watched_at_precision,
						date_note:
							watch.watched_at === null
								? "No date recorded"
								: "Recorded watch date",
						origin: watch.origin,
					})),
				args,
			),
		}
	}
	if (name === "get_title") {
		const resolved = await resolve(args, origin)
		if ("result" in resolved) return resolved.result
		const title = resolved.title
		const [ctx, user] = await Promise.all([
			getMemberViewerContext(userId, "US"),
			getUserData({ user_id: userId }),
		])
		const scope = {
			mediaType: title.media_type,
			tmdbId: title.tmdb_id,
			country: ctx.country,
		}
		try {
			const [details, evidence] = await Promise.all([
				title.media_type === "movie"
					? getDetailsForMovie({
							movieId: String(title.tmdb_id),
							country: ctx.country,
							language: "en_US",
						})
					: getDetailsForShow({
							showId: String(title.tmdb_id),
							country: ctx.country,
							language: "en_US",
						}),
				getAvailabilityEvidence(scope),
			])
			return {
				title: {
					...summary(title, origin),
					synopsis: details.details.synopsis ?? null,
					genres: details.details.genres,
					availability: {
						country: ctx.country,
						...evaluateAvailability(evidence, {
							...scope,
							serviceIds: ctx.services,
						}),
					},
				},
				member: marks(user, `${title.media_type}-${title.tmdb_id}`),
			}
		} catch (error) {
			if (error instanceof Response && error.status === 404)
				return {
					status: "title_not_found",
					message: "No matching catalog title",
				}
			throw error
		}
	}
	throw new Error("Unknown read tool")
}
