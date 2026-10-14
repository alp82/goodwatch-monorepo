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
				'export const getViewerContext=async()=>({viewer:{kind:"guest",progress:{interactions:[]}},country:"DE",services:[],forYou:true,language:undefined})'
		else if (url.endsWith("/server/person.server.ts"))
			source = "export const getPersonName=async()=>null"
		else if (url.endsWith("/server/discover-legacy-params.server.ts"))
			source = "export const legacyDiscoverRedirect=async()=>null"
		else if (url.endsWith("/server/discover-results.server.ts"))
			source =
				'export class SnapshotNotLoaded extends Error {}; export const discoverFilterDefaults=()=>({onMyServices:false,notSeenYet:false});export const forYouFromParams=()=>true;export const getDiscoverResults=async()=>({cards:[{title:"The Matrix",media_type:"movie",tmdb_id:603}],page:1,pageSize:40,total:1})'
		else if (url.endsWith("/ui/discover/DiscoverPage.tsx"))
			source = "export const DiscoverPage=()=>null"
		else if (url.endsWith("/routes/api.user-settings.set.tsx"))
			source = "export const useSetUserSettings=()=>({})"
		else if (url.endsWith("/server/media-payload.server.ts"))
			source = `export const presentCatalogLoader=load=>load;export const liveMediaLanguage=async request=>request.headers.get("User-Agent")==="Googlebot"?"en":"fr";export const localizeTitlePayload=async(value,language,_a,_b,options)=>{globalThis.__crawlerExplorerOverlays.push({language,limit:options.maxTitles});return value}`
		else if (url.endsWith("/server/explorer/http.server.ts"))
			source =
				"export const explorerQueryOf=()=>({});export const EXPLORER_OVERLAY_MAX_TITLES=200"
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
			url.endsWith("/routes/explorer.tsx")
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

const { loader } = await import("../routes/discover.($type).tsx")
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

const { loader: explorerLoader } = await import("../routes/explorer.tsx")
test("Explorer SSR uses the live locale without API opt-in and labels initialData consistently; crawlers stay canonical", async () => {
	for (const agent of [
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		"Googlebot",
	]) {
		explorerOverlays.length = 0
		const response = await explorerLoader({
			request: new Request("https://goodwatch.test/explorer", {
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
			agent === "Googlebot" ? [] : [{ language: "fr", limit: 200 }],
		)
		assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	}
})
