import "react"
import "react-dom/server"
import "@remix-run/react"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import ts from "typescript"
import { stubModules } from "./rating-onboarding.test-support.ts"

stubModules({
	"~/server/browse/places.server":
		"export class PlacesNotReady extends Error{};export const openPlaces=async()=>({})",
	"~/server/top-page.server": "export const loadTopPage=async()=>null",
	"~/ui/top-lists/TopRanking": "export const TopRanking=()=>null",
	"~/navigation/instant-navigation": "export const cachedClientLoader=()=>()=>{}",
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
const route = await import("../routes/$type.top.tsx")
const path = (kind: string, n: number) => `/${kind}/top${n > 1 ? `?page=${n}` : ""}`
const tagsOf = (data: Record<string, unknown>) => route.meta({ data } as any)
const href = (tags: any[], rel: string) => {
	const tag = tags.find((tag) => "rel" in tag && tag.rel === rel)
	return tag && "href" in tag ? tag.href : undefined
}
const robots = (tags: any[]) => tags.find((tag) => tag.name === "robots")?.content

const pageData = (
	kind: string,
	listKind: string,
	page: number,
	extra: Record<string, unknown> = {},
) => ({
	kind,
	listKind,
	published: true,
	heading: "Top movies of all time",
	title: "Top Movies of All Time | GoodWatch",
	description: "",
	page,
	pages: 12,
	total: 3000,
	first: (page - 1) * 250 + 1,
	rows: [],
	canonical: path(listKind, page),
	prev: page > 1 ? path(listKind, page - 1) : undefined,
	next: page < 12 ? path(listKind, page + 1) : undefined,
	...extra,
})

test("Top's paged canonicals and prev/next relations stay on adjacent pages", () => {
	for (const [kind, listKind] of [
		["movie", "movies"],
		["show", "shows"],
	]) {
		for (const page of [1, 2, 3, 12]) {
			const tags = tagsOf(pageData(kind, listKind, page))
			assert.equal(href(tags, "canonical"), `https://goodwatch.app${path(listKind, page)}`)
			assert.equal(
				href(tags, "prev"),
				page > 1 ? `https://goodwatch.app${path(listKind, page - 1)}` : undefined,
			)
			assert.equal(
				href(tags, "next"),
				page < 12 ? `https://goodwatch.app${path(listKind, page + 1)}` : undefined,
			)
			assert.equal(robots(tags), "index, follow")
		}
	}
})

test("Top for movies and shows together, and a filtered Top, are not indexed", () => {
	assert.equal(robots(tagsOf(pageData("all", "all", 1))), "noindex, follow")
	assert.equal(
		robots(
			tagsOf(
				pageData("movie", "movies", 1, {
					published: false,
					canonical: "/movies/top?with=mood:cozy",
				}),
			),
		),
		"noindex, follow",
	)
})
