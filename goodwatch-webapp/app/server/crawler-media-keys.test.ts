import "react"
import "react-dom/server"
import "@remix-run/node"
import "@remix-run/react"
import "@tanstack/react-query"
import "isbot"
import ts from "typescript"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

const browseCalls: { page: number; exposure?: boolean }[] = []
const browseViewer = { member: false, rows: false }
Object.assign(globalThis, {
	__browseCalls: browseCalls,
	__browseViewer: browseViewer,
})

const explorerOverlays: { language: string; limit: number }[] = []
Object.assign(globalThis, { __crawlerExplorerOverlays: explorerOverlays })

const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		let source: string | undefined
		if (url.endsWith("/utils/auth.ts"))
			source = "export const getUserIdFromRequest=async()=>null"
		else if (url.endsWith("/server/viewer.server.ts"))
			source =
				'export const getViewerContext=async()=>({viewer:{kind:globalThis.__browseViewer.member?"member":"guest",progress:{interactions:[]}},country:"DE",services:[],forYou:true,language:undefined})'
		else if (url.endsWith("/server/person.server.ts"))
			source = "export const getPersonName=async()=>null"
		else if (url.endsWith("/server/discover-legacy-params.server.ts"))
			source = "export const legacyDiscoverRedirect=async()=>null"
		else if (url.endsWith("/server/discover-results.server.ts"))
			source =
				'export class SnapshotNotLoaded extends Error {}; export const discoverFilterDefaults=()=>({onMyServices:false,notSeenYet:false});export const forYouFromParams=(params)=>params.get("foryou")!=="0";export const getDiscoverResults=async(_ctx,input)=>{globalThis.__browseCalls.push(input);return {sides:globalThis.__browseViewer.rows?{layout:"rows",rows:[]}:null,cards:[{title:"The Matrix",media_type:"movie",tmdb_id:603}],page:input.page,pageSize:40,total:40000}}'
		else if (url.endsWith("/ui/discover/DiscoverPage.tsx"))
			source = "export const DiscoverPage=()=>null"
		else if (url.endsWith("/ui/ErrorPage.tsx"))
			source =
				"export const ErrorPage=()=>null;export const errorPageProps=()=>({status:500})"
		else if (url.endsWith("/routes/api.user-settings.set.tsx"))
			source = "export const useSetUserSettings=()=>({})"
		else if (url.endsWith("/server/media-payload.server.ts"))
			source = `export const presentCatalogLoader=load=>load;export const liveMediaLanguage=async request=>request.headers.get("User-Agent")==="Googlebot"?"en":"fr";export const localizeTitlePayload=async(value,language,_a,_b,options)=>{globalThis.__crawlerExplorerOverlays.push({language,limit:options.maxTitles});return value}`
		else if (url.endsWith("/server/explorer/http.server.ts"))
			source =
				"export const explorerQueryOf=()=>({});export const EXPLORER_OVERLAY_MAX_TITLES=800"
		else if (url.endsWith("/server/explorer/index.server.ts"))
			source = "export class ExplorerUnavailable extends Error {}"
		else if (url.endsWith("/server/explorer/world.server.ts"))
			source = "export const getExplorerWorld=async()=>({maps:[]})"
		else if (url.endsWith("/ui/explorer/ExplorerMap.tsx"))
			source = "export const ExplorerMap=()=>null"
		else if (url.endsWith("/ui/explorer/IslandList.tsx"))
			source = "export const IslandList=()=>null"
		else if (url.endsWith("/ui/explorer/explorer.css"))
			source = 'export default "/explorer.css"'
		else if (
			url.endsWith("/routes/discover.($type).tsx") ||
			url.endsWith("/routes/map.tsx")
		)
			source = readFileSync(new URL(url), "utf8")
		if (source === undefined) return next(url, context)
		return {
			format: "module",
			shortCircuit: true,
			source: ts.transpileModule(source, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ESNext,
					jsx: ts.JsxEmit.ReactJSX,
				},
			}).outputText,
		}
	},
})

const { loader, meta: discoverMeta } = await import(
	"../routes/discover.($type).tsx"
)
const { useDiscoverBrowse } = await import(
	"../ui/discover/useDiscoverBrowse.ts"
)
const { prefetchTitleExtras } = await import("./title-extras-prefetch.ts")
const { movieCollectionQueryKey } = await import("../utils/title-extras.ts")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { createElement } = await import("react")
const { renderToStaticMarkup } = await import("react-dom/server")

test("crawler Discover SSR retains its initial canonical cards under the client's English key", async () => {
	const result = await loader({
		request: new Request("https://goodwatch.test/discover", {
			headers: { "User-Agent": "Googlebot", "Accept-Language": "de-DE" },
		}),
		params: {},
		context: {},
	})
	const data = result instanceof Response ? await result.json() : result
	const initial = data.browse.initial
	assert.match(initial.key, /displayLanguage=en/)
	function Results() {
		const query = initial.key
			.replace(/(?:&)?displayLanguage=en/, "")
			.replace(/(?:&)?foryou=1/, "")
		const found = useDiscoverBrowse({
			query,
			forYou: true,
			member: false,
			guest: undefined,
			initial,
		})
		return createElement(
			"div",
			null,
			found.data?.pages
				.flatMap((page) => page.cards)
				.map((card) => card.title)
				.join(","),
		)
	}
	const html = renderToStaticMarkup(
		createElement(
			QueryClientProvider,
			{ client: new QueryClient() },
			createElement(Results),
		),
	)
	assert.match(html, /The Matrix/)
})

test("crawler movie collection prefetch is canonical and hydrates the English client query", async () => {
	const state = await prefetchTitleExtras({
		genres: [],
		movieSeries: { id: 1, movie_ids: [603] },
		language: undefined,
		budgetMs: 1000,
		lookups: {
			genres: async () => [],
			collection: async () => ({ movies: [{ title: "The Matrix" }] }),
		},
	})
	assert.deepEqual(
		state.queries[0].queryKey,
		movieCollectionQueryKey("1", "603", "en"),
	)
	assert.deepEqual(state.queries[0].state.data, {
		movies: [{ title: "The Matrix" }],
	})
})

const { loader: explorerLoader } = await import("../routes/map.tsx")
test("Explorer SSR uses the live locale without API opt-in and labels initialData consistently; crawlers stay canonical", async () => {
	for (const agent of [
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		"Googlebot",
	]) {
		explorerOverlays.length = 0
		const response = await explorerLoader({
			request: new Request("https://goodwatch.test/map", {
				headers: { "User-Agent": agent, "Accept-Language": "fr-FR" },
			}),
			params: {},
			context: {},
		})
		const data = await response.json()
		assert.equal(data.displayLanguage, agent === "Googlebot" ? "en" : "fr")
		assert.deepEqual(data.world?.maps, [])
		assert.deepEqual(
			explorerOverlays,
			agent === "Googlebot" ? [] : [{ language: "fr", limit: 800 }],
		)
		assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	}
})

test("Discover pagination advances its bounded window and stops at the page cap", async () => {
	for (const page of [2, 3, 6, 12, 250, 251, 999]) {
		const result = await loader({
			request: new Request(
				`https://goodwatch.test/discover?layout=grid&page=${page}`,
				{ headers: { "User-Agent": "Googlebot" } },
			),
			params: {},
			context: {},
		})
		const data = result instanceof Response ? await result.json() : result
		const pages = data.browse.initial.pages
		const tags = discoverMeta({
			data,
			location: new URL(
				`https://goodwatch.test/discover?layout=grid&page=${page}`,
			),
		} as any)
		assert.ok(
			tags.some(
				(tag: any) =>
					tag.rel === "canonical" &&
					tag.href === "https://goodwatch.app/discover",
			),
		)
		const lastPage = Math.min(page, 250)
		assert.equal(pages.at(-1).page, lastPage)
		assert.deepEqual(
			pages.map((p: any) => p.page),
			Array.from(
				{ length: Math.min(lastPage, 5) },
				(_, i) => Math.max(1, lastPage - 4) + i,
			),
		)
		assert.equal(pages.length, Math.min(page, 5))
		function NextPage() {
			const query = data.browse.initial.key
				.replace(/(?:&)?displayLanguage=en/, "")
				.replace(/(?:&)?foryou=1/, "")
			const found = useDiscoverBrowse({
				query,
				forYou: true,
				member: false,
				guest: undefined,
				initial: data.browse.initial,
			})
			assert.equal(found.data?.pageParams.at(-1), lastPage)
			assert.equal(found.hasNextPage, lastPage < 250)
			return null
		}
		renderToStaticMarkup(
			createElement(
				QueryClientProvider,
				{ client: new QueryClient() },
				createElement(NextPage),
			),
		)
	}
})

async function browse(search: string) {
	browseCalls.length = 0
	return loader({
		request: new Request(`https://goodwatch.test/discover?${search}`),
		params: {},
		context: {},
	})
}

test("guests load only the requested window without a page-one probe", async () => {
	browseViewer.member = false
	for (const search of ["page=6", "page=12&layout=grid"]) {
		await browse(search)
		assert.deepEqual(
			browseCalls.map((p) => p.page),
			search.startsWith("page=6") ? [2, 3, 4, 5, 6] : [8, 9, 10, 11, 12],
		)
	}
})

test("members probe side rows without exposure and skip the probe for grids or sides", async () => {
	browseViewer.member = true
	try {
		await browse("page=12")
		assert.deepEqual(
			browseCalls.map((p) => p.page),
			[1, 8, 9, 10, 11, 12],
		)
		assert.equal(browseCalls[0].exposure, false)
		assert.ok(browseCalls.slice(1).every((p) => p.exposure !== false))
		for (const search of [
			"page=12&layout=grid",
			"page=12&side=one",
			"page=12&foryou=0",
		]) {
			await browse(search)
			assert.deepEqual(
				browseCalls.map((p) => p.page),
				[8, 9, 10, 11, 12],
			)
		}
		browseViewer.rows = true
		const result = await browse("page=12")
		const data = result instanceof Response ? await result.json() : result
		assert.deepEqual(
			data.browse.initial?.pages.map((p: any) => p.page),
			[1],
		)
		assert.deepEqual(
			browseCalls.map((p) => p.page),
			[1],
		)
		assert.equal(browseCalls[0].exposure, false)
	} finally {
		browseViewer.member = false
		browseViewer.rows = false
	}
})
