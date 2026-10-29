// Every address of the member navigation (Watch · Explore · Taste), and where each old address goes now. Pure: the
// redirect routes, the MCP links, the navigation and the tests all read from here, so an address is written once.
//
// Watch holds what you watch next and what you watched (`/watch/*`). Taste is your profile (`/u/:handle/*`), with
// Settings as its last tab (`/settings/*`). A member without a handle has no profile yet: their Taste is `/taste`,
// and every redirect that needs a handle sends them there. Handles are never claimed on someone's behalf.
import type { LibraryKind, LibrarySort, LibraryStatus } from "./my-library.ts"

// ---------------------------------------------------------------------------------------------------------
// Who asks

/** Who is asking for an address. Redirects that depend on it are 302 with `private, no-store`. */
export type PathViewer =
	| { kind: "guest" }
	| {
			kind: "member"
			/** Null until the member picks one in Settings › Edit profile. */
			handle: string | null
	  }

export const GUEST: PathViewer = { kind: "guest" }
export const member = (handle: string | null): PathViewer => ({
	kind: "member",
	handle,
})

/** The viewer's handle, or null for guests and for members without one. */
export const handleOf = (viewer: PathViewer) =>
	viewer.kind === "member" ? viewer.handle : null

const sameHandle = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// ---------------------------------------------------------------------------------------------------------
// Watch

export const WATCH_PATHS = {
	/** Up next › Next episodes: the area's first page. */
	nextEpisodes: "/watch",
	notStarted: "/watch/not-started",
	watching: "/watch/watching",
	onHold: "/watch/on-hold",
	dropped: "/watch/dropped",
	/** Up next › Seen: every show you watched. */
	showsSeen: "/watch/seen",
	/** Ready to watch › Tonight. */
	tonight: "/watch/movies",
	/** Ready to watch › Whole Wishlist: movies and shows. */
	wishlist: "/watch/movies/wishlist",
	/** Ready to watch › Recently added: movies, newest first. */
	recent: "/watch/movies/recent",
	/** Ready to watch › Seen: every movie you watched. */
	moviesSeen: "/watch/movies/seen",
	/** Recommendations › For you. */
	forYou: "/watch/for-you",
} as const

export const WATCH_PATH = WATCH_PATHS.nextEpisodes
export const WATCH_MOVIES_PATH = WATCH_PATHS.tonight
export const FOR_YOU_PATH = WATCH_PATHS.forYou

/** The Seen page of one kind: shows under Up next, movies under Ready to watch. */
export const watchSeenPath = (kind: "movie" | "show") =>
	kind === "show" ? WATCH_PATHS.showsSeen : WATCH_PATHS.moviesSeen

/** What one Watch list page shows: a library status, a fixed kind ("all" keeps the kind control), and its sort. */
export interface WatchList {
	status: LibraryStatus
	kind: LibraryKind
	/** Null: the status's default sort. */
	sort: LibrarySort | null
}

/** The `$list` pages under `/watch` (Up next): shows only. An unknown slug is a 404. */
export const WATCH_SHOW_LISTS: Record<string, WatchList> = {
	"not-started": { status: "want", kind: "show", sort: null },
	watching: { status: "watching", kind: "show", sort: null },
	"on-hold": { status: "on_hold", kind: "show", sort: null },
	dropped: { status: "dropped", kind: "show", sort: null },
	seen: { status: "seen", kind: "show", sort: null },
}

/** The `$list` pages under `/watch/movies` (Ready to watch). An unknown slug is a 404. */
export const WATCH_MOVIE_LISTS: Record<string, WatchList> = {
	wishlist: { status: "want", kind: "all", sort: null },
	recent: { status: "want", kind: "movie", sort: "added" },
	seen: { status: "seen", kind: "movie", sort: null },
}

// ---------------------------------------------------------------------------------------------------------
// Taste

/** The Taste area's pages on a profile. Seen, Wishlist and Shows are tabs only visitors get. */
export type TasteTab =
	| "profile"
	| "tropes"
	| "scores"
	| "not-rated"
	| "rate"
	| "stats"
	| "lists"
	| "seen"
	| "wishlist"
	| "shows"

const TASTE_SUFFIX: Record<TasteTab, string> = {
	profile: "",
	tropes: "/tropes",
	scores: "/scores",
	"not-rated": "/scores/not-rated",
	rate: "/scores/rate",
	stats: "/stats",
	lists: "/lists",
	seen: "/seen",
	wishlist: "/wishlist",
	shows: "/shows",
}

type Query = Record<string, string | null | undefined>

const withQuery = (path: string, query?: Query) => {
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(query ?? {}))
		if (value != null && value !== "") params.set(key, value)
	const q = params.toString()
	return q ? `${path}?${q}` : path
}

/**
 * A Taste page on a profile: `tastePath("ana")` is the Taste profile, `tastePath("ana", "rate", { mode: "quick" })` is
 * Rate more's Quick list, `{ view: "taste" }` its taste view, and `{ as: "visitor" }` any tab as visitors see it.
 */
export const tastePath = (
	handle: string,
	tab: TasteTab = "profile",
	query?: Query,
) => withQuery(`/u/${handle}${TASTE_SUFFIX[tab]}`, query)

/** One of a profile's Top 5 lists. It sits outside the profile layout and links back to Lists. */
export const tasteListPath = (handle: string, id: string) =>
	`/u/${handle}/lists/${id}`

/** Taste for guests and members without a handle: the taste page that lives in the browser for guests. */
export const TASTE_FALLBACK_PATH = "/taste"
/** Rating for guests and members without a handle. Account transfer returns here after sign-up. */
export const RATE_FALLBACK_PATH = "/taste/quiz"

/** Where the Taste key leads this viewer: their profile, or `/taste` without one. */
export const tasteHome = (viewer: PathViewer) => {
	const handle = handleOf(viewer)
	return handle ? tastePath(handle) : TASTE_FALLBACK_PATH
}

/** Rate more for this viewer, with Quick list's `mode` or the taste `view` in the query. */
export const ratePath = (viewer: PathViewer, query?: Query) => {
	const handle = handleOf(viewer)
	return handle
		? tastePath(handle, "rate", query)
		: withQuery(RATE_FALLBACK_PATH, query)
}

/** A Taste tab that needs a profile, or `/taste` for a viewer without a handle. */
export const tasteTabFor = (
	viewer: PathViewer,
	tab: TasteTab,
	query?: Query,
) => {
	const handle = handleOf(viewer)
	return handle ? tastePath(handle, tab, query) : TASTE_FALLBACK_PATH
}

// ---------------------------------------------------------------------------------------------------------
// Settings (the Taste area's gear)

export const SETTINGS_PATHS = {
	home: "/settings",
	services: "/settings/services",
	country: "/settings/country",
	language: "/settings/language",
	account: "/settings/account",
	connectedApps: "/settings/connected-apps",
	privacy: "/settings/discover-privacy",
	/** Edit profile, where a member without a handle picks one. */
	profile: "/settings/profile",
	/** Unchanged address: OAuth returns and the MCP import link point here. */
	imports: "/settings/imports",
	notInterested: "/settings/not-interested",
	export: "/settings/export",
} as const

export const SETTINGS_PATH = SETTINGS_PATHS.home
export const IMPORTS_PATH = SETTINGS_PATHS.imports
export const NOT_INTERESTED_PATH = SETTINGS_PATHS.notInterested
export const EXPORT_PATH = SETTINGS_PATHS.export
export const EDIT_PROFILE_PATH = SETTINGS_PATHS.profile

// ---------------------------------------------------------------------------------------------------------
// Library statuses → their new pages (old `?status=` links, `statusPage`, MCP's get_library)

/**
 * The page of a library status for this viewer. Want to see is the Whole Wishlist; Seen splits by kind (movies when
 * the kind is "all"); the show statuses are Up next chips; Not rated is a Taste page, so it needs a handle.
 */
export function statusHome(
	status: LibraryStatus,
	kind: LibraryKind,
	viewer: PathViewer,
): string {
	if (status === "want") return WATCH_PATHS.wishlist
	if (status === "seen")
		return watchSeenPath(kind === "show" ? "show" : "movie")
	if (status === "watching") return WATCH_PATHS.watching
	if (status === "on_hold") return WATCH_PATHS.onHold
	if (status === "dropped") return WATCH_PATHS.dropped
	return tasteTabFor(viewer, "not-rated")
}

/** True when `statusHome` gives every viewer the same page. */
const statusIsShared = (status: LibraryStatus) => status !== "unrated"

// ---------------------------------------------------------------------------------------------------------
// Old addresses → new ones

/**
 * A redirect: `status` 301 when the target is the same for everyone (cacheable, no Cache-Control), 302 with
 * `private, no-store` when it depends on who asks (docs/cache-identity.md), so a browser never keeps a signed-in
 * target across a sign-out.
 */
export interface Move {
	to: string
	status: 301 | 302
	private: boolean
}

const shared = (to: string): Move => ({ to, status: 301, private: false })
const personal = (to: string): Move => ({ to, status: 302, private: true })

/** The old query on the new address, without the keys the new page names by its path. */
const carry = (to: string, search: URLSearchParams, drop: string[] = []) => {
	const params = new URLSearchParams(search)
	for (const key of drop) params.delete(key)
	const q = params.toString()
	const hash = to.indexOf("#")
	if (!q) return to
	return hash < 0 ? `${to}?${q}` : `${to.slice(0, hash)}?${q}${to.slice(hash)}`
}

const OLD_STATUS: Record<string, LibraryStatus> = {
	want: "want",
	seen: "seen",
	watching: "watching",
	on_hold: "on_hold",
	dropped: "dropped",
	unrated: "unrated",
}

const OLD_LIST_SLUG: Record<string, LibraryStatus> = {
	want: "want",
	seen: "seen",
	watching: "watching",
	"on-hold": "on_hold",
	dropped: "dropped",
	"not-rated": "unrated",
}

const kindOf = (search: URLSearchParams): LibraryKind => {
	const type = search.get("type")
	return type === "movie" || type === "show" ? type : "all"
}

/** A status page's move. Pages with a fixed kind drop `type`; the Whole Wishlist keeps it (it has a kind control). */
function statusMove(
	status: LibraryStatus,
	search: URLSearchParams,
	viewer: PathViewer,
	drop: string[] = [],
): Move {
	const to = statusHome(status, kindOf(search), viewer)
	const fixedKind = status !== "want"
	const query = carry(to, search, fixedKind ? [...drop, "type"] : drop)
	if (!statusIsShared(status))
		return personal(to === TASTE_FALLBACK_PATH ? to : query)
	return shared(query)
}

/** The owner's own Seen, Wishlist and Shows tabs live in Watch. */
const OWNER_TAB_HOME: Record<string, (search: URLSearchParams) => string> = {
	seen: (search) =>
		kindOf(search) === "show" ? WATCH_PATHS.showsSeen : WATCH_PATHS.moviesSeen,
	wishlist: () => WATCH_PATHS.wishlist,
	shows: () => WATCH_PATHS.watching,
}

const FIXED: Record<string, string> = {
	"/my-shows": WATCH_PATHS.nextEpisodes,
	"/my-movies": WATCH_PATHS.tonight,
	"/for-you": WATCH_PATHS.forYou,
	"/my-library/hidden": NOT_INTERESTED_PATH,
	"/settings/hidden": NOT_INTERESTED_PATH,
	// Watch next is retired for everyone (guests' Ready to watch fills from the browser).
	"/watch-next": WATCH_PATHS.tonight,
}

/** The old Taste tabs, sections of the one Taste page now. Then the `/taste` rule applies. */
const TASTE_SECTIONS: Record<string, string> = {
	"/taste/everyone": "/taste#everyone",
	"/taste/fingerprint": "/taste#fingerprint",
}

/**
 * Where an old address goes now, or null when it stays (a page, or a new address). `search` is the request's query
 * (with or without "?"); it carries over, minus the keys the new address names in its path. A `#fragment` in the
 * browser survives a redirect whose Location has none, so `/taste#everyone` lands on `/u/:handle#everyone`.
 */
export function oldToNew(
	pathname: string,
	search: string | URLSearchParams,
	viewer: PathViewer,
): Move | null {
	const path =
		pathname.length > 1 && pathname.endsWith("/")
			? pathname.slice(0, -1)
			: pathname
	const params = new URLSearchParams(search)
	const handle = handleOf(viewer)

	const fixed = FIXED[path]
	if (fixed) return shared(carry(fixed, params))

	const section = TASTE_SECTIONS[path]
	if (section) return shared(carry(section, params))

	if (path === "/my-library") {
		const old = params.get("status")
		if (old !== null)
			return statusMove(OLD_STATUS[old] ?? "want", params, viewer, ["status"])
		if (viewer.kind === "guest") return personal(carry(WATCH_PATH, params))
		return personal(
			handle ? carry(tastePath(handle), params) : TASTE_FALLBACK_PATH,
		)
	}

	if (path === "/my-library/scores")
		return personal(
			handle ? carry(tastePath(handle, "scores"), params) : TASTE_FALLBACK_PATH,
		)

	if (path.startsWith("/my-library/")) {
		const status = OLD_LIST_SLUG[path.slice("/my-library/".length)]
		return status ? statusMove(status, params, viewer) : null
	}

	if (path === "/taste")
		return handle ? personal(carry(tastePath(handle), params)) : null

	if (path === "/taste/quiz")
		return handle ? personal(carry(tastePath(handle, "rate"), params)) : null

	if (path === "/wishlist")
		return personal(
			carry(
				viewer.kind === "member" ? WATCH_PATHS.wishlist : WATCH_PATHS.tonight,
				params,
			),
		)

	const profileTab = /^\/u\/([^/]+)\/(seen|wishlist|shows)$/.exec(path)
	if (profileTab) {
		const [, owner, tab] = profileTab
		const own = handle != null && sameHandle(handle, decodeURIComponent(owner))
		if (!own || params.get("as") === "visitor") return null
		return personal(
			carry(
				OWNER_TAB_HOME[tab](params),
				params,
				tab === "seen" ? ["type"] : [],
			),
		)
	}

	return null
}

/** The response for a move: Location, plus `private, no-store` and `Vary: Cookie` when it depends on who asks. */
export function moveResponse(move: Move): Response {
	const headers = new Headers({ Location: move.to })
	if (move.private) {
		headers.set("Cache-Control", "private, no-store")
		headers.set("Vary", "Cookie")
	}
	return new Response(null, { status: move.status, headers })
}
