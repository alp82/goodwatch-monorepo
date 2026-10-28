// Quick list's pieces: the mode switch (shared with One at a time), the taste strip (the flow's taste bar in one
// line), a row's two marks and the Want to See question they turn into, the round selection check, the undo bar, and
// whether this screen selects rows. Motion is transform and opacity only (main.css, want-*).
import {
	ArrowLeftIcon,
	ArrowUturnLeftIcon,
	BookmarkIcon,
	CheckIcon,
	ChevronRightIcon,
	EyeSlashIcon,
	FingerPrintIcon,
	MinusIcon,
	NoSymbolIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useSyncExternalStore } from "react"
import {
	FLOW_PATH,
	type Milestone,
	type NextStep,
	TASTE_VIEW_PATH,
	type Tally,
	nextStepWords,
	takesWantPress,
	tasteBarWords,
} from "~/ui/rating-flow/flow"
import { WantAnswer } from "~/ui/rating-flow/parts"
import { RatingDots } from "~/ui/rating-flow/RatingDots"
import { WORDS } from "~/ui/rating-flow/words"
import type { QuickAnswer } from "./model"
import { QUICK_WORDS, answerLabel } from "./words"

/** Quick list's address. */
export const QUICK_PATH = `${FLOW_PATH}?mode=quick`

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
 * milestone it turns amber, as the flow's bar does.
 */
export function TasteStrip({ tally, step, lit }: { tally: Tally; step: NextStep | null; lit: Milestone | null }) {
	const on = lit != null
	const { head, line } = tasteBarWords(tally, lit)
	return (
		<Link
			to={TASTE_VIEW_PATH}
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
	"flex h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-wait disabled:opacity-60 xl:text-xs"

/**
 * A row's two marks and the Want to See question they turn into: the rating flow's joined control (rating-flow/
 * parts.tsx, Marks) at a row's size. After Haven't seen it the question takes exactly the marks' box. Its left half
 * asks "Want to see it?" and goes back to the marks (nothing saved; Escape too); the right half answers No (Haven't
 * seen it) or Yes, add (with Want to See). Presses in the question's first moment and a double click's second click
 * don't count (flow.ts, `takesWantPress`).
 */
export function RowMarks({
	answer,
	asking,
	disabled,
	onUnseen,
	onNotInterested,
	onBack,
	onNo,
	onWant,
}: {
	answer: QuickAnswer | null
	asking: boolean
	disabled?: boolean
	onUnseen: () => void
	onNotInterested: () => void
	onBack: () => void
	onNo: () => void
	onWant: () => void
}) {
	const box = useRef<HTMLDivElement>(null)
	const shownAt = useRef(0)
	useEffect(() => {
		shownAt.current = asking ? performance.now() : 0
		// The focus follows the press that changed the box, when it was in the box.
		const el = box.current
		if (!el || !el.contains(document.activeElement)) return
		el.querySelector<HTMLElement>(asking ? "[data-want-no]" : "[data-mark-unseen]")?.focus()
	}, [asking])
	const guard = (fn: () => void) => (e: ReactMouseEvent) => {
		if (takesWantPress(shownAt.current, performance.now(), e.detail)) fn()
	}
	const unseen = answer?.type === "skip" || answer?.type === "plan"
	const off = asking ? { inert: "" } : {}
	return (
		<div ref={box} data-asking={asking || undefined} className="want relative grid w-full grid-cols-2 gap-2" data-row-marks>
			<div className="want-mark want-mark-l grid" {...off}>
				<button
					type="button"
					onClick={onUnseen}
					disabled={disabled}
					aria-pressed={unseen}
					className={`${rowMark} ${unseen ? "border-gray-300 bg-white/10 text-white" : "border-gray-700 text-gray-100 hover:border-gray-500"}`}
					data-mark-unseen
				>
					{answer?.type === "plan" ? (
						<BookmarkIcon className="size-4 shrink-0 text-amber-300" aria-hidden />
					) : (
						<EyeSlashIcon className="size-4 shrink-0 text-gray-300" aria-hidden />
					)}
					<span className="truncate">{answer?.type === "plan" ? WORDS.wantToSee : WORDS.unseen}</span>
				</button>
			</div>
			<div className="want-mark want-mark-r grid" {...off}>
				<button
					type="button"
					onClick={onNotInterested}
					disabled={disabled}
					aria-pressed={answer?.type === "not-interested"}
					className={`${rowMark} ${answer?.type === "not-interested" ? "border-pink-300/70 bg-pink-300/10 text-white" : "border-gray-700 text-gray-100 hover:border-gray-500"}`}
				>
					<NoSymbolIcon className="size-4 shrink-0 text-pink-300" aria-hidden />
					<span className="truncate">{WORDS.notInterested}</span>
				</button>
			</div>
			{/* biome-ignore lint/a11y/useSemanticElements: one joined control in the marks' box, as the flow's */}
			<div
				role="group"
				aria-label={WORDS.wantAsk}
				className={`want-shell absolute inset-0 flex select-none overflow-hidden rounded-xl border-2 border-gray-700 bg-gray-900 ${asking ? "" : "pointer-events-none"}`}
				onKeyDown={(e) => {
					if (e.key !== "Escape") return
					e.preventDefault()
					onBack()
				}}
				{...(asking ? {} : { inert: "" })}
				data-want
			>
				<button
					type="button"
					onClick={guard(onBack)}
					aria-label={`${WORDS.wantAsk} ${WORDS.wantBack}`}
					aria-keyshortcuts="Escape"
					className="want-btn flex min-w-0 basis-1/2 cursor-pointer items-center gap-1.5 px-2 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-amber-300 active:bg-white/10"
				>
					<span className="want-c flex min-w-0 flex-1 items-center gap-1.5">
						<ArrowLeftIcon className="size-4 shrink-0 text-gray-400" aria-hidden />
						<span className="truncate text-sm font-bold text-gray-100 xl:text-xs">{WORDS.wantAsk}</span>
					</span>
				</button>
				<span aria-hidden className="want-div w-0.5 shrink-0 bg-gray-700" />
				<div className="flex min-w-0 basis-1/2">
					<WantAnswer kind="no" data-want-no onClick={guard(onNo)} disabled={disabled} className="flex-1 gap-1 px-1.5 text-sm xl:text-xs">
						<EyeSlashIcon className="size-4 shrink-0" aria-hidden />
						<span className="truncate">{WORDS.wantNo}</span>
					</WantAnswer>
					<span aria-hidden className="want-div w-0.5 shrink-0 bg-gray-700" />
					<WantAnswer kind="yes" onClick={guard(onWant)} disabled={disabled} className="flex-[1.7] gap-1 px-1.5 text-sm xl:text-xs">
						<BookmarkIcon className="size-4 shrink-0" aria-hidden />
						<span className="truncate">{WORDS.wantYes}</span>
					</WantAnswer>
				</div>
			</div>
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
