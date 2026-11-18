import "react"
import "react-dom/server"
import "@remix-run/react"
import "react-router-dom/server.js"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import ts from "typescript"
import "../../../server/title-filter/test-alias.ts"
import type { TalkedRow, TalkedTitle } from "../../../domain/talked-about-now.ts"

const app = new URL("../../../", import.meta.url).href
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(url: string, context: unknown, next: (url: string, context: unknown) => unknown): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		// Keep the start page's unrelated card tree out of this rendering test.
		if (url.endsWith("/living-room/BelowRoom.tsx"))
			return {
				format: "module",
				shortCircuit: true,
				source: "export const startTitleHref = t => `/${t.media_type}/${t.tmdb_id}`",
			}
		if (!url.startsWith(app) || !url.endsWith(".tsx")) return next(url, context)
		return {
			format: "module",
			shortCircuit: true,
			source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ESNext,
					jsx: ts.JsxEmit.ReactJSX,
				},
			}).outputText,
		}
	},
})

const { createElement: h } = await import("react")
const { renderToStaticMarkup } = await import("react-dom/server")
const { StaticRouter } = await import("react-router-dom/server.js")
const { HotPage } = await import("./HotPage.tsx")

const title: TalkedTitle = {
	mediaType: "movie",
	tmdbId: 1,
	title: "Latest ranked movie",
	year: 2026,
	poster: null,
	backdrop: null,
	rank: 1,
	lift: 4,
	views: 4000,
	usual: 1000,
	curve: [1000, 4000],
	reason: null,
	move: null,
	items: [],
}
const row: TalkedRow = { day: "2026-11-17", source: "wikipedia_api", titles: [title] }
const render = (value: TalkedRow | null) =>
	renderToStaticMarkup(h(StaticRouter, { location: "/hot" }, h(HotPage, { row: value })))

test("shows the latest dated ranking when social posts are absent", () => {
	const html = render(row)
	assert.match(html, /Latest ranked movie/)
	assert.match(html, /17 Nov/)
	assert.doesNotMatch(html, /Nothing to show right now|please look again later/)
})

test("keeps ranked titles with no posts alongside titles with recent posts", () => {
	const html = render({
		...row,
		titles: [
			title,
			{
				...title,
				tmdbId: 2,
				title: "Another ranked title",
				rank: 2,
				items: [
					{
						id: "news",
						image: null,
						source: "rss",
						url: "https://example.com/news",
						author: "Writer",
						publisher: "Publisher",
						at: "2026-11-17T10:00:00Z",
						text: "The latest headline",
						sourceId: null,
						english: true,
					},
				],
			},
		],
	})
	assert.match(html, /Latest ranked movie/)
	assert.match(html, /Another ranked title/)
	assert.match(html, /The latest headline/)
	assert.match(html, /No recent posts for this title/)
})

test("shows the available ranking even when its date is older than yesterday", () => {
	const html = render({ ...row, day: "2026-10-13" })
	assert.match(html, /13 Oct/)
	assert.match(html, /Latest ranked movie/)
	assert.doesNotMatch(html, /No ranking is available yet/)
})

test("reserves the empty state for a missing or empty ranking", () => {
	for (const value of [null, { ...row, titles: [] }]) {
		assert.match(render(value), /No ranking is available yet/)
	}
})
