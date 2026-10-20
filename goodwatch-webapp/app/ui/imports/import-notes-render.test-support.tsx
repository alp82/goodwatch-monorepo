import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { IMPORT_SOURCES, type ImportSource } from "~/domain/imports"
import { SourceImportPreview } from "./SourceImportPreview"

const render = (source: ImportSource, warnings: string[]) =>
	renderToStaticMarkup(
		createElement(
			QueryClientProvider,
			{ client: new QueryClient() },
			createElement(SourceImportPreview, {
				summary: {
					id: "notes",
					source,
					fileName: "export.zip",
					warnings,
					kinds: {
						watch: 0,
						rating: 1,
						want: 0,
						favorite: 0,
						review: 0,
						show_status: 0,
					},
					counts: {
						rows: 1,
						new: 1,
						unchanged: 0,
						conflict: 0,
						unmatched: 0,
						invalid: 0,
						unsupported: 0,
					},
					status: "preview",
					createdAt: "2026-10-20T10:00:00Z",
					finishedAt: null,
					options: null,
					processed: 0,
					total: 1,
					applied: { added: 0, updated: 0, kept: 0, failed: 0 },
					stalled: false,
					canUndo: false,
					error: null,
				},
				focus: false,
				confirming: false,
				error: null,
				onBack() {},
				onConfirm() {},
			}),
		),
	)
process.stdout.write(
	`__NOTES__${JSON.stringify(
		Object.fromEntries(
			IMPORT_SOURCES.map((source) => [
				source,
				{
					empty: render(source, []),
					short: render(source, ["One note"]),
					long: render(
						source,
						Array.from({ length: 52 }, (_, i) => `Export detail ${i + 1}`),
					),
				},
			]),
		),
	)}`,
)
