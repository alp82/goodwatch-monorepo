// The Done step: what the import changed as count tiles (the member's new total per kind, with what came in and what
// came off), what stayed, what couldn't come in, a question when the import took titles off a list, and Undo. After an
// Undo the same place says it's undone, and what Undo couldn't put back.
import { ArrowDownTrayIcon } from "@heroicons/react/20/solid"
import { CheckIcon } from "@heroicons/react/20/solid"
import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import type {
	ImportResult as ImportResultData,
	ImportResultRow,
	ImportResultSection,
} from "~/domain/import-result"
import { useUserData } from "~/routes/api.user-data"
import { Spinner } from "~/ui/wait/Spinner"
import {
	Answer,
	Disclosure,
	type FlowPoster,
	ListName,
	PosterRow,
	PosterStack,
	QuestionCopy,
	StepHeading,
	headingClass,
	useLockIn,
	useReportStep,
} from "./ImportFlowParts"
import {
	type ImportResultApi,
	MoreRows,
	PutBackButton,
	useImportResult,
	usePutAllBack,
	useWholeSection,
} from "./ImportResult"
import { ResultRows, ResultSection, resultList } from "./ImportResultView"
import { ProgressStrip } from "./ImportRun"
import {
	type CountTile,
	clearedByList,
	doneReplaced,
	doneSection,
	doneTiles,
	formatCount,
	oneOrMany,
	plural,
} from "./import-flow-model"
import {
	dangerButton,
	errorBox,
	primaryButton,
	secondaryButton,
	textLink,
} from "./shared"

/** Questions an import still holds rows for, which Done lists with a Decide button each. */
export interface LeftToDecide {
	count: number
	node: ReactNode
}

export interface DoneImport {
	id: string
	status: string
	canUndo: boolean
}

export function ImportDone({
	api,
	summary,
	source,
	posters,
	focus,
	openedHere,
	undo,
	undoQuestion,
	onUploadAnother,
	anotherLabel = "Import something else",
	skippedUrl,
	thing = "file",
	notes,
	left,
	children,
}: {
	api: ImportResultApi
	summary: DoneImport
	/** The source's name in a sentence: "Letterboxd". */
	source: string
	/** What the import read: the member's file, or their account. */
	thing?: "file" | "account"
	posters: FlowPoster[]
	focus: boolean
	/** The member started this import on this visit, so Done speaks of it as just done. */
	openedHere: boolean
	undo: { pending: boolean; error: string | null; run: () => void }
	/** What Undo does for this source, asked before it runs. */
	undoQuestion: string
	onUploadAnother: () => void
	anotherLabel?: string
	skippedUrl: string
	/** The stepper's notes under Bring and Choose. */
	notes: [string, string]
	/** Questions still waiting on the member: how many, and the list with their Decide buttons. */
	left?: LeftToDecide
	/** Credits, notes about the file, and what only one source says. */
	children?: ReactNode
}) {
	const query = useImportResult(api, summary.id, summary.status)
	const result = query.data
	if (summary.status === "undone")
		return (
			<Undone
				api={api}
				summary={summary}
				source={source}
				posters={posters}
				focus={focus}
				result={result}
				error={query.isError ? query.error.message : null}
				onRetry={() => query.refetch()}
				onUploadAnother={onUploadAnother}
				anotherLabel={anotherLabel}
				notes={notes}
			/>
		)
	if (!result)
		return (
			<LoadingDone
				focus={focus}
				error={query.isError ? query.error.message : null}
				onRetry={() => query.refetch()}
				notes={notes}
			>
				{children}
			</LoadingDone>
		)
	return (
		<Done
			api={api}
			summary={summary}
			result={result}
			source={source}
			posters={posters}
			focus={focus}
			openedHere={openedHere}
			undo={undo}
			undoQuestion={undoQuestion}
			onUploadAnother={onUploadAnother}
			anotherLabel={anotherLabel}
			skippedUrl={skippedUrl}
			thing={thing}
			notes={notes}
			left={left}
		>
			{children}
		</Done>
	)
}

function LoadingDone({
	focus,
	error,
	onRetry,
	notes,
	children,
}: {
	focus: boolean
	error: string | null
	onRetry: () => void
	notes: [string, string]
	children?: ReactNode
}) {
	useReportStep({
		step: 4,
		notes: [notes[0], notes[1], "", ""],
		allDone: false,
	})
	return (
		<section className="flex flex-col gap-4">
			<StepHeading focus={focus}>Your import is in</StepHeading>
			{error ? (
				<div className="flex flex-col items-start gap-3" aria-live="assertive">
					<p className={errorBox}>{error}</p>
					<button type="button" className={secondaryButton} onClick={onRetry}>
						Try again
					</button>
				</div>
			) : (
				<div className="flex items-center gap-2 text-gray-400">
					<Spinner size="small" /> Loading what changed
				</div>
			)}
			{children}
		</section>
	)
}

const section = (result: ImportResultData, key: ImportResultSection["key"]) =>
	doneSection(result, key)

function Done({
	api,
	summary,
	result,
	source,
	posters,
	focus,
	openedHere,
	undo,
	undoQuestion,
	onUploadAnother,
	anotherLabel,
	skippedUrl,
	thing,
	notes,
	left,
	children,
}: {
	api: ImportResultApi
	summary: DoneImport
	result: ImportResultData
	source: string
	posters: FlowPoster[]
	focus: boolean
	openedHere: boolean
	undo: { pending: boolean; error: string | null; run: () => void }
	undoQuestion: string
	onUploadAnother: () => void
	anotherLabel: string
	skippedUrl: string
	thing: "file" | "account"
	notes: [string, string]
	left?: LeftToDecide
	children?: ReactNode
}) {
	const { data } = useUserData()
	const clearedSection = section(result, "lists_cleared")
	const whole = useWholeSection(api, summary.id, summary.status, clearedSection)
	const clearedRows = whole.rows
	const [putBack, setPutBack] = useState<"back" | "leave" | null>(null)
	const putAll = usePutAllBack()
	const cleared = clearedByList(clearedRows ?? clearedSection?.rows ?? [])
	const back =
		putBack === "back" &&
		putAll.state.at === "done" &&
		putAll.state.failed === 0
	const tiles = doneTiles(
		result,
		back ? { want_to_see: 0, not_interested: 0 } : cleared,
		data,
	)
	const asks = (clearedSection?.total ?? 0) > 0
	const waits = asks && putBack === null
	// Done's tick and "Done." wait for every question: the ones left while it ran, and putting titles back.
	const toDecide = (left?.count ?? 0) + (waits ? 1 : 0)
	const titles = result.titles
	const lists = result.customLists?.created ?? 0
	useReportStep({
		step: 4,
		notes: [
			notes[0],
			notes[1],
			"",
			toDecide ? `${formatCount(toDecide)} to decide` : "",
		],
		allDone: toDecide === 0,
	})
	const what =
		titles > 0
			? `${plural(titles, "title")} ${oneOrMany(titles, "is", "are")} in GoodWatch`
			: lists > 0
				? `${plural(lists, "list")} ${oneOrMany(lists, "is", "are")} in GoodWatch`
				: null
	const heading = !what
		? toDecide
			? "Nothing in GoodWatch changed yet"
			: "Done. Nothing in GoodWatch needed changing"
		: !openedHere
			? `${plural(titles || lists, titles ? "title" : "list")} came in from ${source}`
			: toDecide
				? what
				: `Done. ${what}`
	const kept = section(result, "kept")
	const replaced = doneReplaced(result)
	const anyReplaced = Object.values(replaced).some((n) => n > 0)
	const skipped = section(result, "skipped")
	const [skippedOpen, setSkippedOpen] = useState(false)
	const [allOpen, setAllOpen] = useState(false)
	const [askUndo, setAskUndo] = useState(false)
	const more = (s: ImportResultSection) => (
		<MoreRows api={api} id={summary.id} status={summary.status} section={s} />
	)
	const changes = result.sections.filter(
		(item) => item.key !== "skipped" && item.key !== "kept",
	)
	return (
		<section className="flex flex-col gap-6" data-import-done>
			<div className="flex flex-col gap-3">
				<StepHeading focus={focus}>{heading}</StepHeading>
				<PosterStack posters={posters} max={10} />
			</div>

			{left && left.count > 0 && left.node}

			{asks && clearedSection && (
				<ClearedQuestion
					rows={clearedRows ?? clearedSection.rows}
					count={clearedSection.total}
					loading={!clearedRows}
					loadError={whole.error}
					onLoadRetry={whole.retry}
					answer={putBack}
					state={putAll.state}
					onAnswer={(answer) => {
						setPutBack(answer)
						if (answer === "back" && clearedRows) void putAll.run(clearedRows)
					}}
					onRetry={() => clearedRows && void putAll.run(clearedRows)}
				/>
			)}

			<div className="rounded-2xl bg-gray-900/70 p-5 ring-1 ring-white/10">
				<div className="flex flex-col gap-4">
					<p className="font-semibold text-white">What changed</p>
					{tiles.length > 0 ? (
						<CountTiles tiles={tiles} />
					) : anyReplaced ? null : (
						<p className="text-gray-300">Nothing in your library changed.</p>
					)}
					{(kept || anyReplaced) && (
						<div className="flex flex-col gap-1 text-sm text-gray-400">
							{replaced.scores > 0 && (
								<p>
									{plural(replaced.scores, "score")} now{" "}
									{oneOrMany(replaced.scores, "matches", "match")} {source}'s.
								</p>
							)}
							{replaced.episodeScores > 0 && (
								<p>
									{plural(
										replaced.episodeScores,
										"season or episode score",
										"season and episode scores",
									)}{" "}
									now {oneOrMany(replaced.episodeScores, "matches", "match")}{" "}
									{source}'s.
								</p>
							)}
							{replaced.reviews > 0 && (
								<p>
									{plural(replaced.reviews, "review")} now{" "}
									{oneOrMany(replaced.reviews, "matches", "match")} {source}'s.
								</p>
							)}
							{replaced.statuses > 0 && (
								<p>
									{plural(replaced.statuses, "show status", "show statuses")}{" "}
									changed to {source}'s.
								</p>
							)}
							{kept && (
								<p>
									{plural(kept.total, "title")} you already had stayed the same.
								</p>
							)}
						</div>
					)}
				</div>
				{skipped && (
					<div className="mt-3">
						<Disclosure
							label={`${formatCount(skipped.total)} from your ${thing} couldn't come in`}
							open={skippedOpen}
							onToggle={setSkippedOpen}
						>
							<div className="flex flex-col gap-3">
								<ul className={`${resultList} border-slate-700`}>
									<ResultRows rows={skipped.rows} />
								</ul>
								{skipped.total > skipped.rows.length && more(skipped)}
								<a
									href={skippedUrl}
									download
									className={`${textLink} inline-flex min-h-11 items-center gap-2 self-start`}
								>
									<ArrowDownTrayIcon className="size-4 shrink-0" aria-hidden />
									Download the list ({formatCount(skipped.total)}, CSV file)
								</a>
							</div>
						</Disclosure>
					</div>
				)}
				{(changes.length > 0 || kept) && (
					<div className="mt-3">
						<Disclosure
							label="Every change, title by title"
							open={allOpen}
							onToggle={setAllOpen}
						>
							<div className="flex flex-col gap-5">
								{[...changes, ...(kept ? [kept] : [])].map((item) => (
									<ResultSection key={item.key} section={item} more={more} />
								))}
							</div>
						</Disclosure>
					</div>
				)}
				<div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
					<Link
						to="/my-library/scores"
						className={`${textLink} min-h-11 content-center`}
					>
						See your scores
					</Link>
					<Link to="/taste" className={`${textLink} min-h-11 content-center`}>
						See your taste
					</Link>
				</div>
			</div>

			{children}

			<div className="flex flex-col gap-3 border-t border-white/10 pt-5">
				{summary.canUndo && (
					<>
						<h3 className="font-semibold text-white">Changed your mind?</h3>
						<p className="text-gray-400">
							Undo takes out what this import added and puts back what it
							changed.
						</p>
					</>
				)}
				{summary.canUndo && askUndo && (
					<div className="flex flex-col gap-3 rounded-lg border border-red-900 bg-red-950/40 p-4">
						<p className="text-gray-100">{undoQuestion}</p>
						<div className="flex flex-wrap gap-3">
							<button
								type="button"
								className={dangerButton}
								disabled={undo.pending}
								onClick={undo.run}
							>
								{undo.pending ? "Undoing" : "Yes, undo import"}
							</button>
							<button
								type="button"
								className={secondaryButton}
								disabled={undo.pending}
								// biome-ignore lint/a11y/noAutofocus: the question replaced the focused Undo button
								autoFocus
								onClick={() => setAskUndo(false)}
							>
								Keep the import
							</button>
						</div>
					</div>
				)}
				<div className="flex flex-wrap gap-3">
					{summary.canUndo && !askUndo && (
						<button
							type="button"
							className={openedHere ? secondaryButton : dangerButton}
							onClick={() => setAskUndo(true)}
						>
							<ArrowUturnLeftIcon className="size-5" aria-hidden />
							Undo this import
						</button>
					)}
					<button
						type="button"
						className={secondaryButton}
						disabled={undo.pending}
						onClick={onUploadAnother}
					>
						{anotherLabel}
					</button>
				</div>
				<div aria-live="assertive">
					{undo.error && <p className={errorBox}>{undo.error}</p>}
				</div>
			</div>
		</section>
	)
}

/** The member's new total per kind, with what came in (+N) and what came off (−N). */
export function CountTiles({ tiles }: { tiles: CountTile[] }) {
	return (
		<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-count-tiles>
			{tiles.map((tile) => (
				<li
					key={tile.key}
					data-tile={tile.key}
					className="flex flex-col rounded-xl bg-white/5 px-4 py-3"
				>
					<span className="text-2xl font-bold tabular-nums text-white">
						{formatCount(tile.total ?? tile.added)}
					</span>
					<span className="text-sm text-gray-400">{tile.name}</span>
					{tile.total !== null && (tile.added > 0 || tile.removed > 0) && (
						<span className="mt-1 flex flex-wrap gap-x-2 text-sm font-semibold tabular-nums">
							{tile.added > 0 && (
								<span className="text-emerald-400" data-marker="added">
									+{formatCount(tile.added)}
									<span className="sr-only"> added</span>
								</span>
							)}
							{tile.removed > 0 && (
								<span className="text-red-400" data-marker="removed">
									−{formatCount(tile.removed)}
									<span className="sr-only"> taken off</span>
								</span>
							)}
						</span>
					)}
				</li>
			))}
		</ul>
	)
}

const BECAUSE_LINE = {
	watched: (n: number, lists: ReactNode) => (
		<>
			You watched {plural(n, "title")} that {oneOrMany(n, "was", "were")} on{" "}
			{lists}, so {oneOrMany(n, "it", "they")} came off.
		</>
	),
	status: (n: number, lists: ReactNode) => (
		<>
			{plural(n, "show")} got a new status, so {oneOrMany(n, "it", "they")} came
			off {lists}.
		</>
	),
	want: (n: number, lists: ReactNode) => (
		<>
			{plural(n, "title")} {oneOrMany(n, "is", "are")} now on{" "}
			<ListName>Want to See</ListName>, so {oneOrMany(n, "it", "they")} came off{" "}
			{lists}.
		</>
	),
}

/** The import took titles off Want to See or Not interested: ask whether to put them back. */
function ClearedQuestion({
	rows,
	count,
	loading,
	loadError,
	onLoadRetry,
	answer,
	state,
	onAnswer,
	onRetry,
}: {
	rows: readonly ImportResultRow[]
	count: number
	loading: boolean
	/** The titles couldn't all load, so the answers wait for Try again. */
	loadError: string | null
	onLoadRetry: () => void
	answer: "back" | "leave" | null
	state: ReturnType<typeof usePutAllBack>["state"]
	onAnswer: (answer: "back" | "leave") => void
	onRetry: () => void
}) {
	const lock = useLockIn()
	const [shown, setShown] = useState<"back" | "leave" | null>(null)
	const picked = shown ?? answer
	const changes = rows.flatMap((row) =>
		row.changes.flatMap((change) =>
			change.type === "list-cleared" ? [change] : [],
		),
	)
	const want = changes.some((change) => change.list === "want_to_see")
	const notInterested = changes.some(
		(change) => change.list === "not_interested",
	)
	const lists = (
		<>
			{want && <ListName>Want to See</ListName>}
			{want && notInterested && " and "}
			{notInterested && <ListName>Not interested</ListName>}
		</>
	)
	const reasons = new Set(changes.map((change) => change.because))
	const reason = reasons.size === 1 ? [...reasons][0] : null
	const fact = reason ? (
		BECAUSE_LINE[reason](count, lists)
	) : (
		<>
			{plural(count, "title")} came off {lists} because of this import.
		</>
	)
	const posters: FlowPoster[] = rows
		.flatMap((row) =>
			row.title
				? [
						{
							key: row.key,
							title: row.title.title,
							posterPath: row.title.posterPath,
						},
					]
				: [],
		)
		.slice(0, 6)
	const pick = (value: "back" | "leave") => {
		setShown(value)
		lock.lock(value, () => {
			setShown(null)
			onAnswer(value)
		})
	}
	const it = oneOrMany(count, "it", "them")
	return (
		<div
			className="flex flex-col gap-4 rounded-2xl bg-amber-400/5 p-5 ring-1 ring-amber-400/30"
			data-cleared-question
		>
			<QuestionCopy value>
				<h3 className="text-lg font-bold text-white">
					{fact} Put {it} back?
				</h3>
				<PosterRow posters={posters} />
				{answer === null || lock.locking ? (
					<>
						<fieldset
							disabled={!!lock.locking || loading}
							data-locked={lock.locking ? true : undefined}
							className="group/answers flex flex-col gap-3"
						>
							<legend className="sr-only">Your answer</legend>
							<Answer
								selected={picked === "back"}
								title={`Yes, put ${it} back`}
								onClick={() => pick("back")}
							/>
							<Answer
								selected={picked === "leave"}
								recommended
								title={`No, leave ${it} off`}
								onClick={() => pick("leave")}
							/>
						</fieldset>
						<div aria-live="polite" data-cleared-load>
							{loadError && (
								<div className="flex flex-col items-start gap-2">
									<p className="text-red-200">
										GoodWatch couldn't load every title that came off.{" "}
										{loadError}
									</p>
									<button
										type="button"
										className={secondaryButton}
										onClick={onLoadRetry}
									>
										Try again
									</button>
								</div>
							)}
						</div>
					</>
				) : (
					<div aria-live="polite" className="flex flex-col items-start gap-2">
						{answer === "leave" ? (
							<p className="text-gray-300">
								{oneOrMany(count, "It stays", "They stay")} off. You can add{" "}
								{it} again from {oneOrMany(count, "its", "their")} page.
							</p>
						) : state.at === "running" || state.at === "idle" ? (
							<p className="flex items-center gap-2 text-gray-300">
								<Spinner size="small" /> Putting {it} back
							</p>
						) : state.failed === 0 ? (
							<p className="flex items-center gap-2 font-semibold text-emerald-200">
								<CheckIcon className="size-5" aria-hidden /> Back on {lists}
							</p>
						) : (
							<>
								<p className="text-red-200" role="alert">
									{plural(state.failed, "title")} didn't go back. Try again.
								</p>
								<button
									type="button"
									className={secondaryButton}
									onClick={onRetry}
								>
									Try again
								</button>
							</>
						)}
					</div>
				)}
			</QuestionCopy>
		</div>
	)
}

function Undone({
	api,
	summary,
	source,
	posters,
	focus,
	result,
	error,
	onRetry,
	onUploadAnother,
	anotherLabel,
	notes,
}: {
	api: ImportResultApi
	summary: DoneImport
	source: string
	posters: FlowPoster[]
	focus: boolean
	result: ImportResultData | undefined
	error: string | null
	onRetry: () => void
	onUploadAnother: () => void
	anotherLabel: string
	notes: [string, string]
}) {
	useReportStep({
		step: 4,
		notes: [notes[0], notes[1], "", "Undone"],
		allDone: true,
	})
	const [open, setOpen] = useState(false)
	const notRestored = result && section(result, "not_restored")
	const left = result && section(result, "left")
	const keptLists = result?.customLists?.notRestored ?? 0
	const listsOnly = notRestored?.rows.every((row) =>
		row.changes.every((change) => change.type === "not-restored"),
	)
	const more = (s: ImportResultSection) => (
		<MoreRows api={api} id={summary.id} status={summary.status} section={s} />
	)
	const changes =
		result?.sections.filter((item) => item.key !== "not_restored") ?? []
	return (
		<section className="flex flex-col gap-5" data-import-undone>
			<ProgressStrip
				summary={{
					status: "done",
					processed: 1,
					total: 1,
					stalled: false,
					error: null,
					operation: "undo",
				}}
				posters={posters}
				label={
					result ? `${plural(result.titles, "title")} taken out` : "Taken out"
				}
			/>
			<StepHeading focus={focus} className={headingClass}>
				Undone
			</StepHeading>
			<p className="text-gray-200">
				GoodWatch is back to how it was before this {source} import.
				{left &&
					left.total > 0 &&
					` ${plural(left.total, "title")} ${oneOrMany(left.total, "stays", "stay")} as you changed ${oneOrMany(left.total, "it", "them")} after the import.`}
				{keptLists > 0 && ` ${plural(keptLists, "list")} could not be deleted.`}
			</p>
			{error && (
				<div className="flex flex-col items-start gap-3" aria-live="assertive">
					<p className={errorBox}>{error}</p>
					<button type="button" className={secondaryButton} onClick={onRetry}>
						Try again
					</button>
				</div>
			)}
			{notRestored && (
				<div className="flex flex-col gap-3 rounded-lg border border-amber-700 bg-amber-950/50 p-4 text-amber-100">
					<p className="font-semibold">
						{plural(notRestored.count, listsOnly ? "list choice" : "change")}{" "}
						could not be put back
					</p>
					<p className="text-sm">
						{listsOnly
							? "The import took these titles off a list. Put them back here, or leave them."
							: "Undo couldn't take these back. Put list choices back here, or leave them."}
					</p>
					<ul className={`${resultList} border-amber-800`}>
						<ResultRows
							rows={notRestored.rows}
							putBack={(put) => <PutBackButton {...put} />}
						/>
					</ul>
					{notRestored.total > notRestored.rows.length && more(notRestored)}
				</div>
			)}
			{changes.length > 0 && (
				<Disclosure
					label="Every change Undo made, title by title"
					open={open}
					onToggle={setOpen}
				>
					<div className="flex flex-col gap-5">
						{changes.map((item) => (
							<ResultSection key={item.key} section={item} more={more} />
						))}
					</div>
				</Disclosure>
			)}
			<div>
				<button
					type="button"
					className={primaryButton}
					onClick={onUploadAnother}
				>
					{anotherLabel}
				</button>
			</div>
		</section>
	)
}
