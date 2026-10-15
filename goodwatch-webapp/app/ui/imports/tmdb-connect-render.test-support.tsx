import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { ImportSource, ImportSummary } from "~/domain/imports"
import { setServerAssetBase } from "~/utils/asset-url"
import { SourceImportPreview } from "./SourceImportPreview"
setServerAssetBase(() => "https://static.goodwatch.test")
import { TmdbConnectControls } from "./TmdbConnectPanel"
const render = (state?: string, pending = false, error?: string) =>
	renderToStaticMarkup(
		createElement(TmdbConnectControls, { state, pending, error }),
	)
const preview = (source: ImportSource) => {
	const summary: ImportSummary = {
		id: "preview",
		source,
		fileName: "TMDB account",
		status: "preview",
		createdAt: "2026-10-15T00:00:00Z",
		finishedAt: null,
		counts: {
			rows: 1,
			new: 1,
			unchanged: 0,
			conflict: 0,
			unmatched: 0,
			unsupported: 0,
			invalid: 0,
		},
		kinds: { rating: 1, watch: 0, want: 0, favorite: 0, review: 0 },
		warnings: ["Check ratings"],
		options: null,
		processed: 0,
		total: 1,
		applied: { added: 0, updated: 0, kept: 0, failed: 0 },
		stalled: false,
		canUndo: false,
		error: null,
	}
	return renderToStaticMarkup(
		createElement(SourceImportPreview, {
			summary,
			focus: false,
			confirming: false,
			error: null,
			onConfirm: () => {},
			onBack: () => {},
		}),
	)
}
process.stdout.write(
	`__TMDB_RENDER__${JSON.stringify({ preview: preview("tmdb"), filePreview: preview("csv"), start: render(), returned: render("flow-id"), busy: render("flow-id", true), failed: render("flow-id", false, "Please try again") })}`,
)
