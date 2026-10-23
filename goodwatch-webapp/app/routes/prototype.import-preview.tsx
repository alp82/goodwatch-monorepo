// HARNESS - development only (#759). The real import preview (ui/imports/SourceImportPreview.tsx) with a stand-in
// Trakt preview that brings season and episode scores, for screenshots. Nothing is sent: Start import only logs.
//   /prototype/import-preview
import { json } from "@remix-run/node"
import type { ImportSummary } from "~/domain/imports"
import { SourceImportPreview } from "~/ui/imports/SourceImportPreview"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json({})
}

export const meta = () => [
	{ title: "Import preview harness · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

const summary: ImportSummary = {
	id: "00000000-0000-4000-8000-000000000759",
	source: "trakt",
	fileName: "trakt-export.zip",
	status: "preview",
	createdAt: "2026-10-24T09:00:00Z",
	finishedAt: null,
	counts: {
		rows: 1104,
		new: 1037,
		unchanged: 41,
		conflict: 9,
		unmatched: 12,
		unsupported: 0,
		invalid: 5,
	},
	kinds: {
		rating: 64,
		episode_rating: 186,
		watch: 838,
		want: 12,
		favorite: 4,
		review: 0,
		show_status: 0,
	},
	warnings: [
		{
			kind: "info",
			message:
				"Trakt's watched summaries were left out because the history files contain the individual watches.",
		},
	],
	options: null,
	processed: 0,
	total: 1104,
	applied: { added: 0, updated: 0, kept: 0, failed: 0 },
	stalled: false,
	canUndo: false,
	error: null,
}

export default function ImportPreviewHarness() {
	return (
		<div className="mx-auto max-w-3xl px-4 pb-24 pt-8 text-gray-300">
			<h2 className="mb-6 text-2xl font-bold text-white">Import from Trakt</h2>
			<SourceImportPreview
				summary={summary}
				focus={false}
				confirming={false}
				error={null}
				onConfirm={(options) => console.info("Start import", options)}
				onBack={() => {}}
			/>
		</div>
	)
}
