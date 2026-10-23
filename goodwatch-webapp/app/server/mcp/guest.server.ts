import { getDetailsForMovie, getDetailsForShow } from "../details.server"
import { guestContext, type ViewerContext } from "../viewer.server"
import { getDisplayFields } from "../title-cards.server"
import { titleKey } from "../../utils/title-key"
import { lookup, resolve, summary } from "./data.server.ts"
import { watchAvailability } from "./watch-links.server.ts"
import type { ReadArgs } from "./tools.server.ts"

export type GuestToolName =
	| "search_titles"
	| "get_title"
	| "get_similar_titles"
	| "discover_titles"
	| "get_discover_filters"
	| "search_people"
	| "get_person"

export async function readGuestTool(
	viewer: Pick<ViewerContext, "country"> &
		Partial<Pick<ViewerContext, "services">>,
	origin: string,
	name: GuestToolName,
	args: ReadArgs,
): Promise<Record<string, unknown>> {
	const ctx = guestContext(
		{
			interactions: [],
			country: viewer.country,
			services: viewer.services ?? [],
		},
		viewer.country,
	)
	if (name === "get_similar_titles")
		return (await import("./similar-titles.server.ts")).similarTitles(
			"",
			origin,
			{ ...args, for_you: false },
			ctx,
		)
	if (name === "discover_titles" || name === "get_discover_filters")
		return (await import("./discover.server.ts")).readDiscover(
			"",
			origin,
			name,
			{ ...args, for_you: false },
			ctx,
		)
	if (name === "search_people" || name === "get_person") {
		if (name === "search_people" && !args.query?.trim())
			throw new Error("search_people requires a nonblank query")
		if (
			name === "get_person" &&
			(!Number.isSafeInteger(args.person_id) || Number(args.person_id) <= 0)
		)
			throw new Error("get_person requires person_id")
		return (await import("./people.server.ts")).readPeople(
			"",
			origin,
			name === "search_people" ? { ...args, person_id: undefined } : args,
			ctx,
		)
	}
	if (name === "search_titles") {
		const query = args.query?.trim()
		if (!query) throw new Error("search_titles requires a nonblank query")
		const limit = Math.min(25, Math.max(1, args.limit ?? 25))
		const titles = await lookup(query, 0, limit)
		return {
			items: titles.map((title) => summary(title, origin)),
			ranked: false,
		}
	}
	if (name !== "get_title") throw new Error("Unsupported guest tool")
	const resolved = await resolve(args, origin)
	if ("result" in resolved) return resolved.result
	const title = resolved.title
	try {
		const [media, displays, availability] = await Promise.all([
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
			getDisplayFields([titleKey(title.media_type, title.tmdb_id)]),
			watchAvailability(title, ctx, undefined, { allServices: ctx.services.length === 0 }),
		])
		const display = displays.get(titleKey(title.media_type, title.tmdb_id))
		return {
			title: {
				...summary(title, origin),
				synopsis: media.details.synopsis ?? null,
				genres: media.details.genres,
				runtime_minutes: display?.runtime ?? null,
				poster_url: display?.poster_path
					? `https://image.tmdb.org/t/p/w342${display.poster_path}`
					: null,
				backdrop_url: display?.backdrop_path
					? `https://image.tmdb.org/t/p/w780${display.backdrop_path}`
					: null,
				goodwatch_score:
					display?.goodwatch_overall_score_normalized_percent ?? null,
				availability,
			},
		}
	} catch (error) {
		if (error instanceof Response && error.status === 404)
			return { status: "title_not_found" }
		throw error
	}
}
