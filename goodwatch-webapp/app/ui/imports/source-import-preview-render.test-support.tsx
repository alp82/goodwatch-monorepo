import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { importInfo } from "~/domain/imports"
import type { FileImportSource, ImportSummary } from "~/domain/imports"
import { SourceImportCurrent } from "./SourceImportCurrent"
import { sourceImportKeys } from "./SourceImportHooks"
import { SourceImportPreview } from "./SourceImportPreview"
import { SourceImportUploadPanel } from "./SourceImportUploadPanel"

const summary = (watch: number, showStatuses = 0): ImportSummary => ({
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
	kinds: {
		rating: 1,
		watch,
		want: 0,
		favorite: 0,
		review: 0,
		show_status: showStatuses,
	},
	warnings: [],
	options: null,
	processed: 0,
	total: 0,
	applied: { added: 0, updated: 0, kept: 0, failed: 0 },
	stalled: false,
	canUndo: false,
	error: null,
})

const render = (
	watch: number,
	confirming: boolean,
	error: string | null,
	showStatuses = 0,
) =>
	renderToStaticMarkup(
		createElement(SourceImportPreview, {
			summary: summary(watch, showStatuses),
			focus: false,
			confirming,
			error,
			onConfirm: () => {},
			onBack: () => {},
		}),
	)

const upload = (source: FileImportSource) =>
	renderToStaticMarkup(
		createElement(
			QueryClientProvider,
			{ client: new QueryClient() },
			createElement(SourceImportUploadPanel, { source, onPreview: () => {} }),
		),
	)

const receipt = () => {
	const client = new QueryClient()
	const item: ImportSummary = {
		...summary(2),
		source: "myanimelist",
		status: "done",
		warnings: [
			importInfo("Comments and tags are not imported."),
			importInfo(
				"Season scores are kept for later and not applied as show ratings.",
			),
		],
	}
	client.setQueryData(sourceImportKeys.detail(item.id), { import: item })
	return renderToStaticMarkup(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(SourceImportCurrent, {
				id: item.id,
				focus: false,
				onUploadAnother: () => {},
			}),
		),
	)
}

process.stdout.write(
	`__SOURCE_IMPORT_RENDER__${JSON.stringify({
		letterboxdUpload: upload("letterboxd"),
		traktUpload: upload("trakt"),
		csvUpload: upload("csv"),
		movielensUpload: upload("movielens"),
		kodiUpload: upload("kodi"),
		malUpload: upload("myanimelist"),
		malReceipt: receipt(),
		ratingOnly: render(0, false, "Preview could not start."),
		statusOnly: render(0, false, null, 3),
		withWatches: render(2, true, null),
	})}`,
)
