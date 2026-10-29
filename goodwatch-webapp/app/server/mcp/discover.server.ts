import { captureProductEvent } from "~/telemetry/product-analytics.server"
import {
	getStreamingProviders,
	slimStreamingProviders,
} from "../streaming-providers.server"
import { loadTaste } from "../taste/index.server"
import { getDisplayFields } from "../title-cards.server"
import { filterTitles } from "../title-filter/index.server"
import { getTitleSnapshot } from "../title-snapshot/index.server"
import { type ViewerContext, getMemberViewerContext } from "../viewer.server"
import { summary } from "./data.server.ts"
import { discoverView, filterArgs } from "./discover-filters.ts"
import { discoverMetadata } from "./discover-metadata.ts"
import type { ReadArgs } from "./tools.server.ts"

export async function readDiscover(
	userId: string,
	origin: string,
	name: "discover_titles" | "get_discover_filters",
	args: ReadArgs,
	guest?: ViewerContext,
) {
	const ctx = guest ?? (await getMemberViewerContext(userId, "US"))
	if (name === "get_discover_filters") {
		const snapshot = getTitleSnapshot()
		if (!snapshot)
			return {
				status: "data_unavailable",
				message: "Discover is starting up; try again shortly.",
			}
		const providers = slimStreamingProviders(
			await getStreamingProviders({ country: ctx.country }),
			ctx.country,
			ctx.services,
		)
		return {
			...discoverMetadata(!!snapshot.columns.facts),
			country: ctx.country,
			saved_provider_ids: ctx.services,
			genres: [...snapshot.columns.genreNames].sort(),
			providers: providers.map(({ id, name }) => ({ id, name })),
		}
	}
	const taste = await loadTaste(ctx.viewer)
	const view = discoverView(args, false)
	const result = await filterTitles({
		universe: "catalog",
		state: view.state,
		sort: view.sort,
		forYou: view.forYou ? "browse" : null,
		viewer: ctx,
		taste,
	})
	const offset = Number(args.cursor?.slice(7) ?? 0)
	const limit = args.limit ?? 40
	const keys = result.keys.slice(offset, offset + limit)
	const displays = await getDisplayFields(keys)
	if (!guest)
		captureProductEvent(userId, "discovery results shown", {
			source: "mcp",
			result_count: keys.length,
			country: ctx.country,
			for_you: view.forYou,
			sort: result.sortUsed,
			on_my_services: view.state.onMyServices,
			moods: view.state.moods,
		})
	return {
		items: keys.flatMap((key) => {
			const title = displays.get(key)
			return title
				? [
						{
							...summary(title, origin),
							goodwatch_score: getTitleSnapshot()?.facts(key)?.score ?? null,
							// Guest reads serve the Discord list card, which shows posters and runtimes.
							...(guest
								? {
										poster_url: title.poster_path
											? `https://image.tmdb.org/t/p/w342${title.poster_path}`
											: null,
										runtime_minutes: title.runtime ?? null,
									}
								: {}),
						},
					]
				: []
		}),
		total: result.total,
		returned: keys.length,
		next_cursor:
			offset + limit < result.total ? `offset:${offset + limit}` : null,
		country: ctx.country,
		availability: view.state.anyService
			? "any"
			: view.state.onMyServices
				? "mine"
				: view.state.services?.length
					? "providers"
					: "everywhere",
		exclude_seen: view.state.notSeenYet,
		for_you: view.forYou,
		for_you_applied: !!result.moved,
		order: args.order ?? "for_you",
		sort_used: result.sortUsed,
		filters: filterArgs(args),
		approximate_availability: result.approximate,
		facts_available: result.facts !== false,
	}
}
