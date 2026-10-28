// Quick list's table. Each row: the poster filling its height, the title, year · type, genres and tags, a synopsis
// line, the ten score keys across the width, and the two marks at the right (Haven't seen it turns them into the Want
// to See question in their box). Pressing the chosen score again clears it. On a phone the poster and words sit on
// top, the keys a full row wide under them, the marks under the keys. One grid template for the head and every row,
// with columns that never depend on a row's content, so every column starts at the same place in every row and state.
//
// On a desktop (a fine pointer on a wide window) rows can be selected for the bar above the table: a press anywhere
// on a row outside its controls, Shift for a range, Space on a focused row; a round check on the poster's corner
// shows it, over a real checkbox. Phones and touch screens have no selection at all.
//
// The rows' motion (transform and opacity only): an answered row slides out to the left, the rows below close up,
// a new title fades in at the bottom, and a row Undo brings back comes in from the left.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ScoreKeys } from "~/ui/my-library/scores/ScoreRow"
import { Poster } from "~/ui/my-pages/bits"
import { STICKY_BAR } from "~/ui/layers"
import { WORDS } from "~/ui/rating-flow/words"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import {
	type Order,
	type QuickAnswer,
	type QuickTitle,
	afterBulk,
	keepSelected,
	nextOrder,
	selectRange,
	toggleSelected,
} from "./model"
import { CheckBadge, RowMarks } from "./parts"
import { QUICK_WORDS, answerLabel } from "./words"

// Phone: poster and words; the keys, then the marks, a full row wide under them.
// Tablet: the marks at the right of the words; the keys under both; the poster spans the two lines.
// Wide: one line. Words and keys share the width 5 to 7, the marks keep a fixed column at the right edge.
const COLS =
	"grid grid-cols-[4.5rem_minmax(0,1fr)] md:grid-cols-[5rem_minmax(0,1fr)_18rem] xl:grid-cols-[5rem_minmax(0,5fr)_minmax(0,7fr)_18.5rem]"
const GAPS = "gap-x-3 gap-y-3 px-2 md:gap-x-4 md:px-3 xl:gap-x-5"
const AT = {
	poster: "col-start-1 row-start-1 md:row-span-2 xl:row-span-1",
	info: "col-start-2 row-start-1 self-center",
	keys: "col-span-2 col-start-1 row-start-2 self-center md:col-span-2 md:col-start-2 xl:col-span-1 xl:col-start-3 xl:row-start-1",
	marks: "col-span-2 col-start-1 row-start-3 md:col-span-1 md:col-start-3 md:row-start-1 md:self-center xl:col-start-4",
}
// The row's keys: tall enough for a thumb, digits a size up, spread over their column.
const KEYS_ROW = "[&_button]:h-11 [&_button]:text-sm md:[&_button]:h-12 md:[&_button]:text-base sm:[&_fieldset]:gap-1.5"
// What a press on a row leaves alone: the controls in it.
const OWN = "button, a, input, label, select, textarea, fieldset, [data-row-marks]"

const kindWord = (t: { mediaType: string }) => (t.mediaType === "show" ? "Show" : "Movie")

const Row = memo(function Row({
	t,
	answer,
	latest,
	leaving,
	back,
	checked,
	selecting,
	selects,
	locked,
	busy,
	onToggle,
	onAnswer,
}: {
	t: QuickTitle
	answer: QuickAnswer | null
	/** Answered by the latest change: it stays, dimmed with its answer, until the next. */
	latest: boolean
	leaving: boolean
	/** Brought back by Undo. */
	back: boolean
	checked: boolean
	/** Some row is selected: every row shows its check. */
	selecting: boolean
	/** This screen selects rows (a desktop). */
	selects: boolean
	/** A guest at the limit: no new score. */
	locked: boolean
	/** A write for this title is on its way. */
	busy: boolean
	onToggle: (key: string, range: boolean) => void
	onAnswer: (key: string, a: QuickAnswer | null) => void
}) {
	const tick = `quick-tick-${t.key}`
	// The Want to See question is up: Haven't seen it was pressed, not answered yet.
	const [asking, setAsking] = useState(false)
	const give = (a: QuickAnswer) => {
		setAsking(false)
		onAnswer(t.key, a)
	}
	const score = answer?.type === "score" ? answer.score : null
	const meta = [t.release_year, kindWord(t)].filter(Boolean).join(" · ")
	const dim = latest && !asking && !checked
	const select = selects && !leaving
	return (
		// biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them
		<div
			role="row"
			data-row={t.key}
			data-answered={answer?.type}
			data-leaving={leaving || undefined}
			data-back={back || undefined}
			data-selected={checked || undefined}
			aria-busy={busy || undefined}
			tabIndex={select ? 0 : undefined}
			onMouseDown={(e) => {
				// Shift-click selects a range; keep it from selecting the text between.
				if (select && e.shiftKey && !(e.target as HTMLElement).closest(OWN)) e.preventDefault()
			}}
			onClick={(e) => {
				if (!select || (e.target as HTMLElement).closest(OWN)) return
				if (window.getSelection()?.toString()) return
				onToggle(t.key, e.shiftKey)
			}}
			onKeyDown={(e) => {
				if (!select || e.target !== e.currentTarget || e.key !== " ") return
				e.preventDefault()
				onToggle(t.key, e.shiftKey)
			}}
			className={`group/row ${COLS} ${GAPS} relative isolate border-b border-white/5 py-3 outline-none transition-[opacity,translate] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-inset motion-reduce:transition-none ${select ? "cursor-pointer" : ""} ${leaving ? "pointer-events-none -translate-x-4 opacity-0" : dim ? "opacity-50 hover:opacity-90" : ""}`}
			{...(leaving ? { inert: "" } : {})}
		>
			{/* The selected tint and its amber bar, and the hover tint: layers that fade, so nothing repaints the row. */}
			<span
				aria-hidden
				className={`absolute inset-0 -z-10 bg-amber-400/[0.07] transition-opacity duration-150 ${checked ? "opacity-100" : "opacity-0"}`}
			/>
			{select && !checked && (
				<span aria-hidden className="absolute inset-0 -z-10 bg-white/[0.025] opacity-0 group-hover/row:opacity-100" />
			)}
			<span
				aria-hidden
				className={`absolute inset-y-1.5 left-0 w-1 origin-center rounded-r-full bg-amber-400 transition-[scale,opacity] duration-200 ${checked ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"}`}
			/>
			{/* biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
			<div role="cell" className={`${AT.poster} relative self-start`}>
				<Poster path={t.poster_path} size="w154" className="aspect-[2/3] w-full rounded-lg" />
				{selects && (
					<label
						htmlFor={tick}
						className={`absolute -top-2 -left-2 grid size-11 cursor-pointer place-items-center transition-opacity duration-150 group-hover/row:opacity-100 group-focus-visible/row:opacity-100 has-[:focus-visible]:opacity-100 ${checked || selecting ? "opacity-100" : "opacity-0"}`}
						onClickCapture={(e) => {
							// Shift selects the range from the last row pressed.
							if (e.shiftKey && (e.target as HTMLElement).tagName !== "INPUT") {
								e.preventDefault()
								onToggle(t.key, true)
							}
						}}
					>
						<input
							id={tick}
							type="checkbox"
							checked={checked}
							onChange={() => onToggle(t.key, false)}
							className="peer sr-only"
							aria-label={QUICK_WORDS.selectRow(t.title)}
						/>
						<span className="rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-white">
							<CheckBadge on={checked} />
						</span>
					</label>
				)}
			</div>
			{/* biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
			<div role="cell" className={`${AT.info} min-w-0`}>
				<p className="line-clamp-2 leading-snug">
					<span className="text-base font-semibold text-white md:text-lg" lang={mediaFieldLanguage(t)}>
						{t.title}
					</span>
					{meta && <span className="ml-2 whitespace-nowrap text-sm tabular-nums text-gray-400">{meta}</span>}
				</p>
				{t.tags.length > 0 && <p className="mt-1 truncate text-sm text-gray-300">{t.tags.join(", ")}</p>}
				{latest && answer ? (
					<p className="mt-1 truncate text-sm font-semibold text-amber-300">{answerLabel(answer)}</p>
				) : (
					t.synopsis && (
						<p className="mt-1 line-clamp-1 text-sm text-gray-500 xl:line-clamp-2" lang={mediaFieldLanguage(t)}>
							{t.synopsis}
						</p>
					)
				)}
			</div>
			{/* biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
			<div role="cell" className={`${AT.keys} ${KEYS_ROW}`}>
				<ScoreKeys
					score={score}
					gw={null}
					label={`Your score for ${t.title}`}
					disabled={busy || (locked && score == null)}
					onPick={(n) => give({ type: "score", score: n })}
					onClear={() => onAnswer(t.key, null)}
				/>
			</div>
			{/* biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
			<div role="cell" className={AT.marks}>
				<RowMarks
					answer={answer}
					asking={asking}
					disabled={busy}
					onUnseen={() => setAsking(true)}
					onNotInterested={() => give({ type: "not-interested" })}
					onBack={() => setAsking(false)}
					onNo={() => give({ type: "skip" })}
					onWant={() => give({ type: "plan" })}
				/>
			</div>
		</div>
	)
})

// A layout effect in the browser; the server render has no layout.
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/** Rows that stay slide to their new places (transform); a new row at the bottom fades in, a row brought back slides in. */
function useRowMotion(keys: string) {
	const body = useRef<HTMLDivElement>(null)
	const tops = useRef(new Map<string, number>())
	// Deliberate dependencies: runs when the rows change, by their keys
	useBrowserLayoutEffect(() => {
		const el = body.current
		if (!el) return
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		const rows = [...el.querySelectorAll<HTMLElement>(":scope > [data-row]")]
		const kept = rows.some((r) => tops.current.has(r.dataset.row ?? ""))
		const next = new Map<string, number>()
		for (const row of rows) {
			const key = row.dataset.row ?? ""
			const top = row.offsetTop
			next.set(key, top)
			if (still || !kept) continue
			const before = tops.current.get(key)
			if (before == null && row.dataset.back != null)
				row.animate([{ opacity: 0, transform: "translateX(-16px)" }, { opacity: 1, transform: "none" }], {
					duration: 300,
					easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
				})
			else if (before == null)
				row.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], {
					duration: 280,
					delay: 120,
					easing: "ease-out",
					fill: "backwards",
				})
			else if (before !== top)
				row.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], {
					duration: 300,
					easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
				})
		}
		tops.current = next
	}, [keys])
	return body
}

function SortButton({
	label,
	by,
	order,
	onOrder,
}: { label: string; by: "title" | "year"; order: Order; onOrder: (o: Order) => void }) {
	const on = order.by === by
	const state = on ? (order.dir === "asc" ? "ascending" : "descending") : null
	return (
		<button
			type="button"
			onClick={() => onOrder(nextOrder(order, by))}
			aria-label={state ? `${label}, sorted ${state}` : `Sort by ${label.toLowerCase()}`}
			className={`inline-flex min-h-9 cursor-pointer items-center gap-0.5 whitespace-nowrap rounded-md px-1 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400 ${on ? "text-amber-300" : ""}`}
		>
			{label}
			<span aria-hidden className={`text-[10px] ${on ? "" : "opacity-0"}`}>
				{on && order.dir === "asc" ? "▲" : "▼"}
			</span>
		</button>
	)
}

/** The bar above the table while rows are selected: score them all, or mark them all. Desktop only. */
function SelectionBar({
	n,
	locked,
	onScore,
	onMark,
	onClear,
	note,
}: {
	n: number
	locked: boolean
	onScore: (score: number) => void
	onMark: (a: QuickAnswer) => void
	onClear: () => void
	/** Rows that were still saving at the last bulk answer, to try again. */
	note: string | null
}) {
	const mark =
		"inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-gray-700 px-2.5 text-xs font-bold text-gray-100 hover:border-gray-500 focus-visible:outline-2 focus-visible:outline-amber-400"
	return (
		<div
			className={`sticky top-[var(--nav-header-height,0px)] ${STICKY_BAR} mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-gray-900/95 px-3 py-2 text-sm ring-1 ring-amber-400/40`}
			data-selection
		>
			<b className="mr-1" aria-live="polite">
				{QUICK_WORDS.selected(n)}
			</b>
			<button type="button" className={mark} onClick={() => onMark({ type: "skip" })}>
				{WORDS.unseen}
			</button>
			<button type="button" className={mark} onClick={() => onMark({ type: "not-interested" })}>
				{WORDS.notInterested}
			</button>
			<span className="ml-2 text-gray-400">{QUICK_WORDS.scoreAs(n)}</span>
			<div className="w-[19rem] [&_button]:h-9">
				<ScoreKeys score={null} gw={null} label={QUICK_WORDS.scoreAs(n)} disabled={locked} onPick={onScore} />
			</div>
			<button type="button" onClick={onClear} className="ml-auto h-8 cursor-pointer px-2 text-xs text-gray-400 hover:text-white">
				{QUICK_WORDS.clearSelection}
			</button>
			{note && (
				<p className="basis-full text-xs text-amber-200/90" role="status" data-still-saving>
					{note}
				</p>
			)}
		</div>
	)
}

export function QuickTable({
	rows,
	answers,
	latest,
	leaving,
	back,
	order,
	onOrder,
	selects,
	locked,
	busy,
	onAnswer,
}: {
	rows: QuickTitle[]
	answers: Record<string, QuickAnswer | null>
	latest: readonly string[]
	leaving: readonly string[]
	back: readonly string[]
	order: Order
	onOrder: (o: Order) => void
	/** This screen selects rows (a desktop). */
	selects: boolean
	locked: boolean
	busy: (key: string) => boolean
	onAnswer: (keys: readonly string[], a: QuickAnswer | null) => { written: string[]; busy: string[] }
}) {
	const latestSet = useMemo(() => new Set(latest), [latest])
	const leavingSet = useMemo(() => new Set(leaving), [leaving])
	const backSet = useMemo(() => new Set(back), [back])
	const present = useMemo(() => rows.map((t) => t.key as string).filter((k) => !leavingSet.has(k)), [rows, leavingSet])

	// The selection: only on a desktop, only rows still here.
	const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
	const anchor = useRef<string | null>(null)
	const presentNow = useRef(present)
	presentNow.current = present
	useEffect(() => setPicked((s) => (selects ? keepSelected(s, present) : s.size ? new Set() : s)), [present, selects])
	const onToggle = useCallback((key: string, range: boolean) => {
		setPicked((s) => (range ? selectRange(s, presentNow.current, anchor.current, key) : toggleSelected(s, key)))
		anchor.current = key
	}, [])
	const onRowAnswer = useCallback((key: string, a: QuickAnswer | null) => onAnswer([key], a), [onAnswer])
	const chosen = present.filter((k) => picked.has(k))
	const n = selects ? chosen.length : 0
	const open = present.filter((k) => !answers[k])
	const allOn = open.length > 0 && open.every((k) => picked.has(k))
	const someOn = !allOn && n > 0
	// Rows still saving when a bulk answer was given keep their place in the selection, with a line that says so.
	const [stillSaving, setStillSaving] = useState(0)
	const many = (a: QuickAnswer) => {
		const { busy: skipped } = onAnswer(chosen, a)
		const after = afterBulk(chosen, skipped)
		setPicked(after.selected)
		setStillSaving(after.stillSaving)
	}
	useEffect(() => {
		if (n === 0) setStillSaving(0)
	}, [n])
	const body = useRowMotion(rows.map((t) => t.key).join(","))

	return (
		<div data-quick-table>
			{n > 0 && (
				<SelectionBar
					n={n}
					locked={locked}
					onScore={(score) => many({ type: "score", score })}
					onMark={many}
					onClear={() => setPicked(new Set())}
					note={stillSaving ? QUICK_WORDS.stillSaving(stillSaving) : null}
				/>
			)}
			{/* biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
			<div role="table" aria-label={QUICK_WORDS.head}>
				{/* biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
				<div role="rowgroup">
					{/* biome-ignore lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
					<div role="row" className={`${COLS} ${GAPS} items-center border-b border-white/10 py-1.5 text-xs font-semibold text-gray-400`} data-head>
						{/* biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
						<div role="columnheader" className={`${AT.poster} grid place-items-start`}>
							{selects ? (
								<button
									type="button"
									// biome-ignore lint/a11y/useSemanticElements: a tri-state select-all drawn as the rows' round check
									role="checkbox"
									aria-checked={allOn ? true : someOn ? "mixed" : false}
									aria-label={QUICK_WORDS.selectAll}
									onClick={() => setPicked(allOn || someOn ? new Set() : new Set(open))}
									className="-m-2 grid size-10 cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-amber-400"
								>
									<CheckBadge on={allOn} mixed={someOn} />
								</button>
							) : (
								<span className="sr-only">Poster</span>
							)}
						</div>
						{/* biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
						<div role="columnheader" className={`${AT.info} flex items-center gap-2`}>
							<SortButton label={QUICK_WORDS.title} by="title" order={order} onOrder={onOrder} />
							<SortButton label={QUICK_WORDS.year} by="year" order={order} onOrder={onOrder} />
						</div>
						{/* biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
						<div role="columnheader" className="hidden xl:col-start-3 xl:row-start-1 xl:block">
							{WORDS.ask}
						</div>
						{/* biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
						<div role="columnheader" className="hidden md:col-start-3 md:row-start-1 md:block xl:col-start-4">
							<span className="sr-only">{`${WORDS.unseen} · ${WORDS.notInterested}`}</span>
						</div>
					</div>
				</div>
				{/* biome-ignore lint/a11y/useSemanticElements: a CSS grid table: div rows keep their table roles where display on table elements would drop them */}
				<div role="rowgroup" ref={body} className="relative">
					{rows.map((t) => (
						<Row
							key={t.key}
							t={t}
							answer={answers[t.key] ?? null}
							latest={latestSet.has(t.key)}
							leaving={leavingSet.has(t.key)}
							back={backSet.has(t.key)}
							checked={n > 0 && picked.has(t.key)}
							selecting={n > 0}
							selects={selects}
							locked={locked}
							busy={busy(t.key)}
							onToggle={onToggle}
							onAnswer={onRowAnswer}
						/>
					))}
				</div>
			</div>
		</div>
	)
}
