import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type ReactNode, createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import type { ImportResult } from "~/domain/import-result"
import { importInfo } from "~/domain/imports"
import type { FileImportSource, ImportSummary } from "~/domain/imports"
import { ImportDone } from "./ImportDone"
import { SourceImportChoose } from "./SourceImportChoose"
import { SourceItem } from "./SourceImportCounts"
import { SourceImportCurrent } from "./SourceImportCurrent"
import { sourceImportKeys } from "./SourceImportHooks"
import { SourceImportUploadPanel } from "./SourceImportUploadPanel"

/** The app's query cache and router around a part of the flow. */
const inApp = (child: ReactNode, client = new QueryClient()) =>
	createElement(
		QueryClientProvider,
		{ client },
		createElement(MemoryRouter, null, child),
	)

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
	patch: Partial<ImportSummary> = {},
) =>
	renderToStaticMarkup(
		inApp(
			createElement(SourceImportChoose, {
				summary: { ...summary(watch, showStatuses), ...patch },
				focus: false,
				confirming,
				error,
				onConfirm: () => {},
				onBack: () => {},
				posters: [],
			}),
		),
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
				"Each entry's score is kept for its own episodes, such as S1 E1–12, and never becomes a rating of the whole show.",
			),
		],
	}
	client.setQueryData(sourceImportKeys.detail(item.id), { import: item })
	client.setQueryData(["import-result", "/api/imports", item.id, "done"], {
		operation: "import",
		titles: 0,
		sections: [],
	} satisfies ImportResult)
	return renderToStaticMarkup(
		inApp(
			createElement(SourceImportCurrent, {
				id: item.id,
				focus: false,
				onUploadAnother: () => {},
			}),
			client,
		),
	)
}

const listPreview = () =>
	renderToStaticMarkup(
		inApp(
			createElement(SourceImportChoose, {
				summary: {
					...summary(0),
					kinds: { ...summary(0).kinds, rating: 0, list: 1 },
				},
				focus: false,
				confirming: false,
				error: null,
				onConfirm: () => {},
				onBack: () => {},
				posters: [],
			}),
		),
	)
const listDetails = (kept = false) =>
	renderToStaticMarkup(
		createElement(SourceItem, {
			item: {
				key: "list:source",
				applyState: kept ? "undone" : "added",
				kind: "list",
				index: 0,
				title: "Source list",
				mediaType: "movie",
				year: null,
				tmdbId: null,
				imdbId: null,
				outcome: "new",
				reason: null,
				customList: {
					sourceId: "source",
					name: "Source list",
					description: "A list description",
					createdId: "AbCd012345",
					...(kept
						? { undoReason: "This list changed after import. Undo kept it." }
						: {}),
					entries: [
						{
							position: 2,
							note: "A list note, not a review.",
							entry: {
								key: "entry",
								kind: "want",
								title: "Synthetic title",
								year: 2000,
								mediaType: "movie",
								tmdbId: 862,
								imdbId: null,
							},
						},
					],
				},
			},
		}),
	)
const listReceipt = (kept = false) => {
	const client = new QueryClient()
	const status = kept ? "undone" : "done"
	client.setQueryData(["import-result", "/api/imports", "list-id", status], {
		operation: kept ? "undo" : "import",
		titles: 0,
		sections: [],
		customLists: kept
			? { created: 0, deleted: 0, notRestored: 1 }
			: { created: 1, deleted: 0 },
	} satisfies ImportResult)
	return renderToStaticMarkup(
		inApp(
			createElement(ImportDone, {
				api: "/api/imports",
				summary: { id: "list-id", status, canUndo: !kept },
				source: "Letterboxd",
				posters: [],
				focus: false,
				openedHere: true,
				undo: { pending: false, error: null, run: () => {} },
				undoQuestion: "Undo this import?",
				onUploadAnother: () => {},
				skippedUrl: "/skipped",
				notes: ["Letterboxd", ""],
			}),
			client,
		),
	)
}
process.stdout.write(
	`__SOURCE_IMPORT_RENDER__${JSON.stringify({
		listReceipt: listReceipt(),
		keptListReceipt: listReceipt(true),
		keptListDetails: listDetails(true),
		listPreview: listPreview(),
		listDetails: listDetails(),
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
		plexWatches: render(2, false, null, 0, { source: "plex" }),
		plexSeasonScore: renderToStaticMarkup(
			createElement(SourceItem, {
				item: {
					index: 0,
					key: "plex:rating:synthetic:1",
					kind: "unsupported",
					title: "Synthetic show",
					mediaType: "show",
					year: null,
					tmdbId: 1,
					imdbId: null,
					season: 4,
					score: 8.5,
					outcome: "unsupported",
					reason:
						"Season and episode scores are kept here, not applied as whole-show ratings.",
				},
			}),
		),
		freshWatches: render(2, false, null),
		mdblistShowChoice: render(2, false, null, 0, {
			source: "mdblist",
			fileName: "MDBList account",
			kinds: {
				rating: 1,
				watch: 2,
				want: 2,
				favorite: 0,
				review: 0,
				show_status: 0,
			},
			wishlistShowChoiceCount: 1,
		}),
	})}`,
)
