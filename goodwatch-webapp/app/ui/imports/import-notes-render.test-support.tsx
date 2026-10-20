import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
	IMPORT_SOURCES,
	type ImportSource,
	type ImportWarning,
	importActionable,
	importInfo,
} from "~/domain/imports"
import { parseImportFile } from "../../server/imports/files.server"
import { threeUnreachableServersWithFeed } from "../../server/imports/plex-unreachable-fixture.test-support"
import { officialAncillaryFiles } from "../../server/imports/tvtime-official-archive.test-support"
import { zipFixture } from "../../server/imports/zip-fixture.test-support"
import { SourceImportPreview } from "./SourceImportPreview"

const render = (source: ImportSource, warnings: ImportWarning[]) =>
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
const plex = await threeUnreachableServersWithFeed()
const tvtime = await parseImportFile(
	"tvtime",
	zipFixture({
		"tracking-prod-records-v2.csv":
			"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-a,100,200,1,1,0001-01-01\n",
		"episodes.csv": "Unrecognized history layout",
		...Object.fromEntries(
			officialAncillaryFiles.map((name) => [name, 'Never parse this,"broken']),
		),
	}),
)
process.stdout.write(
	`__TVTIME_NOTES__${JSON.stringify({ mixed: render("tvtime", tvtime.warnings) })}__END_TVTIME__`,
)
process.stdout.write(
	`__PLEX_NOTES__${JSON.stringify({ mixed: render("plex", plex.warnings) })}__END_PLEX__`,
)
process.stdout.write(
	`__NOTES__${JSON.stringify(
		Object.fromEntries(
			IMPORT_SOURCES.map((source) => [
				source,
				{
					empty: render(source, []),
					short: render(source, [importInfo("One note")]),
					mixed: render(source, [
						...Array.from({ length: 52 }, (_, i) =>
							importInfo(`Export detail ${i + 1}`),
						),
						...Array.from({ length: 4 }, (_, i) =>
							importActionable(`Reconnect source ${i + 1}`),
						),
					]),
					long: render(
						source,
						Array.from({ length: 52 }, (_, i) =>
							importInfo(`Export detail ${i + 1}`),
						),
					),
				},
			]),
		),
	)}`,
)
