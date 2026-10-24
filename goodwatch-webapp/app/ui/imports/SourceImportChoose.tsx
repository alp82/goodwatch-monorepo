import { CheckIcon } from "@heroicons/react/20/solid"
import { ArrowDownTrayIcon } from "@heroicons/react/20/solid"
// The Choose step of an import and the questions after it, before anything changes: every kind the file brings with
// its count, all in, one Import button; then one question per screen (a plain fact, then yes or no) for what only the
// member can decide. A preview that counts its questions starts right after Choose and asks them while it runs
// (ImportQuestions); only matching stays here. Older previews ask everything here, since the server takes every answer
// when the import starts.
import { Link } from "@remix-run/react"
import { type ReactNode, useRef, useState } from "react"
import type { ImportOptions, ImportSummary } from "~/domain/imports"
import { useOpenedOnce } from "~/utils/first-use"
import {
	type ConflictRow,
	useConflictRows,
	useImportPosters,
} from "./ImportFlowData"
import {
	Answer,
	BackArrow,
	Disclosure,
	type FlowPoster,
	ListName,
	PosterRow,
	PosterStack,
	ProblemCard,
	QuestionScreen,
	Slide,
	StepHeading,
	backClass,
	useLockIn,
	useReportStep,
} from "./ImportFlowParts"
import { ImportNotes } from "./ImportNotes"
import { sourceImportCopy } from "./SourceImportCopy"
import { SourceOutcomeRow } from "./SourceImportCounts"
import { sourceSkippedDownloadUrl } from "./SourceImportHooks"
import type {
	PreviewUpdate,
	SourceImportChoices,
} from "./SourceImportPreviewModel"
import { tvtimeProgress } from "./TvTimeMatchCopy"
import {
	TvTimeLookupNotices,
	TvTimeMatchPanel,
	type TvTimeMatching,
	TvTimeUpdatedNotice,
	useTvTimeMatching,
} from "./TvTimePreviewParts"
import {
	WishlistMatchHost,
	type WishlistMatching,
	loadMatchPanel,
	useWishlistMatching,
} from "./WishlistMatching"
import {
	ANSWER,
	type Answers,
	KIND_NAME,
	type Question,
	availableKinds,
	conflictCountNeedsRows,
	conflictsAreScores,
	firstUnanswered,
	formatCount,
	isWishlistOnly,
	leftOutCount,
	matchableCount,
	oneOrMany,
	plural,
	rewatchCount,
	scoreConflictCount,
	sourceName,
	sourceOptions,
	sourcePreviewContent,
	sourceQuestions,
	sourceThing,
	sourceWouldWrite,
	waitsForAnswer,
	wholeShowCount,
} from "./import-flow-model"
import {
	asksWhileRunning,
	runOptions,
	runWouldWrite,
} from "./import-questions-model"
import {
	errorBox,
	infoBox,
	primaryButton,
	secondaryButton,
	textLink,
} from "./shared"

type ChooseProps = {
	summary: ImportSummary
	focus: boolean
	confirming: boolean
	error: string | null
	onConfirm: (options: ImportOptions) => void
	/** Back to Bring: another file, or connecting again. */
	onBack: () => void
	/** Wishlist and TV Time: a new preview replaced this one on screen. */
	onPreviewReplaced?: (next: ImportSummary, update: PreviewUpdate) => void
	updated?: PreviewUpdate
	/** Kinds and answers kept from the preview this one replaced. */
	initialChoices?: SourceImportChoices
	onChoicesChange?: (choices: SourceImportChoices) => void
	posters: FlowPoster[]
}

export function SourceImportChoose(props: ChooseProps) {
	const { summary, initialChoices, onChoicesChange } = props
	const [choices, setChoicesState] = useState<SourceImportChoices>(
		() =>
			initialChoices ?? {
				kinds: availableKinds(summary),
				answers: {},
			},
	)
	const setChoices = (next: SourceImportChoices) => {
		setChoicesState(next)
		onChoicesChange?.(next)
	}
	const inner = { ...props, choices, setChoices }
	return summary.source === "tvtime" ? (
		<TvTimeChoose {...inner} />
	) : summary.source === "wishlist" ? (
		<WishlistChoose {...inner} />
	) : (
		<ChooseAndAsk {...inner} />
	)
}

type InnerProps = ChooseProps & {
	choices: SourceImportChoices
	setChoices: (choices: SourceImportChoices) => void
}

/** TV Time adds background matching and movie matching to the general steps. */
function TvTimeChoose(props: InnerProps) {
	const tvtime = useTvTimeMatching(
		props.summary,
		props.confirming,
		props.onPreviewReplaced,
	)
	return <ChooseAndAsk {...props} tvtime={tvtime} />
}

/** A wishlist file can hold entries without a type, which the member matches by hand. */
function WishlistChoose(props: InnerProps) {
	const { answers } = props.choices
	const wishlist = useWishlistMatching(
		props.summary,
		props.confirming,
		props.onPreviewReplaced,
		() =>
			answers.rewatch === ANSWER.rewatch.add ||
			answers["whole-show"] === ANSWER["whole-show"].add,
	)
	return <ChooseAndAsk {...props} wishlist={wishlist} />
}

type Screen =
	| { at: "choose" }
	/** A question screen, by its question: the set of questions can change while the member answers. */
	| { at: "ask"; question: Question }
	/** The answers keep everything as it is: nothing to import. */
	| { at: "nothing" }

function ChooseAndAsk({
	summary,
	focus,
	confirming,
	error,
	onConfirm,
	onBack,
	updated,
	posters,
	choices,
	setChoices,
	tvtime,
	wishlist,
}: InnerProps & { tvtime?: TvTimeMatching; wishlist?: WishlistMatching }) {
	const src = sourceName(summary.source)
	const thing = sourceThing(summary.source)
	const copy = sourceImportCopy(summary.source)
	const available = availableKinds(summary)
	const { kinds, answers } = choices
	const stillMatching =
		!!tvtime &&
		!!summary.resolution &&
		tvtimeProgress(summary.resolution).active
	const content = sourcePreviewContent(summary, stillMatching)
	// A preview that counts its questions asks them while the import runs; only matching stays before it.
	const live = asksWhileRunning(summary)
	const countNeedsRows = !live && conflictCountNeedsRows(summary)
	const conflicts = useConflictRows(
		"/api/imports",
		summary.id,
		!live && summary.counts.conflict > 0 && !isWishlistOnly(summary),
		countNeedsRows,
	)
	const scoreConflicts = scoreConflictCount(summary, conflicts?.total ?? null)
	// The questions are settled once the conflict count is known, or known to be unknown; until then Import waits.
	const settled = !countNeedsRows || conflicts !== null
	const questions = sourceQuestions({ summary, kinds, scoreConflicts }).filter(
		(question) => !live || question === "matching",
	)
	const [screen, setScreen] = useState<Screen>({ at: "choose" })
	const [dir, setDir] = useState<1 | -1>(1)
	// Focus follows the member's own acts, never arrival.
	const [acted, setActed] = useState(focus)
	const lock = useLockIn()
	const locked = confirming || !!tvtime?.locked || !!wishlist?.locked
	const unapplied = !!tvtime?.unapplied || !!wishlist?.unapplied
	const back = tvtime ? () => tvtime.discardPreview(onBack) : onBack
	// What a lock-in callback reads when it fires: the questions and answers as they are then, not when it was set.
	const latest = useRef({ questions, answers, settled, kinds })
	latest.current = { questions, answers, settled, kinds }

	const go = (next: Screen, d: 1 | -1) => {
		lock.cancel()
		setActed(true)
		setDir(d)
		setScreen(next)
	}
	/** Confirms only when every question that applies now has an explicit answer; otherwise goes to the first open one. */
	const finish = (final: Answers) => {
		const now = latest.current
		if (!now.settled) return go({ at: "choose" }, -1)
		const open = firstUnanswered(now.questions, final)
		if (open) return go({ at: "ask", question: open }, 1)
		if (live) {
			const options = runOptions(summary, now.kinds, isWishlistOnly(summary))
			if (!runWouldWrite(summary, options)) return go({ at: "nothing" }, 1)
			return onConfirm(options)
		}
		if (!sourceWouldWrite(summary, now.kinds, final))
			return go({ at: "nothing" }, 1)
		onConfirm(sourceOptions(summary, now.kinds, final))
	}
	const start = () => {
		if (!settled) return
		setActed(true)
		const first = firstUnanswered(questions, answers)
		if (first) go({ at: "ask", question: first }, 1)
		else finish(answers)
	}
	const answer = (q: Question, value: string) => {
		const next = { ...answers, [q]: value }
		setChoices({ kinds, answers: next })
		// Checking matches opens the panel on this screen; the member moves on from there.
		if (q === "matching" && value === ANSWER.matching.check) return
		lock.lock(q, () => {
			const now = latest.current
			const given = { ...now.answers, [q]: value }
			const at = now.questions.indexOf(q)
			const open = now.questions.filter((item) => waitsForAnswer(given, item))
			const to =
				open.find((item) => now.questions.indexOf(item) > at) ?? open[0]
			if (to === undefined || !now.settled) finish(given)
			else go({ at: "ask", question: to }, 1)
		})
	}

	const asking =
		screen.at === "ask" &&
		content === "some" &&
		settled &&
		questions.includes(screen.question)
			? screen.question
			: null
	// The match panel mounts once the member says they'll check, and stays while they go back and forth between
	// questions, so their place in it and the suggestions it loaded stay too.
	const checking = answers.matching === ANSWER.matching.check
	const panelOpened = useOpenedOnce(checking)
	const onMatching = checking && asking === "matching"
	const panel =
		panelOpened && (tvtime || wishlist) ? (
			<div
				key="match-panel"
				hidden={!onMatching}
				className="mt-6"
				data-match-panel
			>
				{tvtime ? (
					<TvTimeMatchPanel
						summary={summary}
						matching={tvtime}
						visible={onMatching}
						onBack={back}
					/>
				) : wishlist ? (
					<WishlistMatchHost
						summary={summary}
						matching={wishlist}
						visible={onMatching}
						onBack={back}
					/>
				) : null}
			</div>
		) : null
	const unanswered = questions.filter((q) => waitsForAnswer(answers, q)).length
	useReportStep(
		content === "caught-up"
			? { step: 4, notes: [src, "", "", "Up to date"], allDone: true }
			: asking !== null || screen.at === "nothing"
				? {
						step: 3,
						notes: [
							src,
							plural(kinds.length, "kind"),
							unanswered ? `${formatCount(unanswered)} to answer` : "",
							"",
						],
						allDone: false,
					}
				: { step: 2, notes: [src, "", "", ""], allDone: false, back },
	)

	if (content === "caught-up")
		return (
			<CaughtUp
				source={src}
				thing={thing}
				count={isWishlistOnly(summary) ? summary.counts.unchanged : null}
				posters={posters}
				focus={focus}
				onBack={onBack}
				skipped={
					leftOutCount(summary) > 0
						? {
								count: leftOutCount(summary),
								url: sourceSkippedDownloadUrl(summary.id),
								reasons: (
									<SkippedReasons
										summary={summary}
										wishlist={summary.source === "wishlist"}
									/>
								),
							}
						: undefined
				}
			/>
		)
	if (content === "nothing")
		return (
			<NothingToBring
				source={src}
				thing={thing}
				rows={summary.counts.rows}
				skippedUrl={sourceSkippedDownloadUrl(summary.id)}
				focus={focus}
				onBack={back}
			/>
		)

	if (screen.at === "nothing")
		return (
			<Slide key="nothing" dir={1}>
				<section className="flex flex-col gap-4">
					<StepHeading focus={acted}>
						Nothing changes with these answers
					</StepHeading>
					<p className="text-gray-300">
						Your answers keep everything in GoodWatch as it is, so there's
						nothing to import.
					</p>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={primaryButton}
							onClick={() => {
								const last = questions.at(-1)
								go(last ? { at: "ask", question: last } : { at: "choose" }, -1)
							}}
						>
							Change my answers
						</button>
						<button type="button" className={secondaryButton} onClick={back}>
							Pick another file
						</button>
					</div>
				</section>
			</Slide>
		)

	if (asking !== null) {
		const q = asking
		const index = questions.indexOf(q)
		const previous = index > 0 ? questions[index - 1] : null
		return (
			<>
				<Slide key={`ask:${q}`} dir={dir}>
					<Ask
						question={q}
						index={index}
						of={questions.length}
						focus={acted}
						summary={summary}
						source={src}
						thing={thing}
						scoreConflicts={scoreConflicts}
						conflictRows={conflicts?.rows ?? null}
						picked={answers[q]}
						locked={lock.locking === q || confirming}
						confirming={confirming}
						unapplied={unapplied}
						error={error}
						onAnswer={(value) => answer(q, value)}
						onBack={() =>
							go(
								previous ? { at: "ask", question: previous } : { at: "choose" },
								-1,
							)
						}
						tvtime={tvtime}
					/>
				</Slide>
				{panel}
			</>
		)
	}

	const toggle = (kind: (typeof available)[number]) =>
		setChoices({
			kinds: kinds.includes(kind)
				? kinds.filter((item) => item !== kind)
				: [...kinds, kind],
			answers,
		})
	const explicitChoices = summary.wishlistRewatchChoiceCount !== undefined
	return (
		<>
			<Slide key="choose" dir={dir}>
				<section className="flex flex-col gap-6" data-choose>
					<button
						type="button"
						onClick={back}
						className={backClass}
						disabled={locked}
					>
						<BackArrow />
						{tvtime?.cancel.isPending ? "Discarding preview" : "Back"}
					</button>
					<StepHeading focus={acted}>What should come in?</StepHeading>
					{tvtime && updated && <TvTimeUpdatedNotice update={updated} />}
					{wishlist && updated && (
						<p className={infoBox}>
							Updated with your changes. The counts include them.
							{updated.rewatchReset &&
								(explicitChoices
									? " Your answers about titles you've seen were reset. You'll be asked again."
									: " Your answer about titles you've already seen was reset.")}
						</p>
					)}
					{tvtime && (
						<TvTimeLookupNotices summary={summary} matching={tvtime} />
					)}
					<fieldset>
						<legend className="sr-only">From {src}</legend>
						<ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-gray-900/70 ring-1 ring-white/10">
							{available.map((kind) => (
								<li key={kind}>
									<label className="flex min-h-14 cursor-pointer items-center gap-4 px-4 py-3 hover:bg-white/5 sm:px-5">
										<input
											type="checkbox"
											checked={kinds.includes(kind)}
											onChange={() => toggle(kind)}
											disabled={locked}
											className="size-5 shrink-0 cursor-pointer accent-amber-400"
										/>
										<span
											className={`flex-1 font-semibold ${kinds.includes(kind) ? "text-white" : "text-gray-400"}`}
										>
											{KIND_NAME[kind]}
										</span>
										<span
											className={`tabular-nums ${kinds.includes(kind) ? "text-gray-200" : "text-gray-500"}`}
										>
											{formatCount(summary.kinds[kind] ?? 0)}
										</span>
									</label>
								</li>
							))}
						</ul>
					</fieldset>
					<ImportNotes warnings={summary.warnings} title={copy.details} />
					<button
						type="button"
						className={`${primaryButton} w-full sm:w-auto sm:min-w-56 sm:self-start`}
						disabled={kinds.length === 0 || locked || unapplied || !settled}
						aria-busy={!settled || undefined}
						data-checking={!settled || undefined}
						aria-describedby={
							kinds.length === 0
								? "source-import-required"
								: unapplied
									? "source-import-unapplied"
									: undefined
						}
						onClick={start}
					>
						{confirming
							? "Starting import"
							: !settled
								? `Checking your ${thing}…`
								: stillMatching
									? "Import what's matched so far"
									: "Import"}
					</button>
					{kinds.length === 0 && (
						<p
							id="source-import-required"
							className="-mt-3 text-sm text-gray-300"
						>
							Select at least one kind to import.
						</p>
					)}
					{unapplied && (
						<p
							id="source-import-unapplied"
							className="-mt-3 text-sm text-gray-300"
						>
							Your matches aren't in this preview yet. Choose Update preview to
							add them, or Discard changes.
						</p>
					)}
					{stillMatching && (
						<p className="-mt-3 text-sm text-gray-300">
							GoodWatch is still matching. Importing now brings in only what's
							matched so far, and matching stops.
						</p>
					)}
					<div aria-live="assertive">
						{error && <p className={errorBox}>{error}</p>}
					</div>
				</section>
			</Slide>
			{panel}
		</>
	)
}

/** One question's screen, with its fact, its examples, and its answers. */
function Ask({
	question,
	index,
	of,
	focus,
	summary,
	source,
	thing,
	scoreConflicts,
	conflictRows,
	picked,
	locked,
	confirming,
	unapplied,
	error,
	onAnswer,
	onBack,
	tvtime,
}: {
	question: Question
	index: number
	of: number
	focus: boolean
	summary: ImportSummary
	source: string
	thing: string
	/** Null when the count couldn't load: the question asks without a number. */
	scoreConflicts: number | null
	conflictRows: ConflictRow[] | null
	picked: string | undefined
	locked: boolean
	confirming: boolean
	unapplied: boolean
	error: string | null
	onAnswer: (value: string) => void
	onBack: () => void
	tvtime?: TvTimeMatching
}) {
	let title: React.ReactNode
	let body: React.ReactNode = null
	let answers: React.ReactNode
	let after: React.ReactNode = null
	switch (question) {
		case "conflicts": {
			const n = scoreConflicts
			const scores = conflictsAreScores(
				conflictRows?.map((row) => row.kind) ?? null,
			)
			title =
				n === null
					? `If anything in your ${source} ${thing} differs from what you have in GoodWatch, keep yours?`
					: scores
						? `${plural(n, "score")} in your ${source} ${thing} ${oneOrMany(n, "differs", "differ")} from yours in GoodWatch. Keep yours?`
						: `${plural(n, "entry", "entries")} in your ${source} ${thing} ${oneOrMany(n, "differs", "differ")} from what you have in GoodWatch. Keep yours?`
			body = (
				<ConflictExamples
					importId={summary.id}
					rows={conflictRows}
					source={source}
				/>
			)
			answers = (
				<>
					<Answer
						selected={picked === ANSWER.conflicts.keep}
						recommended
						title={scores ? "Yes, keep my scores" : "Yes, keep mine"}
						onClick={() => onAnswer(ANSWER.conflicts.keep)}
					/>
					<Answer
						selected={picked === ANSWER.conflicts.source}
						title={`No, use ${source}'s`}
						note={
							summary.source === "tvtime" &&
							summary.wishlistRewatchChoiceCount === undefined
								? "For later titles you've already seen also come in as Want to rewatch."
								: undefined
						}
						onClick={() => onAnswer(ANSWER.conflicts.source)}
					/>
				</>
			)
			break
		}
		case "rewatch": {
			const n = rewatchCount(summary)
			const it = oneOrMany(n, "it", "them")
			title = (
				<>
					{plural(n, "title")} in your {source} {thing}{" "}
					{oneOrMany(n, "is", "are")} already <ListName>Seen</ListName>. Add{" "}
					{it} to <ListName>Want to rewatch</ListName>?
				</>
			)
			answers = (
				<>
					<Answer
						selected={picked === ANSWER.rewatch.add}
						title={
							<>
								Yes, add to <ListName>Want to rewatch</ListName>
							</>
						}
						onClick={() => onAnswer(ANSWER.rewatch.add)}
					/>
					<Answer
						selected={picked === ANSWER.rewatch.leave}
						recommended
						title={
							<>
								No, leave {it} as <ListName>Seen</ListName>
							</>
						}
						onClick={() => onAnswer(ANSWER.rewatch.leave)}
					/>
				</>
			)
			break
		}
		case "whole-show": {
			const n = wholeShowCount(summary)
			const shows = oneOrMany(n, "show", "shows")
			title = (
				<>
					Your {source} {thing} lists seasons or episodes of {plural(n, "show")}
					. Add the whole {shows} to <ListName>Want to See</ListName>?
				</>
			)
			body = <p className="text-gray-400">No episode progress comes in.</p>
			answers = (
				<>
					<Answer
						selected={picked === ANSWER["whole-show"].add}
						title={`Yes, add the whole ${shows}`}
						onClick={() => onAnswer(ANSWER["whole-show"].add)}
					/>
					<Answer
						selected={picked === ANSWER["whole-show"].leave}
						recommended
						title={`No, leave ${oneOrMany(n, "it", "them")} out`}
						onClick={() => onAnswer(ANSWER["whole-show"].leave)}
					/>
				</>
			)
			break
		}
		case "matching": {
			const n = matchableCount(summary)
			const them = oneOrMany(n, "it", "them")
			title = tvtime
				? `GoodWatch isn't sure about ${plural(n, "movie")} in your TV Time file. Check ${them} now?`
				: n === 1
					? `Your file doesn't say whether 1 entry is a movie or a show. Check it now?`
					: `Your file doesn't say whether ${formatCount(n)} entries are movies or shows. Check them now?`
			const checking = picked === ANSWER.matching.check
			// Background matching can publish a new preview while the member matches: say so here too.
			body = tvtime && (
				<TvTimeLookupNotices summary={summary} matching={tvtime} />
			)
			answers = (
				<>
					<Answer
						selected={checking}
						title={`Yes, check ${them}`}
						onClick={() => {
							void loadMatchPanel()
							onAnswer(ANSWER.matching.check)
						}}
					/>
					<Answer
						selected={picked === ANSWER.matching.leave}
						recommended
						title={`No, leave ${them} out`}
						disabled={unapplied}
						describedBy={unapplied ? "import-match-unapplied" : undefined}
						onClick={() => onAnswer(ANSWER.matching.leave)}
					/>
				</>
			)
			after = unapplied && (
				<p id="import-match-unapplied" className="text-sm text-gray-300">
					Your matches aren't in this preview yet. Choose Update preview to add
					them, or Discard changes.
				</p>
			)
			break
		}
	}
	return (
		<QuestionScreen
			number={index + 1}
			of={of}
			focus={focus}
			onBack={confirming ? undefined : onBack}
			title={title}
			body={body}
			locked={locked}
			answers={answers}
			after={
				<>
					{after}
					<div aria-live="polite">
						{confirming && (
							<p className="flex items-center gap-2 text-gray-300">
								<CheckIcon className="size-5 text-amber-300" aria-hidden />
								Starting your import
							</p>
						)}
					</div>
					<div aria-live="assertive">
						{error && <p className={errorBox}>{error}</p>}
					</div>
				</>
			}
		/>
	)
}

/** A few titles whose score differs, each with the member's score and the file's. */
export function ConflictExamples({
	importId,
	rows,
	source,
	api = "/api/imports",
}: {
	importId: string
	rows: ConflictRow[] | null
	source: string
	api?: "/api/imports" | "/api/imdb-import"
}) {
	const posters = useImportPosters(api, importId, {
		outcome: "conflict",
		limit: 12,
		enabled: !!rows?.length,
	})
	const scored = (rows ?? []).filter(
		(row) => row.yours !== null && row.theirs !== null,
	)
	const byKey = new Map(posters.map((poster) => [poster.key, poster]))
	const shown: (FlowPoster & { yours: number; theirs: number })[] = []
	for (const row of scored) {
		const poster = byKey.get(row.key)
		if (!poster || shown.some((item) => item.key === row.key)) continue
		shown.push({ ...poster, yours: row.yours ?? 0, theirs: row.theirs ?? 0 })
		if (shown.length === 6) break
	}
	if (!shown.length) return null
	return (
		<PosterRow
			posters={shown}
			note={(poster) => {
				const found = shown.find((item) => item.key === poster.key)
				return found ? `yours ${found.yours} · ${source} ${found.theirs}` : null
			}}
		/>
	)
}

/** A file with nothing new: everything in it is already in GoodWatch. */
export function CaughtUp({
	source,
	thing,
	count,
	posters,
	focus,
	onBack,
	skipped,
}: {
	source: string
	thing: string
	/** Titles in the file, when every row is one title. */
	count: number | null
	posters: FlowPoster[]
	focus: boolean
	onBack: () => void
	/** Entries that couldn't come in: how many, the CSV with reasons, and a fold that lists them when cheap. */
	skipped?: { count: number; url: string; reasons?: ReactNode }
}) {
	return (
		<section className="flex flex-col gap-6" data-caught-up>
			<div className="flex flex-col items-center gap-5 rounded-3xl bg-amber-400/5 px-5 py-8 text-center ring-1 ring-amber-400/30 sm:px-8">
				<span className="flex size-16 items-center justify-center rounded-full bg-amber-400 text-gray-950 shadow-[0_0_0_10px_rgb(251_191_36/0.12)]">
					<CheckIcon className="size-9" aria-hidden />
				</span>
				<div className="flex flex-col gap-2">
					<StepHeading focus={focus}>You're all caught up</StepHeading>
					<p className="text-lg text-gray-200">
						{count
							? `${skipped?.count ? "" : "All "}${plural(count, "title")} from this ${source} ${thing} ${oneOrMany(count, "is", "are")} already in GoodWatch.`
							: skipped?.count
								? `Everything GoodWatch can bring in from this ${source} ${thing} is already there.`
								: `Everything in this ${source} ${thing} is already in GoodWatch.`}
					</p>
				</div>
				<PosterStack posters={posters} max={10} />
			</div>
			{skipped && skipped.count > 0 && (
				<div className="flex flex-col gap-2" data-caught-up-skipped>
					<p className="text-gray-200">
						{plural(skipped.count, "entry", "entries")} from your {source}{" "}
						{thing} couldn't come in.
					</p>
					{skipped.reasons}
					<a
						href={skipped.url}
						download
						className={`${textLink} inline-flex min-h-11 items-center gap-2 self-start`}
					>
						<ArrowDownTrayIcon className="size-4 shrink-0" aria-hidden />
						Download the list with reasons (CSV file)
					</a>
				</div>
			)}
			<div className="flex flex-col gap-3">
				<p className="text-gray-400">
					{thing === "file"
						? `Made changes on ${source} since then? Export a fresh file and drop it in.`
						: `Made changes on ${source} since then? Connect again to bring them in.`}
				</p>
				<div className="flex flex-wrap gap-3">
					<Link to="/my-library/scores" className={primaryButton}>
						See your scores
					</Link>
					<button type="button" className={secondaryButton} onClick={onBack}>
						{thing === "file" ? "Pick another file" : "Back"}
					</button>
				</div>
			</div>
		</section>
	)
}

const LEFT_OUT = ["unmatched", "unsupported", "invalid"] as const

/** The entries that couldn't come in, by reason, each opening to its titles. */
function SkippedReasons({
	summary,
	wishlist,
}: {
	summary: ImportSummary
	wishlist: boolean
}) {
	const [open, setOpen] = useState(false)
	return (
		<Disclosure
			label="Why they couldn't come in"
			open={open}
			onToggle={setOpen}
			bordered={false}
		>
			<ul className="divide-y divide-slate-800 rounded-lg border border-slate-700">
				{LEFT_OUT.filter((outcome) => summary.counts[outcome] > 0).map(
					(outcome) => (
						<SourceOutcomeRow
							key={outcome}
							importId={summary.id}
							outcome={outcome}
							count={summary.counts[outcome]}
							wishlist={wishlist}
						/>
					),
				)}
			</ul>
		</Disclosure>
	)
}

/** A file with nothing GoodWatch can bring in: no row matched a title it takes. */
export function NothingToBring({
	source,
	thing,
	rows,
	skippedUrl,
	focus,
	onBack,
}: {
	source: string
	thing: string
	rows: number
	skippedUrl: string
	focus: boolean
	onBack: () => void
}) {
	return (
		<ProblemCard
			title={`Nothing in this ${source} ${thing} can come in`}
			focus={focus}
		>
			<p>
				GoodWatch couldn't match any of the {plural(rows, "entry", "entries")}{" "}
				to a movie or show it can import.
			</p>
			<a
				href={skippedUrl}
				download
				className={`${textLink} inline-flex min-h-11 items-center gap-2 self-start`}
			>
				<ArrowDownTrayIcon className="size-4 shrink-0" aria-hidden />
				Download the list with reasons (CSV file)
			</a>
			<div>
				<button type="button" className={secondaryButton} onClick={onBack}>
					{thing === "file" ? "Pick another file" : "Back"}
				</button>
			</div>
		</ProblemCard>
	)
}
