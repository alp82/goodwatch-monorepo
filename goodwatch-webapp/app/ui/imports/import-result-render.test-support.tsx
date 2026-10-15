import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import type { ImportResult, ImportResultTitle } from "~/domain/import-result"
import { ImportResultView } from "./ImportResultView"

const title = (
	tmdbId: number,
	name: string,
	year: number,
	mediaType: "movie" | "show" = "movie",
): ImportResultTitle => ({
	tmdbId,
	mediaType,
	title: name,
	year,
	posterPath: tmdbId === 693134 ? "/dune.jpg" : null,
})
const dune = title(693134, "Dune: Part Two", 2024)
const arrival = title(329865, "Arrival", 2016)
const pastLives = title(666277, "Past Lives", 2023)
const bear = title(136315, "The Bear", 2022, "show")
const anora = title(1064213, "Anora", 2024)
const shogun = title(126308, "Shōgun", 2024, "show")
const parasite = title(496243, "Parasite", 2019)
const row = (
	t: ImportResultTitle | null,
	changes: ImportResult["sections"][number]["rows"][number]["changes"],
) => ({
	key: t ? `${t.mediaType}:${t.tmdbId}` : "row:11",
	title: t,
	changes,
})

const imported: ImportResult = {
	operation: "import",
	titles: 5,
	sections: [
		{
			key: "ratings_added",
			count: 1,
			total: 1,
			rows: [row(dune, [{ type: "rating-added", score: 9 }])],
		},
		{
			key: "ratings_replaced",
			count: 1,
			total: 1,
			rows: [row(arrival, [{ type: "rating-replaced", from: 7, to: 9 }])],
		},
		{
			key: "watches_added",
			count: 5,
			total: 3,
			rows: [
				row(dune, [
					{
						type: "watches-added",
						watches: {
							count: 1,
							first: null,
							last: null,
							firstDay: "2024-03-09",
							lastDay: "2024-03-09",
							undated: 0,
						},
						status: null,
					},
				]),
				row(pastLives, [
					{
						type: "watches-added",
						watches: {
							count: 1,
							first: null,
							last: null,
							firstDay: null,
							lastDay: null,
							undated: 1,
						},
						status: null,
					},
				]),
				row(bear, [
					{
						type: "watches-added",
						watches: {
							count: 3,
							first: { season: 1, episode: 1 },
							last: { season: 1, episode: 3 },
							firstDay: "2023-06-23",
							lastDay: "2023-06-24",
							undated: 0,
						},
						status: { from: null, to: "watching" },
					},
				]),
			],
		},
		{
			key: "want_added",
			count: 1,
			total: 1,
			rows: [row(anora, [{ type: "list-added", list: "Want to See" }])],
		},
		{
			key: "lists_cleared",
			count: 2,
			total: 2,
			rows: [
				row(dune, [
					{
						type: "list-cleared",
						list: "Want to See",
						because: "watched",
						undoRestores: false,
					},
				]),
				row(anora, [
					{
						type: "list-cleared",
						list: "Not interested",
						because: "want",
						undoRestores: false,
					},
				]),
			],
		},
		{
			key: "kept",
			count: 1,
			total: 1,
			rows: [
				row(parasite, [
					{
						type: "kept",
						kind: "rating",
						reason: "Already the same in GoodWatch.",
					},
				]),
			],
		},
		{
			key: "skipped",
			count: 30,
			total: 30,
			rows: [
				row(null, [
					{
						type: "skipped",
						kind: "rating",
						label: "Kurzfilmnacht Vol. 3 (2021)",
						row: 12,
						reason:
							"This title could not be matched uniquely in the GoodWatch catalog.",
					},
				]),
			],
		},
	],
}

const undone: ImportResult = {
	operation: "undo",
	titles: 4,
	sections: [
		{
			key: "not_restored",
			count: 2,
			total: 2,
			rows: [
				row(dune, [{ type: "not-restored", list: "Want to See" }]),
				row(anora, [{ type: "not-restored", list: "Not interested" }]),
			],
		},
		{
			key: "ratings_removed",
			count: 1,
			total: 1,
			rows: [row(dune, [{ type: "rating-removed", score: 9 }])],
		},
		{
			key: "ratings_restored",
			count: 1,
			total: 1,
			rows: [row(arrival, [{ type: "rating-restored", from: 9, to: 7 }])],
		},
		{
			key: "watches_removed",
			count: 3,
			total: 1,
			rows: [
				row(bear, [
					{
						type: "watches-removed",
						watches: {
							count: 3,
							first: { season: 1, episode: 1 },
							last: { season: 1, episode: 3 },
							firstDay: "2023-06-23",
							lastDay: "2023-06-24",
							undated: 0,
						},
						status: { from: "watching", to: null },
					},
				]),
			],
		},
		{
			key: "want_removed",
			count: 1,
			total: 1,
			rows: [row(anora, [{ type: "list-removed", list: "Want to See" }])],
		},
		{
			key: "left",
			count: 1,
			total: 1,
			rows: [row(shogun, [{ type: "left", kind: "rating" }])],
		},
	],
}

const render = (result: ImportResult) =>
	renderToStaticMarkup(
		createElement(
			MemoryRouter,
			null,
			createElement(ImportResultView, {
				result,
				from: "my-movies.csv",
				focus: false,
				putBack: (put) =>
					createElement(
						"button",
						{ type: "button" },
						`put back ${put.title.title} on ${put.list}`,
					),
				more: (section) =>
					createElement("button", { type: "button" }, `more ${section.key}`),
			}),
		),
	)

process.stdout.write(
	`__IMPORT_RESULT_RENDER__${JSON.stringify({ imported: render(imported), undone: render(undone) })}`,
)
