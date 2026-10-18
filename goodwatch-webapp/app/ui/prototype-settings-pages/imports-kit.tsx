// PROTOTYPE - throwaway (settings subpages). The Imports page's parts, shared with the Taste start (ui/taste/start):
// the drop zone, the logo row with pop-outs, a source's steps, and the page-wide drop all come from there unchanged.
// A dropped file is read for real (recognizeImportFile names its source); what follows (check, import, receipt, undo)
// is a stub with made-up counts, since the real flows need a signed-in member. Nothing is uploaded or saved.
import { ArrowUturnLeftIcon, CheckCircleIcon, LinkIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import type { ImportHandoff } from "~/ui/imports/ImportFileRouting"
import { IMPORT_SOURCE_LIST, type ImportSourceEntry, type ImportSourceId } from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import { primaryButton, secondaryButton } from "~/ui/imports/shared"
import { SourceHeader, sourceEntry, useFileTaking } from "~/ui/taste/start/StartImport"

export { PageDrop, SourceHeader, SourceSteps, StartDropZone, WaitChip, sourceEntry, useFileTaking } from "~/ui/taste/start/StartImport"
export { SourceLogoRow } from "~/ui/taste/start/SourceLogoRow"
export { IMPORT_SOURCE_LIST, SourceMark }
export type { ImportSourceEntry, ImportSourceId }

/** Past imports, newest first, as the real history would list them. */
export const HISTORY = [
	{ id: "h3", source: "letterboxd" as ImportSourceId, when: "October 1, 2026", added: "412 watches, 186 ratings, 3 lists", skipped: 9, undoable: true },
	{ id: "h2", source: "imdb" as ImportSourceId, when: "September 2, 2026", added: "1,284 ratings", skipped: 31, undoable: false },
	{ id: "h1", source: "trakt" as ImportSourceId, when: "July 18, 2026", added: "Undone", skipped: 0, undoable: false },
]

/** Made-up counts per source for the stub check. */
const FAKE: Partial<Record<ImportSourceId, { rows: [string, number][]; notFound: number }>> = {
	imdb: { rows: [["New ratings", 214], ["Ratings that change", 18], ["Already the same", 1052]], notFound: 7 },
	letterboxd: { rows: [["New watches", 63], ["New ratings", 41], ["Want to See", 22]], notFound: 3 },
	trakt: { rows: [["New watches", 128], ["Episodes", 2_310], ["Want to See", 14]], notFound: 5 },
}

/** Where the page is in an import: nothing open, a source's steps, or a file being checked. */
export type ImportStage =
	| { at: "start" }
	| { at: "source"; id: ImportSourceId }
	| { at: "check"; id: ImportSourceId; fileName: string }
	| { at: "done"; id: ImportSourceId; fileName: string }

/** The page's state plus the real file reading: a recognized file goes to its check. */
export function useImportStage() {
	const [stage, setStage] = useState<ImportStage>({ at: "start" })
	const taking = useFileTaking((handoff: ImportHandoff) => {
		const id = handoff.recognition.source
		if (id) setStage({ at: "check", id, fileName: handoff.file.name })
	})
	return { stage, setStage, taking }
}

/** The stub of a source's check: counts, then Import, then the receipt with Undo. */
export function FakeCheck({
	stage,
	onDone,
	onOther,
	onReset,
}: {
	stage: Extract<ImportStage, { at: "check" | "done" }>
	onDone: () => void
	onOther: () => void
	onReset: () => void
}) {
	const source = sourceEntry(stage.id)
	const fake = FAKE[stage.id] ?? { rows: [["New ratings", 96], ["Want to See", 12]] as [string, number][], notFound: 2 }
	const done = stage.at === "done"
	return (
		<div className="w-full rounded-2xl bg-gray-900/90 p-5 text-left text-base text-gray-300 ring-1 ring-white/10 md:p-6">
			<SourceHeader source={source} onOther={onOther} />
			<p className="text-sm text-gray-400">
				{done ? "Imported from" : "Checked"} <span className="font-semibold break-all text-gray-200">{stage.fileName}</span>
				{done ? "." : ". Nothing has changed yet."}
			</p>
			<ul className="mt-4 grid gap-2 sm:grid-cols-3">
				{fake.rows.map(([label, n]) => (
					<li key={label} className="rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10">
						<span className="block text-2xl font-black tabular-nums text-white">{n.toLocaleString("en-US")}</span>
						<span className="text-sm text-gray-400">{label}</span>
					</li>
				))}
			</ul>
			<p className="mt-3 text-sm text-gray-500">{fake.notFound} titles aren't in GoodWatch yet and stay out.</p>
			<div className="mt-5 flex flex-wrap items-center gap-3">
				{done ? (
					<>
						<span className="inline-flex items-center gap-2 font-semibold text-emerald-300">
							<CheckCircleIcon className="size-5" aria-hidden /> In your library
						</span>
						<button type="button" className={secondaryButton} onClick={onReset}>
							<ArrowUturnLeftIcon className="size-4" aria-hidden /> Undo this import
						</button>
						<button type="button" className={secondaryButton} onClick={onReset}>
							Import something else
						</button>
					</>
				) : (
					<>
						<button type="button" className={primaryButton} onClick={onDone}>
							Import {source.name}
						</button>
						<button type="button" className={secondaryButton} onClick={onReset}>
							Cancel
						</button>
					</>
				)}
			</div>
			<p className="mt-4 text-xs text-fuchsia-300">Prototype: counts are made up. Nothing was uploaded.</p>
		</div>
	)
}

/** The stub of an account source (TMDB, Plex): connect, then import. */
export function FakeConnect({ id, onOther }: { id: ImportSourceId; onOther: () => void }) {
	const source = sourceEntry(id)
	const [connected, setConnected] = useState(false)
	return (
		<div className="w-full rounded-2xl bg-gray-900/90 p-5 text-left text-base text-gray-300 ring-1 ring-white/10 md:p-6">
			<SourceHeader source={source} onOther={onOther} />
			<p>
				{connected
					? `Connected as alp. GoodWatch reads your ${source.gets.join(", ").toLowerCase()} and shows them before anything changes.`
					: `Sign in on ${source.name} and allow GoodWatch to read your library. You come back here afterwards.`}
			</p>
			<button type="button" className={`${primaryButton} mt-4`} onClick={() => setConnected(!connected)}>
				<LinkIcon className="size-4" aria-hidden />
				{connected ? `Check my ${source.name} library` : `Connect ${source.name}`}
			</button>
			<p className="mt-4 text-xs text-fuchsia-300">Prototype: no account is reached.</p>
		</div>
	)
}

/** One past import, for a history list. */
export function HistoryRow({ item }: { item: (typeof HISTORY)[number] }) {
	const source = sourceEntry(item.source)
	const undone = item.added === "Undone"
	return (
		<li className="flex flex-wrap items-center gap-3 px-4 py-3">
			<SourceMark source={source} />
			<span className="min-w-0 flex-1">
				<span className="block font-semibold text-gray-100">
					{source.name} <span className="font-normal text-gray-500">· {item.when}</span>
				</span>
				<span className={`block text-sm ${undone ? "text-gray-500" : "text-gray-400"}`}>
					{item.added}
					{item.skipped > 0 && ` · ${item.skipped} left out`}
				</span>
			</span>
			{item.undoable && (
				<button type="button" className="cursor-pointer text-sm font-semibold text-gray-300 underline underline-offset-4 hover:text-white">
					Undo
				</button>
			)}
			<button type="button" className="cursor-pointer text-sm font-semibold text-indigo-300 underline underline-offset-4 hover:text-indigo-200">
				Receipt
			</button>
		</li>
	)
}

export function HistoryList() {
	return (
		<ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
			{HISTORY.map((item) => (
				<HistoryRow key={item.id} item={item} />
			))}
		</ul>
	)
}
