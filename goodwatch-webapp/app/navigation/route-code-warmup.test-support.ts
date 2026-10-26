// Run by route-code-warmup.test.ts through vite-node: prefetchPage on a minimal browser (a router with a title and a
// person route, a manifest, a document that records the links it gets), for a phone's viewport and for a press.
// Imported before the stubs: libraries in its import graph check for a browser when they load.
const { prefetchPage } = await import("./instant-navigation")
const links: { rel: string; href: string; fetchPriority: string }[] = []
const head = {
	appendChild(link: { rel: string; href: string; fetchPriority: string }) {
		links.push(link)
	},
}
const routes = {
	root: {
		id: "root",
		module: "/assets/root.js",
		imports: ["/assets/shell.js"],
		hasLoader: true,
	},
	"routes/movie.$movieKey": {
		id: "routes/movie.$movieKey",
		module: "/assets/movie.js",
		imports: ["/assets/details.js", "/assets/shell.js"],
		hasLoader: true,
	},
	"routes/person.$personKey": {
		id: "routes/person.$personKey",
		module: "/assets/person.js",
		imports: ["/assets/person-parts.js"],
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
g.window = g
g.CSS = { escape: (s: string) => s }
Object.defineProperty(g, "navigator", { value: {}, configurable: true })
g.location = new URL("https://goodwatch.app/movies/best")
g.document = {
	visibilityState: "visible",
	head,
	querySelector: () => null,
	createElement: () => ({
		rel: "",
		href: "",
		as: "",
		fetchPriority: "",
		setAttribute(name: string, value: string) {
			;(this as unknown as Record<string, string>)[
				name === "fetchpriority" ? "fetchPriority" : name
			] = value
		},
	}),
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
const snapshot = () =>
	links.map((l) => `${l.rel} ${l.href} ${l.fetchPriority || "auto"}`)
prefetchPage(new URL("https://goodwatch.app/movie/1-a"), "viewport")
prefetchPage(new URL("https://goodwatch.app/movie/2-b"), "viewport")
const viewport = snapshot()
prefetchPage(new URL("https://goodwatch.app/movie/2-b"), "press")
const afterPress = snapshot()
prefetchPage(new URL("https://goodwatch.app/person/3-c"), "press")
console.log(
	`__WARMUP__${JSON.stringify({ viewport, afterPress, all: snapshot() })}`,
)

export {}
