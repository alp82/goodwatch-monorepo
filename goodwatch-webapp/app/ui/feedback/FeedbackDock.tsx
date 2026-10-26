// The Feedback drawer and fix mode, loaded after the page settles (FeedbackTab.tsx renders the tab). Tapping the tab
// slides the drawer out of it to the left, joined to the tab's left edge and level with its top (moved up only as far
// as it must to fit the window); tapping the tab again, Escape or the close button slides it back in (and ends fix
// mode). The drawer offers two paths:
// - "Fix something on this page", on pages that show parts to fix or flag (areas.ts): a scrim dims everything else,
//   each part gets a dashed outline with a Fix or Flag badge, and the drawer lists the parts too; hovering either side
//   lights up the other. A picked part's questions show in the drawer: the title and person pages ask from their own
//   data (ReportFlow, subject.ts), every other page asks its part's chips (AreaFlow).
// - "Send feedback": one text box, bug or idea, and "Include a screenshot" (off by default) with a preview of what
//   gets sent.
// Phones open the same drawer; once fix mode starts it goes back into the tab and fix mode runs from the bottom edge
// (PhoneFix.tsx). Every way out of fix mode (back, tab, Escape, close, send, a new page) fades its marks away.
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
import { useLocation } from "@remix-run/react"
import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { PrimaryButton } from "~/ui/auth/PrimaryButton"
import { useUser } from "~/utils/auth"
import { AreaFlow } from "./AreaFlow"
import type { DockProps } from "./FeedbackTab"
import { PhoneFix } from "./PhoneFix"
import { ReportFlow } from "./ReportFlow"
import { type PageArea, kindOf, pageTypeOf } from "./areas"
import { DimHeader, Scrim, reveal, useFadePresence } from "./fix-scrim"
import {
	FailureLine,
	type FixFlow,
	FixFlowContext,
	type FixPath,
	GuestEmail,
	INPUT,
	thanksLine,
	useSender,
} from "./kit"
import {
	Outlines,
	Spotlight,
	areaElements,
	findArea,
	findSpot,
	lc,
} from "./page-layer"
import { isRichArea } from "./problems"
import { buildMessageRequest, emailProblem } from "./request"
import { captureScreen } from "./screenshot"
import { useFeedbackSubject } from "./subject"

type Kind = "bug" | "idea"

function useIsWide() {
	const [wide, setWide] = useState(
		() => window.matchMedia("(min-width: 768px)").matches,
	)
	useEffect(() => {
		const m = window.matchMedia("(min-width: 768px)")
		const on = () => setWide(m.matches)
		on()
		m.addEventListener("change", on)
		return () => m.removeEventListener("change", on)
	}, [])
	return wide
}

// --- Send feedback ---

/** A preview of exactly the screenshot that gets sent, taken when the option turns on. */
function ScreenshotPreview({
	shot,
}: { shot: { state: "busy" | "failed" } | { state: "ready"; data: string } }) {
	return (
		<div
			className="relative grid aspect-video max-h-44 w-full place-items-center overflow-hidden rounded-lg bg-gray-900 ring-1 ring-white/15"
			data-feedback-shot={shot.state}
		>
			{shot.state === "ready" ? (
				<img
					src={`data:image/jpeg;base64,${shot.data}`}
					alt="The screenshot we get"
					className="h-full w-full object-contain object-top"
				/>
			) : (
				<span className="px-4 text-center text-xs text-gray-400">
					{shot.state === "busy"
						? "Taking the screenshot…"
						: "We couldn't take a screenshot here. Your message goes without one."}
				</span>
			)}
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
					className={`absolute top-1 left-1 size-4 rounded-full bg-white transition-transform duration-200 motion-reduce:transition-none ${on ? "translate-x-4" : ""}`}
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
		<fieldset className="flex rounded-full bg-white/8 p-0.5 text-sm">
			<legend className="sr-only">Kind</legend>
			{(["bug", "idea"] as const).map((k) => (
				<button
					key={k}
					type="button"
					aria-pressed={kind === k}
					onClick={() => setKind(k)}
					className={`flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 ${kind === k ? "bg-white font-semibold text-black" : "text-gray-300 hover:text-white"}`}
				>
					{k === "bug" ? (
						<BugAntIcon className="size-4" aria-hidden />
					) : (
						<LightBulbIcon className="size-4" aria-hidden />
					)}
					{k === "bug" ? "A bug" : "An idea"}
				</button>
			))}
		</fieldset>
	)
}

type Shot =
	| { state: "off" }
	| { state: "busy" }
	| { state: "failed" }
	| { state: "ready"; data: string }

/** One text box, bug or idea, an optional screenshot and, for guests, an optional email. */
function FeedbackForm({
	onClose,
	guest,
}: { onClose: () => void; guest: boolean }) {
	const [kind, setKind] = useState<Kind>("bug")
	const [text, setText] = useState("")
	const [shot, setShot] = useState<Shot>({ state: "off" })
	const [email, setEmail] = useState("")
	const [sent, setSent] = useState(false)
	const sender = useSender()
	const run = useRef(0)
	const toggleShot = (on: boolean) => {
		const id = ++run.current
		if (!on) return setShot({ state: "off" })
		setShot({ state: "busy" })
		captureScreen().then(
			(data) => {
				if (run.current === id)
					setShot(data ? { state: "ready", data } : { state: "failed" })
			},
			() => {
				if (run.current === id) setShot({ state: "failed" })
			},
		)
	}
	if (sent)
		return (
			<div className="flex flex-col gap-4 py-2" data-feedback-result="sent">
				<div className="flex items-start gap-3">
					<span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
						<CheckCircleIcon className="size-6" aria-hidden />
					</span>
					<div aria-live="polite">
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
							toggleShot(false)
							sender.reset()
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
	const send = async () => {
		const response = await sender.send(
			(e) =>
				buildMessageRequest(
					{
						kind,
						message: text,
						screenshot: shot.state === "ready" ? shot.data : null,
					},
					e,
				),
			guest ? email : undefined,
		)
		if (response) setSent(true)
	}
	return (
		<div className="flex flex-col gap-4">
			<KindTabs kind={kind} setKind={setKind} />
			<textarea
				value={text}
				onChange={(e) => setText(e.target.value)}
				rows={4}
				maxLength={8000}
				aria-label="Your message"
				placeholder={
					kind === "bug"
						? "What happened, and where?"
						: "What would make GoodWatch better for you?"
				}
				className={`${INPUT} py-2.5`}
			/>
			<div className="flex flex-col gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
				<Switch
					on={shot.state !== "off"}
					onChange={toggleShot}
					label="Include a screenshot"
				/>
				{shot.state !== "off" ? (
					<>
						<ScreenshotPreview shot={shot} />
						<p className="text-xs text-gray-500">
							This is what we get. What you type and members' pictures are left
							out.
						</p>
					</>
				) : (
					<p className="text-xs text-gray-500">
						Helps us see what you see. Off unless you turn it on.
					</p>
				)}
			</div>
			{guest && (
				<GuestEmail
					value={email}
					onChange={setEmail}
					invalid={emailProblem(email)}
				/>
			)}
			<p className="text-xs text-gray-500">
				We also get the page address, your browser and the app version.
			</p>
			<FailureLine failure={sender.failure} />
			<PrimaryButton
				type="button"
				disabled={
					!text.trim() ||
					shot.state === "busy" ||
					(guest && emailProblem(email)) ||
					sender.sending
				}
				onClick={send}
			>
				{sender.sending ? "Sending…" : "Send"}
			</PrimaryButton>
		</div>
	)
}

// --- The drawer ---

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

/** Fix mode's list of the page's parts, linked both ways with the parts on the page. */
function AreaList({ fix }: { fix: FixPath }) {
	// The part lights up and, when it's off screen, starts scrolling into view in the same frame the pointer reaches
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
	// Fix mode scrolls the header away; its bottom is then above the window.
	const header = Math.max(
		0,
		document.querySelector("[data-site-header]")?.getBoundingClientRect()
			.bottom ?? 0,
	)
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
	tab: RefObject<HTMLElement>,
	panel: RefObject<HTMLElement>,
	surface: RefObject<HTMLElement>,
	card: RefObject<HTMLElement>,
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

const FOCUSABLE =
	"button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"

function Drawer({
	fix,
	guest,
	tabRef,
	setTab,
	toggleRef,
	openNow,
	check,
	setSpot,
	setPinned,
}: Omit<DockProps, "sendOnly"> & {
	fix?: FixPath
	guest: boolean
	/** Looks again for the page's parts, before the drawer opens. */
	check: () => void
	setSpot: (spot: string | null) => void
	setPinned: (spot: string | null) => void
}) {
	const wide = useIsWide()
	const panelRef = useRef<HTMLElement>(null)
	const surfaceRef = useRef<HTMLDivElement>(null)
	const cardRef = useRef<HTMLDivElement>(null)
	const bodyRef = useRef<HTMLDivElement>(null)
	const closeRef = useRef<HTMLButtonElement>(null)
	const { open, out, box, toggle, onClosed } = useDrawer(
		wide,
		tabRef,
		panelRef,
		surfaceRef,
		cardRef,
	)
	const [mode, setMode] = useState<Mode>("choose")
	// A page without parts (or one that lost them) only sends feedback.
	const current: Mode = fix ? mode : "send"
	const fixing = current === "fix" && Boolean(fix?.on)
	// Phones run fix mode from the bottom edge (PhoneFix), not the side drawer.
	const phoneFix = !wide && fixing

	// The drawer keeps showing what it showed while it slides back into the tab; the mode resets once it's in (unless
	// it went in because phone fix mode took over).
	onClosed.current = () => {
		if (!phoneFix) setMode("choose")
	}
	const close = () => {
		if (open) toggle(false)
		else setMode("choose")
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
		guest,
		sent: () => fix?.setDone(true),
		again: () => fix?.setDone(false),
		done: close,
		setSpot,
		setPinned,
	}

	// The tab is this drawer's handle.
	toggleRef.current = () => {
		if (phoneFix || open) return close()
		check()
		toggle(true)
	}
	useEffect(() => {
		setTab({ open, out, away: phoneFix })
	}, [open, out, phoneFix, setTab])
	useEffect(() => {
		if (openNow.current) {
			openNow.current = false
			check()
			toggle(true)
		}
		return () => setTab({ open: false, out: false, away: false })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])
	useEffect(() => {
		if (!open && !phoneFix) return
		const esc = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			close()
			tabRef.current?.focus({ preventScroll: true })
		}
		window.addEventListener("keydown", esc)
		return () => window.removeEventListener("keydown", esc)
	})

	// Focus moves into the drawer as it opens and to each new step; the list of parts takes focus as a whole, so
	// entering fix mode doesn't light up and scroll to its first part.
	const pickedId = fix?.picked?.id ?? null
	const done = fix?.done ?? false
	useEffect(() => {
		if (!open || phoneFix) return
		const id = requestAnimationFrame(() => {
			const body = bodyRef.current
			if (!body) return
			if (current === "fix" && !pickedId)
				return body.focus({ preventScroll: true })
			const target =
				body.querySelector<HTMLElement>(FOCUSABLE) ?? closeRef.current
			target?.focus({ preventScroll: true })
		})
		return () => cancelAnimationFrame(id)
	}, [open, phoneFix, current, pickedId, done])
	// Phones: the bottom bar's first part, then the questions' first chip.
	useEffect(() => {
		if (!phoneFix) return
		const t = window.setTimeout(() => {
			const sheet = document.querySelector("[data-fix-sheet]")
			sheet
				?.querySelector<HTMLElement>(
					pickedId
						? `[data-fix-panel] .overflow-y-auto ${FOCUSABLE}`
						: "[data-fix-item]",
				)
				?.focus({ preventScroll: true })
		}, 60)
		return () => window.clearTimeout(t)
	}, [phoneFix, pickedId, done])
	// Back to the tab when the drawer or the phone bar goes away with the focus in it.
	const shownBefore = useRef(false)
	useEffect(() => {
		const showing = open || phoneFix
		if (shownBefore.current && !showing) {
			const a = document.activeElement
			if (
				!a ||
				a === document.body ||
				panelRef.current?.contains(a) ||
				a.closest("[data-fix-sheet]")
			)
				tabRef.current?.focus({ preventScroll: true })
		}
		shownBefore.current = showing
	}, [open, phoneFix, tabRef])

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
					body="A wrong service, cast or date. We check fixes first."
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
						We check fixes before they show.
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
				<FeedbackForm guest={guest} onClose={close} />
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
				id="feedback-drawer"
				aria-hidden={!open}
				aria-labelledby="feedback-drawer-title"
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
						<h2
							id="feedback-drawer-title"
							className="min-w-0 flex-1 truncate text-lg font-semibold text-white"
						>
							{view.title}
						</h2>
						<button
							ref={closeRef}
							type="button"
							onClick={close}
							aria-label="Close"
							className="cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10"
						>
							<XMarkIcon className="size-5" />
						</button>
					</div>
					<div
						ref={bodyRef}
						tabIndex={-1}
						className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 outline-none sm:px-5"
					>
						{out && !phoneFix && view.body}
					</div>
				</div>
			</aside>
		</FixFlowContext.Provider>
	)
}

const NONE: PageArea[] = []

/** The drawer for the open page, with fix mode's state and its marks on the page. */
export default function FeedbackDock({
	tabRef,
	setTab,
	toggleRef,
	openNow,
	sendOnly,
}: DockProps) {
	const { user } = useUser()
	const guest = !user
	const { pathname } = useLocation()
	const subject = useFeedbackSubject()
	const type = pageTypeOf(pathname)
	const areas = (!sendOnly && type?.areas) || NONE

	// Which of the type's parts this page shows now: checked on arrival, a little later (late data), and when the
	// drawer opens.
	const [found, setFound] = useState<string[]>([])
	const check = useCallback(() => {
		const ids = areas.filter((a) => findArea(a)).map((a) => a.id)
		setFound((f) => (f.join() === ids.join() ? f : ids))
	}, [areas])
	useEffect(() => {
		check()
		const t1 = window.setTimeout(check, 400)
		const t2 = window.setTimeout(check, 1500)
		return () => {
			window.clearTimeout(t1)
			window.clearTimeout(t2)
		}
	}, [check, pathname, subject])

	const [on, setOn] = useState(false)
	const [done, setDone] = useState(false)
	const [hot, setHot] = useState<string | null>(null)
	const [picked, setPicked] = useState<string | null>(null)
	const [spot, setSpot] = useState<string | null>(null)
	const [pinned, setPinned] = useState<string | null>(null)
	// The page layer: outlines, badges and scrim. A sent report ends it while the drawer keeps its thanks; every way
	// out of fix mode fades it, then takes it out of the page.
	const layer = on && !done
	const fade = useFadePresence(layer)
	const live = useMemo(
		() => areas.filter((a) => found.includes(a.id)),
		[areas, found],
	)
	const pickedArea = live.find((a) => a.id === picked) ?? null
	const liveRef = useRef(live)
	liveRef.current = live
	const revealArea = useCallback((id: string) => {
		const a = liveRef.current.find((x) => x.id === id)
		if (a) reveal(areaElements(a))
	}, [])
	// A new page ends fix mode.
	useEffect(() => {
		setOn(false)
		setDone(false)
		setPicked(null)
		setHot(null)
		setSpot(null)
		setPinned(null)
	}, [pathname])
	// A hovered chip's part comes into view as it lights up. Not on phones: there the picked part already sits at the
	// window's top, and a tap on a chip (which also "hovers" it) must not move the page.
	useEffect(() => {
		if (layer && spot && window.matchMedia("(min-width: 768px)").matches)
			reveal(findSpot(spot))
	}, [layer, spot])

	const leave = (v: boolean) => {
		setOn(v)
		setDone(false)
		if (!v) {
			setPicked(null)
			setHot(null)
			setSpot(null)
			setPinned(null)
		}
	}
	const pick = (id: string) => {
		setDone(false)
		setSpot(null)
		setPicked(id)
		// A part picked on the page may be only partly in view: bring all of it in (phones place it themselves).
		if (window.matchMedia("(min-width: 768px)").matches)
			requestAnimationFrame(() => revealArea(id))
	}
	const fix: FixPath | undefined = live.length
		? {
				on,
				setOn: leave,
				done,
				setDone,
				element: (id) => {
					const a = live.find((x) => x.id === id)
					return a ? findArea(a) : null
				},
				picked: pickedArea
					? {
							id: pickedArea.id,
							title: `${kindOf(pickedArea) === "flag" ? "Flag" : "Fix"} ${lc(pickedArea.name)}`,
							flow:
								subject && isRichArea(pickedArea.id, subject) ? (
									<ReportFlow
										key={pickedArea.id}
										area={pickedArea.id}
										subject={subject}
									/>
								) : (
									<AreaFlow
										key={pickedArea.id}
										area={pickedArea}
										subject={subject}
									/>
								),
						}
					: null,
				closePicked: () => {
					setPicked(null)
					setSpot(null)
					setPinned(null)
				},
				areas: live.map((a) => ({
					id: a.id,
					label: a.name,
					flagOnly: kindOf(a) === "flag",
				})),
				hot,
				setHot,
				pick,
				reveal: revealArea,
			}
		: undefined
	return (
		<>
			<Drawer
				key={pathname}
				fix={fix}
				guest={guest}
				tabRef={tabRef}
				setTab={setTab}
				toggleRef={toggleRef}
				openNow={openNow}
				check={check}
				setSpot={setSpot}
				setPinned={setPinned}
			/>
			<DimHeader on={layer} />
			<Scrim on={layer} />
			{fade.mounted && (
				<Outlines
					areas={live}
					lit={picked ?? hot}
					setHot={setHot}
					shown={fade.shown}
					pick={pick}
				/>
			)}
			<Spotlight spot={layer ? (spot ?? pinned) : null} />
		</>
	)
}
