import { ArrowDownTrayIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import {
	IMPORT_SOURCE_NAMES,
	IMPORT_SOURCE_UPLOAD,
	type ImportOptions,
	type ImportSummary,
	isFileImportSource,
} from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import { FocusHeading } from "./FocusHeading"
import { ImportResult } from "./ImportResult"
import { sourceImportCopy } from "./SourceImportCopy"
import {
	sourceSkippedDownloadUrl,
	useConfirmSourceImport,
	useRefreshAfterSourceImport,
	useSourceImport,
	useUndoSourceImport,
} from "./SourceImportHooks"
import { SourceImportPreview } from "./SourceImportPreview"
import type {
	PreviewUpdate,
	SourceImportChoices,
} from "./SourceImportPreviewModel"
import {
	dangerButton,
	errorBox,
	formatCount,
	primaryButton,
	secondaryButton,
	textLink,
} from "./shared"

const skippedCount = (summary: ImportSummary) =>
	summary.counts.unmatched + summary.counts.unsupported + summary.counts.invalid

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
	useRefreshAfterSourceImport(summary)
	if (!summary)
		return query.isError ? (
			<div className="space-y-3">
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
	const resume = () => {
		if (summary.operation === "undo") {
			undo.mutate()
			return
		}
		const options: ImportOptions = summary.options ?? {
			kinds: ["rating", "watch", "want", "favorite", "review", "show_status"],
			conflictChoice: "keep",
			watchDates: "preserve",
		}
		confirm.mutate(options)
	}
	if (summary.status === "preview")
		return (
			<SourceImportPreview
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
			/>
		)
	if (summary.status === "running") {
		const undoing = summary.operation === "undo"
		const pending = undoing ? undo.isPending : confirm.isPending
		const actionError = undoing
			? undo.isError
				? undo.error.message
				: null
			: confirm.isError
				? confirm.error.message
				: null
		return (
			<section className="space-y-4">
				<FocusHeading focus={focus || confirm.isSuccess || undo.isSuccess}>
					{undoing ? "Undoing your import" : "Importing your data"}
				</FocusHeading>
				<p>
					GoodWatch has processed {formatCount(summary.processed)} of{" "}
					{formatCount(summary.total)} rows.
				</p>
				<progress
					value={summary.processed}
					max={Math.max(summary.total, 1)}
					className="h-3 w-full accent-indigo-500"
				>
					<span>
						{summary.processed} of {summary.total}
					</span>
				</progress>
				{summary.stalled && (
					<div className="rounded-lg border border-amber-700 bg-amber-950/40 p-4">
						<p>
							This {undoing ? "undo" : "import"} stopped making progress. It is
							safe to resume from where it stopped.
						</p>
						<button
							type="button"
							className={`${primaryButton} mt-3`}
							disabled={pending}
							onClick={resume}
						>
							{pending ? "Resuming" : undoing ? "Resume undo" : "Resume import"}
						</button>
					</div>
				)}
				{query.isError && (
					<p className={errorBox}>
						Progress could not be refreshed. GoodWatch will keep trying.
					</p>
				)}
				{actionError && <p className={errorBox}>{actionError}</p>}
			</section>
		)
	}
	if (summary.status === "failed") {
		const undoing = summary.operation === "undo"
		const pending = undoing ? undo.isPending : confirm.isPending
		const actionError = undoing
			? undo.isError
				? undo.error.message
				: null
			: confirm.isError
				? confirm.error.message
				: null
		return (
			<section className="space-y-4">
				<FocusHeading focus={focus}>
					The {undoing ? "undo" : "import"} didn't finish
				</FocusHeading>
				<p className={errorBox} role="alert">
					{summary.error ??
						`Something went wrong while ${undoing ? "undoing" : "importing"} your data.`}
				</p>
				<p>
					{formatCount(summary.processed)} of {formatCount(summary.total)} rows
					were processed. Resume to continue without repeating completed rows.
				</p>
				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						className={primaryButton}
						disabled={pending}
						onClick={resume}
					>
						{pending ? "Resuming" : undoing ? "Resume undo" : "Resume import"}
					</button>
					{!undoing && (
						<button
							type="button"
							className={secondaryButton}
							onClick={onUploadAnother}
						>
							{sourceImportCopy(summary.source).restart}
						</button>
					)}
				</div>
				{actionError && <p className={errorBox}>{actionError}</p>}
			</section>
		)
	}
	return (
		<Receipt
			summary={summary}
			undoing={undo.isPending}
			undoError={undo.isError ? undo.error.message : null}
			onUndo={() => undo.mutate()}
			onUploadAnother={onUploadAnother}
		/>
	)
}

function Receipt({
	summary,
	undoing,
	undoError,
	onUndo,
	onUploadAnother,
}: {
	summary: ImportSummary
	undoing: boolean
	undoError: string | null
	onUndo: () => void
	onUploadAnother: () => void
}) {
	const [askUndo, setAskUndo] = useState(false)
	const skipped = skippedCount(summary)
	return (
		<ImportResult
			api="/api/imports"
			id={summary.id}
			status={summary.status}
			from={
				isFileImportSource(summary.source)
					? summary.fileName
					: `your ${IMPORT_SOURCE_NAMES[summary.source]} account`
			}
			focus
		>
			{(IMPORT_SOURCE_UPLOAD[summary.source]?.credits ?? []).map((credit) => (
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
			{summary.warnings.length > 0 && (
				<div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4">
					<p className="font-semibold text-amber-100">
						{summary.source === "wishlist" ? "About this file" : "Export notes"}
					</p>
					<ul className="mt-2 list-disc pl-5 text-amber-100">
						{summary.warnings.map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				</div>
			)}
			<div className="flex flex-wrap items-center gap-3">
				{skipped > 0 && summary.status !== "undone" && (
					<a
						href={sourceSkippedDownloadUrl(summary.id)}
						download
						className={secondaryButton}
					>
						<ArrowDownTrayIcon className="size-5" aria-hidden />
						Download skipped rows ({formatCount(skipped)} CSV)
					</a>
				)}
				<button
					type="button"
					className={secondaryButton}
					onClick={onUploadAnother}
				>
					{sourceImportCopy(summary.source).another}
				</button>
			</div>
			{summary.canUndo &&
				(askUndo ? (
					<div className="rounded-lg border border-red-900 bg-red-950/40 p-4">
						<p className="text-gray-100">
							{summary.source === "wishlist"
								? "Undo this import? GoodWatch takes the titles this import added off Want to See. Titles you changed since then stay as you left them. Titles the import took off Not interested aren't marked Not interested again. The result lists them so you can put them back."
								: "Undo this import? GoodWatch removes watches this import added, even if you edited their dates later, and restores earlier show statuses. Later status, rating and list changes stay protected. Without added watches, restoring a status also restores its cleared Want to See or Not interested choices. Undo of added watches and Want to See does not restore those choices; the result lists them so you can put them back."}
						</p>
						<div className="mt-3 flex flex-wrap gap-3">
							<button
								type="button"
								className={dangerButton}
								disabled={undoing}
								onClick={onUndo}
							>
								{undoing ? "Undoing" : "Yes, undo import"}
							</button>
							<button
								type="button"
								className={secondaryButton}
								disabled={undoing}
								// biome-ignore lint/a11y/noAutofocus: the question replaces the focused Undo button
								autoFocus
								onClick={() => setAskUndo(false)}
							>
								Keep the import
							</button>
						</div>
					</div>
				) : (
					<button
						type="button"
						className={`${textLink} min-h-11 self-start`}
						onClick={() => setAskUndo(true)}
					>
						Undo import
					</button>
				))}
			{undoError && <p className={errorBox}>{undoError}</p>}
		</ImportResult>
	)
}
