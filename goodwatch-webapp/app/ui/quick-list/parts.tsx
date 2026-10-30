// Quick list's pieces: the mode switch (shared with One at a time), the taste strip (the flow's taste bar in one
// line), a row's three marks, the round selection check, the undo bar, and whether this screen selects rows.
import {
	ArrowUturnLeftIcon,
	CheckIcon,
	ChevronRightIcon,
	EyeSlashIcon,
	FingerPrintIcon,
	MinusIcon,
	NoSymbolIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { QUICK_LIST_PAGE, SCORES_FROM_QUICK } from "~/domain/my-library"
import { useSyncExternalStore } from "react"
import {
	FLOW_PATH,
	type Milestone,
	type NextStep,
	TASTE_VIEW_PATH,
	type Tally,
	nextStepWords,
	tasteBarWords,
} from "~/ui/rating-flow/flow"
import { BookmarkMark } from "~/ui/rating-flow/parts"
import { RatingDots } from "~/ui/rating-flow/RatingDots"
import { WORDS } from "~/ui/rating-flow/words"
import type { QuickAnswer } from "./model"
import { QUICK_WORDS, answerLabel } from "./words"

/** Quick list's address. */
export const QUICK_PATH = QUICK_LIST_PAGE

/** One at a time | Quick list, above either mode. Each is its own address, so Back goes between them. */
export function ModeSwitch({ mode }: { mode: "one" | "quick" }) {
	const seg = (on: boolean) =>
		`flex h-9 items-center rounded-full px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 ${on ? "bg-white font-bold text-gray-950" : "text-gray-300 hover:text-white"}`
	return (
		<nav
			aria-label={QUICK_WORDS.mode}
			className="inline-flex shrink-0 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10"
			data-mode-switch
		>
			<Link to={FLOW_PATH} aria-current={mode === "one" ? "page" : undefined} className={seg(mode === "one")} preventScrollReset>
				{QUICK_WORDS.oneAtATime}
			</Link>
			<Link to={QUICK_PATH} aria-current={mode === "quick" ? "page" : undefined} className={seg(mode === "quick")} preventScrollReset>
				{QUICK_WORDS.quick}
			</Link>
		</nav>
	)
}

/**
 * The flow's taste bar in one line: the next step in words and dots, the totals, and the way to the taste view. At a
 * milestone it turns amber, as the flow's bar does. From a member's 50th rating (`toScores`) it is the way to Your
 * scores, last scored first, without dots or milestones.
 */
export function TasteStrip({
	tally,
	step: nextStep,
	lit: milestone,
	toScores = false,
}: { tally: Tally; step: NextStep | null; lit: Milestone | null; toScores?: boolean }) {
	const step = toScores ? null : nextStep
	const lit = toScores ? null : milestone
	const on = lit != null
	const words = tasteBarWords(tally, lit)
	const head = toScores ? QUICK_WORDS.yourScores : words.head
	const { line } = words
	return (
		<Link
			to={toScores ? SCORES_FROM_QUICK : TASTE_VIEW_PATH}
			prefetch={toScores ? "intent" : undefined}
			className="group relative isolate flex h-12 min-w-0 items-center gap-2.5 overflow-hidden rounded-full bg-white/[0.03] pr-3 pl-1.5 ring-1 ring-white/10 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400"
			data-taste-strip
		>
			<span
				aria-hidden
				className={`absolute inset-0 -z-10 bg-linear-to-r from-amber-400/25 via-amber-400/10 to-amber-400/[0.04] ring-1 ring-amber-400/50 ring-inset transition-opacity duration-500 ${on ? "opacity-100" : "opacity-0"}`}
			/>
			<span
				className={`${on ? "bg-linear-to-b from-amber-400 to-amber-600 text-gray-950" : "bg-white/[0.06] text-gray-400"} flex size-9 shrink-0 items-center justify-center rounded-full`}
			>
				<FingerPrintIcon className="size-5" aria-hidden />
			</span>
			<span key={lit ? `lit-${lit.rated}` : "calm"} className={`flex min-w-0 flex-1 flex-col leading-tight ${lit ? "score-ack-enter" : ""}`}>
				<span className={`truncate text-sm font-extrabold ${on ? "text-amber-100" : "text-gray-100"}`}>
					{on || !step ? head : nextStepWords(step)}
				</span>
				<span className={`truncate text-xs ${on ? "text-amber-200/80" : "text-gray-400"}`}>{line}</span>
			</span>
			{step && step.of > 0 && !on && (
				<span aria-hidden className="hidden shrink-0 min-[420px]:flex">
					<RatingDots at={step.done} of={step.of} />
				</span>
			)}
			<ChevronRightIcon className="size-5 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
			<span className="sr-only" aria-live="polite">
				{on ? head : ""}
			</span>
		</Link>
	)
}

const rowMark =
	"flex h-11 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-xl border-2 px-1.5 text-[13px] font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-wait disabled:opacity-60 max-[380px]:px-1 max-[380px]:text-xs md:gap-1.5 md:px-2 md:text-xs"

/**
 * A row's three marks, one press each, as the rating flow's (rating-flow/parts.tsx, Marks): a bookmark for Want to See
 * (Haven't seen it, with Want to See), Haven't seen it, and Not interested. The one that is on shows it; pressing it
 * again takes the answer back. Their words never shorten: the columns take the width the words need.
 */
export function RowMarks({
	answer,
	disabled,
	onAnswer,
}: {
	answer: QuickAnswer | null
	disabled?: boolean
	onAnswer: (a: QuickAnswer | null) => void
}) {
	const on = answer?.type
	const press = (type: "plan" | "skip" | "not-interested") => () => onAnswer(on === type ? null : { type })
	return (
		<div className="grid w-full grid-cols-[auto_minmax(max-content,1fr)_minmax(max-content,1fr)] gap-1.5 md:gap-2" data-row-marks>
			<BookmarkMark on={on === "plan"} onClick={press("plan")} disabled={disabled} className="h-11 w-11" />
			<button
				type="button"
				onClick={press("skip")}
				disabled={disabled}
				aria-pressed={on === "skip"}
				className={`${rowMark} ${on === "skip" ? "border-gray-300 bg-white/10 text-white" : "border-gray-700 text-gray-100 hover:border-gray-500"}`}
				data-mark-unseen
			>
				<EyeSlashIcon className="size-4 shrink-0 text-gray-300" aria-hidden />
				{WORDS.unseen}
			</button>
			<button
				type="button"
				onClick={press("not-interested")}
				disabled={disabled}
				aria-pressed={on === "not-interested"}
				className={`${rowMark} ${on === "not-interested" ? "border-pink-300/70 bg-pink-300/10 text-white" : "border-gray-700 text-gray-100 hover:border-gray-500"}`}
			>
				<NoSymbolIcon className="size-4 shrink-0 text-pink-300" aria-hidden />
				{WORDS.notInterested}
			</button>
		</div>
	)
}

/** The round selection check: an empty ring at rest, amber with a dark tick when on, a dash when some are on. */
export function CheckBadge({ on, mixed = false }: { on: boolean; mixed?: boolean }) {
	const lit = on || mixed
	return (
		<span
			aria-hidden
			className={`grid size-6 place-items-center rounded-full shadow-md ring-2 transition-colors duration-150 ${lit ? "bg-amber-400 text-gray-950 ring-gray-950" : "bg-gray-950/70 text-transparent ring-white/80"}`}
		>
			{mixed ? (
				<MinusIcon className="size-4" />
			) : (
				<CheckIcon className={`size-4 transition-transform duration-150 ${on ? "scale-100" : "scale-50"}`} />
			)}
		</span>
	)
}

/** The latest change and Undo (U on a keyboard), above the phone's dock. */
export function UndoBar({
	label,
	answer,
	busy,
	onUndo,
}: { label: string; answer: QuickAnswer | null; busy: boolean; onUndo: () => void }) {
	return (
		<output
			className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-gray-950 px-4 py-2 text-sm text-gray-100 shadow-2xl ring-1 ring-white/20"
			data-undo-bar
		>
			<span className="min-w-0 flex-1 truncate">
				<b>{label}</b> · {answerLabel(answer)}
			</span>
			<button
				type="button"
				onClick={onUndo}
				disabled={busy}
				aria-keyshortcuts="U"
				className="flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2 font-semibold text-gray-300 hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60"
			>
				<ArrowUturnLeftIcon className="h-4 w-4" aria-hidden />
				{QUICK_WORDS.undo}
				<kbd className="ml-1 hidden rounded border border-current/30 px-1 font-sans text-[10px] opacity-70 md:inline">U</kbd>
			</button>
		</output>
	)
}

// Rows are selected only with a fine pointer that hovers, on a wide window. Phones and touch screens never select.
const SELECTS = "(hover: hover) and (pointer: fine) and (min-width: 1024px)"
const subscribeSelects = (changed: () => void) => {
	const media = window.matchMedia(SELECTS)
	media.addEventListener("change", changed)
	return () => media.removeEventListener("change", changed)
}

/** Whether this screen selects rows (a desktop). The server and the first render say no. */
export function useSelectsRows() {
	return useSyncExternalStore(
		subscribeSelects,
		() => window.matchMedia(SELECTS).matches,
		() => false,
	)
}

/** Whether a key press belongs to a field. */
export const inField = (e: { target: EventTarget | null }) =>
	!!(e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")
