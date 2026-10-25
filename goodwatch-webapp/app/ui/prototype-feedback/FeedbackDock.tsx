// PROTOTYPE - throwaway. The one feedback entry point (variant C, round 5): a quiet "Feedback" tab on the right edge of
// every page, in the upper middle. The tab is a drawer's handle: tapped, it stays where it is, pressed, and the panel
// slides out of it to the left, joined to the tab's left edge and level with its top (moved up only as far as it must to
// fit the window); tapping the tab again, Escape or the panel's close button slides it back in (and ends fix mode).
// Phones open the same drawer from the tab; once fix mode starts, it goes back in and fix mode runs from the bottom edge
// (PhoneFix.tsx). The panel offers two paths:
// - "Fix something on this page" on pages with correctable data: the page's fix mode dims everything but the choosable
//   blocks, marks them with a dashed outline and a Fix/Flag badge, and the panel lists them too; hovering either side
//   lights up the other. A picked block's questions show in the panel.
// - "Send feedback": one text box, bug or idea, and "Include a screenshot" (off by default) with a preview of what
//   gets sent. Nothing is sent.
// Pages without correctable data go straight to Send feedback. Guests may leave an email if they want an answer.
// The root layout mounts it on every page in development (GlobalFix.tsx, with the parts from areas.ts); the feedback
// prototype mounts its own with the richer title and person flows. It imports no fixtures.
import {
	ArrowLeftIcon,
	BugAntIcon,
	ChatBubbleLeftEllipsisIcon,
	CheckCircleIcon,
	ChevronRightIcon,
	FlagIcon,
	LightBulbIcon,
	PencilSquareIcon,
} from "@heroicons/react/20/solid"
import { XMarkIcon } from "@heroicons/react/24/solid"
import {
	type ReactNode,
	createContext,
	forwardRef,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { PrimaryButton } from "~/ui/auth/kit"
import { PhoneFix } from "~/ui/prototype-feedback/PhoneFix"

/**
 * What a picked part's questions tell the panel: a report went out (fix mode's page layer goes, the thanks stay), the
 * person reports something else (it comes back), or Done (the panel closes). Null outside the panel.
 */
type FixFlow = { sent: () => void; again: () => void; done: () => void }
const FixFlowContext = createContext<FixFlow | null>(null)
export const useFixFlow = () => useContext(FixFlowContext)

export const INPUT =
	"min-h-11 w-full rounded-lg bg-gray-900 px-3 text-gray-100 ring-1 ring-white/15 placeholder:text-gray-600 focus:ring-2 focus:ring-amber-400 focus:outline-none"

type Kind = "bug" | "idea"

/** Guests only: members get answers at their account's email. Optional. */
export function GuestEmail({
	value,
	onChange,
}: { value: string; onChange: (v: string) => void }) {
	return (
		<label className="flex flex-col gap-1.5" data-guest-email>
			<span className="text-sm font-medium text-gray-300">
				Your email{" "}
				<span className="font-normal text-gray-500">
					(if you want an answer)
				</span>
			</span>
			<input
				type="email"
				inputMode="email"
				autoComplete="email"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="you@example.com"
				className={INPUT}
			/>
		</label>
	)
}

/** The "it's with us" line after sending, for who sent it and how. */
export const thanksLine = (guest: boolean, email: string) =>
	guest
		? email.trim()
			? `We'll answer at ${email.trim()}.`
			: "We read every message."
		: "If we have a question, we'll email you."

function useIsWide() {
	const [wide, setWide] = useState(false)
	useEffect(() => {
		const m = window.matchMedia("(min-width: 768px)")
		const on = () => setWide(m.matches)
		on()
		m.addEventListener("change", on)
		return () => m.removeEventListener("change", on)
	}, [])
	return wide
}

/** A scaled copy of what's on screen now, without the feedback panel, the switcher, form fields or avatars. */
function Snapshot() {
	const box = useRef<HTMLDivElement>(null)
	const [ratio, setRatio] = useState(0.5625)
	useEffect(() => {
		const host = box.current
		const page =
			document.querySelector<HTMLElement>("[data-feedback-page]") ??
			document.querySelector<HTMLElement>("main") ??
			document.body
		if (!host || !page) return
		const w = window.innerWidth
		const h = window.innerHeight
		setRatio(h / w)
		const clone = page.cloneNode(true) as HTMLElement
		for (const el of clone.querySelectorAll(
			"[data-feedback-private], .search-private, [data-member-avatar], script",
		))
			el.remove()
		for (const el of clone.querySelectorAll("input, textarea, select")) {
			const bar = document.createElement("div")
			bar.style.cssText = "height:2.5rem;border-radius:.5rem;background:#1f2937"
			el.replaceWith(bar)
		}
		for (const el of clone.querySelectorAll("[id]")) el.removeAttribute("id")
		const top = page.getBoundingClientRect().top
		clone.style.cssText = `position:absolute;left:0;top:${top}px;width:${w}px;pointer-events:none`
		const frame = document.createElement("div")
		const scale = host.clientWidth / w
		frame.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;transform:scale(${scale});transform-origin:0 0;overflow:hidden;background:#111827`
		frame.appendChild(clone)
		host.replaceChildren(frame)
	}, [])
	return (
		<div className="overflow-hidden rounded-lg ring-1 ring-white/15">
			<div
				ref={box}
				{...{ inert: "" }}
				aria-hidden
				className="relative w-full overflow-hidden bg-gray-900"
				style={{ aspectRatio: `1 / ${ratio}`, maxHeight: "11rem" }}
			/>
		</div>
	)
}

function Switch({
	on,
	onChange,
	label,
}: { on: boolean; onChange: (v: boolean) => void; label: string }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			onClick={() => onChange(!on)}
			className="flex w-full cursor-pointer items-center gap-3 text-left text-sm font-medium text-gray-100"
		>
			<span
				className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-amber-500" : "bg-white/15"}`}
				aria-hidden
			>
				<span
					className={`absolute top-1 left-1 size-4 rounded-full bg-white transition-transform duration-200 ${on ? "translate-x-4" : ""}`}
				/>
			</span>
			{label}
		</button>
	)
}

function KindTabs({
	kind,
	setKind,
}: { kind: Kind; setKind: (k: Kind) => void }) {
	return (
		<div
			role="tablist"
			aria-label="Kind"
			className="flex rounded-full bg-white/8 p-0.5 text-sm"
		>
			{(["bug", "idea"] as const).map((k) => (
				<button
					key={k}
					type="button"
					role="tab"
					aria-selected={kind === k}
					onClick={() => setKind(k)}
					className={`flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 ${kind === k ? "bg-white font-semibold text-black" : "text-gray-300 hover:text-white"}`}
				>
					{k === "bug" ? (
						<BugAntIcon className="size-4" />
					) : (
						<LightBulbIcon className="size-4" />
					)}
					{k === "bug" ? "A bug" : "An idea"}
				</button>
			))}
		</div>
	)
}

function KindTiles({
	kind,
	setKind,
}: { kind: Kind; setKind: (k: Kind) => void }) {
	return (
		<div className="grid grid-cols-2 gap-2">
			{(["bug", "idea"] as const).map((k) => (
				<button
					key={k}
					type="button"
					aria-pressed={kind === k}
					onClick={() => setKind(k)}
					className={`flex cursor-pointer flex-col items-start gap-1 rounded-xl p-3 text-left ring-1 transition-colors ${kind === k ? "bg-amber-500/10 ring-amber-500/60" : "bg-white/[0.04] ring-white/10 hover:ring-white/25"}`}
				>
					{k === "bug" ? (
						<BugAntIcon className="size-5 text-amber-400" />
					) : (
						<LightBulbIcon className="size-5 text-amber-400" />
					)}
					<span className="text-sm font-semibold text-gray-100">
						{k === "bug" ? "Something's broken" : "An idea"}
					</span>
					<span className="text-xs text-gray-500">
						{k === "bug" ? "Tell us what happened" : "What would help you?"}
					</span>
				</button>
			))}
		</div>
	)
}

export function FeedbackForm({
	style,
	onClose,
	guest,
}: {
	style: "tiles" | "textFirst" | "tabs"
	onClose: () => void
	guest: boolean
}) {
	const [kind, setKind] = useState<Kind>("bug")
	const [text, setText] = useState("")
	const [shot, setShot] = useState(false)
	const [email, setEmail] = useState("")
	const [sent, setSent] = useState(false)
	if (sent)
		return (
			<div className="flex flex-col gap-4 py-2" aria-live="polite">
				<div className="flex items-start gap-3">
					<span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
						<CheckCircleIcon className="size-6" />
					</span>
					<div>
						<p className="text-lg font-semibold text-white">
							Thanks! It's with us.
						</p>
						<p className="mt-0.5 text-sm text-gray-400">
							{thanksLine(guest, email)}
						</p>
					</div>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => {
							setSent(false)
							setText("")
							setShot(false)
						}}
						className="min-h-10 cursor-pointer rounded-xl px-4 font-semibold text-gray-300 hover:bg-white/10"
					>
						Send another
					</button>
					<button
						type="button"
						onClick={onClose}
						className="ml-auto min-h-10 cursor-pointer rounded-xl bg-white px-5 font-semibold text-black hover:bg-gray-200"
					>
						Done
					</button>
				</div>
			</div>
		)
	const box = (
		<textarea
			value={text}
			onChange={(e) => setText(e.target.value)}
			rows={style === "textFirst" ? 5 : 4}
			aria-label="Your message"
			placeholder={
				kind === "bug"
					? "What happened, and where?"
					: "What would make GoodWatch better for you?"
			}
			className={`${INPUT} py-2.5`}
		/>
	)
	return (
		<div className="flex flex-col gap-4">
			{style === "tiles" && <KindTiles kind={kind} setKind={setKind} />}
			{style === "tabs" && <KindTabs kind={kind} setKind={setKind} />}
			{box}
			{style === "textFirst" && <KindTabs kind={kind} setKind={setKind} />}
			<div className="flex flex-col gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
				<Switch on={shot} onChange={setShot} label="Include a screenshot" />
				{shot ? (
					<>
						<Snapshot />
						<p className="text-xs text-gray-500">
							This is what we get. What you type and other members' pictures are
							left out.
						</p>
					</>
				) : (
					<p className="text-xs text-gray-500">
						Helps us see what you see. Off unless you turn it on.
					</p>
				)}
			</div>
			{guest && <GuestEmail value={email} onChange={setEmail} />}
			<p className="text-xs text-gray-500">
				We also get the page address, your browser and the app version.
			</p>
			<PrimaryButton
				type="button"
				disabled={!text.trim()}
				onClick={() => setSent(true)}
			>
				Send
			</PrimaryButton>
		</div>
	)
}

// --- The tab ---

/** Hidden while the page scrolls down on phones, back on the first scroll up (transform only). Never while open. */
function useHideOnScrollDown(active: boolean) {
	const [hidden, setHidden] = useState(false)
	useEffect(() => {
		if (!active) {
			setHidden(false)
			return
		}
		let last = window.scrollY
		let frame = 0
		const onScroll = () => {
			if (frame) return
			frame = requestAnimationFrame(() => {
				frame = 0
				const y = window.scrollY
				if (Math.abs(y - last) < 8) return
				setHidden(y > last && y > 80)
				last = y
			})
		}
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => {
			window.removeEventListener("scroll", onScroll)
			cancelAnimationFrame(frame)
		}
	}, [active])
	return hidden
}

/**
 * Desktop: a vertical "Feedback" label on the right edge, in the upper middle of the window, below the header. Phones:
 * a slim tab with the icon, a little lower. It never moves and never goes away: it's the drawer's handle. While the
 * drawer is out the tab is pressed: it takes the drawer's colour and edge, its inner corners square off and a strip
 * over its inner edge hides the seam, so tab and drawer read as one shape. Tapping it again pushes the drawer back in.
 */
const Tab = forwardRef<
	HTMLButtonElement,
	{
		open: boolean
		out: boolean
		onToggle: () => void
		wide: boolean
		/** Phones in fix mode: the tab rests on the bottom sheet as its handle instead. */
		away?: boolean
	}
>(function Tab({ open, out, onToggle, wide, away = false }, ref) {
	const hidden = useHideOnScrollDown(!wide && !out && !away)
	return (
		<button
			ref={ref}
			type="button"
			onClick={onToggle}
			aria-expanded={open}
			aria-label="Feedback"
			data-feedback-private
			data-feedback-tab
			data-out={out || undefined}
			{...(away && { inert: "", "aria-hidden": true })}
			className={`group fixed right-0 flex cursor-pointer flex-col items-center gap-2.5 bg-gray-950 max-md:top-[42%] max-md:h-16 max-md:w-10 max-md:justify-center md:top-[30%] md:px-2.5 md:pt-3.5 md:pb-4 ${
				out
					? "z-[1002] rounded-l-none text-white ring-1 ring-amber-500/30"
					: "z-[45] rounded-l-xl text-gray-200 shadow-[0_8px_30px_-6px_rgba(0,0,0,.7)] ring-1 ring-white/15 transition-[transform,opacity] ease-out hover:bg-gray-900 hover:text-white"
			} ${hidden || away ? "translate-x-full" : ""} ${away ? "opacity-0" : ""}`}
		>
			{/* Covers the drawer's right edge where it meets the tab, so the two join. */}
			{out && (
				<span
					aria-hidden
					className="pointer-events-none absolute inset-y-0 -left-px w-0.5 bg-gray-950"
				/>
			)}
			<ChatBubbleLeftEllipsisIcon
				className={`size-5 shrink-0 text-amber-400 transition-transform ${out ? "" : "group-hover:scale-110"}`}
				aria-hidden
			/>
			{wide && (
				<span className="rotate-180 text-sm font-semibold tracking-wide [writing-mode:vertical-rl]">
					Feedback
				</span>
			)}
		</button>
	)
})

// --- The panel ---

/** One choosable block of the page, listed in the panel while fix mode is on. */
export type FixArea = { id: string; label: string; flagOnly: boolean }

/** The page's fix mode, when the page has correctable data. */
export type FixPath = {
	on: boolean
	setOn: (on: boolean) => void
	/** Trusted members' fixes go live at once; everyone else's are checked first. */
	trusted: boolean
	/** The picked block's title ("Fix where to watch") and its questions; null while nothing is picked. */
	picked: { id: string; title: string; flow: ReactNode } | null
	/** A report was sent: the page layer (scrim, outlines, badges) goes while the panel thanks. */
	done: boolean
	setDone: (done: boolean) => void
	/** The block's element on the page (phones quote it and scroll to it). */
	element: (id: string) => HTMLElement | null
	closePicked: () => void
	/** The choosable blocks, in page order; the panel lists them so a block can be picked from the page or the list. */
	areas: FixArea[]
	/** The block under the pointer or focus, on either side; both light up. */
	hot: string | null
	setHot: (id: string | null) => void
	pick: (id: string) => void
	/** Scrolls the block into view when it's off screen. */
	reveal: (id: string) => void
}

type Mode = "choose" | "fix" | "send"

function Choice({
	icon,
	title,
	body,
	onClick,
}: { icon: ReactNode; title: string; body: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.07] hover:ring-white/25"
		>
			<span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-400">
				{icon}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-semibold text-gray-100">{title}</span>
				<span className="block text-sm text-gray-400">{body}</span>
			</span>
			<ChevronRightIcon className="size-5 shrink-0 text-gray-500" aria-hidden />
		</button>
	)
}

/** Fix mode's list of the page's choosable blocks, linked both ways with the blocks on the page. */
function AreaList({ fix }: { fix: FixPath }) {
	// The block lights up and, when it's off screen, starts scrolling into view in the same frame the pointer reaches
	// its item: highlight on enter, scroll on the first move over it (a list that opens under a still pointer doesn't
	// scroll the page). reveal() aims at absolute positions, so sweeping across items retargets one scroll.
	const moved = useRef<string | null>(null)
	// The outline lights up from here, without waiting for the page to re-render (a title page takes a frame or more);
	// the page's own lit state follows.
	const light = (id: string | null) => {
		for (const el of document.querySelectorAll("[data-fix-overlay][data-hot]"))
			el.removeAttribute("data-hot")
		if (id)
			document
				.querySelector(`[data-fix-overlay="${CSS.escape(id)}"]`)
				?.setAttribute("data-hot", "")
	}
	useEffect(() => () => light(null), [])
	return (
		<>
			<style>
				{
					"[data-fix-overlay][data-hot]{border-style:solid!important;border-color:rgb(251 191 36)!important;background-color:rgb(251 191 36/.07)!important}"
				}
			</style>
			<ul className="grid grid-cols-2 gap-1.5 md:grid-cols-1" data-fix-list>
				{fix.areas.map((a) => {
					const lit = fix.hot === a.id
					return (
						<li key={a.id}>
							<button
								type="button"
								data-fix-item={a.id}
								data-lit={lit || undefined}
								onPointerEnter={() => {
									light(a.id)
									fix.setHot(a.id)
								}}
								onPointerMove={(e) => {
									if (e.pointerType !== "mouse" || moved.current === a.id)
										return
									moved.current = a.id
									if (fix.hot !== a.id) fix.setHot(a.id)
									fix.reveal(a.id)
								}}
								onPointerLeave={() => {
									moved.current = null
									light(null)
									fix.setHot(null)
								}}
								onFocus={() => {
									light(a.id)
									fix.setHot(a.id)
									fix.reveal(a.id)
								}}
								onBlur={() => {
									light(null)
									fix.setHot(null)
								}}
								onClick={() => {
									fix.pick(a.id)
									fix.reveal(a.id)
								}}
								className={`flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-left md:min-h-12 md:gap-3 md:px-3 ring-1 transition-[background-color,box-shadow] duration-100 ${lit ? "bg-amber-400/10 ring-amber-400" : "bg-white/[0.04] ring-white/10"}`}
							>
								<span
									className={`grid size-7 shrink-0 place-items-center rounded-full ${a.flagOnly ? "bg-gray-200 text-gray-950" : "bg-amber-400 text-gray-950"}`}
									aria-hidden
								>
									{a.flagOnly ? (
										<FlagIcon className="size-3.5" />
									) : (
										<PencilSquareIcon className="size-3.5" />
									)}
								</span>
								<span className="min-w-0 flex-1 text-sm leading-tight font-semibold text-gray-100 md:text-base">
									{a.label}
								</span>
								<span className="text-xs text-gray-500 max-md:hidden">
									{a.flagOnly ? "Flag" : "Fix"}
								</span>
								<ChevronRightIcon
									className={`size-5 shrink-0 transition-colors max-md:hidden ${lit ? "text-amber-400" : "text-gray-600"}`}
									aria-hidden
								/>
							</button>
						</li>
					)
				})}
			</ul>
		</>
	)
}

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect
const reducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Corner radius of the drawer. */
const R = 16
const EASE = "cubic-bezier(.22,.8,.24,1)"

/**
 * Where the drawer goes. The panel element is a fixed column left of the tab, from below the header to above the
 * bottom (and a phone's dock); what shows of it is a clip-path, so opening, closing and height changes are clip-path and
 * transform only, never layout. The visible card's top meets the tab's top, moved up only as far as it must to fit.
 */
type Box = { top: number; right: number; width: number; height: number }
type Shape = { y: number; h: number; tr: number; br: number }

function boxFor(tab: HTMLElement, wide: boolean): Box {
	const T = tab.getBoundingClientRect()
	// The tab is fixed to the right edge, so the drawer's right edge sits the tab's width further in (layout sizes, so a
	// scrollbar or a hover transform can't throw it off).
	const right =
		(Number.parseFloat(getComputedStyle(tab).right) || 0) + tab.offsetWidth
	const header =
		document.querySelector("[data-site-header]")?.getBoundingClientRect()
			.bottom ?? 0
	const dock = wide
		? 0
		: Number.parseFloat(
				getComputedStyle(document.documentElement).getPropertyValue(
					"--nav-dock-height",
				),
			) || 0
	const top = Math.max(0, header) + 8
	const left = wide ? Math.max(8, T.left - 384) : 8
	return {
		top,
		right,
		width: T.left - left,
		height: window.innerHeight - dock - 8 - top,
	}
}

function shapeFor(tab: HTMLElement, box: Box, natural: number): Shape {
	const T = tab.getBoundingClientRect()
	const h = Math.min(natural, box.height)
	// The tab's ring sits 1px outside it; the drawer's edge lines up with that.
	const want = T.top - 1 - box.top
	const y = Math.max(0, Math.min(want, box.height - h))
	const bottom = box.top + y + h
	return {
		y,
		h,
		tr: Math.abs(y - want) < 1 ? 0 : R,
		br: Math.abs(bottom - (T.bottom + 1)) < 1 ? 0 : R,
	}
}

/** The edge (the panel element) and the surface inside it; `shut` is the width still hidden on the left. */
const edgeClip = (b: Box, s: Shape, shut: number) =>
	`inset(${s.y}px 0px ${b.height - s.y - s.h}px ${shut}px round ${R}px ${s.tr}px ${s.br}px ${R}px)`
const surfaceClip = (b: Box, s: Shape, shut: number) =>
	`inset(${s.y + 1}px 1px ${b.height - s.y - s.h + 1}px ${shut + 1}px round ${R - 1}px ${Math.max(0, s.tr - 1)}px ${Math.max(0, s.br - 1)}px ${R - 1}px)`
const cardMove = (s: Shape, dx: number) => `translate(${dx}px, ${s.y + 1}px)`

/**
 * The drawer slides out of the tab to the left and back into it. Its right edge stays on the tab's left edge the whole
 * time; the clip's left edge travels out (opening) or in (closing), and the content fades in a beat after the drawer
 * starts moving. Tapping the tab mid-way reverses from there. When the content's height changes (a new step), the clip
 * and the card's position glide to the new shape. Reduced motion: a plain fade.
 */
function useDrawer(
	wide: boolean,
	tab: React.RefObject<HTMLElement>,
	panel: React.RefObject<HTMLElement>,
	surface: React.RefObject<HTMLElement>,
	card: React.RefObject<HTMLElement>,
) {
	const [open, setOpen] = useState(false)
	const [out, setOut] = useState(false)
	const [box, setBox] = useState<Box | null>(null)
	const want = useRef(false)
	const anims = useRef<Animation[]>([])
	const pending = useRef(false)
	const shape = useRef<Shape | null>(null)
	const onClosed = useRef<() => void>(() => {})

	/** Writes the resting styles: the full shape when open, shut when closed. */
	const rest = (b: Box, s: Shape, isOpen: boolean) => {
		const p = panel.current
		const f = surface.current
		const c = card.current
		if (!p || !f || !c) return
		p.style.clipPath = edgeClip(b, s, isOpen ? 0 : b.width)
		f.style.clipPath = surfaceClip(b, s, isOpen ? 0 : b.width)
		c.style.transform = cardMove(s, 0)
		c.style.opacity = isOpen ? "1" : "0"
	}
	const settle = () => {
		const list = anims.current
		anims.current = []
		// Closed: rest shut before the animations let go, so the drawer can't flash open for a frame.
		if (!want.current && box && shape.current) rest(box, shape.current, false)
		for (const a of list) a.cancel()
		if (!want.current) {
			setOut(false)
			onClosed.current()
		}
	}
	const play = (opening: boolean) => {
		const p = panel.current
		const f = surface.current
		const c = card.current
		const b = box
		const s = shape.current
		if (!p || !f || !c || !b || !s) return settle()
		rest(b, s, true)
		const timing: KeyframeAnimationOptions = {
			duration: opening ? 320 : 280,
			easing: EASE,
			fill: "both",
			direction: opening ? "normal" : "reverse",
		}
		let main: Animation
		if (reducedMotion()) {
			main = p.animate([{ opacity: 0 }, { opacity: 1 }], {
				...timing,
				duration: 160,
				easing: "linear",
			})
			anims.current = [main]
		} else {
			main = p.animate(
				[
					{ clipPath: edgeClip(b, s, b.width) },
					{ clipPath: edgeClip(b, s, 0) },
				],
				timing,
			)
			anims.current = [
				main,
				f.animate(
					[
						{ clipPath: surfaceClip(b, s, b.width) },
						{ clipPath: surfaceClip(b, s, 0) },
					],
					timing,
				),
				c.animate(
					[
						{ offset: 0, opacity: 0, transform: cardMove(s, 28) },
						{ offset: 0.3, opacity: 0, transform: cardMove(s, 20) },
						{ offset: 1, opacity: 1, transform: cardMove(s, 0) },
					],
					timing,
				),
			]
		}
		main.onfinish = settle
	}
	/** Glides from the shape it had to the shape its content needs now. */
	const reshape = () => {
		const t = tab.current
		const c = card.current
		const b = box
		if (!t || !c || !b || !want.current) return
		const from = shape.current
		const to = shapeFor(t, b, c.offsetHeight + 2)
		shape.current = to
		if (
			from &&
			from.y === to.y &&
			from.h === to.h &&
			from.tr === to.tr &&
			from.br === to.br
		)
			return
		// Mid-open: aim the running opening at the new shape.
		if (anims.current.length) {
			const [m, f, k] = anims.current as [Animation, Animation, Animation?]
			if (reducedMotion() || !k) return rest(b, to, true)
			;(m.effect as KeyframeEffect).setKeyframes([
				{ clipPath: edgeClip(b, to, b.width) },
				{ clipPath: edgeClip(b, to, 0) },
			])
			;(f.effect as KeyframeEffect).setKeyframes([
				{ clipPath: surfaceClip(b, to, b.width) },
				{ clipPath: surfaceClip(b, to, 0) },
			])
			;(k.effect as KeyframeEffect).setKeyframes([
				{ offset: 0, opacity: 0, transform: cardMove(to, 28) },
				{ offset: 0.3, opacity: 0, transform: cardMove(to, 20) },
				{ offset: 1, opacity: 1, transform: cardMove(to, 0) },
			])
			return rest(b, to, true)
		}
		rest(b, to, true)
		if (!from || reducedMotion()) return
		const timing = { duration: 240, easing: EASE }
		panel.current?.animate(
			[{ clipPath: edgeClip(b, from, 0) }, { clipPath: edgeClip(b, to, 0) }],
			timing,
		)
		surface.current?.animate(
			[
				{ clipPath: surfaceClip(b, from, 0) },
				{ clipPath: surfaceClip(b, to, 0) },
			],
			timing,
		)
		c.animate(
			[{ transform: cardMove(from, 0) }, { transform: cardMove(to, 0) }],
			timing,
		)
	}
	const toggle = (opening: boolean) => {
		if (want.current === opening) return
		want.current = opening
		setOpen(opening)
		const running = anims.current.filter((a) => a.playState === "running")
		if (running.length) {
			for (const a of running) a.reverse()
			return
		}
		if (opening) {
			if (tab.current) setBox(boxFor(tab.current, wide))
			shape.current = null
			pending.current = true
			setOut(true)
		} else play(false)
	}
	// Opening: measure once the drawer has its content, before the first paint.
	useIsoLayoutEffect(() => {
		if (!out || !pending.current || !box) return
		pending.current = false
		const t = tab.current
		const c = card.current
		if (!t || !c) return
		shape.current = shapeFor(t, box, c.offsetHeight + 2)
		play(true)
	})
	// A new step changes the content's height; the window can change size.
	const reshapeRef = useRef(reshape)
	reshapeRef.current = reshape
	useEffect(() => {
		const c = card.current
		if (!out || !c) return
		const ro = new ResizeObserver(() => reshapeRef.current())
		ro.observe(c)
		const resize = () => {
			if (tab.current) setBox(boxFor(tab.current, wide))
		}
		window.addEventListener("resize", resize)
		return () => {
			ro.disconnect()
			window.removeEventListener("resize", resize)
		}
	}, [out, card, tab, wide])
	// A new box (window resized): rest on the new shape.
	useIsoLayoutEffect(() => {
		if (!box || !out || pending.current || anims.current.length) return
		const t = tab.current
		const c = card.current
		if (!t || !c) return
		shape.current = shapeFor(t, box, c.offsetHeight + 2)
		rest(box, shape.current, want.current)
	}, [box])
	return { open, out, box, toggle, onClosed }
}

export function FeedbackDock({
	fix,
	guest,
	startWith,
}: { fix?: FixPath; guest: boolean; startWith?: "send" }) {
	const wide = useIsWide()
	const tabRef = useRef<HTMLButtonElement>(null)
	const panelRef = useRef<HTMLElement>(null)
	const surfaceRef = useRef<HTMLDivElement>(null)
	const cardRef = useRef<HTMLDivElement>(null)
	const { open, out, box, toggle, onClosed } = useDrawer(
		wide,
		tabRef,
		panelRef,
		surfaceRef,
		cardRef,
	)
	// "choose" waits until the page has a fix path; without one the panel shows Send feedback.
	const [mode, setMode] = useState<Mode>(startWith ?? "choose")
	useEffect(() => {
		if (startWith === "send") toggle(true)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])
	// A page without the fix path (or one that lost it) only sends feedback.
	const current: Mode = fix ? mode : "send"
	const fixing = current === "fix" && Boolean(fix?.on)
	// Phones run fix mode from the bottom edge (PhoneFix), not the side drawer.
	const phoneFix = !wide && fixing

	// The drawer keeps showing what it showed while it slides back into the tab; the mode resets once it's in (unless
	// it went in because phone fix mode took over).
	onClosed.current = () => {
		if (!phoneFix) setMode(startWith ?? "choose")
	}
	const close = () => {
		if (open) toggle(false)
		else setMode(startWith ?? "choose")
		fix?.closePicked()
		fix?.setOn(false)
	}
	const back = () => {
		if (fix?.picked) return fix.closePicked()
		fix?.setOn(false)
		setMode("choose")
		// Phones: back from the bottom bar to the drawer's two paths.
		if (phoneFix) toggle(true)
	}
	const flow: FixFlow = {
		sent: () => fix?.setDone(true),
		again: () => fix?.setDone(false),
		done: close,
	}
	useEffect(() => {
		if (!open && !phoneFix) return
		const esc = (e: KeyboardEvent) => e.key === "Escape" && close()
		window.addEventListener("keydown", esc)
		return () => window.removeEventListener("keydown", esc)
	})

	const title =
		fix?.picked && fixing
			? fix.picked.title
			: current === "fix"
				? "Fix something"
				: current === "send"
					? "Send feedback"
					: "Feedback"
	const canGoBack = Boolean(fix) && current !== "choose"

	let body: ReactNode = null
	if (current === "choose" && fix)
		body = (
			<div className="flex flex-col gap-2.5">
				<Choice
					icon={<PencilSquareIcon className="size-5" />}
					title="Fix something on this page"
					body={
						fix.trusted
							? "Your fixes go live at once."
							: "A wrong service, cast or date. We check fixes first."
					}
					onClick={() => {
						fix.setOn(true)
						setMode("fix")
						// Phones: the drawer goes back into the tab; the bottom bar takes over.
						if (!wide) toggle(false)
					}}
				/>
				<Choice
					icon={<ChatBubbleLeftEllipsisIcon className="size-5" />}
					title="Send feedback"
					body="A bug or an idea, in your words."
					onClick={() => setMode("send")}
				/>
			</div>
		)
	else if (fixing && fix?.picked) body = fix.picked.flow
	else if (fixing && fix)
		body = (
			<div className="flex flex-col gap-3 pb-1">
				<p className="text-sm text-gray-300">
					Pick a part on the page, or here.{" "}
					<span className="text-gray-400">
						{fix.trusted
							? "Your fixes go live at once."
							: "We check fixes before they show."}
					</span>
				</p>
				<AreaList fix={fix} />
				<button
					type="button"
					onClick={close}
					className="mt-1 min-h-10 cursor-pointer self-end rounded-xl bg-white px-5 font-semibold text-black hover:bg-gray-200"
				>
					Exit
				</button>
			</div>
		)
	else
		body = (
			<div className="flex flex-col gap-4">
				<p className="text-sm text-gray-400">
					Found a bug or have an idea? One message is enough.
				</p>
				<FeedbackForm style="tabs" guest={guest} onClose={close} />
			</div>
		)
	const last = useRef<{ title: string; body: ReactNode; canGoBack: boolean }>({
		title,
		body,
		canGoBack,
	})
	if (open) last.current = { title, body, canGoBack }
	const view = open ? { title, body, canGoBack } : last.current

	const cap = box?.height
	return (
		<FixFlowContext.Provider value={flow}>
			<Tab
				ref={tabRef}
				open={open}
				out={out}
				wide={wide}
				away={phoneFix}
				// Pushing the drawer in ends fix mode too, like the close button.
				onToggle={() => (phoneFix || open ? close() : toggle(true))}
			/>
			<PhoneFix
				on={phoneFix}
				fix={fix}
				title={fix?.picked?.title ?? "Fix something"}
				body={phoneFix && fix?.picked ? fix.picked.flow : null}
				onBack={back}
				onClose={close}
			/>
			<aside
				ref={panelRef}
				aria-hidden={!open}
				aria-label="Feedback"
				data-feedback-private
				data-feedback-panel
				data-open={open || undefined}
				{...(!open && { inert: "" })}
				style={
					box
						? {
								top: box.top,
								right: box.right,
								width: box.width,
								height: box.height,
							}
						: undefined
				}
				className={`fixed z-[1001] bg-amber-500/30 ${out && box ? "" : "invisible pointer-events-none"}`}
			>
				<div
					ref={surfaceRef}
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-gray-950"
				/>
				{/* The visible card: its height is its content's; the clips above follow it (see useDrawer). */}
				<div
					ref={cardRef}
					data-feedback-card
					style={{ maxHeight: cap ? cap - 2 : undefined }}
					className="absolute top-0 right-px left-px flex flex-col"
				>
					<div className="flex shrink-0 items-center gap-1 px-4 pt-3 pb-3 sm:px-5 md:pt-4">
						{view.canGoBack && (
							<button
								type="button"
								onClick={back}
								aria-label="Back"
								className="-ml-1.5 cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10"
							>
								<ArrowLeftIcon className="size-5" />
							</button>
						)}
						<h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-white">
							{view.title}
						</h2>
						<button
							type="button"
							onClick={close}
							aria-label="Close"
							className="cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10"
						>
							<XMarkIcon className="size-5" />
						</button>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5">
						{out && !phoneFix && view.body}
					</div>
				</div>
			</aside>
		</FixFlowContext.Provider>
	)
}
