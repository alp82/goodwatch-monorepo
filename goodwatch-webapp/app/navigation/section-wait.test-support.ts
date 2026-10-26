// Run by section-wait.test.ts through vite-node: afterNavigationWork on a minimal browser, timed with real timers.
// Imported before the stubs: libraries in its import graph check for a browser when they load.
const { afterNavigationWork, prefetchPage, watchScrolls } = await import(
	"./instant-navigation"
)

const g = globalThis as Record<string, unknown>
/** The links the warm-up added; finishing them ends the warm-up. */
const links: { loads: (() => void)[] }[] = []
const scrollListeners: (() => void)[] = []
g.window = g
g.CSS = { escape: (s: string) => s }
Object.defineProperty(g, "navigator", {
	value: { connection: { effectiveType: "4g" } },
	configurable: true,
})
g.location = new URL("https://goodwatch.app/movie/1-a")
g.document = {
	visibilityState: "visible",
	head: { appendChild() {} },
	querySelector: () => null,
	createElement: () => {
		const link = {
			loads: [] as (() => void)[],
			setAttribute() {},
			addEventListener(type: string, l: () => void) {
				if (type === "load") link.loads.push(l)
			},
		}
		links.push(link)
		return link
	},
	addEventListener(type: string, listener: () => void) {
		if (type === "scroll") scrollListeners.push(listener)
	},
}
g.addEventListener = (type: string, listener: () => void) => {
	if (type === "scroll") scrollListeners.push(listener)
}
let answer: (() => void) | null = null
g.fetch = () =>
	new Promise((resolve) => {
		answer = () =>
			resolve(
				new Response("{}", { headers: { "content-type": "application/json" } }),
			)
	})
g.__remixManifest = {
	routes: {
		root: { id: "root", module: "/assets/root.js", hasLoader: true },
		"routes/person.$personKey": {
			id: "routes/person.$personKey",
			module: "/assets/person.js",
			hasLoader: true,
		},
	},
}
g.__remixRouteModules = { root: {} }
g.__remixRouter = {
	routes: [
		{
			id: "root",
			path: "/",
			children: [{ id: "routes/person.$personKey", path: "person/:personKey" }],
		},
	],
	state: {
		location: { pathname: "/movie/1-a", search: "", key: "k" },
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const timed = async (prepare: () => void) => {
	const t0 = Date.now()
	let at = -1
	const cancel = afterNavigationWork(() => {
		at = Date.now() - t0
	})
	prepare()
	return {
		wait: async (ms: number) => {
			await sleep(ms)
			return at
		},
		cancel,
	}
}

// 0. A wait before the page watched scrolls (a scroll may have brought the section near): settled conservatively,
// not before 400 ms.
const unwatched = await timed(() => {})
const unwatchedEarly = await unwatched.wait(250)
const unwatchedAt = await unwatched.wait(500)

// 1. Scrolls watched from the start (installLinkIntent), nothing going on: soon.
watchScrolls()
await new Promise((r) => setTimeout(r, 500))
const idle = await timed(() => {})
const idleAt = await idle.wait(600)

// 2. The reader just scrolled: not before 400 ms after the scroll.
const scrolled = await timed(() => {
	for (const l of scrollListeners) l()
})
const scrolledEarly = await scrolled.wait(250)
const scrolledAt = await scrolled.wait(500)

// 3. A page prefetch (its data and its code warm-up) is loading: after it ends.
const busy = await timed(() =>
	prefetchPage(new URL("https://goodwatch.app/person/3-c"), "viewport"),
)
const busyDuring = await busy.wait(800)
;(answer as (() => void) | null)?.()
for (const link of links.splice(0)) for (const l of link.loads) l()
const busyAt = await busy.wait(500)

// 4. A prefetch that doesn't end: at the cap.
const stuck = await timed(() =>
	prefetchPage(new URL("https://goodwatch.app/person/4-d"), "viewport"),
)
const stuckAt = await stuck.wait(3000)

// 5. Cancelled before it ran: never.
const gone = await timed(() => {
	for (const l of scrollListeners) l()
})
gone.cancel()
const goneAt = await gone.wait(700)

console.log(
	`__SECTION_WAIT__${JSON.stringify({ unwatchedEarly, unwatchedAt, idleAt, scrolledEarly, scrolledAt, busyDuring, busyAt, stuckAt, goneAt })}`,
)
export {}
