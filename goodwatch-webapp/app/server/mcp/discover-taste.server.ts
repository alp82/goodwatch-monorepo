import type { Taste } from "../taste/index.server"
import { getTitleSnapshot } from "../title-snapshot/index.server"
import type { ViewerContext } from "../viewer.server"

/** The same stable group resolution as the website, computed from saved taste, never temporary steering picks. */
export async function discoverGroupSelection(
	ctx: ViewerContext,
	taste: Taste | null,
	picks: readonly string[] = [],
) {
	const snapshot = getTitleSnapshot()
	if (ctx.viewer.kind !== "member" || !snapshot || !taste)
		return { tasteGroups: null, tasteFilter: null }
	const [{ resolveTasteGroups }, { tasteGroupsFor }] = await Promise.all([
		import("../discover-results.server"),
		import("../watch-next-taste-picker.server"),
	])
	return resolveTasteGroups(await tasteGroupsFor(ctx, taste, snapshot), picks)
}
