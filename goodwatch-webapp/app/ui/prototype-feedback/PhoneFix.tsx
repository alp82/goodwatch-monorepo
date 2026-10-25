// PROTOTYPE - throwaway. Fix mode on phones (round 7, Split view picked). The side drawer is too big for a phone: it
// covered the very part being reported. Here the drawer only offers the two paths; "Fix something on this page" slides
// it back into the tab and fix mode runs from the bottom edge instead, where the app's dock is:
// - Picking: a slim bar, "Tap the part that's wrong", with the parts as a row of chips. The scrim, the outlines and the
//   badges show at this stage only.
// - Answering: the page scrolls the picked part to the top, under the header, and the questions sit in a sheet below
//   it. The sheet starts at about half the room (more when the part leaves more), grows a little and scrolls the form
//   into sight once the form opens, and its grip (the top row) drags it to any height: down to see the part, up to
//   type. Dragged almost shut, it folds to a slim bar with "Continue".
// The tab rests on the sheet's top right corner as its handle; tapping it closes fix mode, like pushing a drawer in.
// Opening, closing and folding move by transform only. Dragging sets the sheet's height directly: it's one fixed element,
// so nothing on the page moves.
import {
	ArrowLeftIcon,
	ChatBubbleLeftEllipsisIcon,
	ChevronUpIcon,
	FlagIcon,
	PencilSquareIcon,
} from "@heroicons/react/20/solid"
import { XMarkIcon } from "@heroicons/react/24/solid"
import {
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import type { FixPath } from "~/ui/prototype-feedback/FeedbackDock"
import { reduced, useFadePresence } from "~/ui/prototype-feedback/fix-scrim"

/** The header row's height; the folded sheet shows just this row. */
const ROW = 56
/** How far the handle stands above the sheet. */
const HANDLE = 30
/** Below this, a dragged sheet folds to its slim bar. */
const MIN_OPEN = ROW + 72
/** The sheet's starting share of the room under the header, however tall the part is. */
const START_SHARE = 0.52
/** How far the sheet grows by itself once the form opens. */
const FORM_SHARE = 0.72

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

const headerBottom = () =>
	Math.max(
		0,
		document.querySelector("[data-site-header]")?.getBoundingClientRect()
			.bottom ?? 0,
	)

/** The parts, as a sideways row of chips under "Tap the part that's wrong". */
function PartChips({ fix }: { fix: FixPath }) {
	return (
		<ul
			className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			data-fix-list
		>
			{fix.areas.map((a) => (
				<li key={a.id} className="shrink-0">
					<button
						type="button"
						data-fix-item={a.id}
						onClick={() => fix.pick(a.id)}
						className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-white/[0.06] py-1 pr-3.5 pl-1.5 text-sm font-semibold whitespace-nowrap text-gray-100 ring-1 ring-white/10 active:bg-white/10"
					>
						<span
							className={`grid size-7 place-items-center rounded-full ${a.flagOnly ? "bg-gray-200 text-gray-950" : "bg-amber-400 text-gray-950"}`}
							aria-hidden
						>
							{a.flagOnly ? (
								<FlagIcon className="size-3.5" />
							) : (
								<PencilSquareIcon className="size-3.5" />
							)}
						</span>
						{a.label}
					</button>
				</li>
			))}
		</ul>
	)
}

/** While answering on a phone: only the picked part keeps its outline, solid and see-through to taps. */
function answerRules(picked: string) {
	const id = CSS.escape(picked)
	return `
html[data-fix-phone="answer"] [data-fix-scrim],
html[data-fix-phone="answer"] [data-fix-badge],
html[data-fix-phone="answer"] [data-fix-overlay]:not([data-fix-overlay="${id}"]){opacity:0!important;pointer-events:none!important}
html[data-fix-phone="answer"] [data-fix-overlay="${id}"]{pointer-events:none!important;border-style:solid!important;border-color:rgb(251 191 36)!important;background-color:transparent!important}
html[data-fix-phone="answer"] [data-site-header]{opacity:1!important}
html[data-fix-phone="answer"] [data-feedback-page] .sticky,html[data-fix-phone="answer"] [data-details-header]{opacity:0!important;pointer-events:none!important}`
}

const clamp = (n: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, n))

/** The room for the sheet: from just under the header (handle included) to the bottom edge. */
const roomUnderHeader = () =>
	Math.round(window.innerHeight - headerBottom() - HANDLE - 8)

export function PhoneFix({
	on,
	fix,
	title,
	body,
	onBack,
	onClose,
}: {
	/** Phone fix mode is on (picking or answering). */
	on: boolean
	fix: FixPath | undefined
	title: string
	/** The picked part's questions (or their thanks once sent). */
	body: ReactNode
	onBack: () => void
	onClose: () => void
}) {
	const { mounted, shown } = useFadePresence(on, 280)
	// While it slides away, the sheet keeps what it showed.
	const live = {
		answering: on && Boolean(fix?.picked),
		title,
		body,
		id: fix?.picked?.id ?? null,
	}
	const last = useRef(live)
	if (on) last.current = live
	const { answering } = on ? live : last.current
	const shownTitle = on ? title : last.current.title
	const shownBody = on ? body : last.current.body
	const pickedId = on && answering ? (fix?.picked?.id ?? null) : null
	const [mini, setMini] = useState(false)
	/** The answering sheet's height (header row included); null while picking. */
	const [size, setSize] = useState<number | null>(null)
	const [room, setRoom] = useState(600)
	const sheetRef = useRef<HTMLDivElement>(null)
	const bodyRef = useRef<HTMLDivElement>(null)
	/** Set before a size change: where the sheet starts (px down from its new resting place) once the new size lands. */
	const flip = useRef<number | null>(null)
	const drag = useRef<{
		y: number
		from: number
		to: number
		max: number
	} | null>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	/** The height to open at again after a drag folded the sheet. */
	const restore = useRef<number | null>(null)
	const sizeRef = useRef(size)
	sizeRef.current = size

	// The stage, for the page-wide rules (and the scroll helper's clear area).
	useIsoLayoutEffect(() => {
		if (!on) return
		const root = document.documentElement
		root.setAttribute("data-fix-phone", answering ? "answer" : "pick")
		return () => root.removeAttribute("data-fix-phone")
	}, [on, answering])

	useEffect(() => {
		if (!on) return
		const measure = () => setRoom(roomUnderHeader())
		measure()
		window.addEventListener("resize", measure)
		return () => window.removeEventListener("resize", measure)
	}, [on])

	// A new pick: size the sheet and bring the part under the header.
	useIsoLayoutEffect(() => {
		if (!on) return
		setMini(false)
		restore.current = null
		if (!pickedId || !fix) {
			setSize(null)
			return
		}
		const max = roomUnderHeader()
		setRoom(max)
		const part = fix.element(pickedId)
		const top = headerBottom()
		const content = ROW + (bodyRef.current?.scrollHeight ?? max)
		let start = Math.round(max * START_SHARE)
		if (part) {
			const r = part.getBoundingClientRect()
			// The part's outline stands 4px out; air above and below it.
			start = Math.max(start, max + HANDLE + 8 - (r.height + 8) - 24 - HANDLE)
			window.scrollTo({
				top: Math.max(0, r.top + window.scrollY - (top + 16)),
				behavior: reduced() ? "auto" : "smooth",
			})
		}
		setSize(clamp(Math.min(start, content), MIN_OPEN, max))
	}, [pickedId])

	// A size change lands without a jump: the sheet starts where it was (transform) and, for a grow, slides up.
	useIsoLayoutEffect(() => {
		const el = sheetRef.current
		const from = flip.current
		if (!el || from === null) return
		flip.current = null
		el.style.transition = "none"
		el.style.transform = from ? `translateY(${from}px)` : "none"
		if (from && !reduced()) {
			el.getBoundingClientRect()
			el.style.transition = ""
			el.style.transform = "none"
		} else {
			el.style.transform = "none"
			requestAnimationFrame(() => {
				el.style.transition = ""
			})
		}
	}, [size])

	// Once more of the form opens (the next question, a text field), the sheet grows a little and scrolls it into sight.
	useEffect(() => {
		const box = bodyRef.current
		if (!box || !pickedId) return
		let timer = 0
		const mo = new MutationObserver((records) => {
			let fresh: HTMLElement | null = null
			for (const m of records)
				for (const n of m.addedNodes)
					if (
						n instanceof HTMLElement &&
						n.tagName !== "STYLE" &&
						n.getBoundingClientRect().height > 16 &&
						(!fresh ||
							fresh.compareDocumentPosition(n) &
								Node.DOCUMENT_POSITION_PRECEDING)
					)
						fresh = n
			const cur = sizeRef.current
			if (!fresh || cur === null) return
			const max = roomUnderHeader()
			const want = clamp(
				Math.min(ROW + box.scrollHeight, Math.round(max * FORM_SHARE)),
				cur,
				max,
			)
			if (want > cur + 8) {
				flip.current = want - cur
				setSize(want)
			}
			const el = fresh
			window.clearTimeout(timer)
			// After the new height lands, measure where the new part sits in the sheet.
			timer = window.setTimeout(() => {
				const at = el.getBoundingClientRect()
				const b = box.getBoundingClientRect()
				// The sheet's own sticky footer (Send) covers its bottom.
				const foot = box.querySelector(".sticky")
				const bottom = (foot?.getBoundingClientRect().top ?? b.bottom) - 12
				const top = b.top + 12
				let by = 0
				if (at.height > bottom - top || at.top < top) by = at.top - top
				else if (at.bottom > bottom) by = at.bottom - bottom
				if (Math.abs(by) > 1)
					box.scrollBy({ top: by, behavior: reduced() ? "auto" : "smooth" })
			}, 40)
		})
		mo.observe(box, { childList: true, subtree: true })
		return () => {
			mo.disconnect()
			window.clearTimeout(timer)
		}
	}, [pickedId])

	if (!mounted || !fix) return null

	// The grip follows the finger with the sheet's real height (one fixed element; the page never moves), so the
	// questions and Send stay at its bottom the whole way.
	const grab = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (!answering || mini || size === null || e.button > 0) return
		if ((e.target as Element).closest("button, a, input, textarea")) return
		// No text selection or native drag (which would cancel the pointer) from the grip.
		e.preventDefault()
		window.getSelection()?.removeAllRanges()
		// Up to the room under the header, but never taller than the questions (no empty space under Send).
		const box = bodyRef.current
		const last = box?.lastElementChild
		const full =
			box && last
				? ROW +
					last.getBoundingClientRect().bottom -
					box.getBoundingClientRect().top +
					box.scrollTop +
					16
				: room
		drag.current = {
			y: e.clientY,
			from: size,
			to: size,
			max: Math.max(size, Math.min(room, Math.ceil(full))),
		}
		e.currentTarget.setPointerCapture(e.pointerId)
	}
	const move = (e: ReactPointerEvent<HTMLDivElement>) => {
		const d = drag.current
		const panel = panelRef.current
		if (!d || !panel) return
		d.to = clamp(d.from - (e.clientY - d.y), ROW, d.max)
		panel.style.height = `${Math.round(d.to)}px`
	}
	const drop = () => {
		const d = drag.current
		drag.current = null
		if (!d) return
		const to = Math.round(d.to)
		if (to < MIN_OPEN) {
			// Folds from where the finger left it; "Continue" opens it at the size it had before.
			restore.current = d.from
			setSize(Math.max(ROW, to))
			setMini(true)
			return
		}
		setSize(to)
	}
	const unfold = () => {
		setMini(false)
		if (restore.current !== null) setSize(restore.current)
		restore.current = null
	}

	return (
		<div
			ref={sheetRef}
			data-fix-sheet={answering ? "answer" : "pick"}
			data-mini={mini || undefined}
			data-fix-row={ROW}
			data-fix-handle-h={HANDLE}
			data-feedback-private
			className="fixed inset-x-0 bottom-0 z-[1003] transition-transform duration-300 ease-[cubic-bezier(.22,.8,.24,1)] motion-reduce:transition-none"
			style={{
				transform: !shown
					? `translateY(calc(100% + ${HANDLE}px))`
					: mini
						? `translateY(calc(100% - ${ROW}px - env(safe-area-inset-bottom)))`
						: "none",
			}}
		>
			{/* The prototype switcher steps aside in phone fix mode; the page layer's parts fade as the stage changes. */}
			<style>
				{
					"html[data-fix-phone] .tsqd-parent-container{display:none}html[data-fix-phone] [data-mobile-dock]{visibility:hidden;transition:visibility 0s linear .3s}html[data-fix-phone] [data-prototype-switcher]{opacity:0!important;pointer-events:none!important}[data-prototype-switcher]{transition:opacity .2s ease-out}html[data-fix-phone] [data-fix-badge],html[data-fix-phone] [data-feedback-page] .sticky,html[data-fix-phone] [data-details-header]{transition:opacity .2s ease-out}"
				}
			</style>
			{/* While answering, the page's sticky bar steps aside and the other parts' outlines go. */}
			{pickedId && <style>{answerRules(pickedId)}</style>}
			{/* The tab, resting on the sheet as its handle. */}
			<button
				type="button"
				onClick={onClose}
				aria-label="Close feedback"
				data-fix-handle
				className="absolute right-0 bottom-full grid w-10 cursor-pointer place-items-center rounded-tl-xl bg-gray-950 ring-1 ring-amber-500/30"
				style={{ height: HANDLE + 1, marginBottom: -1 }}
			>
				<ChatBubbleLeftEllipsisIcon
					className="size-5 text-amber-400"
					aria-hidden
				/>
			</button>
			<div
				ref={panelRef}
				data-fix-panel
				className="relative flex flex-col rounded-tl-3xl bg-gray-950 pb-[env(safe-area-inset-bottom)] shadow-[0_-24px_60px_-20px_rgba(0,0,0,.95)] ring-1 ring-white/12"
				style={answering && size !== null ? { height: size } : undefined}
			>
				{/* Hides the ring's seam under the handle, so handle and sheet read as one shape. */}
				<span
					aria-hidden
					className="pointer-events-none absolute -top-px right-px h-0.5 w-[38px] bg-gray-950"
				/>
				{/* The grip: the whole top row drags the sheet (its buttons still tap). */}
				<div
					data-fix-grip
					onPointerDown={grab}
					onPointerMove={move}
					onPointerUp={drop}
					onPointerCancel={drop}
					className={`relative flex shrink-0 items-center gap-1 px-3 ${answering && !mini ? "cursor-grab touch-none select-none active:cursor-grabbing" : ""}`}
					style={{ height: ROW }}
				>
					{answering && !mini && (
						<span
							aria-hidden
							className="pointer-events-none absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/25"
						/>
					)}
					<button
						type="button"
						onClick={onBack}
						aria-label="Back"
						className="cursor-pointer rounded-full p-2 text-gray-300 active:bg-white/10"
					>
						<ArrowLeftIcon className="size-5" />
					</button>
					{mini ? (
						<button
							type="button"
							onClick={unfold}
							data-fix-unfold
							className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
						>
							<span className="truncate text-base font-semibold text-white">
								{shownTitle}
							</span>
							<span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-gray-200">
								Continue <ChevronUpIcon className="size-4" aria-hidden />
							</span>
						</button>
					) : (
						<h2 className="min-w-0 flex-1 truncate text-base font-semibold text-white">
							{answering ? shownTitle : "Tap the part that's wrong"}
						</h2>
					)}
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="cursor-pointer rounded-full p-2 text-gray-300 active:bg-white/10"
					>
						<XMarkIcon className="size-5" />
					</button>
				</div>
				{answering ? (
					<div
						key={on ? (live.id ?? "") : (last.current.id ?? "")}
						ref={bodyRef}
						className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 transition-opacity duration-200 ${mini ? "opacity-0" : "opacity-100"} motion-safe:animate-[fixin_.2s_ease-out]`}
						{...(mini && { inert: "" })}
					>
						<style>{"@keyframes fixin{from{opacity:0}}"}</style>
						{shownBody}
					</div>
				) : (
					<div key="pick" className="motion-safe:animate-[fixin_.2s_ease-out]">
						<style>{"@keyframes fixin{from{opacity:0}}"}</style>
						<PartChips fix={fix} />
					</div>
				)}
			</div>
		</div>
	)
}
