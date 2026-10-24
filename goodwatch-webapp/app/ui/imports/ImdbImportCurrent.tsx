// One IMDb ratings import, drawn by where it is in its life: Choose and its one question while it's a preview, the
// progress strip while it runs or after it stopped, and the Done step once it finished or was undone.
import { useRef, useState } from "react"
import type {
	ImdbConflictChoice,
	ImdbImportSummary,
} from "~/domain/imdb-import"
import { Spinner } from "~/ui/wait/Spinner"
import { ImportDone } from "./ImportDone"
import { useConflictRows, useImportPosters } from "./ImportFlowData"
import {
	Answer,
	BackArrow,
	type FlowPoster,
	QuestionScreen,
	Slide,
	StepHeading,
	backClass,
	useLockIn,
	useReportStep,
} from "./ImportFlowParts"
import { ImportRun } from "./ImportRun"
import {
	CaughtUp,
	ConflictExamples,
	NothingToBring,
} from "./SourceImportChoose"
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
	imdbToWrite,
	leftOutCount,
	oneOrMany,
	plural,
} from "./import-flow-model"
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
				onConfirm={(choice) => confirm.mutate(choice)}
				onBack={onUploadAnother}
			/>
		)

	if (summary.status === "running" || summary.status === "failed")
		return (
			<ImportRun
				summary={summary}
				source="IMDb"
				posters={posters}
				count={summary.total || null}
				focus={acted}
				pending={confirm.isPending}
				actionError={confirmError}
				checkFailed={query.isError}
				onResume={() => confirm.mutate(summary.conflictChoice ?? "keep")}
				onRestart={onUploadAnother}
				notes={NOTES}
			/>
		)

	const { applied, withoutFingerprint } = summary
	return (
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
}

type Screen = { at: "choose" } | { at: "ask" } | { at: "nothing" }

/** What an IMDb ratings file brings, then its one question: scores that differ from the member's. */
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
	const conflicts = useConflictRows(
		"/api/imdb-import",
		summary.id,
		counts.conflict > 0,
	)
	const [screen, setScreen] = useState<Screen>({ at: "choose" })
	const [dir, setDir] = useState<1 | -1>(1)
	const [acted, setActed] = useState(focus)
	const [picked, setPicked] = useState<ImdbConflictChoice | null>(null)
	const lock = useLockIn()
	const go = (next: Screen, d: 1 | -1) => {
		lock.cancel()
		setActed(true)
		setDir(d)
		setScreen(next)
	}
	const finish = (choice: ImdbConflictChoice) => {
		if (imdbToWrite(summary, choice === "imdb") === 0)
			return go({ at: "nothing" }, 1)
		onConfirm(choice)
	}
	const sure = counts.new + counts.update
	useReportStep(
		content === "caught-up"
			? { step: 4, notes: ["IMDb", "", "", "Up to date"], allDone: true }
			: screen.at === "choose" || content === "nothing"
				? { step: 2, notes: ["IMDb", "", "", ""], allDone: false, back: onBack }
				: {
						step: 3,
						notes: [
							"IMDb",
							counts.conflict ? "" : plural(sure, "title"),
							picked ? "" : "1 to answer",
							"",
						],
						allDone: false,
					},
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
	if (screen.at === "nothing")
		return (
			<Slide key="nothing" dir={1}>
				<section className="flex flex-col gap-4">
					<StepHeading focus={acted}>
						Nothing changes with this answer
					</StepHeading>
					<p className="text-gray-300">
						Every other title in this file is already in GoodWatch with the same
						score, so there's nothing to import.
					</p>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={primaryButton}
							onClick={() => go({ at: "ask" }, -1)}
						>
							Change my answer
						</button>
						<button type="button" className={secondaryButton} onClick={onBack}>
							Pick another file
						</button>
					</div>
				</section>
			</Slide>
		)
	if (screen.at === "ask") {
		const n = counts.conflict
		const pick = (choice: ImdbConflictChoice) => {
			setPicked(choice)
			lock.lock(choice, () => finish(choice))
		}
		return (
			<Slide key="ask" dir={dir}>
				<QuestionScreen
					number={1}
					of={1}
					focus={acted}
					onBack={confirming ? undefined : () => go({ at: "choose" }, -1)}
					title={`${plural(n, "score")} in your IMDb file ${oneOrMany(n, "differs", "differ")} from yours in GoodWatch. Keep yours?`}
					body={
						<ConflictExamples
							api="/api/imdb-import"
							importId={summary.id}
							rows={conflicts?.rows ?? null}
							source="IMDb"
						/>
					}
					locked={lock.locking !== null || confirming}
					answers={
						<>
							<Answer
								selected={picked === "keep"}
								recommended
								title="Yes, keep my scores"
								onClick={() => pick("keep")}
							/>
							<Answer
								selected={picked === "imdb"}
								title="No, use IMDb's"
								onClick={() => pick("imdb")}
							/>
						</>
					}
					after={
						<>
							<div aria-live="polite">
								{confirming && (
									<p className="text-gray-300">Starting your import</p>
								)}
							</div>
							<div aria-live="assertive">
								{error && <p className={errorBox}>{error}</p>}
							</div>
						</>
					}
				/>
			</Slide>
		)
	}

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
	const start = () => {
		setActed(true)
		if (counts.conflict > 0) go({ at: "ask" }, 1)
		else finish("keep")
	}
	return (
		<Slide key="choose" dir={dir}>
			<section className="flex flex-col gap-6" data-choose>
				<button type="button" onClick={onBack} className={backClass}>
					<BackArrow />
					Back
				</button>
				<StepHeading focus={acted}>What should come in?</StepHeading>
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
