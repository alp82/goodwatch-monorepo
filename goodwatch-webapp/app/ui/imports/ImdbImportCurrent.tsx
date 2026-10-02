// One import, drawn by where it is in its life: the preview, the progress, the receipt, undone, or failed.
import { ArrowDownTrayIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import type {
	ImdbConflictChoice,
	ImdbImportOutcome,
	ImdbImportSummary,
} from "~/domain/imdb-import"
import { Spinner } from "~/ui/wait/Spinner"
import { FocusHeading } from "./FocusHeading"
import { CountList, CountRow, OutcomeRow } from "./ImdbImportCounts"
import { ImdbImportPreview } from "./ImdbImportPreview"
import {
	skippedDownloadUrl,
	useConfirmImdbImport,
	useImdbImport,
	useRefreshAfterImport,
	useUndoImdbImport,
} from "./api"
import {
	dangerButton,
	errorBox,
	formatCount,
	formatDate,
	infoBox,
	primaryButton,
	ratings,
	secondaryButton,
	skippedCount,
	textLink,
	titles,
} from "./shared"

export function ImdbImportCurrent({
	id,
	focus,
	onUploadAnother,
}: {
	id: string
	/** Whether this view replaced another after something the person did, so its heading takes focus. */
	focus: boolean
	onUploadAnother: () => void
}) {
	const query = useImdbImport(id)
	const confirm = useConfirmImdbImport(id)
	const undo = useUndoImdbImport(id)
	const summary = query.data?.import
	useRefreshAfterImport(summary)

	if (!summary)
		return query.isError ? (
			<div className="flex flex-col items-start gap-3" aria-live="assertive">
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

	const confirmAgain = () => confirm.mutate(summary.conflictChoice ?? "keep")
	const confirmError = confirm.isError ? confirm.error.message : null

	if (summary.status === "preview")
		return (
			<ImdbImportPreview
				summary={summary}
				focus={focus}
				confirming={confirm.isPending}
				error={confirmError}
				onConfirm={(choice: ImdbConflictChoice) => confirm.mutate(choice)}
				onBack={onUploadAnother}
			/>
		)

	if (summary.status === "running")
		return (
			<Progress
				summary={summary}
				// After confirming, the preview and its Import button are gone.
				focus={confirm.isSuccess}
				checkFailed={query.isError}
				resuming={confirm.isPending}
				error={confirmError}
				onResume={confirmAgain}
			/>
		)

	if (summary.status === "failed")
		return (
			<section className="flex flex-col gap-4">
				<FocusHeading focus={focus || confirm.isSuccess}>
					The import didn't finish
				</FocusHeading>
				<p className={errorBox} role="alert">
					{summary.error ?? "Something went wrong while saving your ratings."}
				</p>
				{summary.applied.added + summary.applied.updated > 0 && (
					<p>
						{ratings(summary.applied.added + summary.applied.updated)}{" "}
						{summary.applied.added + summary.applied.updated === 1
							? "was"
							: "were"}{" "}
						saved before it stopped. Try again to save the rest.
					</p>
				)}
				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						className={primaryButton}
						disabled={confirm.isPending}
						onClick={confirmAgain}
					>
						{confirm.isPending ? "Trying again" : "Try again"}
					</button>
					<button
						type="button"
						className={secondaryButton}
						disabled={confirm.isPending}
						onClick={onUploadAnother}
					>
						Choose another file
					</button>
				</div>
				<div aria-live="assertive">
					{confirmError && <p className={errorBox}>{confirmError}</p>}
				</div>
			</section>
		)

	if (summary.status === "undone")
		return (
			<section className="flex flex-col gap-4">
				<FocusHeading focus={focus || undo.isSuccess}>
					This import was undone
				</FocusHeading>
				<p>
					The import of{" "}
					<span className="font-semibold text-gray-100 break-all">
						{summary.fileName}
					</span>{" "}
					from {formatDate(summary.createdAt)} was undone. The ratings it added
					or changed are back to what they were before, except the ones you
					changed yourself since then.
				</p>
				<Actions>
					<button
						type="button"
						className={primaryButton}
						onClick={onUploadAnother}
					>
						Upload a newer export
					</button>
					<Link to="/taste" className={secondaryButton}>
						Back to Taste
					</Link>
				</Actions>
			</section>
		)

	return (
		<Receipt
			summary={summary}
			focus={focus || confirm.isSuccess}
			undoing={undo.isPending}
			undoError={undo.isError ? undo.error.message : null}
			onUndo={() => undo.mutate()}
			onUploadAnother={onUploadAnother}
		/>
	)
}

function Actions({ children }: { children: ReactNode }) {
	return <div className="flex flex-wrap items-center gap-3">{children}</div>
}

// ------------------------------------------------------------- progress

function Progress({
	summary,
	focus,
	checkFailed,
	resuming,
	error,
	onResume,
}: {
	summary: ImdbImportSummary
	focus: boolean
	checkFailed: boolean
	resuming: boolean
	error: string | null
	onResume: () => void
}) {
	const { processed, total, stalled } = summary
	const percent =
		total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0
	return (
		<section className="flex flex-col gap-4">
			<FocusHeading focus={focus}>
				{stalled ? "Your import paused" : "Importing your ratings"}
			</FocusHeading>
			<progress
				className="sr-only"
				aria-label="Import progress"
				max={Math.max(total, 1)}
				value={Math.min(processed, total)}
			/>
			<div
				aria-hidden
				className="h-3 overflow-hidden rounded-full bg-slate-800"
			>
				<div
					className={`h-full rounded-full transition-[width] duration-500 ${stalled ? "bg-amber-500" : "bg-indigo-500"}`}
					style={{ width: `${percent}%` }}
				/>
			</div>
			<p aria-live="polite" className="tabular-nums text-gray-100">
				{formatCount(processed)} of {ratings(total)} saved ({percent}%)
			</p>
			{stalled ? (
				<div className="flex flex-col items-start gap-3">
					<p>
						The import stopped before it was done. The ratings saved so far are
						kept. Resume to save the rest.
					</p>
					<button
						type="button"
						className={primaryButton}
						disabled={resuming}
						onClick={onResume}
					>
						{resuming ? "Resuming" : "Resume import"}
					</button>
				</div>
			) : (
				<p className="text-gray-400">
					You can close this page. The import keeps going, and you'll find the
					result here when you come back.
				</p>
			)}
			<div aria-live="polite">
				{error && <p className={errorBox}>{error}</p>}
				{!error && checkFailed && (
					<p className="text-sm text-amber-200">
						We can't check the progress right now. We'll keep trying.
					</p>
				)}
			</div>
		</section>
	)
}

// ------------------------------------------------------------- receipt

const SKIPPED_ORDER: ImdbImportOutcome[] = [
	"unchanged",
	"unmatched",
	"unsupported",
	"invalid",
]

function Receipt({
	summary,
	focus,
	undoing,
	undoError,
	onUndo,
	onUploadAnother,
}: {
	summary: ImdbImportSummary
	focus: boolean
	undoing: boolean
	undoError: string | null
	onUndo: () => void
	onUploadAnother: () => void
}) {
	const { applied, counts, withoutFingerprint } = summary
	const [askUndo, setAskUndo] = useState(false)
	const written = applied.added + applied.updated
	const skipped = skippedCount(summary)
	// The receipt only draws the sum when its rows really add up to the file.
	const addsUp =
		applied.added +
			applied.updated +
			applied.kept +
			applied.failed +
			counts.unchanged +
			skipped ===
		counts.rows

	return (
		<section className="flex flex-col gap-5">
			<div className="flex flex-col gap-2">
				<FocusHeading focus={focus}>
					Imported on {formatDate(summary.finishedAt ?? summary.createdAt)}
				</FocusHeading>
				<p>
					{written > 0
						? `${ratings(written)} from `
						: "No ratings needed saving from "}
					<span className="font-semibold text-gray-100 break-all">
						{summary.fileName}
					</span>
					{written > 0
						? ` ${written === 1 ? "is" : "are"} now in GoodWatch. The titles count as Seen.`
						: "."}
				</p>
			</div>

			<CountList>
				<CountRow label="Ratings added" count={applied.added} />
				{applied.updated > 0 && (
					<CountRow label="Ratings updated" count={applied.updated} />
				)}
				{applied.kept > 0 && (
					<CountRow label="GoodWatch ratings kept" count={applied.kept} />
				)}
				{applied.failed > 0 && (
					<CountRow label="Couldn't be saved" count={applied.failed} />
				)}
				{SKIPPED_ORDER.filter((outcome) => counts[outcome] > 0).map(
					(outcome) => (
						<OutcomeRow
							key={outcome}
							importId={summary.id}
							outcome={outcome}
							count={counts[outcome]}
						/>
					),
				)}
				{addsUp && (
					<CountRow label="Rows in your file" count={counts.rows} total />
				)}
			</CountList>

			{applied.failed > 0 && (
				<p className={infoBox}>
					{ratings(applied.failed)} couldn't be saved. Your other ratings are
					in. Upload the same file again and{" "}
					{applied.failed === 1 ? "it shows" : "they show"} up as ratings to
					add.
				</p>
			)}

			{typeof withoutFingerprint === "number" && withoutFingerprint > 0 && (
				<p className={infoBox}>
					{titles(withoutFingerprint)} from this import{" "}
					{withoutFingerprint === 1 ? "doesn't" : "don't"} count toward your
					Taste yet, because {withoutFingerprint === 1 ? "it has" : "they have"}{" "}
					no fingerprint in GoodWatch so far.
				</p>
			)}

			<Actions>
				<Link to="/taste" className={primaryButton}>
					Back to Taste
				</Link>
				<button
					type="button"
					className={secondaryButton}
					onClick={onUploadAnother}
				>
					Upload a newer export
				</button>
			</Actions>

			{(skipped > 0 || summary.canUndo) && (
				<div className="flex flex-col items-start gap-3 border-t border-slate-800 pt-4">
					{skipped > 0 && (
						<a
							href={skippedDownloadUrl(summary.id)}
							download
							className={`${textLink} inline-flex min-h-11 items-center gap-2`}
						>
							<ArrowDownTrayIcon className="h-4 w-4 shrink-0" aria-hidden />
							Download skipped titles ({formatCount(skipped)}, CSV file)
						</a>
					)}
					{summary.canUndo &&
						(askUndo ? (
							<div className="flex flex-col items-start gap-3 rounded-lg border border-red-900 bg-red-950/40 p-4">
								<p className="text-gray-100">
									Undo this import? Every rating it added or changed goes back
									to what it was before. Ratings you changed yourself since then
									stay as they are.
								</p>
								<Actions>
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
										// biome-ignore lint/a11y/noAutofocus: the question replaced the button that had focus
										autoFocus
										onClick={() => setAskUndo(false)}
									>
										Keep the import
									</button>
								</Actions>
							</div>
						) : (
							<button
								type="button"
								className={`${textLink} min-h-11`}
								onClick={() => setAskUndo(true)}
							>
								Undo import
							</button>
						))}
					<div aria-live="assertive">
						{undoError && <p className={errorBox}>{undoError}</p>}
					</div>
				</div>
			)}
		</section>
	)
}
