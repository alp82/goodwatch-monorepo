// The wishlist import's preview, rows, and receipt rendered to HTML with synthetic data, for WishlistImport.test.ts.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { importInfo } from "~/domain/imports"
import type { ImportItem, ImportSummary } from "~/domain/imports"
import { SourceItem } from "./SourceImportCounts"
import { SourceImportCurrent } from "./SourceImportCurrent"
import { sourceImportKeys } from "./SourceImportHooks"
import { SourceImportPreview } from "./SourceImportPreview"
import { SourceImportUploadPanel } from "./SourceImportUploadPanel"

const summary = (
	counts: Partial<ImportSummary["counts"]>,
	warnings: string[] = [],
): ImportSummary => {
	const all = {
		new: 0,
		unchanged: 0,
		conflict: 0,
		unmatched: 0,
		unsupported: 0,
		invalid: 0,
		...counts,
	}
	return {
		id: "00000000-0000-4000-8000-0000000000c1",
		source: "wishlist",
		fileName: "watcharr-export.json",
		status: "preview",
		createdAt: "2026-10-18T10:00:00.000Z",
		finishedAt: null,
		counts: { ...all, rows: Object.values(all).reduce((a, b) => a + b, 0) },
		kinds: {
			rating: 0,
			watch: 0,
			want: all.new + all.unchanged + all.conflict + all.unmatched,
			favorite: 0,
			review: 0,
			show_status: 0,
		},
		warnings: warnings.map(importInfo),
		options: null,
		processed: 0,
		total: 0,
		applied: { added: 0, updated: 0, kept: 0, failed: 0 },
		stalled: false,
		canUndo: false,
		error: null,
	}
}

const preview = (item: ImportSummary, confirming = false) =>
	renderToStaticMarkup(
		createElement(
			QueryClientProvider,
			{ client: new QueryClient() },
			createElement(SourceImportPreview, {
				summary: item,
				focus: false,
				confirming,
				error: null,
				onConfirm: () => {},
				onBack: () => {},
			}),
		),
	)

const evidence = (mediaType: "movie" | "show" | "unknown") => ({
	source: "netflix",
	completeness: "partial" as const,
	mediaType,
})
const item = (patch: Partial<ImportItem>): ImportItem => ({
	index: 0,
	key: "wishlist:want:1",
	kind: "want",
	mediaType: "movie",
	title: "Synthetic title",
	year: null,
	tmdbId: null,
	imdbId: null,
	outcome: "unmatched",
	reason: "Synthetic reason.",
	...patch,
})
const row = (value: ImportItem, wishlist: boolean) =>
	renderToStaticMarkup(createElement(SourceItem, { item: value, wishlist }))

const receipt = () => {
	const client = new QueryClient()
	const done: ImportSummary = {
		...summary({ new: 2 }),
		status: "done",
		canUndo: true,
		options: {
			kinds: ["want"],
			conflictChoice: "keep",
			watchDates: "preserve",
		},
	}
	client.setQueryData(sourceImportKeys.detail(done.id), { import: done })
	return renderToStaticMarkup(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(SourceImportCurrent, {
				id: done.id,
				focus: false,
				onUploadAnother: () => {},
			}),
		),
	)
}

process.stdout.write(
	`__WISHLIST_RENDER__${JSON.stringify({
		// A Planned show whose only other data is its season and episode scores (#759 review).
		plannedWithScores: preview({
			...summary({ new: 3 }),
			kinds: {
				rating: 0,
				episode_rating: 2,
				watch: 0,
				want: 1,
				favorite: 0,
				review: 0,
				show_status: 0,
			},
		}),
		watcharrLibrary: preview({
			...summary({ new: 12, conflict: 1 }),
			wishlistRewatchChoiceCount: 1,
			kinds: {
				rating: 2,
				watch: 5,
				want: 1,
				favorite: 0,
				review: 1,
				show_status: 3,
			},
		}),
		mixed: preview(
			summary(
				{ new: 3, unchanged: 1, conflict: 2, unmatched: 1, unsupported: 4 },
				["This file may hold only part of your list."],
			),
		),
		oneSeen: preview(summary({ conflict: 1 })),
		seasonChoice: preview({
			...summary({ conflict: 1 }),
			wishlistShowChoiceCount: 1,
			wishlistRewatchChoiceCount: 0,
		}),
		sourceSeen: preview({
			...summary({ conflict: 1 }),
			wishlistShowChoiceCount: 0,
			wishlistRewatchChoiceCount: 1,
		}),
		nothing: preview(summary({ unchanged: 2, unsupported: 1 })),
		confirming: preview(summary({ new: 1 }), true),
		unknownType: row(
			item({ wishlistEvidence: evidence("unknown"), title: "Dark & Light" }),
			true,
		),
		show: row(
			item({ mediaType: "show", wishlistEvidence: evidence("show") }),
			true,
		),
		matched: row(
			item({
				outcome: "new",
				reason: null,
				tmdbId: 1,
				wishlistEvidence: evidence("movie"),
			}),
			true,
		),
		generalUnmatched: row(item({}), false),
		receipt: receipt(),
		upload: renderToStaticMarkup(
			createElement(
				QueryClientProvider,
				{ client: new QueryClient() },
				createElement(SourceImportUploadPanel, {
					source: "wishlist",
					onPreview: () => {},
				}),
			),
		),
	})}`,
)
