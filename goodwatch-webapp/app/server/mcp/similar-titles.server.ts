import { relatedMapNeighbors } from "../related-map.server"
import { loadTaste } from "../taste/index.server"
import { getMemberViewerContext } from "../viewer.server"
import { resolve, summary } from "./data.server.ts"
import { similarTitleView } from "./similar-titles.ts"
import type { ReadArgs } from "./tools.server.ts"

export async function similarTitles(
	userId: string,
	origin: string,
	args: ReadArgs,
) {
	const resolved = await resolve(args, origin)
	if ("result" in resolved) return resolved.result
	const source = resolved.title
	const [pack, ctx, taste] = await Promise.all([
		relatedMapNeighbors(source.media_type, source.tmdb_id),
		getMemberViewerContext(userId, "US"),
		args.for_you !== false
			? loadTaste({ kind: "member", userId }).catch(() => null)
			: null,
	])
	const view = similarTitleView(
		pack?.n ?? [],
		source,
		args,
		ctx.hidden,
		[...ctx.seen, ...ctx.skipped],
		taste?.signal === "some" ? (keys) => taste.percentile(keys) : undefined,
	)
	return {
		...view,
		source: summary(source, origin),
		items: view.items.map((title) => ({
			...summary(title, origin),
			similarity: title.similarity,
		})),
		similarity_note:
			"Fingerprint similarity to the source title (0–1), separate from your GoodWatch taste match.",
		candidate_limit: 80,
		...(!pack
			? {
					message:
						"No title analysis fingerprint neighbors are available for this title.",
				}
			: {}),
	}
}
