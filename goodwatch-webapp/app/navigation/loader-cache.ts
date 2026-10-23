// The browser's copy of catalog loader data, so a page change that was prefetched, or a step Back or Forward, shows
// the next page without waiting for the server. Rules (docs/navigation-cache.md has the whole picture):
// - An entry belongs to one identity (member or visitor, country, language), one route, and one URL.
// - A forward navigation (a link, `navigate()`) takes an entry up to FORWARD_MAX_AGE_MS old, or joins a prefetch
//   that is still loading. Older entries are fetched again.
// - A history navigation (Back, Forward) takes an entry up to HISTORY_MAX_AGE_MS old at once. When it is older than
//   the forward limit, the caller refreshes it in the background for the next visit.
// - A revalidation (after a write, `useRevalidator`, the sign-in rerun) never reads the cache. Its answer is stored.
// - Incomplete data (INCOMPLETE_DATA_HEADER) is kept only when a prefetch loaded it, and only for the one forward
//   navigation it was loaded for. It's dropped once used, and Back and Forward never take it.
// - `clear()` drops every entry and every load under way. A load that started before it doesn't store its answer.
// This file has no browser or Remix imports, so `node --test` runs its tests directly.

export const FORWARD_MAX_AGE_MS = 60_000
export const HISTORY_MAX_AGE_MS = 10 * 60_000
export const MAX_ENTRIES = 100

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
export type Loaded = { ok: true; data: unknown; store: boolean } | { ok: false }

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

	private readonly now: () => number
	private readonly maxEntries: number

	constructor(now: () => number = Date.now, maxEntries = MAX_ENTRIES) {
		this.now = now
		this.maxEntries = maxEntries
	}

	get size(): number {
		return this.entries.size
	}

	/** What a navigation of this kind may use for the key. */
	lookup(key: string, kind: NavigationKind): Lookup {
		if (kind === "revalidation") return { kind: "miss" }
		const entry = this.entries.get(key)
		if (entry && !(entry.once && kind === "history")) {
			const age = this.now() - entry.fetchedAt
			const limit = kind === "history" ? HISTORY_MAX_AGE_MS : FORWARD_MAX_AGE_MS
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
	 * Runs a load for the key and stores its answer, unless the cache was cleared meanwhile or the answer says not to.
	 * Navigations of the forward kind can join it while it runs.
	 */
	load(
		key: string,
		source: LoadSource,
		run: () => Promise<Loaded>,
	): Promise<Loaded> {
		const generation = this.generation
		const promise = run().then((loaded) => {
			if (!loaded.ok || generation !== this.generation) return loaded
			if (loaded.store) this.set(key, loaded.data, source)
			else if (PREFETCHES.has(source)) this.set(key, loaded.data, source, true)
			return loaded
		})
		const pending = { promise, source }
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
}

/**
 * Which kind of navigation a loader call for `url` belongs to. A pending navigation to the same URL without a form
 * is forward or history: history when the browser's current entry already is the target (a Back or Forward
 * changes the entry before the loaders run, a push changes it after). Anything else (a revalidation, a fetcher,
 * a form submission) counts as a revalidation.
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

// Paths whose non-GET requests change what a member's pages show. Reads that use POST (Discover's results, the
// explorer, poster impressions) aren't writes and don't clear the cache.
export const WRITE_PATHS = [
	"/api/update-",
	"/api/imports",
	"/api/imdb-import",
	"/api/import-guest-interactions",
	"/api/media-preferences",
	"/api/user-settings/",
	"/api/tracking/",
	"/api/watch-log",
	"/api/watch-next/watched",
	"/api/share-lists",
	"/api/auth/",
	"/api/profile/",
	"/api/handle",
]

/** Whether a request writes member data, by the list above. */
export function isWriteRequest(
	method: string,
	url: URL,
	origin: string,
): boolean {
	const verb = method.toUpperCase()
	if (verb === "GET" || verb === "HEAD") return false
	if (url.origin !== origin) return false
	return WRITE_PATHS.some((path) => url.pathname.startsWith(path))
}
