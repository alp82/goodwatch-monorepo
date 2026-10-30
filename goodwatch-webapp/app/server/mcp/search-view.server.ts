import { titleKey } from "../../utils/title-key"
import { loadTaste } from "../taste/index.server"
import { filterTitles } from "../title-filter/index.server"
import { getMemberViewerContext } from "../viewer.server"
import type { CatalogTitle } from "./data.server.ts"
import {
	discoverView,
	discoverViewKey,
	filterArgs,
	hasDiscoverFilters,
} from "./discover-filters.ts"
import { searchView } from "./search-view.ts"
import { discoverGroupSelection } from "./discover-taste.server.ts"
import type { ReadArgs } from "./tools.server.ts"

export async function prepareSearchView(
	titles: CatalogTitle[],
	userId: string,
	args: ReadArgs,
	ranked = true,
) {
	if (hasDiscoverFilters(args)) {
		const [ctx, taste] = await Promise.all([
			getMemberViewerContext(userId, "US"),
			loadTaste({ kind: "member", userId }),
		])
		const view = discoverView(args, ranked)
		const selection = args.taste_groups?.length
			? await discoverGroupSelection(ctx, taste, args.taste_groups)
			: null
		const result = await filterTitles({
			tasteGroups: selection?.tasteFilter,
			universe: titles.map((t) => titleKey(t.media_type, t.tmdb_id)),
			includeNotInterested: true,
			state: view.state,
			sort: !ranked && !args.order ? "relevance" : view.sort,
			forYou: ranked && view.forYou ? "search" : null,
			viewer: ctx,
			taste,
		})
		const byKey = new Map(
			titles.map((t) => [titleKey(t.media_type, t.tmdb_id), t]),
		)
		return {
			titles: result.keys.flatMap((key) => byKey.get(key) ?? []),
			view: {
				for_you: view.forYou,
				exclude_seen: view.state.notSeenYet,
				for_you_applied: !!result.moved,
				...(view.state.streamingCountry
					? { country: view.state.streamingCountry }
					: {}),
				availability: view.state.anyService
					? ("any" as const)
					: view.state.onMyServices
						? ("mine" as const)
						: view.state.services?.length
							? ("providers" as const)
							: ("everywhere" as const),
				filters: filterArgs(args),
				filter_key: discoverViewKey(args),
			},
		}
	}
	const [ctx, taste] = await Promise.all([
		args.exclude_seen ? getMemberViewerContext(userId, "US") : null,
		args.for_you !== false ? loadTaste({ kind: "member", userId }) : null,
	])
	return searchView(
		titles,
		args,
		ctx ? [...ctx.seen, ...ctx.skipped] : [],
		taste?.signal === "some" ? (keys) => taste.percentile(keys) : undefined,
	)
}
