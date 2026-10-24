// An import while it runs, and when it stopped partway: the progress strip with its row of posters, and under it the
// waiting line or the reason it stopped with Continue. The same strip comes back for an Undo, with the posters dimming
// from the right as it takes things out.
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import {
	Bar,
	type FlowPoster,
	PosterLights,
	StepHeading,
	headingClass,
	useReportStep,
} from "./ImportFlowParts"
import {
	LONG_RUN_ROWS,
	oneOrMany,
	plural,
	runProgress,
	stopReason,
} from "./import-flow-model"
import { errorBox, primaryButton, secondaryButton } from "./shared"

export interface RunSummary {
	status: string
	processed: number
	total: number
	stalled: boolean
	error: string | null
	operation?: "apply" | "undo"
}

/** The strip on top of a running, stopped, or undoing import. */
export function ProgressStrip({
	summary,
	posters,
	label,
	note,
	resume,
}: {
	summary: RunSummary
	posters: FlowPoster[]
	/** "Importing 842 titles", or how an Undo says it. */
	label: string
	/** A short line under the bar: questions left, answers coming in. */
	note?: string
	/** A question is on screen: the strip itself carries why the run stopped, and Continue. */
	resume?: { pending: boolean; run: () => void }
}) {
	const undo = summary.operation === "undo"
	const stopped = summary.status === "failed" || summary.stalled
	const done = runProgress(summary)
	// Undo takes out: the lit posters go dark from the right as it moves on.
	const lit = undo ? 1 - done : done
	const pct = Math.round(done * 100)
	const said = stopped
		? `${stopReason(summary)} What came in so far is saved.`
		: `${undo ? "Undo" : "Import"} ${Math.floor(pct / 25) * 25}% done.`
	return (
		<section
			aria-label={undo ? "Undo progress" : "Import progress"}
			data-progress-strip={stopped ? "stopped" : "running"}
			className={`rounded-2xl px-4 py-3 transition-colors duration-300 ${stopped ? "border-l-8 border-red-700 bg-red-950/70 ring-1 ring-red-700/60" : "bg-gray-900/70 ring-1 ring-white/10"}`}
		>
			<p className="sr-only" aria-live="polite">
				{said}
			</p>
			{posters.length > 0 && (
				<PosterLights
					posters={posters}
					progress={lit}
					tone={stopped ? "red" : "amber"}
				/>
			)}
			<div
				className="mt-2 flex items-center justify-between gap-3 text-sm"
				aria-hidden
			>
				<span
					className={`flex min-w-0 items-center gap-2 font-semibold ${stopped ? "text-red-100" : "text-white"}`}
				>
					{stopped && (
						<ExclamationTriangleIcon
							className="size-5 shrink-0 text-red-300"
							aria-hidden
						/>
					)}
					{stopped ? `Stopped at ${pct}%` : label}
				</span>
				<span
					className={`inline-block min-w-[4ch] text-right tabular-nums ${stopped ? "font-semibold text-red-200" : "text-amber-300"}`}
				>
					{pct}%
				</span>
			</div>
			<div className="mt-2">
				<Bar
					slim
					value={lit}
					label={undo ? "Undo progress" : "Import progress"}
					tone={stopped ? "red" : "amber"}
				/>
			</div>
			{note && (
				<p className="mt-2 text-xs text-gray-400" data-strip-note>
					{note}
				</p>
			)}
			{stopped && resume && (
				<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0 text-sm">
						<p className="font-semibold text-white">{stopReason(summary)}</p>
						<p className="text-red-100/80">What came in so far is saved.</p>
					</div>
					<button
						type="button"
						className={primaryButton}
						disabled={resume.pending}
						onClick={resume.run}
					>
						{resume.pending ? "Continuing" : "Continue"}
					</button>
				</div>
			)}
		</section>
	)
}

/**
 * A running or stopped import: the strip, then what the member can do. `source` names it ("Letterboxd"); `count` is
 * the titles it brings when that is known.
 */
export function ImportRun({
	summary,
	source,
	posters,
	count,
	focus,
	pending,
	actionError,
	checkFailed,
	onResume,
	onRestart,
	restartLabel,
	notes,
	putOff = 0,
	answered = false,
	note,
}: {
	summary: RunSummary
	source: string
	posters: FlowPoster[]
	count: number | null
	focus: boolean
	pending: boolean
	actionError: string | null
	checkFailed: boolean
	onResume: () => void
	onRestart?: () => void
	restartLabel?: string
	/** The stepper's notes under Bring and Choose. */
	notes: [string, string]
	/** Questions the member put off with Decide later: they wait for the end. */
	putOff?: number
	/** The member answered a question while it ran. */
	answered?: boolean
	/** The strip's line under the bar. */
	note?: string
}) {
	const undo = summary.operation === "undo"
	const stopped = summary.status === "failed" || summary.stalled
	const pct = Math.round(runProgress(summary) * 100)
	useReportStep({
		step: undo ? 4 : 3,
		notes: [
			notes[0],
			notes[1],
			undo ? "" : stopped ? "Stopped" : `${pct}%`,
			undo ? (stopped ? "Stopped" : "Undoing") : "",
		],
		allDone: false,
	})
	const label = undo
		? count
			? `Taking out ${plural(count, "title")}`
			: "Taking out what came in"
		: count
			? `Importing ${plural(count, "title")}`
			: `Importing your ${source} titles`
	return (
		<div className="flex flex-col gap-6">
			<ProgressStrip
				summary={summary}
				posters={posters}
				label={label}
				note={note}
			/>
			{stopped ? (
				<section className="flex flex-col gap-4" data-run-stopped>
					<StepHeading focus={focus}>
						Your {undo ? "undo" : "import"} stopped
					</StepHeading>
					<p className="text-lg text-white" role="alert">
						{stopReason(summary)}
					</p>
					<p className="text-gray-300">
						{undo
							? "What was taken out so far stays out. Continue picks up where it stopped."
							: "What came in so far is saved. Continue picks up where it stopped."}
					</p>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={primaryButton}
							disabled={pending}
							onClick={onResume}
						>
							{pending ? "Continuing" : "Continue"}
						</button>
						{!undo && onRestart && (
							<button
								type="button"
								className={secondaryButton}
								disabled={pending}
								onClick={onRestart}
							>
								{restartLabel ?? "Choose another file"}
							</button>
						)}
					</div>
				</section>
			) : (
				<section className="flex flex-col gap-3" data-run-waiting>
					<StepHeading focus={focus} className={headingClass}>
						{undo
							? "Undoing this import"
							: putOff > 0
								? `${plural(putOff, "question")} ${oneOrMany(putOff, "waits", "wait")} for the end`
								: answered
									? "Thanks! Your titles are almost in"
									: `Your ${source} titles are moving in`}
					</StepHeading>
					<p className="text-gray-400">
						{!undo && putOff > 0
							? `Nothing from ${oneOrMany(putOff, "it", "them")} changes until you answer.`
							: summary.total >= LONG_RUN_ROWS
								? "Ready in a few minutes. You can leave this page; it keeps going."
								: "Ready in a moment."}
					</p>
				</section>
			)}
			<div aria-live="assertive">
				{actionError && <p className={errorBox}>{actionError}</p>}
				{!actionError && checkFailed && (
					<p className="text-sm text-amber-200">
						Progress could not be refreshed. GoodWatch will keep trying.
					</p>
				)}
			</div>
		</div>
	)
}
