// One import, drawn by where it is in its life: Choose and the questions while it's a preview, the progress strip
// while it runs or after it stopped, and the Done step once it finished or was undone.
import { useRef, useState } from "react"
import {
	IMPORT_SOURCE_UPLOAD,
	type ImportOptions,
	type ImportSummary,
} from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import { ImportDone } from "./ImportDone"
import { useImportPosters } from "./ImportFlowData"
import { Disclosure } from "./ImportFlowParts"
import { ImportNotes } from "./ImportNotes"
import { ImportRun } from "./ImportRun"
import { SourceImportChoose } from "./SourceImportChoose"
import { sourceImportCopy } from "./SourceImportCopy"
import { SourceOutcomeRow } from "./SourceImportCounts"
import {
	sourceSkippedDownloadUrl,
	useConfirmSourceImport,
	useRefreshAfterSourceImport,
	useSourceImport,
	useUndoSourceImport,
} from "./SourceImportHooks"
import type {
	PreviewUpdate,
	SourceImportChoices,
} from "./SourceImportPreviewModel"
import { sourceName, sourceThing } from "./import-flow-model"
import { errorBox, secondaryButton, textLink } from "./shared"

/** Options for a stopped import that never recorded its own, so Continue can still pick it up. */
const FALLBACK_OPTIONS: ImportOptions = {
	kinds: [
		"rating",
		"episode_rating",
		"watch",
		"want",
		"favorite",
		"review",
		"show_status",
	],
	conflictChoice: "keep",
	watchDates: "preserve",
}

export function SourceImportCurrent({
	id,
	focus,
	onUploadAnother,
	onPreviewReplaced,
	updated,
	initialChoices,
	onChoicesChange,
}: {
	id: string
	focus: boolean
	onUploadAnother: () => void
	onPreviewReplaced?: (next: ImportSummary, update: PreviewUpdate) => void
	updated?: PreviewUpdate
	initialChoices?: SourceImportChoices
	onChoicesChange?: (choices: SourceImportChoices) => void
}) {
	const query = useSourceImport(id)
	const confirm = useConfirmSourceImport(id)
	const undo = useUndoSourceImport(id)
	const summary = query.data?.import
	const posters = useImportPosters("/api/imports", id, { enabled: !!summary })
	useRefreshAfterSourceImport(summary)
	// Done speaks of an import as just done when the member watched it run here.
	const watched = useRef(false)
	if (summary?.status === "running" || summary?.status === "preview")
		watched.current = true
	if (!summary)
		return query.isError ? (
			<div className="space-y-3" aria-live="assertive">
				<p className={errorBox}>{query.error.message}</p>
				<button
					type="button"
					className={secondaryButton}
					onClick={() => query.refetch()}
				>
					Try again
				</button>
			</div>
		) : (
			<Spinner size="medium" />
		)
	const src = sourceName(summary.source)
	const copy = sourceImportCopy(summary.source)
	const notes: [string, string] = [src, ""]
	// Focus moves with the member's acts: a step that replaced the one they acted on takes it.
	const acted = focus || confirm.isSuccess || undo.isSuccess
	if (summary.status === "preview")
		return (
			<SourceImportChoose
				summary={summary}
				focus={focus}
				confirming={confirm.isPending}
				error={confirm.isError ? confirm.error.message : null}
				onConfirm={(options) => confirm.mutate(options)}
				onBack={onUploadAnother}
				onPreviewReplaced={onPreviewReplaced}
				updated={updated}
				initialChoices={initialChoices}
				onChoicesChange={onChoicesChange}
				posters={posters}
			/>
		)
	if (summary.status === "running" || summary.status === "failed") {
		const undoing = summary.operation === "undo"
		const action = undoing ? undo : confirm
		return (
			<ImportRun
				summary={summary}
				source={src}
				posters={posters}
				count={null}
				focus={acted}
				pending={action.isPending}
				actionError={action.isError ? action.error.message : null}
				checkFailed={query.isError}
				onResume={() =>
					undoing
						? undo.mutate()
						: confirm.mutate(summary.options ?? FALLBACK_OPTIONS)
				}
				onRestart={onUploadAnother}
				restartLabel={copy.restart}
				notes={notes}
			/>
		)
	}
	return (
		<ImportDone
			api="/api/imports"
			summary={summary}
			source={src}
			thing={sourceThing(summary.source)}
			posters={posters}
			focus={acted}
			openedHere={watched.current || confirm.isSuccess}
			undo={{
				pending: undo.isPending,
				error: undo.isError ? undo.error.message : null,
				run: () => undo.mutate(),
			}}
			undoQuestion={undoQuestion(summary)}
			onUploadAnother={onUploadAnother}
			anotherLabel={copy.another}
			skippedUrl={sourceSkippedDownloadUrl(summary.id)}
			notes={notes}
		>
			<SourceDoneNotes summary={summary} />
		</ImportDone>
	)
}

/** What Undo does for this source, asked before it runs. */
export function undoQuestion(summary: ImportSummary) {
	const watcharrWatches =
		summary.source === "wishlist" &&
		(summary.kinds.watch > 0 || summary.kinds.show_status > 0)
	return summary.source === "plex" && summary.kinds.watch > 0
		? "Undo this import? GoodWatch removes watches this import added and restores earlier scores and show statuses. Choices cleared by watches are restored when no newer watch or choice remains. Later ratings, statuses and list choices stay protected. Undo of Want to See does not restore earlier Not interested choices."
		: watcharrWatches
			? "Undo this import? GoodWatch removes watches this import added and restores earlier show statuses. Undo restores the earlier Want to See and Not interested choices when no newer watch or choice remains. Later ratings and reviews stay protected."
			: summary.source === "wishlist"
				? "Undo this import? GoodWatch takes the titles this import added off Want to See. Titles you changed since then stay as you left them. Titles the import took off Not interested aren't marked Not interested again. The result lists them so you can put them back."
				: "Undo this import? GoodWatch removes watches this import added, even if you edited their dates later, and restores earlier show statuses. Later status, rating and list changes stay protected. Without added watches, restoring a status also restores its cleared Want to See or Not interested choices. Undo of added watches and Want to See does not restore those choices; the result lists them so you can put them back."
}

const ENTRY_OUTCOMES = [
	"new",
	"unchanged",
	"conflict",
	"unmatched",
	"unsupported",
	"invalid",
] as const

/** The source's credits, its lists as they came in, and the notes about its file, under the Done step's summary. */
function SourceDoneNotes({ summary }: { summary: ImportSummary }) {
	const credits = IMPORT_SOURCE_UPLOAD[summary.source]?.credits ?? []
	const [listsOpen, setListsOpen] = useState(false)
	const lists = summary.source === "imdb_list" || (summary.kinds.list ?? 0) > 0
	if (!credits.length && !summary.warnings.length && !lists) return null
	return (
		<div className="flex flex-col gap-3">
			{lists && (
				<Disclosure
					label={
						summary.source === "imdb_list"
							? "Original IMDb list entries"
							: "Lists and original export entries"
					}
					open={listsOpen}
					onToggle={setListsOpen}
				>
					<ul className="divide-y divide-slate-800 rounded-lg border border-slate-700">
						{ENTRY_OUTCOMES.filter(
							(outcome) => summary.counts[outcome] > 0,
						).map((outcome) => (
							<SourceOutcomeRow
								key={outcome}
								importId={summary.id}
								outcome={outcome}
								count={summary.counts[outcome]}
							/>
						))}
					</ul>
				</Disclosure>
			)}
			{credits.map((credit) => (
				<p key={credit.url} className="text-sm text-gray-400">
					{credit.purpose} courtesy of{" "}
					<a
						href={credit.url}
						target="_blank"
						rel="noopener noreferrer"
						className={textLink}
					>
						{credit.name}
					</a>
					.
				</p>
			))}
			<ImportNotes
				warnings={summary.warnings}
				title={
					summary.source === "wishlist" ? "About this file" : "Export notes"
				}
			/>
		</div>
	)
}
