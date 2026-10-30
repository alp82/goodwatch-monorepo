// Run the real route loaders with session/profile reads replaced; never connect to live services.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"
import {
	GUEST,
	member,
	oldToNew,
	moveResponse,
	type PathViewer,
} from "../domain/member-paths.ts"

async function routeLoader(route: string, viewer: PathViewer) {
	const app = path.resolve("app")
	const user = viewer.kind === "member" ? { id: "session-member" } : null
	const modules: Record<string, string> = {
		"~/utils/auth": `export const getUserIdFromRequest = async () => ${JSON.stringify(user?.id)}; export const getUserFromRequest = async () => (${JSON.stringify(user)}); export const useUser = () => ({})`,
		"~/server/share-lists/view.server": `export const getCachedProfileByUserId = async id => { if (id !== 'session-member') throw Error('wrong user'); return ${JSON.stringify(viewer.kind === "member" ? { handle: viewer.handle } : null)} }`,
		"~/server/media-payload.server":
			"export const presentCatalogLoader = load => load",
		"~/server/taste-portrait/page.server": `export const tastePageViewer = async () => ({userId: ${JSON.stringify(user?.id ?? null)}}); export const loadTastePage = async () => new Response('taste page')`,
		"~/server/cache-identity.server":
			"export const getLocaleFromRequest = () => ({locale: {}})",
		"~/server/smart-titles.server":
			"export const getSmartTitlesForGuest = async () => []; export const getSmartTitlesForUser = async () => []",
		"~/server/user-settings.server":
			"export const prefetchUserSettings = async () => {}",
		"@tanstack/react-query":
			"export class QueryClient {}; export const dehydrate = () => ({})",
		// The list editor's loader (lists.new.tsx): what it reads after the redirect check.
		"~/server/share-lists/prefill.server":
			"export const prefillTitles = async t => t; export const topRatedEntries = async () => []",
		"~/server/share-lists/remix.server":
			"export const getRemixSource = async () => null",
		"~/server/share-lists/titles.server":
			"export const getQuickPicks = async () => []; export const parseTitleKey = () => null; export const resolveCardTitles = async () => []",
		// Watch's movie lists (watch.movies.$list.tsx): the list itself never loads here.
		"~/server/library-list-route.server":
			"export const libraryListLoader = async () => new Response('list')",
		"~/ui/my-library/MyLibraryPage": "export const LibraryListBody = () => null",
		"~/ui/share-card/model":
			"export const LIST_PROMPTS = [{ title: 'Top 5' }]; export const DEFAULT_PROMPT_ID = 'top'; export const DEFAULT_THEME = 'amber'; export const GUEST_BYLINE = 'you'; export const cardDate = () => 'today'; export const listByline = h => '@' + h",
	}
	const result = await build({
		stdin: {
			contents: `export { loader } from './routes/${route}'`,
			resolveDir: app,
		},
		bundle: true,
		write: false,
		platform: "node",
		format: "esm",
		jsx: "transform",
		logOverride: { "import-is-undefined": "silent" },
		alias: { "~": app },
		packages: "external",
		plugins: [
			{
				name: "isolated-redirects",
				setup(builder) {
					builder.onResolve({ filter: /.*/ }, (args) => {
						if (args.path in modules)
							return { path: args.path, namespace: "fixture" }
						// UI imports are discarded with the component; no browser or database code runs.
						if (args.path === "~/ui/settings/paths") return
						if (
							args.path.startsWith("~/ui/") ||
							args.path.startsWith("~/utils/") ||
							args.path === "@remix-run/react" ||
							args.path === "react"
						)
							return { path: args.path, namespace: "fixture" }
					})
					builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
						contents: modules[args.path] ?? "",
					}))
				},
			},
		],
	})
	// A file URL keeps external package imports resolvable from this workspace.
	// Redirect-only loaders have no runtime package imports; quiz needs Remix's json.
	const source = result.outputFiles[0].text
		.replace(
			/from "react\/jsx-runtime"/g,
			`from ${JSON.stringify(import.meta.resolve("react/jsx-runtime"))}`,
		)
		.replace(
			/from "@remix-run\/node"/g,
			`from ${JSON.stringify(import.meta.resolve("@remix-run/node"))}`,
		)
	return (
		await import(
			`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
		)
	).loader
}

const viewers: [string, PathViewer][] = [
	["guest", GUEST],
	["member", member("ana")],
	["no handle", member(null)],
]
const rows: [string, string][] = [
	["my-shows.tsx", "/my-shows"],
	["my-movies.tsx", "/my-movies"],
	["for-you.tsx", "/for-you"],
	["watch-next.tsx", "/watch-next"],
	["wishlist.tsx", "/wishlist"],
	["my-library._index.tsx", "/my-library"],
	["my-library.scores.tsx", "/my-library/scores"],
	["my-library.hidden.tsx", "/my-library/hidden"],
	["settings.hidden.ts", "/settings/hidden"],
	["taste._index.tsx", "/taste"],
	["taste.quiz.tsx", "/taste/quiz"],
	...["want", "seen", "watching", "on-hold", "dropped", "not-rated"].map(
		(slug) =>
			["my-library.$list.tsx", `/my-library/${slug}`] as [string, string],
	),
	...[
		"want",
		"seen",
		"watching",
		"on_hold",
		"dropped",
		"unrated",
		"invalid",
	].map(
		(status) =>
			["my-library._index.tsx", `/my-library?status=${status}`] as [
				string,
				string,
			],
	),
]

for (const [name, viewer] of viewers) {
	for (const [route, address] of rows) {
		test(`${name}: ${address} is wired to the shared redirect map`, async () => {
			const url = new URL(address, "https://goodwatch.app")
			url.searchParams.set("mode", "quick")
			url.searchParams.set("view", "taste")
			url.searchParams.append("tag", "one")
			url.searchParams.append("tag", "two")
			const loader = await routeLoader(route, viewer)
			const response: Response = await loader({
				request: new Request(url),
				params: {},
				context: {},
			})
			const move = oldToNew(url.pathname, url.search, viewer)
			if (!move) {
				assert.equal(
					response.status,
					200,
					"guest and handle-less Taste pages stay real pages",
				)
				assert.equal(response.headers.get("Location"), null)
				return
			}
			const expected = moveResponse(
				route === "wishlist.tsx" && viewer.kind === "guest"
					? { ...move, status: 301, private: false }
					: move,
			)
			assert.equal(response.status, expected.status)
			for (const header of ["Location", "Cache-Control", "Vary"])
				assert.equal(
					response.headers.get(header),
					expected.headers.get(header),
					header,
				)
		})
	}
}

test("Seen kind and old status parameters are carried according to the map", async () => {
	for (const address of [
		"/my-library/seen?type=show&sort=title",
		"/my-library?status=seen&type=movie&sort=title",
		"/my-library/want?type=show&sort=title",
	]) {
		const url = new URL(address, "https://goodwatch.app")
		const loader = await routeLoader(
			url.pathname === "/my-library"
				? "my-library._index.tsx"
				: "my-library.$list.tsx",
			GUEST,
		)
		const response = await loader({
			request: new Request(url),
			params: {},
			context: {},
		})
		assert.equal(response.status, 301)
		assert.equal(
			response.headers.get("Location"),
			oldToNew(url.pathname, url.search, GUEST)?.to,
		)
		assert.equal(response.headers.get("Cache-Control"), null)
	}
})

test("unknown library slugs stay 404", async () => {
	const loader = await routeLoader("my-library.$list.tsx", GUEST)
	await assert.rejects(
		loader({ request: new Request("https://goodwatch.app/my-library/nope") }),
		(error: unknown) => error instanceof Response && error.status === 404,
	)
})

// These routes belong to the Taste builder. Check their wiring and exercise every viewer through the map.
for (const tab of ["seen", "wishlist", "shows"]) {
	test(`profile ${tab}: owner-only moves, with visitor override`, () => {
		const source = readFileSync(
			new URL(`./u.$handle.${tab}.tsx`, import.meta.url),
			"utf8",
		)
		assert.match(source, /ownerKeepsInWatch\(/)
		const ownerRedirect = readFileSync(
			new URL("../server/profile/route.server.ts", import.meta.url),
			"utf8",
		)
		assert.match(
			ownerRedirect,
			/throw moveResponse\(\{ to, status: 302, private: true \}\)/,
		)
		for (const [, viewer] of viewers) {
			const move = oldToNew(`/u/ana/${tab}`, "?sort=title", viewer)
			if (viewer.kind !== "member" || !viewer.handle) assert.equal(move, null)
			else {
				assert.ok(move)
				const response = moveResponse(move)
				assert.equal(response.status, 302)
				assert.equal(
					response.headers.get("Location"),
					`${tab === "seen" ? "/watch/movies/seen" : tab === "wishlist" ? "/watch/movies/wishlist" : "/watch/watching"}?sort=title`,
				)
				assert.equal(response.headers.get("Cache-Control"), "private, no-store")
			}
			assert.equal(oldToNew(`/u/ana/${tab}`, "?as=visitor", viewer), null)
		}
	})
}

test("Taste section fragments survive the next member redirect by browser fragment inheritance", () => {
	for (const section of ["everyone", "fingerprint"]) {
		const source = readFileSync(
			new URL(`./taste.${section}.tsx`, import.meta.url),
			"utf8",
		)
		assert.ok(source.includes(`redirect("/taste#${section}", 301)`))
		const first = oldToNew(`/taste/${section}`, "?view=taste", GUEST)!
		assert.equal(first.to, `/taste?view=taste#${section}`)
		const url = new URL(first.to, "https://goodwatch.app")
		const next = oldToNew(url.pathname, url.search, member("ana"))!
		assert.equal(next.to, "/u/ana?view=taste")
		assert.equal(new URL(next.to, url).hash || url.hash, `#${section}`)
	}
})

test("Lists mine stays with its existing resolver", () => {
	for (const [, viewer] of viewers)
		assert.equal(oldToNew("/lists/mine", "?from=menu", viewer), null)
})

test("the new-list editor lives in the owner's profile; guests and members without a handle keep /lists/new", async () => {
	const cases: [string, string, PathViewer, string | null][] = [
		[
			"lists.new.tsx",
			"/lists/new?remix=abc&share=1",
			member("ana"),
			"/u/ana/lists/new?remix=abc&share=1",
		],
		["lists.new.tsx", "/lists/new?from=ratings", GUEST, null],
		["lists.new.tsx", "/lists/new", member(null), null],
		["u.$handle.lists.new.tsx", "/u/ana/lists/new", member("ana"), null],
		["u.$handle.lists.new.tsx", "/u/Ana/lists/new", member("ana"), null],
		[
			"u.$handle.lists.new.tsx",
			"/u/bo/lists/new?remix=x",
			member("ana"),
			"/u/ana/lists/new?remix=x",
		],
		[
			"u.$handle.lists.new.tsx",
			"/u/ana/lists/new?remix=x",
			member(null),
			"/lists/new?remix=x",
		],
		["u.$handle.lists.new.tsx", "/u/ana/lists/new", GUEST, "/lists/new"],
	]
	for (const [route, address, viewer, to] of cases) {
		const url = new URL(address, "https://goodwatch.app")
		const move = oldToNew(url.pathname, url.search, viewer)
		assert.equal(move?.to ?? null, to, address)
		const loader = await routeLoader(route, viewer)
		const response: Response = await loader({
			request: new Request(url),
			params: { handle: url.pathname.split("/")[2] },
			context: {},
		})
		if (!to) {
			assert.equal(response.status, 200, address)
			continue
		}
		assert.equal(response.status, 302, address)
		assert.equal(response.headers.get("Location"), to, address)
		assert.equal(response.headers.get("Cache-Control"), "private, no-store")
		assert.equal(response.headers.get("Vary"), "Cookie")
	}
})

test("/watch/movies/recent goes to Want to Watch, newest first, for everyone", async () => {
	for (const [, viewer] of viewers) {
		const loader = await routeLoader("watch.movies.$list.tsx", viewer)
		let response: Response
		try {
			response = await loader({
				request: new Request(
					"https://goodwatch.app/watch/movies/recent?sort=title&q=dune",
				),
				params: { list: "recent" },
				context: {},
			})
		} catch (thrown) {
			response = thrown as Response
		}
		assert.equal(response.status, 301)
		assert.equal(
			response.headers.get("Location"),
			"/watch/movies/wishlist?sort=added&q=dune",
		)
		assert.equal(response.headers.get("Cache-Control"), null)
	}
})
