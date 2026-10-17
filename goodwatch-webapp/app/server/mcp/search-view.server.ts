import { loadTaste } from "../taste/index.server"
import { getMemberViewerContext } from "../viewer.server"
import type { CatalogTitle } from "./data.server.ts"
import { searchView } from "./search-view.ts"
import type { ReadArgs } from "./tools.server.ts"

export async function prepareSearchView(
	titles: CatalogTitle[],
	userId: string,
	args: ReadArgs,
) {
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
