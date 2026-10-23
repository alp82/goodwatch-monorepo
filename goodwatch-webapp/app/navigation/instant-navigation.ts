// The browser side of instant page changes (docs/navigation-cache.md): the catalog routes' `clientLoader`, our own
// data prefetch, and what clears the cache. The rules of the cache itself are in loader-cache.ts.
//
// The first load of a page never comes from here. A `clientLoader` without `hydrate` doesn't run on hydration, so
// the server renders every document as before, for crawlers and browsers alike.
import { type ClientLoaderFunctionArgs, matchRoutes } from "@remix-run/react"
import { preloadHeroBackdrop } from "~/ui/details/hero/hero-backdrop"
import { keptLoaderData } from "~/utils/loader-request-retry"
import {
	requestRootRevalidation,
	rootRevalidated,
} from "~/utils/root-revalidation"
import { AUTH_SYNC_KEY, type AuthNote, AuthSync } from "./auth-sync"
import {
	type CachedRouteId,
	TITLE_ROUTE_IDS,
	isCachedRoute,
} from "./cached-routes"
import {
	type LoadSource,
	type Loaded,
	LoaderCache,
	cacheKey,
	identityOf,
	invalidation,
	isAuthRequest,
	isWriteRequest,
	memberKey,
	memberOf,
	navigationKind,
	readLoaderResponse,
	releaseOnFreshRoot,
} from "./loader-cache"
import { PrefetchQueue, type Priority } from "./prefetch-queue"

type Params = Record<string, string | undefined>
interface RouteMatch {
	pathname: string
	params: Params
	route: { id: string }
}
interface RemixRouter {
	routes: Parameters<typeof matchRoutes>[0]
	state: {
		location: { pathname: string; search: string; key: string }
		matches: RouteMatch[]
		loaderData: Record<string, unknown>
		errors: Record<string, unknown> | null
		navigation: {
			state: string
			formMethod?: string
			location?: { pathname: string; search: string; key: string }
		}
		revalidation: string
		fetchers: Map<string, { state: string; formMethod?: string }>
	}
	subscribe(listener: (state: RemixRouter["state"]) => void): () => void
	revalidate(): void
}
interface ManifestRoute {
	module: string
	imports?: string[]
	css?: string[]
	hasLoader?: boolean
}
type ShouldRevalidate = (args: {
	currentUrl: URL
	currentParams: Params
	nextUrl: URL
	nextParams: Params
	defaultShouldRevalidate: boolean
}) => boolean
interface RemixWindow {
	__remixRouter?: RemixRouter
	__remixManifest?: { routes: Record<string, ManifestRoute | undefined> }
	__remixRouteModules?: Record<
		string,
		{ shouldRevalidate?: ShouldRevalidate } | undefined
	>
	__gwNavCache?: typeof stats
}

const remix = () => window as unknown as RemixWindow
const cache = new LoaderCache()
const queue = new PrefetchQueue()

/** Counts for the benchmark report, readable as `window.__gwNavCache`. */
const stats = {
	prefetches: 0,
	/** Navigations answered by an entry or a load that a prefetch trigger started, per trigger. */
	used: {} as Partial<Record<LoadSource, number>>,
	misses: 0,
}

function noteUse(source: LoadSource) {
	stats.used[source] = (stats.used[source] ?? 0) + 1
}

function currentIdentity(): string | null {
	return identityOf(remix().__remixRouter?.state.loaderData.root)
}

/**
 * Drops every kept page, every load under way, and every prefetch that waits. Call it after anything that may change
 * what a page shows.
 */
export function clearLoaderCache(): void {
	cache.clear()
	queue.clear()
}

/**
 * Clears the cache and turns it off until the returned function is called. For the time the server may answer for
 * another person than the root's data names: a sign-in, sign-out, or account switch until the root has reloaded.
 */
export function holdLoaderCache(): () => void {
	queue.clear()
	return cache.hold()
}

// How long after a sign-in request's answer a revalidation may start by itself (the auth provider's after a sign-in or
// sign-out). Without one (a sign-up, a confirmation email) the cache reloads the root itself.
const AUTH_ANSWER_GRACE_MS = 3000

/**
 * Releases a hold once the root has new data from the server (`releaseOnFreshRoot`), and makes sure the root
 * reruns: on the next revalidation or navigation, or now with `revalidateAfterMs` when none started by then.
 */
function releaseAfterRootReload(
	release: () => void,
	revalidateAfterMs?: number,
) {
	const router = remix().__remixRouter
	if (!router) return release()
	requestRootRevalidation()
	const done = () => {
		// The auth provider ends the request only when the member changed: a visitor's root would rerun on every page.
		rootRevalidated()
		release()
	}
	releaseOnFreshRoot(router, done, {
		kept: () => keptLoaderData("root"),
		rerunRoot: requestRootRevalidation,
	})
	if (revalidateAfterMs === undefined) return
	let started = router.state.revalidation !== "idle"
	const stop = router.subscribe((state) => {
		if (state.revalidation !== "idle") started = true
	})
	window.setTimeout(() => {
		stop()
		if (!started && cache.held) router.revalidate()
	}, revalidateAfterMs)
}

/**
 * Reruns the root's loader (and the page's) with the cache held until the root's new data is there, so no page kept
 * for the previous identity, and nothing loaded under it, shows meanwhile. Takes over `release` of a hold the caller
 * already started.
 */
export function revalidateWithCacheHeld(
	revalidate: () => void,
	release: () => void = holdLoaderCache(),
): void {
	releaseAfterRootReload(release)
	revalidate()
}

// Cross-tab notes about sign-ins (auth-sync.ts). Created once the router exists.
let authSync: AuthSync | null = null

/**
 * Tells the other tabs that the signed-in person may have changed. `userId` names who the session holds now when
 * that is known (the Supabase client's change event), so tabs that already show them do nothing.
 */
export function announceAuthChange(userId?: string | null): void {
	authSync?.announce(userId === undefined ? undefined : memberKey(userId))
}

/** Another tab changed the session: hold the cache and reload the root, until it names who the cookie holds now. */
function resyncIdentity() {
	const router = remix().__remixRouter
	if (!router) return
	releaseAfterRootReload(holdLoaderCache())
	router.revalidate()
}

function startAuthSync(router: RemixRouter) {
	let channel: BroadcastChannel | null = null
	try {
		channel = new BroadcastChannel(AUTH_SYNC_KEY)
	} catch {}
	const sync = new AuthSync(
		{
			read: () => window.localStorage.getItem(AUTH_SYNC_KEY),
			write: (value) => window.localStorage.setItem(AUTH_SYNC_KEY, value),
			post: channel ? (note) => channel.postMessage(note) : null,
			newId: () =>
				`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
		},
		() => memberOf(router.state.loaderData.root),
		resyncIdentity,
	)
	authSync = sync
	if (channel)
		channel.onmessage = (event: MessageEvent<AuthNote>) =>
			sync.receive(event.data)
	window.addEventListener("storage", (event) => {
		if (event.key === AUTH_SYNC_KEY) sync.receive(event.newValue)
	})
	// A hidden tab may be throttled, and a page in the back/forward cache hears nothing.
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") sync.check()
	})
	window.addEventListener("pageshow", (event) => {
		if (event.persisted) sync.check()
	})
	sync.start()
}

async function fetchRouteData(
	url: URL,
	routeId: string,
	init: { signal?: AbortSignal; priority?: "high" | "low" | "auto" } = {},
): Promise<Loaded> {
	const dataUrl = new URL(url)
	dataUrl.hash = ""
	dataUrl.searchParams.set("_data", routeId)
	// The same URL Remix asks for, with the same credentials.
	const response = await fetch(dataUrl.href, {
		credentials: "same-origin",
		signal: init.signal,
		...(init.priority ? { priority: init.priority } : {}),
	} as RequestInit)
	const loaded = await readLoaderResponse(response)
	// After a failed revalidation the retry wrapper answers with the page's old data: show it, don't keep it.
	if (loaded.ok && keptLoaderData(routeId)) return { ...loaded, store: false }
	return loaded
}

/**
 * The `clientLoader` of a catalog route. It answers from the cache by the rules in loader-cache.ts, joins a prefetch
 * that is under way, and otherwise loads from the server itself so the answer is kept. Anything the cache can't
 * use (a redirect, an error) goes to Remix's own `serverLoader`.
 */
export function cachedClientLoader(routeId: CachedRouteId) {
	return async ({ request, serverLoader }: ClientLoaderFunctionArgs) => {
		const url = new URL(request.url)
		const kind = navigationKind(
			remix().__remixRouter?.state,
			url,
			(window.history.state as { key?: string } | null)?.key,
		)
		const answer = await cache
			.answer(
				kind,
				() => {
					const identity = currentIdentity()
					return identity ? cacheKey(identity, routeId, url) : null
				},
				() => {
					request.signal.throwIfAborted()
					return fetchRouteData(url, routeId, { signal: request.signal })
				},
				(key) => refresh(url, routeId, key),
			)
			.catch((error: unknown) => {
				if (request.signal.aborted) throw error
				return null
			})
		if (answer) {
			if (answer.source === "navigation") stats.misses++
			else noteUse(answer.source)
			return answer.data
		}
		return serverLoader()
	}
}

function refresh(url: URL, routeId: string, key: string) {
	const identity = currentIdentity()
	queue.request({
		key,
		priority: "viewport",
		run: () => {
			if (!stillWanted(identity)) return Promise.resolve()
			return cache.load(key, "refresh", () =>
				fetchRouteData(url, routeId, { priority: "low" }),
			)
		},
	})
}

/** Whether a prefetch queued for `identity` should still start: the tab is visible and the identity is the same. */
function stillWanted(identity: string | null): boolean {
	return (
		document.visibilityState !== "hidden" &&
		!cache.held &&
		identity !== null &&
		currentIdentity() === identity
	)
}

function saveData(): boolean {
	const connection = (
		navigator as Navigator & {
			connection?: { saveData?: boolean; effectiveType?: string }
		}
	).connection
	return Boolean(
		connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? ""),
	)
}

const preloaded = new Set<string>()

function addLink(rel: string, href: string, as?: string) {
	if (preloaded.has(href)) return
	preloaded.add(href)
	if (
		document.querySelector(
			`link[href="${CSS.escape(href)}"], script[src="${CSS.escape(href)}"]`,
		)
	)
		return
	const link = document.createElement("link")
	link.rel = rel
	if (as) link.as = as
	link.href = href
	document.head.appendChild(link)
}

/** Loads a route's code (its module, the modules it imports, and its style sheets) without running it. */
export function preloadRouteCode(routeId: string): void {
	const route = remix().__remixManifest?.routes[routeId]
	if (!route || remix().__remixRouteModules?.[routeId]) return
	for (const href of [route.module, ...(route.imports ?? [])])
		addLink("modulepreload", href)
	for (const href of route.css ?? []) addLink("prefetch", href, "style")
}

/**
 * The cached routes whose loaders a navigation to `url` would call, as Remix decides it: a route that is new at its
 * position always loads, a route that stays loads when the query string changes and its `shouldRevalidate` agrees.
 */
function routesToLoad(router: RemixRouter, url: URL): RouteMatch[] {
	const matches = (matchRoutes(router.routes, url.pathname) ??
		[]) as unknown as RouteMatch[]
	const current = router.state
	const currentUrl = new URL(
		current.location.pathname + current.location.search,
		window.location.origin,
	)
	return matches.filter((match) => {
		const id = match.route.id
		if (!isCachedRoute(id) || !remix().__remixManifest?.routes[id]?.hasLoader)
			return false
		const staying = current.matches.find(
			(old) => old.route.id === id && old.pathname === match.pathname,
		)
		if (!staying) return true
		if (currentUrl.search === url.search) return false
		const shouldRevalidate = remix().__remixRouteModules?.[id]?.shouldRevalidate
		return shouldRevalidate
			? shouldRevalidate({
					currentUrl,
					currentParams: staying.params,
					nextUrl: url,
					nextParams: match.params,
					defaultShouldRevalidate: true,
				})
			: true
	})
}

const PRIORITY: Record<PrefetchTrigger, Priority> = {
	press: "press",
	hover: "intent",
	focus: "intent",
	viewport: "viewport",
}

export type PrefetchTrigger = "press" | "hover" | "focus" | "viewport"

/** The URL of an internal link the prefetch may follow, or null. */
export function prefetchableUrl(href: string): URL | null {
	let url: URL
	try {
		url = new URL(href, window.location.href)
	} catch {
		return null
	}
	if (url.origin !== window.location.origin) return null
	if (
		url.pathname === window.location.pathname &&
		url.search === window.location.search
	)
		return null
	return url
}

/** Prefetches the data and code of the page at `url`, within the limits of the queue. */
export function prefetchPage(url: URL, trigger: PrefetchTrigger): void {
	const router = remix().__remixRouter
	if (!router || document.visibilityState === "hidden" || cache.held) return
	if (saveData()) return
	const identity = currentIdentity()
	if (!identity) return
	const routes = routesToLoad(router, url)
	if (trigger !== "viewport")
		for (const match of routes) preloadRouteCode(match.route.id)
	for (const match of routes) {
		const routeId = match.route.id
		const key = cacheKey(identity, routeId, url)
		const hero = trigger !== "viewport" && TITLE_ROUTE_IDS.includes(routeId)
		if (cache.covered(key)) {
			if (hero) void cache.settled(key).then(startHero)
			continue
		}
		queue.request({
			key,
			priority: PRIORITY[trigger],
			run: () => {
				if (!stillWanted(identity) || cache.covered(key))
					return Promise.resolve()
				stats.prefetches++
				return cache
					.load(key, trigger, () =>
						fetchRouteData(url, routeId, {
							priority: trigger === "viewport" ? "low" : "high",
						}),
					)
					.then((loaded) => {
						if (loaded.ok && hero) startHero(loaded.data)
					})
					.catch(() => {})
			},
		})
	}
}

/** Takes back a hover or focus prefetch that hasn't started. */
export function cancelPrefetch(url: URL): void {
	const router = remix().__remixRouter
	const identity = currentIdentity()
	if (!router || !identity) return
	for (const match of routesToLoad(router, url))
		queue.cancel(cacheKey(identity, match.route.id, url))
}

function startHero(data: unknown) {
	const path = (data as { media?: { details?: { backdrop_path?: unknown } } })
		?.media?.details?.backdrop_path
	if (typeof path === "string" && path) preloadHeroBackdrop(path)
}

let started = false

/**
 * Starts the cache's bookkeeping once the router exists (after hydration): seeds the cache with the page's own data,
 * and clears it when the identity changes or something is submitted.
 */
export function startLoaderCache(): void {
	const router = remix().__remixRouter
	if (started || !router) return
	started = true
	remix().__gwNavCache = stats
	seed(router.state)
	let identity = identityOf(router.state.loaderData.root)
	let member = memberOf(router.state.loaderData.root)
	router.subscribe((state) => {
		const next = invalidation(identity, state)
		identity = next.identity
		if (next.clear) clearLoaderCache()
		// The server named another member to this tab: the other tabs may still show the previous one.
		const now = memberOf(state.loaderData.root)
		if (now !== null && now !== member && !keptLoaderData("root")) {
			member = now
			authSync?.memberChanged(now)
		}
	})
	startAuthSync(router)
	// A waiting prefetch would start in a hidden tab, for a page the person may never come back to.
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") queue.clear()
	})
}

// Only the first page is seeded: its data came with the document. Later pages store themselves in `clientLoader`.
// A committed URL can't be seeded in general: a route that skipped its loader (Discover's filters) holds data of an
// earlier URL.
function seed(state: RemixRouter["state"]) {
	const identity = identityOf(state.loaderData.root)
	if (!identity || state.errors) return
	const url = new URL(
		state.location.pathname + state.location.search,
		window.location.origin,
	)
	for (const match of state.matches) {
		const id = match.route.id
		const data = state.loaderData[id]
		// Nothing tells whether this data was complete, so a seed serves Back and Forward for a minute only.
		if (isCachedRoute(id) && data !== undefined)
			cache.set(cacheKey(identity, id, url), data, "seed")
	}
}

/**
 * Wraps the browser's `fetch` so a member write clears the cache once the server answered it. Hooks that write
 * through TanStack Query clear it as well (root.tsx), this also covers writes that call `fetch` directly.
 */
export function installWriteWatch(): void {
	const browserFetch = window.fetch.bind(window)
	const origin = window.location.origin
	window.fetch = (input, init) => {
		const method =
			init?.method ?? (input instanceof Request ? input.method : "GET")
		let url: URL | null = null
		try {
			url = new URL(
				input instanceof Request ? input.url : String(input),
				origin,
			)
		} catch {}
		// A sign-in or sign-out changes the session cookie with its answer, before the root's data names the new
		// person: the cache stays off from the request until the root has reloaded.
		const release =
			url && isAuthRequest(method, url, origin) ? holdLoaderCache() : null
		const pending = browserFetch(input, init)
		if (release) {
			// The cookie may name someone else now, also for the other tabs.
			const settle = () => {
				announceAuthChange()
				releaseAfterRootReload(release, AUTH_ANSWER_GRACE_MS)
			}
			pending.then(settle, settle)
		} else if (url && isWriteRequest(method, url, origin)) {
			pending.then(clearLoaderCache, clearLoaderCache)
		}
		return pending
	}
}
