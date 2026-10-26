// Run by route-code-warmup.test.ts through vite-node: prefetchPage on a minimal browser (a router with a title and a
// person route, a manifest, a document that records the links it gets and lets the test finish their loads).
// Imported before the stubs: libraries in its import graph check for a browser when they load.
const { prefetchPage } = await import("./instant-navigation")

type FakeLink = {
	rel: string
	href: string
	fetchPriority: string
	onload: (() => void) | null
	onerror: (() => void) | null
	setAttribute(name: string, value: string): void
	addEventListener(type: string, listener: () => void): void
}
const links: FakeLink[] = []
const head = {
	appendChild(link: FakeLink) {
		links.push(link)
	},
}
const files = (name: string, n: number) =>
	Array.from({ length: n }, (_, i) => `/assets/${name}-${i}.js`)
const routes = {
	root: { id: "root", module: "/assets/root.js", imports: [], hasLoader: true },
	"routes/movie.$movieKey": {
		id: "routes/movie.$movieKey",
		module: "/assets/movie.js",
		imports: files("details", 5),
		hasLoader: true,
	},
	"routes/person.$personKey": {
		id: "routes/person.$personKey",
		module: "/assets/person.js",
		imports: files("person-parts", 1),
		hasLoader: true,
	},
}
const routerRoutes = [
	{
		id: "root",
		path: "/",
		children: [
			{ id: "routes/movie.$movieKey", path: "movie/:movieKey" },
			{ id: "routes/person.$personKey", path: "person/:personKey" },
		],
	},
]
const g = globalThis as Record<string, unknown>
const connection = { effectiveType: "4g", saveData: false }
g.window = g
g.CSS = { escape: (s: string) => s }
Object.defineProperty(g, "navigator", {
	value: { connection },
	configurable: true,
})
const setPath = (pathname: string) => {
	g.location = new URL(`https://goodwatch.app${pathname}`)
	;(
		g.__remixRouter as { state: { location: { pathname: string } } }
	).state.location.pathname = pathname
}
g.document = {
	visibilityState: "visible",
	head,
	querySelector: () => null,
	createElement: (): FakeLink => {
		const listeners: Record<string, (() => void)[]> = {}
		return {
			rel: "",
			href: "",
			fetchPriority: "",
			onload: null,
			onerror: null,
			setAttribute(name: string, value: string) {
				;(this as unknown as Record<string, string>)[
					name === "fetchpriority" ? "fetchPriority" : name
				] = value
			},
			addEventListener(type: string, listener: () => void) {
				listeners[type] = [...(listeners[type] ?? []), listener]
				;(this as unknown as Record<string, unknown>)[`_${type}`] =
					listeners[type]
			},
		}
	},
	addEventListener() {},
}
g.addEventListener = () => {}
g.fetch = () => new Promise(() => {})
g.__remixManifest = { routes }
g.__remixRouteModules = { root: {} }
g.__remixRouter = {
	routes: routerRoutes,
	state: {
		location: { pathname: "/movies/best", search: "", key: "k" },
		matches: [{ pathname: "/", params: {}, route: { id: "root" } }],
		loaderData: {
			root: { user: null, locale: { country: "US", language: "en" } },
		},
		errors: null,
		navigation: { state: "idle" },
		revalidation: "idle",
		fetchers: new Map(),
	},
	subscribe: () => () => {},
	revalidate() {},
}
setPath("/movies/best")

const snapshot = () =>
	links.map((l) => `${l.href} ${l.fetchPriority || "auto"}`)
/** Finishes the load of the oldest link still loading. */
const finishOne = () => {
	const link = links.find((l) => !(l as unknown as { done?: boolean }).done)
	if (!link) return
	;(link as unknown as { done: boolean }).done = true
	for (const listener of (link as unknown as { _load?: (() => void)[] })
		._load ?? [])
		listener()
}

// A best list on a phone: two title links on screen.
prefetchPage(new URL("https://goodwatch.app/movie/1-a"), "viewport")
prefetchPage(new URL("https://goodwatch.app/movie/2-b"), "viewport")
const first = snapshot()
finishOne()
const afterOneLoad = snapshot()
// The reader presses a title link while two warm-up files are loading and three still wait.
prefetchPage(new URL("https://goodwatch.app/movie/2-b"), "press")
const afterPress = snapshot()
const warmLinks = links.length

// The start page: the section below the room shows title links when the reader scrolls there.
setPath("/")
prefetchPage(new URL("https://goodwatch.app/person/3-c"), "viewport")
const startPage = snapshot().slice(warmLinks)

// A 3G connection elsewhere: no code warm-up either.
setPath("/movies/best")
connection.effectiveType = "3g"
prefetchPage(new URL("https://goodwatch.app/person/3-c"), "viewport")
const slow = snapshot().slice(warmLinks)

console.log(
	`__WARMUP__${JSON.stringify({ first, afterOneLoad, afterPress, startPage, slow })}`,
)

export {}
