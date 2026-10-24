import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import {
	IMPORT_RESULT_FIRST_ROWS,
	type ImportResult,
	type ImportResultChange,
	type ImportResultEntry,
	type ImportResultTitle,
	groupImportResult,
	skippedEntry,
} from "~/domain/import-result"
import { ResultRows, ResultSection } from "./ImportResultView"

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
const entry = (
	t: ImportResultTitle,
	change: ImportResultChange,
): ImportResultEntry => ({
	key: `${t.mediaType}:${t.tmdbId}`,
	title: t,
	change,
})
const bearWatches = {
	count: 3,
	first: { season: 1, episode: 1 },
	last: { season: 1, episode: 3 },
	firstDay: "2023-06-23",
	lastDay: "2023-06-24",
	undated: 0,
}
/** The screen gets the first rows of each section, as the API serves them. */
const firstRows = (result: ImportResult): ImportResult => ({
	...result,
	sections: result.sections.map((section) => ({
		...section,
		rows: section.rows.slice(0, IMPORT_RESULT_FIRST_ROWS),
	})),
})

const imported = firstRows(
	groupImportResult("import", [
		entry(dune, { type: "rating-added", score: 9 }),
		entry(dune, {
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
		}),
		entry(dune, {
			type: "list-cleared",
			list: "want_to_see",
			because: "watched",
			undoRestores: false,
		}),
		entry(arrival, { type: "rating-replaced", from: 7, to: 9 }),
		entry(pastLives, {
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
		}),
		entry(bear, {
			type: "watches-added",
			watches: bearWatches,
			status: { from: null, to: "watching" },
		}),
		entry(anora, { type: "list-added", list: "want_to_see" }),
		entry(anora, {
			type: "list-cleared",
			list: "not_interested",
			because: "want",
			undoRestores: false,
		}),
		entry(parasite, {
			type: "kept",
			kind: "rating",
			reason: "Already the same in GoodWatch.",
		}),
		...Array.from({ length: 30 }, (_, i) =>
			skippedEntry(
				11 + i,
				"rating",
				i === 0 ? "Kurzfilmnacht Vol. 3 (2021)" : `Unknown ${i}`,
				"This title could not be matched uniquely in the GoodWatch catalog.",
			),
		),
	]),
)

const undone = firstRows(
	groupImportResult("undo", [
		entry(dune, { type: "not-restored", list: "want_to_see" }),
		entry(dune, { type: "rating-removed", score: 9 }),
		entry(arrival, { type: "rating-restored", from: 9, to: 7 }),
		entry(pastLives, { type: "not-reverted", kind: "rating" }),
		entry(bear, {
			type: "watches-removed",
			watches: bearWatches,
			status: { from: "watching", to: null },
		}),
		entry(anora, { type: "not-restored", list: "not_interested" }),
		entry(anora, { type: "list-removed", list: "want_to_see" }),
		entry(shogun, { type: "left", kind: "rating" }),
	]),
)

/** Every section title by title, as the Done step's folds draw them; Undo's not put back rows with their buttons. */
const render = (result: ImportResult) =>
	renderToStaticMarkup(
		createElement(
			MemoryRouter,
			null,
			...result.sections.map((section) =>
				section.key === "not_restored"
					? createElement(
							"div",
							{ key: section.key },
							createElement("h4", null, `Not put back ${section.count}`),
							createElement(
								"ul",
								null,
								createElement(ResultRows, {
									rows: section.rows,
									putBack: (put) =>
										createElement(
											"button",
											{ type: "button" },
											`put back ${put.title.title} on ${put.list}`,
										),
								}),
							),
						)
					: createElement(ResultSection, {
							key: section.key,
							section,
							more: (item) =>
								createElement("button", { type: "button" }, `more ${item.key}`),
						}),
			),
		),
	)

process.stdout.write(
	`__IMPORT_RESULT_RENDER__${JSON.stringify({ imported: render(imported), undone: render(undone) })}`,
)
