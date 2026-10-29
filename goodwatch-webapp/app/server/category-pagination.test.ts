import "react"
import "react-dom/server"
import "@remix-run/react"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import ts from "typescript"
import { stubModules } from "./rating-onboarding.test-support.ts"

const state = {
	page: 1,
	userId: null as string | null,
	results: [{ tmdb_id: 603 }],
	data: {} as any,
	grid: {} as any,
}
Object.assign(globalThis, { __categoryPagination: state })
stubModules({
	"~/server/best-lists.server":
		"export const getRankedList=async()=>({titles:[],popular:[]})",
	"~/server/row-services.server": "export const rowServices=async()=>null",
	"~/ui/best-lists/ListHead": "export const ListHead=()=>null",
	"~/ui/best-lists/RankedTitles":
		"export const ListPageLinks=()=>null;export const RankedTitles=()=>null",
	"~/server/discover.server":
		"export const getDiscoverResults=async()=>globalThis.__categoryPagination.results",
	"~/utils/discover":
		"export const buildDiscoverParams=async()=>({page:globalThis.__categoryPagination.page,userId:globalThis.__categoryPagination.userId})",
	"~/server/media-payload.server":
		"export const presentCatalogLoader=load=>load",
	"~/navigation/instant-navigation":
		"export const cachedClientLoader=()=>()=>{}",
	"~/utils/navigation":
		"export const useNav=()=>({currentParams:{},updateQueryParams:()=>{}})",
	"~/ui/explore/MovieTvGrid":
		"export default function Grid(props){globalThis.__categoryPagination.grid=props;return null}",
	"~/ui/explore/FAQ": "export default ()=>null",
	"~/ui/nav/Breadcrumbs": "export default ()=>null",
	"~/ui/filter/explore/DidntWatchCheckbox":
		"export const DidntWatchCheckbox=()=>null",
	"~/ui/filter/explore/MyStreamingCheckbox":
		"export const MyStreamingCheckbox=()=>null",
	"@remix-run/react":
		"export const useLoaderData=()=>globalThis.__categoryPagination.data;export const useLocation=()=>({pathname:'/movies/moods/scary',search:'?country=DE&page='+globalThis.__categoryPagination.page});export const Link=({to,prefetch,...props})=>globalThis.__paginationElement('a',{href:to,...props})",
	"~/routes/api.discover":
		"export const useDiscover=({initialData})=>({data:initialData,hasNextPage:true,isPending:false,isError:false})",
	"~/ui/MovieTvCard": "export const MovieTvCard=()=>null",
	"~/ui/wait/Spinner": "export const Spinner=()=>null",
	"~/hooks/usePageTracking": "export const usePageTracking=()=>{}",
	"~/ui/explore/GridUtils":
		"export const GridLoadingIndicator=()=>null;export const GridError=()=>null;export const EmptyResultsMessage=()=>null;export const EndOfResultsMessage=()=>null;export const LoadMoreIndicator=()=>null;export const NextPageLink=({url})=>{globalThis.__categoryPagination.next=url;return null}",
	"react-intersection-observer":
		"export const useInView=()=>({ref:()=>{},inView:false})",
})
const { registerHooks } = nodeModule as any
registerHooks({
	load(url: string, context: unknown, next: any) {
		if (!url.includes("/node_modules/") && url.endsWith(".tsx"))
			return {
				format: "module",
				shortCircuit: true,
				source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						jsx: ts.JsxEmit.ReactJSX,
					},
				}).outputText,
			}
		return next(url, context)
	},
})
const route = await import("../routes/$type.$category.$page.tsx")
const { default: Grid } = await import("../ui/explore/MovieTvGrid.tsx")
const { createElement } = await import("react")
const { renderToStaticMarkup } = await import("react-dom/server")
Object.assign(globalThis, { __paginationElement: createElement })
const { NextPageLink } = await import("../ui/explore/GridUtils.tsx")

test("category SSR seeds the requested page and advances its crawler link, keeping the paged canonical", async () => {
	for (const page of [1, 2, 3, 12]) {
		state.page = page
		state.userId = null
		state.results = [{ tmdb_id: 603 }]
		const location = new URL(
			`https://goodwatch.test/movies/moods/scary?country=DE&page=${page}`,
		)
		state.data = await route.loader({
			request: new Request(location),
			params: { type: "movies", category: "moods", page: "scary" },
			context: {},
		})
		renderToStaticMarkup(createElement(route.default))
		assert.deepEqual(state.grid.initialData.pageParams, [page])
		renderToStaticMarkup(createElement(Grid, state.grid))
		assert.equal(
			(globalThis as any).__categoryPagination.next,
			`/movies/moods/scary?country=DE&page=${page + 1}`,
		)
		const meta = route.meta({
			params: { type: "movies", category: "moods", page: "scary" },
			location,
		} as any)
		assert.ok(
			meta.some(
				(tag: any) =>
					tag.rel === "canonical" &&
					tag.href ===
						`https://goodwatch.app/movies/moods/scary${page > 1 ? `?page=${page}` : ""}`,
			),
		)
	}
})

test("the category route rejects empty guest pages but serves member exclusions", async () => {
	state.page = 3
	state.results = []
	const args = {
		request: new Request("https://goodwatch.test/movies/moods/scary?page=3"),
		params: { type: "movies", category: "moods", page: "scary" },
		context: {},
	}
	state.userId = null
	await assert.rejects(
		() => route.loader(args),
		(error: unknown) => error instanceof Response && error.status === 404,
	)
	state.userId = "member-id"
	assert.deepEqual(((await route.loader(args)) as any).results, [])
})

test("the crawler anchor declares rel next and omits itself at the end", () => {
	const html = renderToStaticMarkup(
		createElement(NextPageLink, { url: "/movies/moods/scary?page=4" }),
	)
	assert.match(html, /href="\/movies\/moods\/scary\?page=4"/)
	assert.match(html, /rel="next"/)
	assert.equal(
		renderToStaticMarkup(createElement(NextPageLink, { url: null })),
		"",
	)
})

test("best-list paged canonicals and prev/next relations stay on adjacent pages", async () => {
	const best = await import("../routes/$type.best.tsx")
	for (const kind of ["movies", "shows"]) {
		for (const page of [1, 2, 3, 12]) {
			const tags = best.meta({
				data: {
					kind,
					page,
					pages: 12,
					total: 3000,
					popular: [],
					first: (page - 1) * 250 + 1,
					titles: [],
				},
			} as any)
			const href = (rel: string) => {
				const tag = tags.find((tag) => "rel" in tag && tag.rel === rel)
				return tag && "href" in tag ? tag.href : undefined
			}
			const path = (n: number) => `/${kind}/best${n > 1 ? `?page=${n}` : ""}`
			assert.equal(href("canonical"), `https://goodwatch.app${path(page)}`)
			assert.equal(
				href("prev"),
				page > 1 ? `https://goodwatch.app${path(page - 1)}` : undefined,
			)
			assert.equal(
				href("next"),
				page < 12 ? `https://goodwatch.app${path(page + 1)}` : undefined,
			)
		}
	}
})
