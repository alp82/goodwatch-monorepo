// The browser's copy of catalog loader data, so a page change that was prefetched, or a step Back or Forward, shows
// the next page without waiting for the server. Rules (docs/navigation-cache.md has the whole picture):
// - An entry belongs to one identity (member or visitor, country, language), one route, and one URL.
// - A forward navigation (a link, `navigate()`) takes an entry up to FORWARD_MAX_AGE_MS old, or joins a prefetch
//   that is still loading. Older entries are fetched again.
// - A history navigation (Back, Forward) takes an entry up to HISTORY_MAX_AGE_MS old at once. When it is older than
//   the forward limit, the caller refreshes it in the background for the next visit.
// - A revalidation (after a write, `useRevalidator`, the sign-in rerun) never reads the cache. Its answer is stored.
// - The first page's own data (a seed) serves Back and Forward for SEED_MAX_AGE_MS only: nothing tells whether it
//   was complete.
// - Incomplete data (INCOMPLETE_DATA_HEADER) is kept only when a prefetch loaded it, and only for the one forward
//   navigation it was loaded for. It's dropped once used, also when that navigation joined the prefetch while it
//   was loading, and Back and Forward never take it.
// - `clear()` drops every entry and every load under way. A load that started before it is obsolete: nobody gets
//   its answer, and a navigation that waited for it loads again with the identity of now.
// - Only the newest load of a key stores its answer, so an older one that ends later can't overwrite it.
// - `hold()` turns the cache off until released, while the signed-in person may differ from the root's data.
// This file has no browser or Remix imports, so `node --test` runs its tests directly.

export const FORWARD_MAX_AGE_MS = 60_000
export const HISTORY_MAX_AGE_MS = 10 * 60_000
export const SEED_MAX_AGE_MS = 60_000
export const MAX_ENTRIES = 100
// A navigation that keeps meeting clears gives up on the cache after this many loads and asks the server itself.
const MAX_ATTEMPTS = 3

/**
 * The header a loader data answer carries when the page is incomplete (a data source ran out of time or failed).
 * The navigation shows such data, but the cache keeps it only for that navigation. The server sets it in
 * `handleDataRequest`.
 */
export const INCOMPLETE_DATA_HEADER = "X-Incomplete-Page"

export type NavigationKind = "forward" | "history" | "revalidation"

/** What started a load: a navigation itself, one of the prefetch triggers, the first page, or a refresh. */
export type LoadSource =
	| "navigation"
	| "press"
	| "hover"
	| "focus"
	| "viewport"
	| "seed"
	| "refresh"

/** A loader answer. `store` is false for data the navigation may show but the cache must not keep for later. */
/** `obsolete` marks a load that a clear overtook: its answer may predate a write or belong to another person. */
export type Loaded =
	| { ok: true; data: unknown; store: boolean }
	| { ok: false; obsolete?: true }

/** What answered a navigation, and which load or prefetch trigger brought the data. */
export interface Answer {
	data: unknown
	source: LoadSource
}

interface Entry {
	data: unknown
	fetchedAt: number
	source: LoadSource
	/** Only for the next forward navigation: incomplete data a prefetch loaded. */
	once: boolean
}

// Loads that run ahead of a navigation. Their incomplete answers wait for that navigation.
const PREFETCHES = new Set<LoadSource>(["press", "hover", "focus", "viewport"])

interface Pending {
	promise: Promise<Loaded>
	source: LoadSource
}

export type Lookup =
	| { kind: "hit"; data: unknown; source: LoadSource; refresh: boolean }
	| { kind: "pending"; promise: Promise<Loaded>; source: LoadSource }
	| { kind: "miss" }

/** The cache key. The identity comes first, so entries of another person or locale can never match. */
export function cacheKey(identity: string, routeId: string, url: URL): string {
	const search = new URLSearchParams(url.search)
	search.delete("_data")
	const query = search.toString()
	return `${identity}\n${routeId}\n${url.pathname}${query ? `?${query}` : ""}`
}

/** The identity part of a key: who is signed in, and the country and language the server renders for. */
export function identityOf(root: unknown): string | null {
	if (!root || typeof root !== "object") return null
	const { user, locale } = root as {
		user?: { id?: unknown } | null
		locale?: { country?: unknown; language?: unknown }
	}
	if (!locale) return null
	const who =
		user && typeof user.id === "string" ? `member:${user.id}` : "visitor"
	return `${who}|${String(locale.country ?? "")}|${String(locale.language ?? "")}`
}

export class LoaderCache {
	private readonly entries = new Map<string, Entry>()
	private readonly pending = new Map<string, Pending>()
	private generation = 0
	private holds = 0

	private readonly now: () => number
	private readonly maxEntries: number

	constructor(now: () => number = Date.now, maxEntries = MAX_ENTRIES) {
		this.now = now
		this.maxEntries = maxEntries
	}

	get size(): number {
		return this.entries.size
	}

	/** True while a `hold()` hasn't been released. */
	get held(): boolean {
		return this.holds > 0
	}

	/**
	 * Clears the cache and turns it off until the returned function is called, as while a sign-in or sign-out is
	 * settling: the server may already answer for another person than the root's data names. Releasing clears again,
	 * so nothing loaded during the hold is kept.
	 */
	hold(): () => void {
		this.holds++
		this.clear()
		let released = false
		return () => {
			if (released) return
			released = true
			this.holds--
			this.clear()
		}
	}

	/** What a navigation of this kind may use for the key. */
	lookup(key: string, kind: NavigationKind): Lookup {
		if (kind === "revalidation" || this.held) return { kind: "miss" }
		const entry = this.entries.get(key)
		if (entry && !(entry.once && kind === "history")) {
			const age = this.now() - entry.fetchedAt
			const limit =
				kind === "forward"
					? FORWARD_MAX_AGE_MS
					: entry.source === "seed"
						? SEED_MAX_AGE_MS
						: HISTORY_MAX_AGE_MS
			if (age <= limit) {
				// Map order is the LRU order: a read moves the entry to the end.
				this.entries.delete(key)
				if (!entry.once) this.entries.set(key, entry)
				return {
					kind: "hit",
					data: entry.data,
					source: entry.source,
					refresh: kind === "history" && age > FORWARD_MAX_AGE_MS,
				}
			}
		}
		const pending = this.pending.get(key)
		if (pending)
			return {
				kind: "pending",
				promise: pending.promise,
				source: pending.source,
			}
		return { kind: "miss" }
	}

	/** Whether a load for the key is under way, or a fresh entry exists, so a prefetch has nothing to do. */
	covered(key: string): boolean {
		if (this.pending.has(key)) return true
		const entry = this.entries.get(key)
		return Boolean(
			entry && this.now() - entry.fetchedAt <= FORWARD_MAX_AGE_MS / 2,
		)
	}

	/**
	 * Runs a load for the key and stores its answer, if it is still the key's newest load and the answer allows it.
	 * When the cache was cleared meanwhile, the answer is obsolete and nobody gets it. Navigations can join the load
	 * while it runs.
	 */
	load(
		key: string,
		source: LoadSource,
		run: () => Promise<Loaded>,
	): Promise<Loaded> {
		const generation = this.generation
		const promise = run().then((loaded): Loaded => {
			if (generation !== this.generation) return { ok: false, obsolete: true }
			if (!loaded.ok || this.pending.get(key) !== pending || this.held)
				return loaded
			if (loaded.store) this.set(key, loaded.data, source)
			else if (PREFETCHES.has(source)) this.set(key, loaded.data, source, true)
			return loaded
		})
		const pending: Pending = { promise, source }
		this.pending.set(key, pending)
		const done = () => {
			if (this.pending.get(key) === pending) this.pending.delete(key)
		}
		promise.then(done, done)
		return promise
	}

	set(key: string, data: unknown, source: LoadSource, once = false): void {
		this.entries.delete(key)
		this.entries.set(key, { data, fetchedAt: this.now(), source, once })
		while (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next().value
			if (oldest === undefined) break
			this.entries.delete(oldest)
		}
	}

	/**
	 * Waits for a load under way. Incomplete data goes to one forward navigation, which uses up the entry the load
	 * left. Back and Forward don't take it.
	 */
	private async join(
		key: string,
		kind: NavigationKind,
		pending: Promise<Loaded>,
	): Promise<Loaded> {
		const loaded = await pending.catch((): Loaded => ({ ok: false }))
		if (!loaded.ok || loaded.store) return loaded
		if (kind !== "forward") return { ok: false }
		const entry = this.entries.get(key)
		if (entry?.once && entry.data === loaded.data) this.entries.delete(key)
		return loaded
	}

	/**
	 * Answers a navigation: from an entry, from a load under way, or from a load of its own that it keeps. `keyNow`
	 * gives the key for the identity of the moment, or null when the cache can't be used (it's held, or the root has
	 * no identity). A load a clear made obsolete is tried again with the key of then. Null means the server must
	 * answer the usual way. `refresh` is called for a history entry that should be loaded again in the background.
	 */
	async answer(
		kind: NavigationKind,
		keyNow: () => string | null,
		fetch: () => Promise<Loaded>,
		refresh: (key: string) => void = () => {},
	): Promise<Answer | null> {
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			const key = this.held ? null : keyNow()
			if (key === null) return null
			const found = this.lookup(key, kind)
			if (found.kind === "hit") {
				if (found.refresh) refresh(key)
				return { data: found.data, source: found.source }
			}
			if (found.kind === "pending") {
				const joined = await this.join(key, kind, found.promise)
				if (joined.ok) return { data: joined.data, source: found.source }
				if (joined.obsolete) continue
			}
			const loaded = await this.load(key, "navigation", fetch)
			if (loaded.ok) return { data: loaded.data, source: "navigation" }
			if (!loaded.obsolete) return null
		}
		return null
	}

	/** The data of the key's entry or of its load under way, for work that follows a prefetch. */
	async settled(key: string): Promise<unknown> {
		const entry = this.entries.get(key)
		if (entry) return entry.data
		const loaded = await this.pending.get(key)?.promise.catch(() => null)
		return loaded?.ok ? loaded.data : undefined
	}

	clear(): void {
		this.generation++
		this.entries.clear()
		this.pending.clear()
	}
}

/** The header subset `readLoaderResponse` looks at. Tests pass plain objects. */
export interface LoaderResponse {
	status: number
	headers: { get(name: string): string | null }
	json(): Promise<unknown>
}

/**
 * Reads a `?_data=` answer the way the cache may use it: plain 200 JSON from the Remix server. A redirect, an error,
 * a thrown response, streamed (deferred) data, or anything from in between (a proxy's error page) is refused, and
 * the navigation asks Remix to load it as usual.
 */
export async function readLoaderResponse(
	response: LoaderResponse,
): Promise<Loaded> {
	const header = (name: string) => response.headers.get(name)
	if (
		response.status !== 200 ||
		header("X-Remix-Redirect") !== null ||
		header("X-Remix-Error") !== null ||
		header("X-Remix-Catch") !== null ||
		header("X-Remix-Response") === null
	)
		return { ok: false }
	const type = header("Content-Type") ?? ""
	if (!/\bapplication\/json\b/.test(type) || /text\/remix-deferred/.test(type))
		return { ok: false }
	try {
		const data = await response.json()
		return { ok: true, data, store: header(INCOMPLETE_DATA_HEADER) === null }
	} catch {
		return { ok: false }
	}
}

/** The parts of the router's state that tell which kind of navigation a loader call belongs to. */
export interface NavigationState {
	navigation: {
		state: string
		formMethod?: string
		location?: { pathname: string; search: string; key: string }
	}
	/** "loading" while a `revalidate()` runs, also when it rides on a navigation that is under way. */
	revalidation?: string
}

/**
 * Which kind of navigation a loader call for `url` belongs to. A pending navigation to the same URL without a form
 * is forward or history: history when the browser's current entry already is the target (a Back or Forward
 * changes the entry before the loaders run, a push changes it after). Anything else (a revalidation, also one
 * started while a navigation waits, a fetcher, a form submission) counts as a revalidation.
 */
export function navigationKind(
	state: NavigationState | undefined,
	url: URL,
	historyKey: string | undefined,
): NavigationKind {
	const navigation = state?.navigation
	const target = navigation?.location
	if (
		!navigation ||
		(state.revalidation && state.revalidation !== "idle") ||
		navigation.state !== "loading" ||
		navigation.formMethod ||
		!target ||
		target.pathname !== url.pathname
	)
		return "revalidation"
	const search = new URLSearchParams(url.search)
	search.delete("_data")
	const query = search.toString()
	if (new URLSearchParams(target.search).toString() !== query)
		return "revalidation"
	return (historyKey ?? "default") === target.key ? "history" : "forward"
}

/** What the router's state tells the cache: the identity now, and whether to clear. */
export interface RouterSnapshot {
	loaderData: Record<string, unknown>
	navigation: { formMethod?: string }
	fetchers: Map<string, { state: string; formMethod?: string }>
}

const isWrite = (method: string | undefined) =>
	Boolean(method) && method?.toUpperCase() !== "GET"

/**
 * Clears on a new identity (sign-in, sign-out, another country or language in the root's data), and while a form or
 * fetcher submission that isn't a GET is under way: its action may change any page.
 */
export function invalidation(
	previousIdentity: string | null,
	state: RouterSnapshot,
): { identity: string | null; clear: boolean } {
	const identity = identityOf(state.loaderData.root)
	let clear =
		identity !== previousIdentity || isWrite(state.navigation.formMethod)
	for (const fetcher of state.fetchers.values())
		if (fetcher.state !== "idle" && isWrite(fetcher.formMethod)) clear = true
	return { identity, clear }
}

// The site's own POST endpoints that only read: searches, listings, the explorer, poster impressions, and error
// reports (`/api/e`). Every other request to /api/ that isn't a GET counts as a write. A path that ends in "/" covers
// everything below it.
export const READ_ONLY_POSTS = [
	"/api/combined-search",
	"/api/discover/results",
	"/api/e",
	"/api/explorer/",
	"/api/living-room/picks",
	"/api/og-image-warm",
	"/api/poster-impressions",
	"/api/taste/match",
	"/api/taste/portrait",
	"/api/title-cards",
	"/api/tonight",
	"/api/watch-next",
	"/api/watch-next/cards",
	"/api/watchability",
]

/** Whether a request may change what a page shows: a non-GET to the site's /api/ that isn't a known read. */
export function isWriteRequest(
	method: string,
	url: URL,
	origin: string,
): boolean {
	const verb = method.toUpperCase()
	if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return false
	if (url.origin !== origin || !url.pathname.startsWith("/api/")) return false
	const path = url.pathname.replace(/\/+$/, "")
	return !READ_ONLY_POSTS.some((read) =>
		read.endsWith("/") ? path.startsWith(read) : path === read,
	)
}

/** Whether a request may sign someone in or out. */
export function isAuthRequest(
	method: string,
	url: URL,
	origin: string,
): boolean {
	return (
		isWriteRequest(method, url, origin) && url.pathname.startsWith("/api/auth/")
	)
}

/** The member part of a root identity: "member:<id>" or "visitor". Null when the root has no data. */
export function memberOf(root: unknown): string | null {
	const identity = identityOf(root)
	return identity === null ? null : identity.slice(0, identity.indexOf("|"))
}

/** The member part of an identity for a user id, as `memberOf` gives it. */
export function memberKey(userId: string | null | undefined): string {
	return userId ? `member:${userId}` : "visitor"
}

/** What the root reload watcher reads from the router. */
export interface RootWatchState {
	loaderData: Record<string, unknown>
	errors: Record<string, unknown> | null
	navigation: { state: string }
	revalidation: string
}

export interface RootWatchRouter {
	state: RootWatchState
	subscribe(listener: (state: RootWatchState) => void): () => void
}

/**
 * Calls `release` once the root has new data from the server, whatever reruns it (the revalidation the caller
 * starts, or a later navigation). A router that went idle is not proof: when the root's request failed twice, the
 * retry wrapper keeps the old member's data (`kept`), and a failed root is an error. Then the hold stays, and
 * `rerunRoot` makes the next navigation ask for the root again. Returns a function that stops waiting without
 * releasing.
 */
export function releaseOnFreshRoot(
	router: RootWatchRouter,
	release: () => void,
	{ kept, rerunRoot }: { kept: () => boolean; rerunRoot: () => void },
): () => void {
	let before = router.state.loaderData.root
	const stop = router.subscribe((state) => {
		if (state.revalidation !== "idle" || state.navigation.state !== "idle")
			return
		// A root that threw keeps its old data: no answer about the person.
		if (state.errors?.root !== undefined) return rerunRoot()
		const root = state.loaderData.root
		if (root === before) return
		before = root
		if (kept()) return rerunRoot()
		stop()
		release()
	})
	return stop
}
