// One IMDb ratings import, drawn by where it is in its life: Choose while it's a preview, the progress strip with the
// differing scores asked one title at a time while it runs or after it stopped, and the Done step once it finished
// (with what's left to decide) or was undone.
import { useRef } from "react"
import type {
	ImdbConflictChoice,
	ImdbImportSummary,
} from "~/domain/imdb-import"
import { Spinner } from "~/ui/wait/Spinner"
import { ImportDone, type LeftToDecide } from "./ImportDone"
import { useImportPosters } from "./ImportFlowData"
import {
	BackArrow,
	type FlowPoster,
	Slide,
	StepHeading,
	backClass,
	useReportStep,
} from "./ImportFlowParts"
import { ImportWithQuestions, type RunExtras } from "./ImportQuestions"
import { ImportRun } from "./ImportRun"
import { CaughtUp, NothingToBring } from "./SourceImportChoose"
import {
	skippedDownloadUrl,
	useConfirmImdbImport,
	useImdbImport,
	useRefreshAfterImport,
	useUndoImdbImport,
} from "./api"
import {
	formatCount,
	imdbPreviewContent,
	leftOutCount,
	oneOrMany,
	plural,
} from "./import-flow-model"
import { imdbLiveQuestions } from "./import-questions-model"
import { errorBox, infoBox, primaryButton, secondaryButton } from "./shared"

const NOTES: [string, string] = ["IMDb", ""]

export function ImdbImportCurrent({
	id,
	focus,
	onUploadAnother,
}: {
	id: string
	/** Whether this view replaced another after something the member did, so its heading takes focus. */
	focus: boolean
	onUploadAnother: () => void
}) {
	const query = useImdbImport(id)
	const confirm = useConfirmImdbImport(id)
	const undo = useUndoImdbImport(id)
	const summary = query.data?.import
	const posters = useImportPosters("/api/imdb-import", id, {
		enabled: !!summary,
	})
	useRefreshAfterImport(summary)
	const watched = useRef(false)
	if (summary?.status === "running" || summary?.status === "preview")
		watched.current = true
	// The member pressed Import here: differing scores are asked right away, while the import runs.
	const startedHere = useRef(false)

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

	const confirmError = confirm.isError ? confirm.error.message : null
	const acted = focus || confirm.isSuccess || undo.isSuccess

	if (summary.status === "preview")
		return (
			<ImdbChoose
				summary={summary}
				focus={focus}
				posters={posters}
				confirming={confirm.isPending}
				error={confirmError}
				onConfirm={(choice) => {
					startedHere.current = true
					confirm.mutate(choice)
				}}
				onBack={onUploadAnother}
			/>
		)

	const resume = () => confirm.mutate(summary.conflictChoice ?? "keep")
	const run = (extras?: RunExtras) => (
		<ImportRun
			summary={summary}
			source="IMDb"
			posters={posters}
			count={summary.total || null}
			focus={acted}
			pending={confirm.isPending}
			actionError={confirmError}
			checkFailed={query.isError}
			onResume={resume}
			onRestart={onUploadAnother}
			notes={NOTES}
			{...extras}
		/>
	)

	const { applied, withoutFingerprint } = summary
	const done = (left?: LeftToDecide) => (
		<ImportDone
			api="/api/imdb-import"
			summary={summary}
			source="IMDb"
			posters={posters}
			focus={acted}
			openedHere={watched.current || confirm.isSuccess}
			undo={{
				pending: undo.isPending,
				error: undo.isError ? undo.error.message : null,
				run: () => undo.mutate(),
			}}
			undoQuestion="Undo this import? Every rating it added or changed goes back to what it was before. Ratings you changed yourself since then stay as they are."
			onUploadAnother={onUploadAnother}
			anotherLabel="Upload a newer export"
			skippedUrl={skippedDownloadUrl(summary.id)}
			notes={NOTES}
			left={left}
		>
			{summary.status === "done" && applied.failed > 0 && (
				<p className={infoBox}>
					{plural(applied.failed, "rating")} couldn't be saved. Your other
					ratings are in. Upload the same file again and{" "}
					{oneOrMany(applied.failed, "it shows", "they show")} up as ratings to
					add.
				</p>
			)}
			{summary.status === "done" &&
				typeof withoutFingerprint === "number" &&
				withoutFingerprint > 0 && (
					<p className={infoBox}>
						{plural(withoutFingerprint, "title")} from this import{" "}
						{oneOrMany(withoutFingerprint, "doesn't", "don't")} count toward
						your Taste yet, because{" "}
						{oneOrMany(withoutFingerprint, "it has", "they have")} no
						fingerprint in GoodWatch so far.
					</p>
				)}
		</ImportDone>
	)
	// Differing scores held while it runs: an import confirmed with "ask". The answer later replaces the choice.
	if (
		summary.status !== "undone" &&
		(summary.questions !== undefined || summary.conflictChoice === "ask")
	)
		return (
			<ImportWithQuestions
				api="/api/imdb-import"
				id={summary.id}
				summary={summary}
				questions={imdbLiveQuestions(summary)}
				asked
				source="IMDb"
				thing="file"
				focus={acted}
				startedHere={startedHere.current}
				resume={{
					pending: confirm.isPending,
					run: resume,
					error: confirm.isError ? confirm.error.message : null,
				}}
				renderRun={run}
				renderDone={done}
				notes={NOTES}
			/>
		)
	if (summary.status === "running" || summary.status === "failed") return run()
	return done()
}

/** What an IMDb ratings file brings. Import starts it; scores that differ are asked about while it runs. */
export function ImdbChoose({
	summary,
	focus,
	posters,
	confirming,
	error,
	onConfirm,
	onBack,
}: {
	summary: ImdbImportSummary
	focus: boolean
	posters: FlowPoster[]
	confirming: boolean
	error: string | null
	onConfirm: (choice: ImdbConflictChoice) => void
	onBack: () => void
}) {
	const { counts } = summary
	const content = imdbPreviewContent(summary)
	const sure = counts.new + counts.update
	useReportStep(
		content === "caught-up"
			? { step: 4, notes: ["IMDb", "", "", "Up to date"], allDone: true }
			: { step: 2, notes: ["IMDb", "", "", ""], allDone: false, back: onBack },
	)

	if (content === "caught-up")
		return (
			<CaughtUp
				source="IMDb"
				thing="file"
				count={counts.unchanged}
				posters={posters}
				focus={focus}
				onBack={onBack}
				skipped={
					leftOutCount(summary) > 0
						? {
								count: leftOutCount(summary),
								url: skippedDownloadUrl(summary.id),
							}
						: undefined
				}
			/>
		)
	if (content === "nothing")
		return (
			<NothingToBring
				source="IMDb"
				thing="file"
				rows={counts.rows}
				skippedUrl={skippedDownloadUrl(summary.id)}
				focus={focus}
				onBack={onBack}
			/>
		)

	const episodes = counts.episodes ?? 0
	const scores = Math.max(
		0,
		counts.rows -
			counts.unmatched -
			counts.unsupported -
			counts.invalid -
			episodes,
	)
	const rows = [
		{ key: "scores", name: "Scores", count: scores },
		{ key: "episodes", name: "Episode scores", count: episodes },
	].filter((row) => row.count > 0)
	// Differing scores wait for the member's answer while everything else comes in.
	const start = () => onConfirm(counts.conflict > 0 ? "ask" : "keep")
	return (
		<Slide key="choose" dir={1}>
			<section className="flex flex-col gap-6" data-choose>
				<button type="button" onClick={onBack} className={backClass}>
					<BackArrow />
					Back
				</button>
				<StepHeading focus={focus}>What should come in?</StepHeading>
				<ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-gray-900/70 ring-1 ring-white/10">
					{rows.map((row) => (
						<li
							key={row.key}
							className="flex min-h-14 items-center gap-4 px-4 py-3 sm:px-5"
						>
							<span className="flex-1 font-semibold text-white">
								{row.name}
							</span>
							<span className="tabular-nums text-gray-200">
								{formatCount(row.count)}
							</span>
						</li>
					))}
				</ul>
				{episodes > 0 && (
					<p data-episode-scores className="-mt-3 text-sm text-gray-400">
						Episode scores stay with their episodes: they never rate the whole
						show or mark an episode watched.
					</p>
				)}
				{counts.unchanged > 0 && (
					<p className="-mt-3 text-sm text-gray-400">
						{plural(counts.unchanged, "title")}{" "}
						{oneOrMany(counts.unchanged, "is", "are")} already the same in
						GoodWatch.
					</p>
				)}
				<button
					type="button"
					className={`${primaryButton} w-full sm:w-auto sm:min-w-56 sm:self-start`}
					disabled={confirming}
					onClick={start}
				>
					{confirming
						? "Starting import"
						: counts.conflict > 0
							? "Import"
							: `Import ${plural(sure, "title")}`}
				</button>
				<div aria-live="assertive">
					{error && <p className={errorBox}>{error}</p>}
				</div>
			</section>
		</Slide>
	)
}
