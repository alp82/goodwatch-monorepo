// An import after Choose, when its questions come while it runs: the progress strip over one question per screen,
// each with Decide later; the run view while nothing is asked; and Done, which lists what's left to decide with a
// Decide button each. An answer is sent when it's picked and only moves on once it's in, so a refused answer stays
// on its screen, unpicked, with the reason.
import { type ReactNode, useMemo, useRef, useState } from "react"
import type { ImportAnswer, ImportQuestion } from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import type { LeftToDecide } from "./ImportDone"
import { useImportPosters } from "./ImportFlowData"
import {
	Answer,
	type FlowPoster,
	ListName,
	Poster,
	PosterRow,
	QuestionScreen,
	Slide,
	useLockIn,
	useReportStep,
} from "./ImportFlowParts"
import { useDecide, useHeldRows } from "./ImportQuestionsData"
import type { ImportResultApi } from "./ImportResult"
import { ProgressStrip, type RunSummary } from "./ImportRun"
import {
	formatCount,
	oneOrMany,
	plural,
	runProgress,
} from "./import-flow-model"
import {
	type HeldTitle,
	type LiveQuestion,
	type QuestionScreen as Screen,
	type ScreenInput,
	applyingCount,
	conflictTitlesLeft,
	isScoreTitle,
	leftToDecide,
	openScreens,
	questionCounter,
	questionSize,
	scoreArticle,
	unloadedConflicts,
} from "./import-questions-model"
import { errorBox, textLink } from "./shared"

/** What the run view shows besides the import: questions put off, and whether any was answered. */
export interface RunExtras {
	putOff: number
	answered: boolean
	note?: string
}

export function ImportWithQuestions({
	api,
	id,
	summary,
	questions,
	asked,
	source,
	thing,
	focus,
	startedHere,
	resume,
	renderRun,
	renderDone,
	notes,
}: {
	api: ImportResultApi
	id: string
	summary: RunSummary
	questions: LiveQuestion[]
	/** Confirm deferred questions, so they come even before the first count arrives. */
	asked: boolean
	/** The source's name in a sentence: "Trakt". */
	source: string
	thing: "file" | "account"
	focus: boolean
	/** The member pressed Import on this visit: the questions start right away. Otherwise Done lists them. */
	startedHere: boolean
	/** Continue for a run that stopped. */
	resume: { pending: boolean; run: () => void; error: string | null }
	renderRun: (extras: RunExtras) => ReactNode
	renderDone: (left: LeftToDecide) => ReactNode
	notes: [string, string]
}) {
	const [deferred, setDeferred] = useState(!startedHere)
	const [acted, setActed] = useState(focus || startedHere)
	/** Topic the member chose to decide from Done. Its first screen comes first. */
	const [target, setTarget] = useState<ImportQuestion | null>(null)
	/** Screens answered on this visit, in order, for the counter. */
	const [order, setOrder] = useState<string[]>([])
	/** The screen whose answer is locking in or on its way, which stays until the answer is in. */
	const [stay, setStay] = useState<{
		screen: Screen
		picked: ImportAnswer
	} | null>(null)
	const [sameForAll, setSameForAll] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const lock = useLockIn()
	const attempt = useRef({ locked: false, sent: false })
	const decide = useDecide(api, id)

	const waiting = (kind: ImportQuestion) =>
		questions.find((question) => question.kind === kind && !question.answer)
			?.waiting ?? 0
	const conflictRows = useHeldRows(api, id, "conflict", waiting("conflict"))
	const rewatchRows = useHeldRows(api, id, "rewatch", waiting("rewatch"))
	const showRows = useHeldRows(api, id, "wholeShow", waiting("wholeShow"))
	const held = {
		conflict: conflictRows.rows,
		rewatch: rewatchRows.rows,
		wholeShow: showRows.rows,
	}
	const answered = useMemo(() => new Set(order), [order])
	const input: ScreenInput = { questions, held, answered }
	const screens = openScreens(input)
	const left = leftToDecide(questions)
	const posters = useImportPosters(api, id, {
		outcome: "conflict",
		limit: 48,
		enabled: left.length > 0 || !!stay,
	})
	const allPosters = useImportPosters(api, id)

	const pickScreen = (): Screen | "loading" | null => {
		if (stay) return stay.screen
		if (deferred) return null
		const first =
			screens.find((screen) => screen.q === target) ??
			(target === "conflict" && unloadedConflicts(input) > 0
				? null
				: screens[0]) ??
			null
		if (first) return first
		// Rows held for a question are still on their way: the question waits on screen rather than leaving it.
		const expecting =
			(asked && questions.length === 0 && summary.status !== "done") ||
			unloadedConflicts(input) > 0
		return expecting ? "loading" : null
	}
	const shown = pickScreen()

	const applying = applyingCount(questions)
	const open = screens.length + unloadedConflicts(input)
	const stripNote = [
		open > 0 && !deferred ? `${plural(open, "question")} left` : "",
		applying > 0 ? `${formatCount(applying)} from your answers coming in` : "",
	]
		.filter(Boolean)
		.join(" · ")

	const answer = (screen: Screen, value: ImportAnswer, all: boolean) => {
		setActed(true)
		setError(null)
		setStay({ screen, picked: value })
		attempt.current = { locked: false, sent: false }
		const mine = attempt.current
		const moveOn = () => {
			if (!mine.locked || !mine.sent || attempt.current !== mine) return
			setStay(null)
			setSameForAll(false)
		}
		lock.lock(screen.key, () => {
			mine.locked = true
			moveOn()
		})
		const conflictKeys = all
			? [
					...screens
						.filter((item) => item.q === "conflict")
						.map((item) => item.key),
					...Array.from(
						{ length: unloadedConflicts(input) },
						(_, at) => `conflict:+${at}`,
					),
				]
			: []
		decide.mutate(
			{
				question: screen.q,
				answer: value,
				rows: screen.q === "conflict" && !all ? screen.title.rows : undefined,
			},
			{
				onSuccess: () => {
					setOrder((before) => [
						...new Set([...before, screen.key, ...conflictKeys]),
					])
					mine.sent = true
					moveOn()
				},
				onError: (failure) => {
					if (attempt.current !== mine) return
					lock.cancel()
					setStay(null)
					setError(failure.message)
				},
			},
		)
	}
	const later = () => {
		lock.cancel()
		attempt.current = { locked: false, sent: false }
		setActed(true)
		setStay(null)
		setError(null)
		setSameForAll(false)
		setTarget(null)
		setDeferred(true)
	}
	const decideNow = (kind: ImportQuestion) => {
		setActed(true)
		setError(null)
		setTarget(kind)
		setDeferred(false)
	}

	if (shown) {
		const pct = Math.round(runProgress(summary) * 100)
		const stopped = summary.status === "failed" || summary.stalled
		return (
			<div className="flex flex-col gap-6">
				<ProgressStrip
					summary={summary}
					posters={allPosters}
					label={
						summary.status === "done"
							? `Your ${source} titles are in`
							: `Importing your ${source} titles`
					}
					note={stripNote}
					resume={resume}
				/>
				<div aria-live="assertive">
					{resume.error && <p className={errorBox}>{resume.error}</p>}
				</div>
				<AskStep
					notes={notes}
					third={
						stopped
							? "Stopped"
							: open
								? `${formatCount(open)} to answer`
								: `${pct}%`
					}
				/>
				{shown === "loading" ? (
					<section
						className="flex min-h-40 flex-col items-start gap-3"
						data-question-loading
						aria-live="polite"
					>
						{conflictRows.failed ? (
							<>
								<p className="text-red-200">
									GoodWatch couldn't load the titles to ask about.
								</p>
								<div className="flex flex-wrap gap-x-5 gap-y-2">
									<button
										type="button"
										className={`${textLink} min-h-11`}
										onClick={conflictRows.retry}
									>
										Try again
									</button>
									<button
										type="button"
										className={`${textLink} min-h-11`}
										onClick={later}
									>
										Decide later
									</button>
								</div>
							</>
						) : (
							<div className="flex items-center gap-2 text-gray-400">
								<Spinner size="small" /> Getting your questions ready
							</div>
						)}
					</section>
				) : (
					<Slide key={shown.key} dir={1}>
						<Ask
							screen={shown}
							input={input}
							order={order}
							source={source}
							thing={thing}
							focus={acted}
							posters={posters}
							picked={stay?.screen.key === shown.key ? stay.picked : undefined}
							locked={!!stay}
							sameForAll={sameForAll}
							onSameForAll={setSameForAll}
							error={error}
							onAnswer={(value) =>
								answer(shown, value, shown.q === "conflict" && sameForAll)
							}
							onLater={later}
						/>
					</Slide>
				)}
			</div>
		)
	}

	if (summary.status === "running" || summary.status === "failed")
		return (
			<>
				{renderRun({
					putOff: deferred ? left.length : 0,
					answered: order.length > 0,
					note: stripNote || undefined,
				})}
			</>
		)

	return (
		<>
			{renderDone({
				count: left.length,
				node: (
					<LeftList
						kinds={left}
						input={input}
						source={source}
						onDecide={decideNow}
					/>
				),
			})}
		</>
	)
}

/** The stepper while a question is on screen. */
function AskStep({ notes, third }: { notes: [string, string]; third: string }) {
	useReportStep({
		step: 3,
		notes: [notes[0], notes[1], third, ""],
		allDone: false,
	})
	return null
}

/** One question's screen while the import runs. */
function Ask({
	screen,
	input,
	order,
	source,
	thing,
	focus,
	posters,
	picked,
	locked,
	sameForAll,
	onSameForAll,
	error,
	onAnswer,
	onLater,
}: {
	screen: Screen
	input: ScreenInput
	order: readonly string[]
	source: string
	thing: "file" | "account"
	focus: boolean
	posters: FlowPoster[]
	/** The member's answer, while it locks in. Nothing is picked before that. */
	picked: ImportAnswer | undefined
	locked: boolean
	sameForAll: boolean
	onSameForAll: (all: boolean) => void
	error: string | null
	onAnswer: (answer: ImportAnswer) => void
	onLater: () => void
}) {
	const { number, of } = questionCounter(input, order, screen.key)
	const posterOf = (key: string) =>
		posters.find((poster) => poster.key === key) ?? null
	let title: ReactNode
	let body: ReactNode = null
	let answers: ReactNode
	switch (screen.q) {
		case "conflict": {
			const t = screen.title
			const all = conflictTitlesLeft(input)
			const scores = openScreens(input).every(
				(item) => item.q !== "conflict" || isScoreTitle(item.title),
			)
			title = conflictTitle(t, source)
			body = <ConflictBody title={t} poster={posterOf(t.posterKey)} />
			const mine = isScoreTitle(t) ? `my ${t.yours}` : "mine"
			const theirs = isScoreTitle(t) ? `${source}'s ${t.theirs}` : `${source}'s`
			answers = (
				<>
					{all > 1 && (
						<label className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-full border-2 border-slate-700 px-4 text-sm font-semibold text-gray-300 hover:border-slate-500 has-checked:border-amber-400 has-checked:bg-amber-400/10 has-checked:text-amber-100">
							<input
								type="checkbox"
								name="same-for-all"
								checked={sameForAll}
								onChange={() => onSameForAll(!sameForAll)}
								className="size-4 cursor-pointer accent-amber-400"
							/>
							Same answer for all {formatCount(all)}
						</label>
					)}
					<Answer
						selected={picked === "keep"}
						recommended
						title={
							sameForAll
								? scores
									? "Yes, keep my GoodWatch scores"
									: "Yes, keep mine in GoodWatch"
								: `Yes, keep ${mine}`
						}
						onClick={() => onAnswer("keep")}
					/>
					<Answer
						selected={picked === "source"}
						title={
							sameForAll
								? scores
									? `No, use ${source}'s scores`
									: `No, use ${source}'s`
								: `No, use ${theirs}`
						}
						onClick={() => onAnswer("source")}
					/>
				</>
			)
			break
		}
		case "rewatch": {
			const n = questionSize(input, "rewatch")
			const it = oneOrMany(n, "it", "them")
			title = (
				<>
					{plural(n, "title")} in your {source} {thing}{" "}
					{oneOrMany(n, "is", "are")} already <ListName>Seen</ListName>. Add{" "}
					{it} to <ListName>Want to rewatch</ListName>?
				</>
			)
			body = <HeldPosters input={input} kind="rewatch" posterOf={posterOf} />
			answers = (
				<>
					<Answer
						selected={picked === "add"}
						title={
							<>
								Yes, add to <ListName>Want to rewatch</ListName>
							</>
						}
						onClick={() => onAnswer("add")}
					/>
					<Answer
						selected={picked === "leave"}
						recommended
						title={
							<>
								No, leave {it} as <ListName>Seen</ListName>
							</>
						}
						onClick={() => onAnswer("leave")}
					/>
				</>
			)
			break
		}
		case "wholeShow": {
			const n = questionSize(input, "wholeShow")
			const shows = oneOrMany(n, "show", "shows")
			title = (
				<>
					Your {source} {thing} lists seasons or episodes of {plural(n, "show")}
					. Add the whole {shows} to <ListName>Want to See</ListName>?
				</>
			)
			body = (
				<>
					<HeldPosters input={input} kind="wholeShow" posterOf={posterOf} />
					<p className="text-gray-400">No episode progress comes in.</p>
				</>
			)
			answers = (
				<>
					<Answer
						selected={picked === "add"}
						title={`Yes, add the whole ${shows}`}
						onClick={() => onAnswer("add")}
					/>
					<Answer
						selected={picked === "leave"}
						recommended
						title={`No, leave ${oneOrMany(n, "it", "them")} out`}
						onClick={() => onAnswer("leave")}
					/>
				</>
			)
			break
		}
		case "undated": {
			const n = questionSize(input, "undated")
			const it = oneOrMany(n, "it", "them")
			title = (
				<>
					{plural(n, "watch", "watches")} in your {source} {thing}{" "}
					{oneOrMany(n, "has", "have")} no date. Add {it} to{" "}
					<ListName>Seen</ListName> anyway?
				</>
			)
			body = (
				<p className="text-gray-400">
					Your watches with a date are already going in.
				</p>
			)
			answers = (
				<>
					<Answer
						selected={picked === "add"}
						recommended
						title={`Yes, add ${it} without a date`}
						onClick={() => onAnswer("add")}
					/>
					<Answer
						selected={picked === "leave"}
						title={`No, leave ${it} out`}
						onClick={() => onAnswer("leave")}
					/>
				</>
			)
			break
		}
	}
	return (
		<QuestionScreen
			number={number}
			of={of}
			focus={focus}
			title={title}
			body={body}
			locked={locked}
			answers={answers}
			after={
				<>
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-white/10 pt-4 text-sm">
						<button
							type="button"
							className={`${textLink} min-h-11`}
							onClick={onLater}
							data-decide-later
						>
							Decide later
						</button>
						<span className="text-gray-400">
							Nothing here changes until you answer.
						</span>
					</div>
					<div aria-live="assertive" data-question-error>
						{error && <p className={errorBox}>{error}</p>}
					</div>
				</>
			}
		/>
	)
}

const ENTRY_NAME: Partial<Record<string, string>> = {
	review: "review",
	show_status: "show status",
	watch: "watch",
	want: "Want to See",
	favorite: "favorite",
}

const named = (t: HeldTitle) => (t.part ? `${t.title} ${t.part}` : t.title)

/** "You gave Breaking Bad a 9 in GoodWatch. Trakt has 10. Keep your 9?" */
function conflictTitle(t: HeldTitle, source: string) {
	if (isScoreTitle(t))
		return `You gave ${named(t)} ${scoreArticle(t.yours ?? 0)} ${t.yours} in GoodWatch. ${source} has ${t.theirs}. Keep your ${t.yours}?`
	const what = ENTRY_NAME[t.kinds[0] ?? ""] ?? "entry"
	return `Your ${what} for ${named(t)} in GoodWatch differs from ${source}'s. Keep yours?`
}

function ConflictBody({
	title,
	poster,
}: { title: HeldTitle; poster: FlowPoster | null }) {
	return (
		<div className="flex items-end gap-4">
			<Poster
				poster={
					poster ?? { key: title.key, title: title.title, posterPath: null }
				}
				className="w-24 sm:w-28"
			/>
			{title.rows.length > 1 && (
				<p className="text-sm text-gray-400">
					{plural(title.rows.length, "entry", "entries")} for this title follow
					this answer.
				</p>
			)}
		</div>
	)
}

/** A few of the titles a yes/no question holds. */
function HeldPosters({
	input,
	kind,
	posterOf,
}: {
	input: ScreenInput
	kind: ImportQuestion
	posterOf: (key: string) => FlowPoster | null
}) {
	const shown: FlowPoster[] = []
	for (const row of input.held[kind] ?? []) {
		const poster = posterOf(row.posterKey)
		if (poster && !shown.some((item) => item.key === poster.key))
			shown.push(poster)
		if (shown.length === 6) break
	}
	return shown.length ? <PosterRow posters={shown} /> : null
}

/** What stays as it is while a question has no answer. Plain text: Done sets nothing apart. */
function leftLine(kind: ImportQuestion, input: ScreenInput, source: string) {
	const n = questionSize(input, kind)
	switch (kind) {
		case "conflict": {
			const scores = openScreens(input).every(
				(item) => item.q !== "conflict" || isScoreTitle(item.title),
			)
			return scores
				? `${plural(n, "score")} that ${oneOrMany(n, "differs from", "differ from")} ${source} ${oneOrMany(n, "stays", "stay")} as you have ${oneOrMany(n, "it", "them")}.`
				: `${plural(n, "entry", "entries")} that ${oneOrMany(n, "differs from", "differ from")} ${source} ${oneOrMany(n, "stays", "stay")} as you have ${oneOrMany(n, "it", "them")}.`
		}
		case "undated":
			return `${plural(n, "watch", "watches")} without a date ${oneOrMany(n, "isn't", "aren't")} on Seen yet.`
		case "rewatch":
			return `${plural(n, "title")} ${oneOrMany(n, "stays", "stay")} Seen, not on Want to rewatch.`
		case "wholeShow":
			return `${plural(n, "show")} with seasons or episodes ${oneOrMany(n, "stays", "stay")} off Want to See.`
	}
}

/** Short name of a question, for screen readers on its Decide button. */
function topicLabel(kind: ImportQuestion, input: ScreenInput) {
	const n = questionSize(input, kind)
	switch (kind) {
		case "conflict":
			return `${plural(n, "title")} that ${oneOrMany(n, "differs", "differ")} from yours`
		case "undated":
			return `${plural(n, "watch", "watches")} without a date`
		case "rewatch":
			return `${plural(n, "Seen title")} on your wishlist`
		case "wholeShow":
			return `${plural(n, "show")} listed by season or episode`
	}
}

/** Done's list of questions left, each with Decide, which opens its first screen. */
function LeftList({
	kinds,
	input,
	source,
	onDecide,
}: {
	kinds: ImportQuestion[]
	input: ScreenInput
	source: string
	onDecide: (kind: ImportQuestion) => void
}) {
	return (
		<div
			className="rounded-2xl bg-amber-400/5 p-5 ring-1 ring-amber-400/30"
			data-left-to-decide
		>
			<h3 className="text-lg font-bold text-white">
				{formatCount(kinds.length)} left to decide
			</h3>
			<p className="mt-1 text-sm text-gray-400">
				Nothing from {oneOrMany(kinds.length, "this", "these")} changed yet.
			</p>
			<ul className="mt-2 divide-y divide-white/10">
				{kinds.map((kind) => (
					<li
						key={kind}
						className="flex items-center gap-3 py-3"
						data-left={kind}
					>
						<span className="min-w-0 flex-1 text-gray-200">
							{leftLine(kind, input, source)}
						</span>
						<button
							type="button"
							className={`${textLink} min-h-11`}
							aria-label={`Decide: ${topicLabel(kind, input)}`}
							onClick={() => onDecide(kind)}
						>
							Decide
						</button>
					</li>
				))}
			</ul>
		</div>
	)
}
