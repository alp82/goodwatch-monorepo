// The browser side of instant page changes (docs/navigation-cache.md): the catalog routes' `clientLoader`, our own
// data prefetch, and what clears the cache. The rules of the cache itself are in loader-cache.ts.
//
// The first load of a page never comes from here. A `clientLoader` without `hydrate` doesn't run on hydration, so
// the server renders every document as before, for crawlers and browsers alike.
import { type ClientLoaderFunctionArgs, matchRoutes } from "@remix-run/react"
import { preloadHeroBackdrop } from "~/ui/details/hero/hero-backdrop"
import { keptLoaderData } from "~/utils/loader-request-retry"
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
	isWriteRequest,
	navigationKind,
	readLoaderResponse,
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
		fetchers: Map<string, { state: string; formMethod?: string }>
	}
	subscribe(listener: (state: RemixRouter["state"]) => void): () => void
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

/** Drops every kept page and every load under way. Call it after anything that may change what a page shows. */
export function clearLoaderCache(): void {
	cache.clear()
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
		const identity = currentIdentity()
		if (!identity) return serverLoader()
		const url = new URL(request.url)
		const key = cacheKey(identity, routeId, url)
		const kind = navigationKind(
			remix().__remixRouter?.state,
			url,
			(window.history.state as { key?: string } | null)?.key,
		)
		const found = cache.lookup(key, kind)
		if (found.kind === "hit") {
			noteUse(found.source)
			if (found.refresh) refresh(url, routeId, key)
			return found.data
		}
		if (found.kind === "pending") {
			const loaded = await found.promise.catch(() => null)
			if (loaded?.ok) {
				noteUse(found.source)
				return loaded.data
			}
		}
		stats.misses++
		request.signal.throwIfAborted()
		const loaded = await cache
			.load(key, "navigation", () =>
				fetchRouteData(url, routeId, { signal: request.signal }),
			)
			.catch((error: unknown) => {
				if (request.signal.aborted) throw error
				return null
			})
		if (loaded?.ok) return loaded.data
		return serverLoader()
	}
}

function refresh(url: URL, routeId: string, key: string) {
	queue.request({
		key,
		priority: "viewport",
		run: () =>
			cache.load(key, "refresh", () =>
				fetchRouteData(url, routeId, { priority: "low" }),
			),
	})
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
	if (!router || document.visibilityState === "hidden") return
	if (trigger !== "press" && saveData()) return
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
				if (cache.covered(key)) return Promise.resolve()
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
	router.subscribe((state) => {
		const next = invalidation(identity, state)
		identity = next.identity
		if (next.clear) cache.clear()
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
		const pending = browserFetch(input, init)
		if (url && isWriteRequest(method, url, origin)) {
			const clear = () => cache.clear()
			pending.then(clear, clear)
		}
		return pending
	}
}
