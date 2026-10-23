// The routes whose loader data the browser keeps (loader-cache.ts). Only catalog pages: the same for every visitor
// in a country and language, apart from small member parts that the identity in the cache key covers. Pages that
// show a member's own data (library, taste, settings, lists, profiles) are not here: they change with every write.
// Pure redirect routes (tv.$showKey, tv-shows.*, explore.*) aren't here either: they have nothing to keep.
// Each route listed exports `clientLoader = cachedClientLoader("<its id>")`; cached-routes.test.ts checks that.

export const CACHED_ROUTE_IDS = [
	"routes/movie.$movieKey",
	"routes/show.$showKey",
	"routes/person.$personKey",
	"routes/$type._index",
	"routes/$type.best",
	"routes/$type.$category._index",
	"routes/$type.$category.$page",
	"routes/discover.($type)",
	"routes/people",
	"routes/hot-on-socials",
	"routes/blog._index",
	"routes/blog.$slug",
] as const

export type CachedRouteId = (typeof CACHED_ROUTE_IDS)[number]

const cached = new Set<string>(CACHED_ROUTE_IDS)

export function isCachedRoute(routeId: string): routeId is CachedRouteId {
	return cached.has(routeId)
}

/** Title pages: a press or hover prefetch of one also starts its hero picture. */
export const TITLE_ROUTE_IDS: readonly string[] = [
	"routes/movie.$movieKey",
	"routes/show.$showKey",
]

/** The main page types, whose code loads when the browser is idle after the first page. */
export const WARM_ROUTE_IDS: readonly CachedRouteId[] = [
	"routes/movie.$movieKey",
	"routes/show.$showKey",
	"routes/person.$personKey",
	"routes/$type._index",
	"routes/$type.best",
	"routes/$type.$category._index",
	"routes/discover.($type)",
]

/** Links the phone prefetch looks at when a list stops scrolling: titles and people. */
export const VIEWPORT_LINK_SELECTOR =
	'a[href^="/movie/"], a[href^="/show/"], a[href^="/person/"]'
