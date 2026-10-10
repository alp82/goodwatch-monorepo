import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { ImportSummary } from "~/domain/imports"
import { SourceImportPreview } from "./SourceImportPreview"

const summary = (watch: number): ImportSummary => ({
	id: "00000000-0000-4000-8000-000000000001",
	source: "letterboxd",
	fileName: "export.zip",
	status: "preview",
	createdAt: "2026-10-09T10:00:00.000Z",
	finishedAt: null,
	counts: {
		new: 1,
		unchanged: 0,
		conflict: 0,
		unmatched: 0,
		unsupported: 0,
		invalid: 0,
		rows: 1,
	},
	kinds: { rating: 1, watch, want: 0, favorite: 0, review: 0 },
	warnings: [],
	options: null,
	processed: 0,
	total: 0,
	applied: { added: 0, updated: 0, kept: 0, failed: 0 },
	stalled: false,
	canUndo: false,
	error: null,
})

const render = (watch: number, confirming: boolean, error: string | null) =>
	renderToStaticMarkup(
		createElement(SourceImportPreview, {
			summary: summary(watch),
			focus: false,
			confirming,
			error,
			onConfirm: () => {},
			onBack: () => {},
		}),
	)

process.stdout.write(
	`__SOURCE_IMPORT_RENDER__${JSON.stringify({
		ratingOnly: render(0, false, "Preview could not start."),
		withWatches: render(2, true, null),
	})}`,
)
