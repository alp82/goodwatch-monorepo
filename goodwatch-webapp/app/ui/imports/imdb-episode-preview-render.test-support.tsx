// Renders the IMDb ratings preview of a file with episode rows (#759), for ImdbList.test.ts.
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { ImdbImportSummary } from "~/domain/imdb-import"
import { ImdbImportPreview } from "./ImdbImportPreview"

const summary = (episodes?: number): ImdbImportSummary => ({
	id: "5b0c8f0e-7d0a-4c53-9f6b-0d1f1f6a2a10",
	status: "preview",
	fileName: "ratings.csv",
	createdAt: "2026-10-24T12:00:00.000Z",
	finishedAt: null,
	counts: {
		rows: 4,
		new: 2,
		update: 0,
		unchanged: 0,
		conflict: 1,
		unmatched: 1,
		unsupported: 0,
		invalid: 0,
		...(episodes === undefined ? {} : { episodes }),
	},
	conflictChoice: null,
	processed: 0,
	total: 0,
	applied: { added: 0, updated: 0, kept: 0, failed: 0 },
	withoutFingerprint: null,
	stalled: false,
	canUndo: false,
	error: null,
})
const render = (episodes?: number) =>
	renderToStaticMarkup(
		createElement(ImdbImportPreview, {
			summary: summary(episodes),
			focus: false,
			confirming: false,
			error: null,
			onConfirm: () => {},
			onBack: () => {},
		}),
	)
console.log(
	`__IMDB_EPISODES__${JSON.stringify({ two: render(2), one: render(1), none: render() })}`,
)
