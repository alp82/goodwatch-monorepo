// PROTOTYPE - throwaway. Fix mode on phones (round 6). The side drawer is too big for a phone: it covered the very part
// being reported. Here the drawer only offers the two paths; "Fix something on this page" slides it back into the tab
// and fix mode runs from the bottom edge instead, where the app's dock is (the dock steps aside once it's covered):
// - Picking: a slim bar, "Tap the part that's wrong", with the parts as a row of chips. The scrim, the outlines and the
//   badges show at this stage only.
// - Answering, two variants for the owner to compare (?m=1|2):
//   1 "Split view": the page scrolls the picked part to the top, under the header; the questions sit in a compact sheet
//     below it that never reaches it (its height is what the part leaves). Only the picked part keeps its outline.
//   2 "Quoted": the sheet takes the bottom part and quotes the picked part at its top: a live, scaled-down copy. Tapping
//     the copy scrolls to the real part and folds the sheet to a slim bar until it's tapped again.
// The tab rests on the sheet's top right corner as its handle; tapping it closes fix mode, like pushing a drawer in.
// Opening, closing and folding move by transform and fade by opacity only; nothing on the page shifts.
import {
	ArrowLeftIcon,
	ChatBubbleLeftEllipsisIcon,
	ChevronUpIcon,
	FlagIcon,
	PencilSquareIcon,
} from "@heroicons/react/20/solid"
import { XMarkIcon } from "@heroicons/react/24/solid"
import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import type { FixPath } from "~/ui/prototype-feedback/FeedbackDock"
import { reduced, useFadePresence } from "~/ui/prototype-feedback/fix-scrim"

export type PhoneVariant = 1 | 2

/** The header row's height; the folded sheet shows just this row. */
const ROW = 56
/** How far the handle stands above the sheet. */
const HANDLE = 30
/** The least the questions get in Split view, however tall the part is. */
const MIN_SHEET = 236
const QUOTE_MAX = 140

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

const headerBottom = () =>
	Math.max(
		0,
		document.querySelector("[data-site-header]")?.getBoundingClientRect()
			.bottom ?? 0,
	)

/**
 * A live, scaled-down copy of the picked part: cloned again whenever the part changes (a live fix shows at once),
 * never clickable, without ids, form fields or the outline.
 */
function Quote({ el, onTap }: { el: HTMLElement; onTap: () => void }) {
	const host = useRef<HTMLDivElement>(null)
	const [height, setHeight] = useState(0)
	useEffect(() => {
		const box = host.current
		if (!box) return
		let frame = 0
		const draw = () => {
			frame = 0
			const r = el.getBoundingClientRect()
			const w = box.clientWidth
			if (!r.width || !w) return
			const scale = Math.min(1, w / r.width, QUOTE_MAX / r.height)
			const clone = el.cloneNode(true) as HTMLElement
			for (const x of clone.querySelectorAll(
				"[data-fix-overlay], [data-feedback-private], script",
			))
				x.remove()
			for (const x of clone.querySelectorAll("input, textarea, select")) {
				const bar = document.createElement("div")
				bar.style.cssText =
					"height:2.5rem;border-radius:.5rem;background:#1f2937"
				x.replaceWith(bar)
			}
			for (const x of [clone, ...clone.querySelectorAll("[id]")])
				x.removeAttribute("id")
			for (const x of clone.querySelectorAll("img[loading]"))
				x.removeAttribute("loading")
			clone.style.cssText = `position:absolute;top:0;left:${Math.max(0, (w - r.width * scale) / 2)}px;width:${r.width}px;margin:0;transform:scale(${scale});transform-origin:0 0;pointer-events:none`
			box.replaceChildren(clone)
			setHeight(Math.round(r.height * scale))
		}
		draw()
		// Changes inside the outline (lit, hovered) aren't the part's.
		const mo = new MutationObserver((records) => {
			if (
				records.some(
					(m) =>
						!(
							m.target instanceof Element ? m.target : m.target.parentElement
						)?.closest("[data-fix-overlay]"),
				) &&
				!frame
			)
				frame = requestAnimationFrame(draw)
		})
		mo.observe(el, {
			subtree: true,
			childList: true,
			characterData: true,
			attributes: true,
		})
		return () => {
			mo.disconnect()
			cancelAnimationFrame(frame)
		}
	}, [el])
	return (
		<button
			type="button"
			onClick={onTap}
			data-fix-quote
			aria-label="Show it on the page"
			className="group relative block w-full cursor-pointer overflow-hidden rounded-xl bg-gray-900 p-2 ring-1 ring-amber-400/60"
		>
			<div
				ref={host}
				aria-hidden
				{...{ inert: "" }}
				className="pointer-events-none relative w-full overflow-hidden"
				style={{ height }}
			/>
			<span className="absolute right-2 bottom-2 rounded-full bg-gray-950/85 px-2 py-0.5 text-[11px] font-semibold text-gray-200 ring-1 ring-white/15">
				Show on the page
			</span>
		</button>
	)
}

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
html[data-fix-phone="answer"] [data-feedback-page] .sticky{opacity:0!important;pointer-events:none!important}`
}

export function PhoneFix({
	on,
	fix,
	variant,
	title,
	body,
	onBack,
	onClose,
}: {
	/** Phone fix mode is on (picking or answering). */
	on: boolean
	fix: FixPath | undefined
	variant: PhoneVariant
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
	const [sheetMax, setSheetMax] = useState<number | null>(null)
	const [el, setEl] = useState<HTMLElement | null>(null)

	// The stage, for the page-wide rules (and the scroll helper's clear area).
	useIsoLayoutEffect(() => {
		if (!on) return
		const root = document.documentElement
		root.setAttribute("data-fix-phone", answering ? "answer" : "pick")
		return () => root.removeAttribute("data-fix-phone")
	}, [on, answering])

	// A new pick: find the part, size the sheet, and (Split view) bring the part under the header.
	useIsoLayoutEffect(() => {
		if (!on) return
		setMini(false)
		if (!pickedId || !fix) {
			setEl(null)
			setSheetMax(null)
			return
		}
		const part = fix.element(pickedId)
		setEl(part)
		const top = headerBottom()
		const H = window.innerHeight
		if (variant === 2 || !part) {
			setSheetMax(H - top - 24 - HANDLE)
			return
		}
		const r = part.getBoundingClientRect()
		// The part's outline stands 4px out; 12px of air above and below it.
		const room = H - top - (r.height + 8) - 24 - HANDLE
		setSheetMax(Math.max(MIN_SHEET, room))
		const target = r.top + window.scrollY - (top + 16)
		window.scrollTo({
			top: Math.max(0, target),
			behavior: reduced() ? "auto" : "smooth",
		})
	}, [pickedId, variant])

	if (!mounted || !fix) return null
	const quote = variant === 2 && answering && el && !fix.done
	const showOnPage = () => {
		setMini(true)
		// The fold has to land before the clear area is measured.
		requestAnimationFrame(() => fix.reveal(pickedId ?? ""))
	}
	const bodyMax = sheetMax
		? sheetMax - ROW - (quote ? QUOTE_MAX + 28 : 0)
		: undefined
	return (
		<div
			data-fix-sheet={answering ? "answer" : "pick"}
			data-fix-variant={variant}
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
					"html[data-fix-phone] .tsqd-parent-container{display:none}html[data-fix-phone] [data-mobile-dock]{visibility:hidden;transition:visibility 0s linear .3s}html[data-fix-phone] [data-prototype-switcher]{opacity:0!important;pointer-events:none!important}[data-prototype-switcher]{transition:opacity .2s ease-out}html[data-fix-phone] [data-fix-badge],html[data-fix-phone] [data-feedback-page] .sticky{transition:opacity .2s ease-out}"
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
				data-fix-panel
				className="relative rounded-tl-3xl bg-gray-950 pb-[env(safe-area-inset-bottom)] shadow-[0_-24px_60px_-20px_rgba(0,0,0,.95)] ring-1 ring-white/12"
			>
				{/* Hides the ring's seam under the handle, so handle and sheet read as one shape. */}
				<span
					aria-hidden
					className="pointer-events-none absolute -top-px right-px h-0.5 w-[38px] bg-gray-950"
				/>
				<div className="flex items-center gap-1 px-3" style={{ height: ROW }}>
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
							onClick={() => setMini(false)}
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
						className={`transition-opacity duration-200 ${mini ? "opacity-0" : "opacity-100"} motion-safe:animate-[fixin_.2s_ease-out]`}
						{...(mini && { inert: "" })}
					>
						<style>{"@keyframes fixin{from{opacity:0}}"}</style>
						{quote && (
							<div className="px-4 pb-3">
								<Quote el={el} onTap={showOnPage} />
							</div>
						)}
						<div
							className="overflow-y-auto overscroll-contain px-4 pb-4"
							style={{ maxHeight: bodyMax }}
						>
							{shownBody}
						</div>
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
