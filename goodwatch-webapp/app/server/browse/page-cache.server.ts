// Whole Browse pages whose data depends only on the catalog (no list state): the hub, the tropes index, a trope page,
// and a place page at its plain address. Two layers:
//
// - In this process, one build per page and data version, shared by concurrent requests (a failed or incomplete build
//   is not kept, so the next request tries again).
// - Across the fleet, the shared Redis cache, keyed by the title snapshot version and the UTC day (trope members and
//   availability refresh daily), so a fresh process reads one key instead of rebuilding the page. A build that missed
//   an optional part (trope members or availability not loaded yet) is stored as already stale: the next request
//   serves it and rebuilds it in the background.
//
// Only pages with a bounded set of addresses go to Redis (hub, tropes, single places); blends stay in-process.
//
// What a title card shows depends on the viewer in two ways. Offers and language depend on the viewer's country,
// services and language: those are part of the key. A member's own marks (seen, Wishlist, Not interested) are not:
// the cached page carries none, and each request puts the viewer's marks on a copy.
import type { ViewerContext } from "~/server/viewer.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { type CachedParams, cached } from "~/utils/cache"
import { markedFor, unmarked } from "./page-marks"
import type { Places } from "./places.server"

export const browsePageDay = () => Math.floor(Date.now() / 86_400_000)
export const pageCacheMinutes = { ttlMinutes: 26 * 60, staleMinutes: 60 }
/** In-process builds kept at once (the least recently used go first). */
const LIMIT = 240

const builds = new Map<string, Promise<unknown>>()

const typedCached = cached as unknown as <R>(options: CachedParams<object, R>) => Promise<R>

export interface PageCacheOptions<T> {
	/** The cache family ("hub", "tropes-index", "trope", "place"). */
	name: string
	/** What tells two pages of the family apart (kind, path). */
	key: string
	build: () => Promise<T>
	/** False when an optional part missed (members or availability not loaded): served, then rebuilt. */
	complete: (value: T) => boolean
	/** Also share the build across the fleet (bounded address sets only). */
	shared: boolean
}

/** What a page depends on besides the address and the catalog: language, country and services. */
type PageLocale = Pick<ViewerContext, "language" | "country" | "services">
const viewerKey = ({ language, country, services }: PageLocale) =>
	`${language ?? ""}|${country}|${[...services].sort((a, b) => a - b).join(".")}`

export function browseCacheEntry(
	name: string,
	key: string,
	ctx: PageLocale,
	snapshot: string,
	day: number,
) {
	return {
		// Earlier pages can contain the previous mood names and membership.
		name: `browse-page-${name}-v3`,
		params: { snapshot, day, key: `${key}|${viewerKey(ctx)}` },
	}
}

/**
 * The page's data, built at most once per data version in this process and, when `shared`, once across the fleet,
 * with the viewer's own marks on its title cards. Before the snapshot loads, the page is built every time.
 */
export async function cachedPage<T>(
	atlas: Places,
	{ name, key, build, complete, shared }: PageCacheOptions<T>,
): Promise<T> {
	const snapshot = getTitleSnapshot()?.version
	if (!snapshot) return build()
	const ctx = atlas.ctx
	const day = browsePageDay()
	const entry = browseCacheEntry(name, key, ctx, snapshot, day)
	const id = `${name}|${snapshot}|${day}|${entry.params.key}`
	let run = builds.get(id) as Promise<T> | undefined
	if (run) {
		builds.delete(id)
		builds.set(id, run)
	} else {
		const neutral = async () => unmarked(await build())
		run = shared
			? typedCached<T>({
					...entry,
					...pageCacheMinutes,
					freshMinutes: (value) => (complete(value) ? undefined : 0),
					target: neutral,
				})
			: neutral()
		builds.set(id, run)
		if (builds.size > LIMIT) builds.delete(builds.keys().next().value as string)
		run.then(
			(value) => {
				if (!complete(value)) builds.delete(id)
			},
			() => builds.delete(id),
		)
	}
	const value = await run
	// A guest has no marks: the neutral page is theirs as it is (Remix serializes it, nothing mutates it).
	return ctx.viewer.kind === "guest" ? value : markedFor(value, ctx)
}
