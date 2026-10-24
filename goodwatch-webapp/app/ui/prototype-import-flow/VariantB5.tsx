// PROTOTYPE - throwaway. Variant B5, "Full-screen focus": B's one-question flow, but once a file or account is in, it takes over the screen like a native import sheet with answers pinned to the bottom.
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import {
	ArrowLeftIcon,
	ArrowUpTrayIcon,
	ArrowUturnLeftIcon,
	CalendarDaysIcon,
	ExclamationTriangleIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline"
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	IMPORT_SOURCE_LIST,
	type ImportSourceId,
	importSourceName,
} from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import {
	dangerButton,
	primaryButton,
	secondaryButton,
	textLink,
} from "~/ui/imports/shared"
import {
	type Choices,
	type FileProblem,
	HISTORY,
	type Kinds,
	type Phase,
	type Question,
	type Scenario,
	type Sim,
	type Title,
	fmt,
	newTitles,
	plural,
	questionsFor,
} from "./model"

/* ------------------------------------------------------------------------------------------------------------------ */
/* Screens                                                                                                            */

/** "uncertain" is local: the model has no choice for TV Time's uncertain titles, so this variant keeps it itself. */
type Group = Question | "uncertain"
type Screen =
	| { q: "matching" }
	| { q: "uncertain" }
	| { q: "conflicts"; i: number }
	| { q: "unmatched"; i: number }
	| { q: "undated" }
	| { q: "rewatch" }
	| { q: "side-effects" }

function screensFor(s: Scenario): Screen[] {
	const out: Screen[] = []
	for (const q of questionsFor(s)) {
		if (q === "matching") {
			out.push({ q })
			if (s.matching?.uncertain.length) out.push({ q: "uncertain" })
		} else if (q === "conflicts")
			s.conflicts.forEach((_, i) => out.push({ q, i }))
		else if (q === "unmatched")
			s.unmatched.forEach((u, i) => u.suggestions.length && out.push({ q, i }))
		else out.push({ q })
	}
	return out
}

interface Local {
	matching: "now" | "wait"
	uncertain: "leave" | "add"
}

type View = { at: "ask"; i: number } | { at: "summary" }

const KIND_LABEL: Record<keyof Kinds, [string, string]> = {
	ratings: ["score", "scores"],
	watches: ["watch", "watches"],
	episodes: ["episode", "episodes"],
	want: ["Want to See", "Want to See"],
	favorites: ["favorite", "favorites"],
	reviews: ["review", "reviews"],
	lists: ["list", "lists"],
	statuses: ["show status", "show statuses"],
}

const kindLine = (k: keyof Kinds, n: number) =>
	k === "want"
		? `${fmt(n)} on Want to See`
		: plural(n, KIND_LABEL[k][0], KIND_LABEL[k][1])

const day = (iso: string) =>
	new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})

const names = (titles: Title[]) => {
	const n = titles.map((t) => t.name)
	return n.length <= 2
		? n.join(" and ")
		: `${n.slice(0, -1).join(", ")}, and ${n.at(-1)}`
}

/** Titles that come in with the member's kind toggles. */
const incoming = (s: Scenario, c: Choices) =>
	Math.max(
		c.include.watches ? s.kinds.watches : 0,
		c.include.ratings ? s.kinds.ratings : 0,
	) +
	(c.include.want ? s.kinds.want : 0) +
	(c.include.favorites ? s.kinds.favorites : 0)

const sourceEntry = (id: ImportSourceId) =>
	IMPORT_SOURCE_LIST.find((x) => x.id === id) ?? IMPORT_SOURCE_LIST[0]

/** Phases that live on the normal Imports page; everything else lives in the full-screen layer. */
const PAGE_PHASES: Phase["at"][] = ["start", "reading", "problem"]
/** Phases that can keep going (or wait) while the layer is closed, shown as a pill on the page. */
const BACKGROUND_PHASES: Phase["at"][] = [
	"running",
	"failed",
	"done",
	"undoing",
	"undone",
]

/** True one frame after mount, for enter transitions (transform and opacity only). */
function useEntered() {
	const [on, setOn] = useState(false)
	useEffect(() => {
		let b = 0
		const a = requestAnimationFrame(() => {
			b = requestAnimationFrame(() => setOn(true))
		})
		return () => {
			cancelAnimationFrame(a)
			cancelAnimationFrame(b)
		}
	}, [])
	return on
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                                       */

function Poster({
	title,
	className = "w-16",
}: { title: Title; className?: string }) {
	return (
		<img
			src={title.poster}
			alt=""
			loading="lazy"
			className={`aspect-[2/3] shrink-0 rounded-md bg-gray-800 object-cover ring-2 ring-gray-950 ${className}`}
		/>
	)
}

function PosterStack({
	titles,
	max = 8,
	size = "w-12 sm:w-14",
}: { titles: Title[]; max?: number; size?: string }) {
	const shown = titles.slice(0, max)
	const more = titles.length - shown.length
	return (
		<ul className="flex items-center pl-3" aria-hidden>
			{shown.map((t) => (
				<li key={t.id} className="-ml-3">
					<Poster title={t} className={size} />
				</li>
			))}
			{more > 0 && (
				<li className="-ml-3 flex aspect-[2/3] w-12 items-center justify-center rounded-md bg-gray-800 text-sm font-bold text-gray-300 ring-2 ring-gray-950 sm:w-14">
					+{fmt(more)}
				</li>
			)}
		</ul>
	)
}

/** Titles with their names, centered, for the question screens. */
function PosterRow({
	titles,
	size = "w-20 sm:w-24",
}: { titles: Title[]; size?: string }) {
	return (
		<ul className="flex flex-wrap justify-center gap-3">
			{titles.map((t) => (
				<li key={t.id} className={`flex flex-col gap-1 ${size}`}>
					<Poster title={t} className="w-full" />
					<span className="line-clamp-2 text-xs text-gray-300">{t.name}</span>
				</li>
			))}
		</ul>
	)
}

function Bar({ value, label }: { value: number; label: string }) {
	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(value * 100)}
			className="h-2 w-full overflow-hidden rounded-full bg-white/10"
		>
			<div
				className="h-full origin-left rounded-full bg-linear-to-r from-amber-500 to-amber-300 transition-transform duration-200 ease-linear"
				style={{ transform: `scaleX(${value})` }}
			/>
		</div>
	)
}

/** Percent for screen readers, in steps of ten so the live region doesn't chatter. */
const spoken = (p: number) => `${Math.floor(p * 10) * 10}%`

/** Fades and slides a whole screen in on mount; transform and opacity only. */
function Slide({ dir, children }: { dir: 1 | -1; children: ReactNode }) {
	const on = useEntered()
	return (
		<div
			className="flex min-h-0 flex-1 flex-col transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none"
			style={{
				transform: on ? "none" : `translateX(${dir * 40}px)`,
				opacity: on ? 1 : 0,
			}}
		>
			{children}
		</div>
	)
}

const headingClass =
	"text-2xl font-bold tracking-tight text-white outline-none md:text-3xl"
const layerHeadingClass =
	"text-balance text-2xl font-bold tracking-tight text-white outline-none sm:text-3xl"

/** A layer heading; the layer moves focus to it on every new screen. */
function LayerHeading({ children }: { children: ReactNode }) {
	return (
		<h2
			id="b5-layer-heading"
			data-heading
			tabIndex={-1}
			className={layerHeadingClass}
		>
			{children}
		</h2>
	)
}

/**
 * One screen in the layer: what it's about in the middle (scrolls if it must), the answers pinned to the bottom
 * within thumb reach. The bottom padding leaves room for the prototype's floating Case panel and switcher.
 */
function Frame({
	top,
	bottom,
	align = "center",
}: { top: ReactNode; bottom?: ReactNode; align?: "center" | "start" }) {
	return (
		<>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
				<div
					className={`mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-5 px-4 py-6 ${align === "center" ? "items-center text-center" : ""}`}
				>
					{top}
				</div>
			</div>
			<div className="mx-auto w-full max-w-xl shrink-0 px-4 pt-3 pb-[calc(7rem+env(safe-area-inset-bottom))]">
				<div className="flex flex-col gap-3">{bottom}</div>
			</div>
		</>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The variant                                                                                                        */

export function VariantB5({ sim }: { sim: Sim }) {
	const s = sim.scenario
	const { phase } = sim
	const screens = useMemo(() => screensFor(s), [s])
	const groups = useMemo(
		() => [...new Set(screens.map((x) => x.q))] as Group[],
		[screens],
	)
	const [view, setView] = useState<View>({ at: "summary" })
	const [dir, setDir] = useState<1 | -1>(1)
	const [editing, setEditing] = useState(false)
	const [local, setLocal] = useState<Local>({
		matching: "now",
		uncertain: "leave",
	})
	const [sameForAll, setSameForAll] = useState(false)

	// Entering the preview starts at the first question, or at the summary when there is nothing to ask.
	const wasPreview = useRef(false)
	useEffect(() => {
		const isPreview = phase.at === "preview"
		if (isPreview && !wasPreview.current) {
			setDir(1)
			setEditing(false)
			setView(screens.length ? { at: "ask", i: 0 } : { at: "summary" })
		}
		wasPreview.current = isPreview
	}, [phase.at, screens.length])

	// The layer opens on its own when the flow leaves the page (checking, connecting, or a past import), and
	// closes when it comes back. "Keep going in the background" closes it without leaving the flow.
	const onPage = PAGE_PHASES.includes(phase.at)
	const [wanted, setWanted] = useState(false)
	const prevAt = useRef<Phase["at"]>(phase.at)
	useEffect(() => {
		const prev = prevAt.current
		prevAt.current = phase.at
		if (PAGE_PHASES.includes(phase.at)) setWanted(false)
		else if (PAGE_PHASES.includes(prev)) setWanted(true)
	}, [phase.at])
	const open = wanted && !onPage

	// Problems are shown on the page; their heading takes focus.
	const pageHeading = useRef<HTMLHeadingElement>(null)
	useEffect(() => {
		if (phase.at === "problem") pageHeading.current?.focus()
	}, [phase.at])

	const sourceName = importSourceName(s.source)
	const inPreview = phase.at === "preview"
	const past = s.entry === "history"

	const go = (next: View, d: 1 | -1) => {
		setDir(d)
		setView(next)
	}
	const toSummary = () => {
		setEditing(false)
		go({ at: "summary" }, 1)
	}
	/** After an answer: the next screen, or back to the summary when the edited question is done. */
	const advance = (from: number, skipGroup = false) => {
		let next = from + 1
		if (skipGroup)
			while (next < screens.length && screens[next].q === screens[from].q)
				next++
		if (next >= screens.length) return toSummary()
		if (editing && screens[next].q !== screens[from].q) return toSummary()
		go({ at: "ask", i: next }, 1)
	}
	const back = () => {
		if (view.at === "summary") {
			if (screens.length && newTitles(s) > 0)
				go({ at: "ask", i: screens.length - 1 }, -1)
			else sim.reset()
		} else if (view.i === 0) sim.reset()
		else go({ at: "ask", i: view.i - 1 }, -1)
	}
	const edit = (g: Group) => {
		setEditing(true)
		setSameForAll(false)
		go({ at: "ask", i: screens.findIndex((x) => x.q === g) }, -1)
	}

	/** The close button never asks: before anything is saved it just stops; while running it keeps going. */
	const close = () => {
		if (
			phase.at === "running" ||
			phase.at === "failed" ||
			phase.at === "undoing"
		)
			setWanted(false)
		else sim.reset()
	}
	const closeLabel =
		phase.at === "running" || phase.at === "undoing"
			? "Close. It keeps going in the background"
			: phase.at === "failed"
				? "Close. What was saved stays"
				: phase.at === "done" || phase.at === "undone"
					? "Close"
					: "Close. Nothing has changed"

	const progress = (() => {
		switch (phase.at) {
			case "connecting":
				return 0.06
			case "checking":
				return 0.06 + 0.14 * phase.progress
			case "preview":
				return view.at === "ask"
					? 0.22 + 0.48 * (view.i / Math.max(1, screens.length))
					: 0.72
			case "running":
			case "failed":
				return 0.74 + 0.26 * phase.progress
			default:
				return 1
		}
	})()

	const status = (() => {
		switch (phase.at) {
			case "connecting":
				return "Connecting"
			case "checking":
				return "Checking"
			case "preview": {
				if (view.at === "summary")
					return groups.length || newTitles(s) === 0
						? "Ready"
						: "Nothing to ask"
				const screen = screens[view.i]
				const inGroup = screens.filter((x) => x.q === screen.q)
				const sub =
					inGroup.length > 1
						? ` · ${inGroup.indexOf(screen) + 1}/${inGroup.length}`
						: ""
				return `Question ${groups.indexOf(screen.q) + 1} of ${groups.length}${sub}`
			}
			case "running":
				return "Importing"
			case "failed":
				return "Paused"
			case "done":
				return past ? "Past import" : "Done"
			case "undoing":
				return "Undoing"
			case "undone":
				return "Undone"
			default:
				return ""
		}
	})()

	const screenKey = `${phase.at}:${view.at === "ask" ? view.i : "summary"}`
	let content: ReactNode = null
	if (phase.at === "connecting" || phase.at === "checking")
		content = <Checking sim={sim} />
	else if (inPreview && view.at === "ask" && screens[view.i])
		content = (
			<Slide key={view.i} dir={dir}>
				<Ask
					sim={sim}
					screen={screens[view.i]}
					index={view.i}
					screens={screens}
					local={local}
					setLocal={setLocal}
					sameForAll={sameForAll}
					setSameForAll={setSameForAll}
					onNext={advance}
				/>
			</Slide>
		)
	else if (inPreview)
		content = (
			<Slide key="summary" dir={dir}>
				<Summary sim={sim} groups={groups} local={local} onEdit={edit} />
			</Slide>
		)
	else if (phase.at === "running" || phase.at === "failed")
		content = <Running sim={sim} onBackground={() => setWanted(false)} />
	else if (
		phase.at === "done" ||
		phase.at === "undoing" ||
		phase.at === "undone"
	)
		content = (
			<Done sim={sim} local={local} onBackground={() => setWanted(false)} />
		)

	const inner = (
		<>
			<div aria-hidden className="h-1 w-full shrink-0 bg-white/10">
				<div
					className="h-full origin-left bg-linear-to-r from-amber-500 to-amber-300 transition-transform duration-500 ease-out motion-reduce:transition-none"
					style={{ transform: `scaleX(${progress})` }}
				/>
			</div>
			<div className="mx-auto grid h-14 w-full max-w-xl shrink-0 grid-cols-[3rem_1fr_3rem] items-center px-2">
				{inPreview ? (
					<button
						type="button"
						data-back
						onClick={back}
						aria-label="Back"
						className="flex size-11 cursor-pointer items-center justify-center rounded-full text-gray-300 hover:bg-white/10 hover:text-white"
					>
						<ArrowLeftIcon className="size-6" aria-hidden />
					</button>
				) : (
					<span />
				)}
				<p className="flex min-w-0 flex-col items-center text-center leading-tight">
					<span className="truncate text-sm font-semibold text-white">
						{sourceName}
					</span>
					<span className="truncate text-xs text-gray-400">{status}</span>
				</p>
				<button
					type="button"
					data-close
					onClick={close}
					aria-label={closeLabel}
					className="flex size-11 cursor-pointer items-center justify-center justify-self-end rounded-full text-gray-300 hover:bg-white/10 hover:text-white"
				>
					<XMarkIcon className="size-6" aria-hidden />
				</button>
			</div>
			{content}
		</>
	)

	const pillVisible = !open && BACKGROUND_PHASES.includes(phase.at)
	const pill = useRef<HTMLButtonElement>(null)

	return (
		<div className="flex flex-col gap-6">
			{pillVisible && (
				<BackgroundPill
					sim={sim}
					pillRef={pill}
					onOpen={() => setWanted(true)}
				/>
			)}
			<Bring sim={sim} heading={pageHeading} locked={pillVisible} />
			<Layer
				open={open}
				screenKey={screenKey}
				labelledBy="b5-layer-heading"
				returnFocus={() =>
					BACKGROUND_PHASES.includes(phase.at) ? pill.current : null
				}
				fallbackFocus={pageHeading}
			>
				{inner}
			</Layer>
		</div>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The full-screen layer                                                                                              */

/**
 * Slides up over the page as a labeled dialog. Keeps focus inside, locks page scroll, and returns focus on close.
 * While it slides away it keeps showing the last screen it had, so it never empties mid-motion.
 * Keys: 1-9 pick an answer, Enter takes the chosen one (or the main button), Esc and Backspace go back.
 */
function Layer({
	open,
	screenKey,
	labelledBy,
	returnFocus,
	fallbackFocus,
	children,
}: {
	open: boolean
	screenKey: string
	labelledBy: string
	returnFocus: () => HTMLElement | null
	fallbackFocus: React.RefObject<HTMLElement>
	children: ReactNode
}) {
	const el = useRef<HTMLDivElement>(null)
	const [mounted, setMounted] = useState(open)
	const [shown, setShown] = useState(false)
	const last = useRef<ReactNode>(children)
	if (open) last.current = children
	const opener = useRef<Element | null>(null)
	const returnRef = useRef(returnFocus)
	returnRef.current = returnFocus

	const wasOpen = useRef(false)
	useEffect(() => {
		if (open) {
			wasOpen.current = true
			opener.current = document.activeElement
			setMounted(true)
			let b = 0
			const a = requestAnimationFrame(() => {
				b = requestAnimationFrame(() => setShown(true))
			})
			return () => {
				cancelAnimationFrame(a)
				cancelAnimationFrame(b)
			}
		}
		if (!wasOpen.current) return
		wasOpen.current = false
		setShown(false)
		const id = window.setTimeout(() => {
			setMounted(false)
			const o = opener.current
			const target =
				returnRef.current() ??
				(o instanceof HTMLElement && o.isConnected && o !== document.body
					? o
					: fallbackFocus.current)
			target?.focus()
		}, 300)
		return () => window.clearTimeout(id)
	}, [open, fallbackFocus])

	// Page scroll stays put underneath.
	useEffect(() => {
		if (!mounted) return
		const html = document.documentElement
		const before = [document.body.style.overflow, html.style.overflow]
		document.body.style.overflow = "hidden"
		html.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = before[0]
			html.style.overflow = before[1]
		}
	}, [mounted])

	// Each new screen's heading takes focus, so it's read out first.
	useEffect(() => {
		if (!mounted || !open) return
		const id = requestAnimationFrame(() =>
			el.current
				?.querySelector<HTMLElement>("[data-heading]")
				?.focus({ preventScroll: true }),
		)
		return () => cancelAnimationFrame(id)
	}, [screenKey, mounted, open])

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		const root = el.current
		if (!root || e.metaKey || e.ctrlKey || e.altKey) return
		const target = e.target as HTMLElement
		const onControl = !!target.closest("button, a, input, summary")
		const click = (sel: string) => {
			const b = root.querySelector<HTMLElement>(sel)
			if (!b || (b as HTMLButtonElement).disabled) return false
			b.click()
			return true
		}
		if (e.key === "Tab") {
			const all = [
				...root.querySelectorAll<HTMLElement>(
					'button:not([disabled]), a[href], input:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
				),
			]
			if (!all.length) return
			const first = all[0]
			const lastEl = all[all.length - 1]
			const active = document.activeElement
			if (e.shiftKey && (active === first || !root.contains(active))) {
				e.preventDefault()
				lastEl.focus()
			} else if (!e.shiftKey && (active === lastEl || !root.contains(active))) {
				e.preventDefault()
				first.focus()
			}
			return
		}
		if (/^[1-9]$/.test(e.key)) {
			const answers = root.querySelectorAll<HTMLElement>("[data-answer]")
			const b = answers[Number(e.key) - 1]
			if (b) {
				e.preventDefault()
				b.click()
			}
			return
		}
		if (e.key === "Enter" && !onControl) {
			if (click("[data-continue]")) e.preventDefault()
			return
		}
		if (e.key === "Escape") {
			e.preventDefault()
			if (!click("[data-back]")) click("[data-close]")
			return
		}
		if (e.key === "Backspace" && !onControl) {
			if (click("[data-back]")) e.preventDefault()
		}
	}

	if (!mounted) return null
	return (
		<div
			ref={el}
			role="dialog"
			aria-modal="true"
			aria-labelledby={labelledBy}
			onKeyDown={onKeyDown}
			className="fixed inset-0 z-40 flex flex-col bg-gray-900 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none"
			style={{
				transform: shown ? "none" : "translateY(100%)",
				opacity: shown ? 1 : 0.6,
			}}
		>
			{open ? children : last.current}
		</div>
	)
}

/** On the Imports page while an import runs (or waits) with the layer closed. Tapping it reopens the layer. */
function BackgroundPill({
	sim,
	pillRef,
	onOpen,
}: {
	sim: Sim
	pillRef: React.RefObject<HTMLButtonElement>
	onOpen: () => void
}) {
	const { phase } = sim
	const src = importSourceName(sim.scenario.source)
	const p =
		phase.at === "running" || phase.at === "failed" || phase.at === "undoing"
			? phase.progress
			: 1
	const [line, action, said] =
		phase.at === "running"
			? [
					`Importing from ${src}`,
					`${Math.round(p * 100)}%`,
					`Importing from ${src}, ${spoken(p)}`,
				]
			: phase.at === "failed"
				? [
						`Import paused at ${Math.round(p * 100)}%`,
						"Open",
						"Import paused. What was saved stays",
					]
				: phase.at === "undoing"
					? [
							"Undoing the import",
							`${Math.round(p * 100)}%`,
							`Undoing, ${spoken(p)}`,
						]
					: phase.at === "undone"
						? ["Import undone", "Open", "Import undone"]
						: [
								`${src} import is done`,
								"See what came in",
								`${src} import is done`,
							]
	return (
		<div className="flex justify-center">
			<p className="sr-only" aria-live="polite">
				{said}
			</p>
			<button
				ref={pillRef}
				type="button"
				onClick={onOpen}
				className="flex min-h-11 w-full max-w-sm cursor-pointer items-center gap-3 rounded-full bg-gray-800 py-1.5 pr-4 pl-1.5 text-left ring-1 ring-white/15 hover:bg-gray-700"
			>
				<span className="scale-75">
					<SourceMark source={sourceEntry(sim.scenario.source)} />
				</span>
				<span className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="truncate text-sm font-semibold text-white">
						{line}
					</span>
					{(phase.at === "running" || phase.at === "undoing") && (
						<span
							aria-hidden
							className="h-1 overflow-hidden rounded-full bg-white/10"
						>
							<span
								className="block h-full origin-left bg-amber-400 transition-transform duration-200 ease-linear"
								style={{ transform: `scaleX(${p})` }}
							/>
						</span>
					)}
				</span>
				<span
					className={`shrink-0 text-sm font-semibold ${phase.at === "running" || phase.at === "undoing" ? "text-gray-300 tabular-nums" : "text-indigo-300"}`}
				>
					{action}
				</span>
			</button>
		</div>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Bring (on the page)                                                                                                */

const CONNECTABLE = IMPORT_SOURCE_LIST.filter((x) => x.connect)

function Bring({
	sim,
	heading,
	locked,
}: {
	sim: Sim
	heading: React.RefObject<HTMLHeadingElement>
	/** An import is still open in the background: one at a time. */
	locked: boolean
}) {
	const s = sim.scenario
	const { phase } = sim
	const input = useRef<HTMLInputElement>(null)
	const [over, setOver] = useState(false)
	const [whereOpen, setWhereOpen] = useState(false)
	const reading = phase.at === "reading"
	const busy = reading || locked

	const problem = phase.at === "problem" ? phase.problem : null
	return (
		<div className="flex flex-col gap-6">
			{problem && (
				<ProblemCard
					problem={problem}
					scenario={s}
					heading={heading}
					onWhere={() => setWhereOpen(true)}
				/>
			)}
			{s.entry === "connect" ? (
				<section className="flex flex-col items-center gap-4 rounded-3xl border-2 border-white/20 bg-gray-950/50 px-4 py-10 text-center">
					<SourceMark source={sourceEntry(s.source)} />
					<h2
						ref={problem ? undefined : heading}
						tabIndex={-1}
						className={headingClass}
					>
						Bring your {importSourceName(s.source)} account
					</h2>
					<p className="max-w-md text-sm text-gray-400">
						You'll say yes on {importSourceName(s.source)}, then check
						everything here before anything changes.
					</p>
					<button
						type="button"
						className={primaryButton}
						disabled={busy}
						onClick={sim.connect}
					>
						Connect {importSourceName(s.source)}
					</button>
				</section>
			) : (
				<section
					onDragOver={(e) => {
						e.preventDefault()
						if (!busy) setOver(true)
					}}
					onDragLeave={() => setOver(false)}
					onDrop={(e) => {
						e.preventDefault()
						setOver(false)
						if (!busy) sim.takeFile()
					}}
					className={`flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-4 py-10 text-center sm:px-6 md:py-14 ${over ? "border-amber-300 bg-amber-400/10" : "border-white/20 bg-gray-950/50 hover:border-white/35"}`}
				>
					<ArrowUpTrayIcon
						className={`size-12 transition-transform duration-300 md:size-14 ${over ? "-translate-y-1 text-amber-300" : reading ? "animate-pulse text-amber-300" : "text-gray-400"}`}
						aria-hidden
					/>
					<h2
						ref={problem ? undefined : heading}
						tabIndex={-1}
						className={headingClass}
					>
						{reading
							? "Reading your file"
							: problem
								? "Try another file"
								: "Drop your export here"}
					</h2>
					<p
						id="b5-drop-hint"
						className="max-w-md text-sm text-gray-400"
						aria-live="polite"
					>
						{reading
							? "On your device first. Nothing is uploaded yet."
							: locked
								? "You can bring another file when this import is finished."
								: "GoodWatch works out where it's from. Nothing changes until you say so."}
					</p>
					<button
						type="button"
						className={primaryButton}
						aria-describedby="b5-drop-hint"
						disabled={busy}
						onClick={() => input.current?.click()}
					>
						Choose file
					</button>
					<input
						ref={input}
						type="file"
						aria-label="Choose an export file"
						className="sr-only"
						tabIndex={-1}
						onChange={(e) => {
							if (e.target.files?.length) sim.takeFile()
							e.target.value = ""
						}}
					/>
					<p className="text-xs text-gray-500">
						This case: <span className="break-all">{s.fileName}</span>
					</p>
				</section>
			)}

			<div className="flex flex-col items-center gap-3">
				<p className="text-sm text-gray-400">Or connect an account</p>
				<div className="flex flex-wrap justify-center gap-3">
					{CONNECTABLE.map((x) => (
						<button
							key={x.id}
							type="button"
							className={secondaryButton}
							disabled={busy}
							onClick={sim.connect}
						>
							<span className="scale-75">
								<SourceMark source={x} />
							</span>
							{x.name}
						</button>
					))}
				</div>
			</div>

			<Disclosure
				label="Where do I get my file?"
				open={whereOpen}
				onToggle={setWhereOpen}
			>
				<ul className="grid gap-2 sm:grid-cols-2">
					{IMPORT_SOURCE_LIST.filter((x) => !x.connect).map((x) => (
						<li
							key={x.id}
							className="flex items-center gap-3 rounded-lg bg-slate-900/60 p-3"
						>
							<SourceMark source={x} />
							<div className="min-w-0">
								<div className="font-semibold text-white">{x.name}</div>
								<div className="text-xs text-gray-400">
									{x.gets.slice(0, 3).join(", ")} · {x.wait}
								</div>
							</div>
						</li>
					))}
				</ul>
			</Disclosure>

			<History sim={sim} />
		</div>
	)
}

function Disclosure({
	label,
	open,
	onToggle,
	children,
}: {
	label: string
	open: boolean
	onToggle: (open: boolean) => void
	children: ReactNode
}) {
	return (
		<div className="border-t border-white/10 pt-4">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => onToggle(!open)}
				className="flex w-full cursor-pointer items-center justify-between gap-3 py-1 text-left font-semibold text-gray-200 hover:text-white"
			>
				{label}
				<ChevronDownIcon
					className={`size-5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
					aria-hidden
				/>
			</button>
			{open && <div className="mt-3">{children}</div>}
		</div>
	)
}

function History({ sim }: { sim: Sim }) {
	const s = sim.scenario
	// The undo case starts here, so the list starts open there.
	const [open, setOpen] = useState(s.entry === "history")
	return (
		<Disclosure
			label={`Past imports (${HISTORY.length})`}
			open={open}
			onToggle={setOpen}
		>
			<ul className="flex flex-col gap-2">
				{HISTORY.map((h) => {
					const src = sourceEntry(h.source)
					const openable = s.entry === "history" && s.previous?.at === h.at
					const body = (
						<>
							<SourceMark source={src} />
							<span className="min-w-0 flex-1">
								<span className="block font-semibold text-white">
									{src.name}{" "}
									<span className="font-normal text-gray-400">
										· {day(h.at)}
									</span>
								</span>
								<span className="block text-sm text-gray-400">{h.line}</span>
							</span>
						</>
					)
					return (
						<li key={h.id}>
							{openable ? (
								<button
									type="button"
									onClick={sim.openPast}
									className="flex w-full cursor-pointer items-center gap-3 rounded-lg bg-slate-900/60 p-3 text-left ring-1 ring-slate-700 hover:bg-slate-800"
								>
									{body}
									<span className="text-sm font-semibold text-indigo-300">
										Open
									</span>
								</button>
							) : (
								<div className="flex items-center gap-3 rounded-lg p-3">
									{body}
								</div>
							)}
						</li>
					)
				})}
			</ul>
		</Disclosure>
	)
}

const PROBLEMS: Record<
	FileProblem,
	(s: Scenario) => { title: string; why: string; next: ReactNode }
> = {
	streaming: () => ({
		title: "Netflix doesn't give a file GoodWatch can use",
		why: "Netflix, Disney+, and other streaming services only list what played, without scores or a clear title match.",
		next: (
			<>
				<p>If you track somewhere else, bring it from there:</p>
				<ul className="mt-3 flex flex-wrap gap-2">
					{(["trakt", "tmdb", "plex"] as ImportSourceId[]).map((id) => {
						const x = IMPORT_SOURCE_LIST.find((y) => y.id === id)
						return x ? (
							<li
								key={id}
								className="flex items-center gap-2 rounded-full bg-slate-800 py-1 pr-3 pl-1 text-sm font-semibold text-gray-200"
							>
								<span className="scale-75">
									<SourceMark source={x} />
								</span>
								{x.name}
								<span className="font-normal text-gray-400">
									{x.connect ? "connect" : "file"}
								</span>
							</li>
						) : null
					})}
				</ul>
			</>
		),
	}),
	unknown: (s) => ({
		title: "GoodWatch doesn't know this file",
		why: `${s.fileName} isn't an export from a site or app GoodWatch reads.`,
		next: "Check where your file comes from in the list below, then drop that export here.",
	}),
	password: () => ({
		title: "This TV Time file is locked",
		why: "TV Time locks its export with a password and sends the password in a separate email.",
		next: "Open the ZIP on your computer with that password, then drop the files inside here.",
	}),
	too_big: () => ({
		title: "This file is too big",
		why: "It's 34 MB. GoodWatch takes files up to 20 MB.",
		next: "Unzip it and drop only the files you need, like your watched and ratings files.",
	}),
	empty: () => ({
		title: "This file is empty",
		why: "It only has column names, no scores.",
		next: "Export again from MovieLens after you've rated a few titles, or pick another file.",
	}),
}

function ProblemCard({
	problem,
	scenario,
	heading,
	onWhere,
}: {
	problem: FileProblem
	scenario: Scenario
	heading: React.RefObject<HTMLHeadingElement>
	onWhere: () => void
}) {
	const p = PROBLEMS[problem](scenario)
	return (
		<section
			aria-live="assertive"
			className="rounded-2xl border-l-8 border-red-700 bg-red-950/70 p-5 text-red-50"
		>
			<div className="flex items-start gap-3">
				<ExclamationTriangleIcon
					className="mt-1 size-6 shrink-0 text-red-300"
					aria-hidden
				/>
				<div className="min-w-0">
					<h2
						ref={heading}
						tabIndex={-1}
						className="text-xl font-bold text-white outline-none"
					>
						{p.title}
					</h2>
					<p className="mt-1 break-all text-sm text-red-200/80">
						{scenario.fileName}
					</p>
					<p className="mt-3">{p.why}</p>
					<div className="mt-3 text-red-50">{p.next}</div>
					{problem === "unknown" && (
						<button
							type="button"
							className={`${textLink} mt-3`}
							onClick={onWhere}
						>
							Where do I get my file?
						</button>
					)}
				</div>
			</div>
		</section>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Check (in the layer)                                                                                               */

function Checking({ sim }: { sim: Sim }) {
	const s = sim.scenario
	const { phase } = sim
	const src = importSourceName(s.source)
	return (
		<Frame
			top={
				<>
					<span className="scale-125">
						<SourceMark source={sourceEntry(s.source)} />
					</span>
					<LayerHeading>
						{phase.at === "connecting"
							? `Waiting for ${src}`
							: "Finding your titles"}
					</LayerHeading>
					<p className="break-all text-sm text-gray-400">{s.fileName}</p>
					<div className="w-full max-w-sm" aria-live="polite">
						{phase.at === "checking" ? (
							<>
								<Bar value={phase.progress} label="Finding your titles" />
								<p className="mt-2 text-sm text-gray-400">
									Looking up {fmt(s.rows)} entries in GoodWatch. Nothing changes
									yet.
								</p>
							</>
						) : (
							<p className="animate-pulse text-sm text-gray-400">
								Say yes to GoodWatch in the {src} tab. You come right back here.
							</p>
						)}
					</div>
				</>
			}
		/>
	)
}

function Answer({
	n,
	selected,
	recommended,
	onClick,
	title,
	note,
	poster,
}: {
	/** 1-based, for the keyboard hint. */
	n: number
	selected: boolean
	recommended?: boolean
	onClick: () => void
	title: string
	note?: string
	poster?: Title
}) {
	return (
		<button
			type="button"
			data-answer
			data-continue={selected ? "" : undefined}
			aria-pressed={selected}
			aria-keyshortcuts={String(n)}
			onClick={onClick}
			className={`flex min-h-16 w-full cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-transform duration-150 active:scale-[0.98] sm:px-5 ${selected ? "border-amber-400 bg-amber-400/10" : "border-slate-700 bg-slate-900/60 hover:border-slate-500"}`}
		>
			<kbd
				aria-hidden
				className="hidden size-6 shrink-0 items-center justify-center rounded border border-slate-600 font-sans text-xs font-semibold text-gray-400 sm:flex"
			>
				{n}
			</kbd>
			{poster && <Poster title={poster} className="w-12" />}
			<span className="min-w-0 flex-1">
				<span className="block text-lg font-bold text-white">{title}</span>
				{note && <span className="block text-sm text-gray-400">{note}</span>}
			</span>
			{recommended && (
				<span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
					Suggested
				</span>
			)}
			<span
				aria-hidden
				className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-amber-400 bg-amber-400 text-gray-950" : "border-slate-600"}`}
			>
				{selected && <CheckIcon className="size-4" />}
			</span>
		</button>
	)
}

function Ask({
	sim,
	screen,
	index,
	screens,
	local,
	setLocal,
	sameForAll,
	setSameForAll,
	onNext,
}: {
	sim: Sim
	screen: Screen
	index: number
	screens: Screen[]
	local: Local
	setLocal: (l: Local) => void
	sameForAll: boolean
	setSameForAll: (v: boolean) => void
	onNext: (from: number, skipGroup?: boolean) => void
}) {
	const s = sim.scenario
	const c = sim.choices
	const set = (next: Partial<Choices>) => sim.setChoices({ ...c, ...next })
	const src = importSourceName(s.source)
	const inGroup = screens.filter((x) => x.q === screen.q)
	const subIndex = inGroup.indexOf(screen)

	let title: ReactNode
	/** Above the question: the posters or picture it's about. */
	let visual: ReactNode = null
	let body: ReactNode = null
	let answers: ReactNode

	switch (screen.q) {
		case "matching": {
			const m = s.matching
			if (!m) return null
			const done = sim.matched >= m.total
			title = done
				? "All your titles are matched"
				: "GoodWatch is still matching your titles"
			body = (
				<div aria-live="polite" className="flex w-full max-w-sm flex-col gap-2">
					<Bar value={sim.matched / m.total} label="Matching titles" />
					<p className="text-sm text-gray-400">
						{fmt(sim.matched)} of {fmt(m.total)} matched.{" "}
						{done
							? "Everything is ready."
							: "This keeps going while you look around."}
					</p>
				</div>
			)
			answers = (
				<>
					<Answer
						n={1}
						selected={local.matching === "now"}
						recommended
						title={done ? "Import everything" : "Import what's ready now"}
						note={
							done
								? undefined
								: "The rest join on their own when they're matched."
						}
						onClick={() => {
							setLocal({ ...local, matching: "now" })
							onNext(index)
						}}
					/>
					<Answer
						n={2}
						selected={local.matching === "wait"}
						title="Wait until all are matched"
						note="Import starts when you tap it, after matching finishes."
						onClick={() => {
							setLocal({ ...local, matching: "wait" })
							onNext(index)
						}}
					/>
				</>
			)
			break
		}
		case "uncertain": {
			const u = s.matching?.uncertain ?? []
			title = `Are these the right ${plural(u.length, "movie")}?`
			visual = <PosterRow titles={u} />
			body = (
				<p className="text-gray-400">
					Their names in your {src} file fit more than one title. These are
					GoodWatch's best guesses.
				</p>
			)
			answers = (
				<>
					<Answer
						n={1}
						selected={local.uncertain === "leave"}
						recommended
						title="Leave them out for now"
						note="You can add them from the finished import."
						onClick={() => {
							setLocal({ ...local, uncertain: "leave" })
							onNext(index)
						}}
					/>
					<Answer
						n={2}
						selected={local.uncertain === "add"}
						title="Yes, these are right"
						onClick={() => {
							setLocal({ ...local, uncertain: "add" })
							onNext(index)
						}}
					/>
				</>
			)
			break
		}
		case "conflicts": {
			const k = s.conflicts[screen.i]
			const current = c.conflictPerTitle[k.title.id] ?? c.conflictDefault
			const left = s.conflicts.length - subIndex
			const pick = (v: "keep" | "file") => {
				if (sameForAll) {
					const per = { ...c.conflictPerTitle }
					for (const x of s.conflicts.slice(screen.i)) delete per[x.title.id]
					set({ conflictDefault: v, conflictPerTitle: per })
					setSameForAll(false)
					onNext(index, true)
				} else {
					set({ conflictPerTitle: { ...c.conflictPerTitle, [k.title.id]: v } })
					onNext(index)
				}
			}
			title = (
				<>
					{k.title.name}: {src} says {k.theirs}, you gave it {k.yours}. Which
					score should stay?
				</>
			)
			visual = <Poster title={k.title} className="w-32 sm:w-40" />
			body = (
				<p className="text-sm text-gray-400">
					You changed it in GoodWatch on {day(k.yoursAt)}.
				</p>
			)
			answers = (
				<>
					{left > 1 && (
						<button
							type="button"
							aria-pressed={sameForAll}
							onClick={() => setSameForAll(!sameForAll)}
							className={`inline-flex min-h-11 cursor-pointer items-center gap-2 self-center rounded-full border-2 px-4 text-sm font-semibold ${sameForAll ? "border-amber-400 bg-amber-400/10 text-amber-100" : "border-slate-700 text-gray-300 hover:border-slate-500"}`}
						>
							<span
								aria-hidden
								className={`flex size-4 items-center justify-center rounded border ${sameForAll ? "border-amber-400 bg-amber-400 text-gray-950" : "border-slate-500"}`}
							>
								{sameForAll && <CheckIcon className="size-3" />}
							</span>
							Same for all {fmt(left)}
						</button>
					)}
					<Answer
						n={1}
						selected={current === "keep"}
						recommended
						title={
							sameForAll ? "Keep my GoodWatch scores" : `Keep my ${k.yours}`
						}
						note="Your newer score stays."
						onClick={() => pick("keep")}
					/>
					<Answer
						n={2}
						selected={current === "file"}
						title={
							sameForAll ? `Use ${src}'s scores` : `Use ${src}'s ${k.theirs}`
						}
						onClick={() => pick("file")}
					/>
				</>
			)
			break
		}
		case "unmatched": {
			const u = s.unmatched[screen.i]
			const current = c.matches[u.raw] ?? u.suggestions[0].id
			const choose = (v: string) => {
				set({ matches: { ...c.matches, [u.raw]: v } })
				onNext(index)
			}
			const one = u.suggestions.length === 1
			title = (
				<>
					Your file says “{u.raw}”. {one ? "Is this it?" : "Which one is it?"}
				</>
			)
			if (one)
				visual = <Poster title={u.suggestions[0]} className="w-28 sm:w-32" />
			body = (
				<p className="text-gray-400">
					GoodWatch couldn't be sure, so it's asking. It's your{" "}
					{u.what === "want" ? "Want to See" : u.what}.
				</p>
			)
			answers = (
				<>
					{u.suggestions.map((t, n) => (
						<Answer
							key={t.id}
							n={n + 1}
							selected={current === t.id}
							recommended={n === 0}
							poster={one ? undefined : t}
							title={one ? `Yes, ${t.name}` : t.name}
							note={`${t.year} · ${t.kind === "show" ? "Show" : "Movie"}`}
							onClick={() => choose(t.id)}
						/>
					))}
					<Answer
						n={u.suggestions.length + 1}
						selected={current === "skip"}
						title={one ? "No, leave it out" : "Neither, leave it out"}
						onClick={() => choose("skip")}
					/>
				</>
			)
			break
		}
		case "undated":
			title = `${plural(s.undatedWatches, "watch", "watches")} in your file have no date. Add them anyway?`
			visual = (
				<CalendarDaysIcon className="size-16 text-gray-500" aria-hidden />
			)
			body = (
				<p className="text-gray-400">
					They count as Seen, just without a day. Your watches with dates come
					in as usual.
				</p>
			)
			answers = (
				<>
					<Answer
						n={1}
						selected={c.undated === "import"}
						recommended
						title="Add them without a date"
						onClick={() => {
							set({ undated: "import" })
							onNext(index)
						}}
					/>
					<Answer
						n={2}
						selected={c.undated === "skip"}
						title="Leave them out"
						onClick={() => {
							set({ undated: "skip" })
							onNext(index)
						}}
					/>
				</>
			)
			break
		case "rewatch":
			title = `${plural(s.alreadySeenWants.length, "title")} on your wishlist ${s.alreadySeenWants.length === 1 ? "is" : "are"} already Seen. Add them to Want to rewatch?`
			visual = <PosterRow titles={s.alreadySeenWants} />
			answers = (
				<>
					<Answer
						n={1}
						selected={c.rewatch === "leave"}
						recommended
						title="No, leave them as Seen"
						onClick={() => {
							set({ rewatch: "leave" })
							onNext(index)
						}}
					/>
					<Answer
						n={2}
						selected={c.rewatch === "rewatch"}
						title="Yes, add to Want to rewatch"
						onClick={() => {
							set({ rewatch: "rewatch" })
							onNext(index)
						}}
					/>
				</>
			)
			break
		case "side-effects": {
			const fx = s.sideEffects
			const n = fx.offWantToSee.length + fx.offNotInterested.length
			const watchesOn = c.include.watches || c.include.episodes
			title = `You watched ${n === 1 ? "this title" : `these ${fmt(n)} titles`}, so ${n === 1 ? "it leaves" : "they leave"} your lists. Is that right?`
			visual = (
				<div className="flex flex-col gap-4">
					{fx.offWantToSee.length > 0 && (
						<div className="flex flex-col gap-2">
							<h3 className="text-sm font-semibold text-gray-300">
								Off Want to See
							</h3>
							<PosterRow titles={fx.offWantToSee} size="w-16 sm:w-20" />
						</div>
					)}
					{fx.offNotInterested.length > 0 && (
						<div className="flex flex-col gap-2">
							<h3 className="text-sm font-semibold text-gray-300">
								Off Not interested
							</h3>
							<PosterRow titles={fx.offNotInterested} size="w-16 sm:w-20" />
						</div>
					)}
				</div>
			)
			answers = (
				<>
					<Answer
						n={1}
						selected={watchesOn}
						recommended
						title="Yes, that's right"
						note="They move to Seen."
						onClick={() => {
							set({
								include: {
									...c.include,
									watches: s.kinds.watches > 0,
									episodes: s.kinds.episodes > 0,
								},
							})
							onNext(index)
						}}
					/>
					<Answer
						n={2}
						selected={!watchesOn}
						title="Leave my watches out"
						note="Your lists stay as they are. Nothing else from the watches comes in."
						onClick={() => {
							set({
								include: { ...c.include, watches: false, episodes: false },
							})
							onNext(index)
						}}
					/>
				</>
			)
			break
		}
	}

	return (
		<Frame
			top={
				<>
					{visual}
					<LayerHeading>{title}</LayerHeading>
					{body}
				</>
			}
			bottom={answers}
		/>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Here's what will happen                                                                                            */

function answerLine(g: Group, s: Scenario, c: Choices, local: Local) {
	const src = importSourceName(s.source)
	switch (g) {
		case "matching":
			return [
				"Still matching",
				local.matching === "now"
					? "Import what's ready now"
					: "Wait until all are matched",
			]
		case "uncertain":
			return [
				`${plural(s.matching?.uncertain.length ?? 0, "uncertain movie")}`,
				local.uncertain === "leave" ? "Leave out for now" : "Add them",
			]
		case "conflicts": {
			const fromFile = s.conflicts.filter(
				(k) => (c.conflictPerTitle[k.title.id] ?? c.conflictDefault) === "file",
			).length
			const keep = s.conflicts.length - fromFile
			return [
				`${plural(s.conflicts.length, "score")} that differ`,
				fromFile === 0
					? "Keep all of yours"
					: keep === 0
						? `Use ${src}'s for all`
						: `Use ${src}'s for ${fmt(fromFile)}, keep ${fmt(keep)} of yours`,
			]
		}
		case "unmatched": {
			const asked = s.unmatched.filter((u) => u.suggestions.length)
			const skipped = asked.filter((u) => c.matches[u.raw] === "skip").length
			return [
				`${plural(asked.length, "likely match", "likely matches")}`,
				skipped === 0
					? "Use all of them"
					: `Use ${fmt(asked.length - skipped)}, leave out ${fmt(skipped)}`,
			]
		}
		case "undated":
			return [
				`${plural(s.undatedWatches, "watch", "watches")} without a date`,
				c.undated === "import" ? "Add without a date" : "Leave out",
			]
		case "rewatch":
			return [
				`${plural(s.alreadySeenWants.length, "Seen title")} on your wishlist`,
				c.rewatch === "leave" ? "Leave as Seen" : "Add to Want to rewatch",
			]
		case "side-effects": {
			const n =
				s.sideEffects.offWantToSee.length +
				s.sideEffects.offNotInterested.length
			return [
				`${plural(n, "title")} leaving your lists`,
				c.include.watches || c.include.episodes
					? "That's right"
					: "Watches left out",
			]
		}
	}
}

function Summary({
	sim,
	groups,
	local,
	onEdit,
}: {
	sim: Sim
	groups: Group[]
	local: Local
	onEdit: (g: Group) => void
}) {
	const s = sim.scenario
	const c = sim.choices
	const src = importSourceName(s.source)
	const [kindsOpen, setKindsOpen] = useState(false)
	const [outOpen, setOutOpen] = useState(false)
	const nothingNew = newTitles(s) === 0

	if (nothingNew)
		return (
			<Frame
				top={
					<>
						<span className="flex size-16 items-center justify-center rounded-full bg-white/10">
							<CheckIcon className="size-9 text-gray-300" aria-hidden />
						</span>
						<LayerHeading>Nothing new in this file</LayerHeading>
						<p>
							All {fmt(s.unchanged)} titles in it are already in GoodWatch,
							exactly the same.
							{s.previous &&
								` You imported this ${src} file on ${day(s.previous.at)}.`}
						</p>
						<p className="text-gray-400">
							Made changes on {src} since then? Export a fresh file and drop it
							in.
						</p>
					</>
				}
				bottom={
					<button
						type="button"
						data-continue
						className={`${primaryButton} w-full`}
						onClick={sim.reset}
					>
						Pick another file
					</button>
				}
			/>
		)

	const m = s.matching
	const waiting = !!m && local.matching === "wait" && sim.matched < m.total
	const share =
		m && local.matching === "now" ? Math.min(1, sim.matched / m.total) : 1
	const count = Math.round(incoming(s, c) * share)
	const kindsIn = (Object.keys(s.kinds) as (keyof Kinds)[]).filter(
		(k) => s.kinds[k] > 0 && c.include[k],
	)
	const noSuggestion = s.unmatched.filter((u) => !u.suggestions.length)
	const outCount = noSuggestion.length + s.unsupported

	return (
		<Frame
			align="start"
			top={
				<>
					<div className="flex flex-col items-center gap-4 text-center">
						<PosterStack titles={s.sample} size="w-14 sm:w-16" />
						<LayerHeading>Here's what will happen</LayerHeading>
					</div>

					<div className="rounded-2xl bg-gray-950/50 p-5 ring-1 ring-white/10">
						<p className="text-xl font-bold text-white">
							{plural(count, "title")} come in from {src}
						</p>
						<p className="mt-1 text-gray-300">
							{kindsIn.map((k) => kindLine(k, s.kinds[k])).join(", ")}
						</p>
						{s.unchanged > 0 && (
							<p className="mt-2 text-sm text-gray-400">
								{plural(s.unchanged, "title")} you already have stay the same.
								{s.previous && ` Last import: ${day(s.previous.at)}.`}
							</p>
						)}
						{m && local.matching === "now" && sim.matched < m.total && (
							<p className="mt-2 text-sm text-gray-400" aria-live="polite">
								{fmt(m.total - sim.matched)} still matching. They join on their
								own.
							</p>
						)}
						<div className="mt-3">
							<Disclosure
								label="Choose what comes in"
								open={kindsOpen}
								onToggle={setKindsOpen}
							>
								<ul className="flex flex-wrap gap-2">
									{(Object.keys(s.kinds) as (keyof Kinds)[])
										.filter((k) => s.kinds[k] > 0)
										.map((k) => (
											<li key={k}>
												<button
													type="button"
													aria-pressed={c.include[k]}
													onClick={() =>
														sim.setChoices({
															...c,
															include: { ...c.include, [k]: !c.include[k] },
														})
													}
													className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border-2 px-3 text-sm font-semibold ${c.include[k] ? "border-amber-400/70 bg-amber-400/10 text-white" : "border-slate-700 text-gray-400 line-through"}`}
												>
													{c.include[k] && (
														<CheckIcon
															className="size-4 text-amber-300"
															aria-hidden
														/>
													)}
													{kindLine(k, s.kinds[k])}
												</button>
											</li>
										))}
								</ul>
							</Disclosure>
						</div>
					</div>

					{groups.length > 0 && (
						<div className="flex flex-col gap-2">
							<h3 className="text-sm font-semibold text-gray-400">
								Your answers
							</h3>
							<ul className="divide-y divide-white/10 rounded-2xl bg-gray-950/50 ring-1 ring-white/10">
								{groups.map((g) => {
									const [what, answer] = answerLine(g, s, c, local)
									return (
										<li key={g} className="flex items-center gap-3 px-4 py-3">
											<span className="min-w-0 flex-1">
												<span className="block text-sm text-gray-400">
													{what}
												</span>
												<span className="block font-semibold text-white">
													{answer}
												</span>
											</span>
											<button
												type="button"
												className={textLink}
												aria-label={`Change: ${what}`}
												onClick={() => onEdit(g)}
											>
												Change
											</button>
										</li>
									)
								})}
							</ul>
						</div>
					)}

					{outCount > 0 && (
						<Disclosure
							label={`${plural(outCount, "entry", "entries")} stay out`}
							open={outOpen}
							onToggle={setOutOpen}
						>
							<div className="flex flex-col gap-2 text-sm text-gray-400">
								{noSuggestion.length > 0 && (
									<>
										<p>GoodWatch couldn't find these titles:</p>
										<ul className="list-disc pl-5 text-gray-300">
											{noSuggestion.map((u) => (
												<li key={u.raw}>{u.raw}</li>
											))}
										</ul>
									</>
								)}
								{s.unsupported > 0 && (
									<p>
										{plural(s.unsupported, "entry", "entries")} aren't movies or
										shows, like podcasts or games.
									</p>
								)}
							</div>
						</Disclosure>
					)}
				</>
			}
			bottom={
				<>
					<button
						type="button"
						data-continue
						className={`${primaryButton} min-h-12 w-full text-lg`}
						disabled={waiting || count === 0}
						onClick={sim.confirm}
					>
						{waiting
							? `Matching ${fmt(sim.matched)} of ${fmt(m?.total ?? 0)}…`
							: `Import ${plural(count, "title")}`}
					</button>
					<p className="text-center text-sm text-gray-400">
						You can undo it later.
					</p>
				</>
			}
		/>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Import and Done (in the layer)                                                                                     */

function Running({
	sim,
	onBackground,
}: { sim: Sim; onBackground: () => void }) {
	const s = sim.scenario
	const { phase } = sim
	if (phase.at !== "running" && phase.at !== "failed") return null
	const count = incoming(s, sim.choices)
	const failed = phase.at === "failed"
	const lit = Math.floor(phase.progress * Math.min(10, s.sample.length))
	return (
		<Frame
			top={
				<>
					<ul className="grid grid-cols-5 gap-2" aria-hidden>
						{s.sample.slice(0, 10).map((t, i) => (
							<li
								key={t.id}
								className="transition-[transform,opacity] duration-500 ease-out"
								style={{
									opacity: i < lit ? 1 : 0.2,
									transform: i < lit ? "none" : "scale(0.94)",
								}}
							>
								<Poster title={t} className="w-full" />
							</li>
						))}
					</ul>
					<LayerHeading>
						{failed
							? `The import stopped at ${Math.round(phase.progress * 100)}%`
							: `Importing ${plural(count, "title")}`}
					</LayerHeading>
					<div className="w-full max-w-sm">
						<Bar value={phase.progress} label="Import progress" />
						<p className="mt-2 text-sm text-gray-400" aria-hidden>
							{Math.round(phase.progress * 100)}% done
						</p>
						<p className="sr-only" aria-live="polite">
							{failed ? "Import stopped" : `${spoken(phase.progress)} done`}
						</p>
					</div>
					<p className="text-gray-400">
						{failed
							? "Everything up to there is saved and stays. Continue picks up where it stopped."
							: s.runSeconds >= 10
								? "This takes a few minutes. You don't need to wait here."
								: "This only takes a moment."}
					</p>
				</>
			}
			bottom={
				failed ? (
					<>
						<button
							type="button"
							data-continue
							className={`${primaryButton} min-h-12 w-full text-lg`}
							onClick={sim.resume}
						>
							Continue
						</button>
						<button
							type="button"
							className={`${secondaryButton} w-full`}
							onClick={sim.undo}
						>
							Undo what was saved
						</button>
					</>
				) : (
					<button
						type="button"
						className={`${secondaryButton} w-full`}
						onClick={onBackground}
					>
						Keep going in the background
					</button>
				)
			}
		/>
	)
}

/** The posters that came in, fading up one after another. */
function ArrivedGrid({ titles, total }: { titles: Title[]; total: number }) {
	const on = useEntered()
	const cells = (n: number) => {
		const shown = titles.slice(0, total > n ? n - 1 : n)
		return { shown, more: total - shown.length }
	}
	const phone = cells(10)
	const wide = cells(12)
	const item = (i: number) => ({
		opacity: on ? 1 : 0,
		transform: on ? "none" : "translateY(14px) scale(0.94)",
		transitionDelay: `${120 + i * 45}ms`,
	})
	const tile =
		"flex aspect-[2/3] items-center justify-center rounded-md bg-gray-800 text-sm font-bold text-gray-300 ring-2 ring-gray-950 transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none"
	return (
		<ul className="grid w-full grid-cols-5 gap-2 sm:grid-cols-6" aria-hidden>
			{wide.shown.map((t, i) => (
				<li
					key={t.id}
					className={`transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none ${i >= phone.shown.length ? "hidden sm:block" : ""}`}
					style={item(i)}
				>
					<Poster title={t} className="w-full" />
				</li>
			))}
			{phone.more > 0 && (
				<li className={`${tile} sm:hidden`} style={item(phone.shown.length)}>
					+{fmt(phone.more)}
				</li>
			)}
			{wide.more > 0 && (
				<li
					className={`${tile} hidden sm:flex`}
					style={item(wide.shown.length)}
				>
					+{fmt(wide.more)}
				</li>
			)}
		</ul>
	)
}

function Done({
	sim,
	local,
	onBackground,
}: { sim: Sim; local: Local; onBackground: () => void }) {
	const s = sim.scenario
	const { phase } = sim
	const src = importSourceName(s.source)
	const past = s.entry === "history"
	const count = past ? (s.previous?.added ?? 0) : incoming(s, sim.choices)
	const leaves = s.undoLeaves ?? []
	const kindsIn = (Object.keys(s.kinds) as (keyof Kinds)[]).filter(
		(k) => s.kinds[k] > 0 && (past || sim.choices.include[k]),
	)
	const restMatching =
		s.matching && local.matching === "now"
			? s.matching.total - s.matching.done
			: 0
	const tookFile =
		!past &&
		s.conflicts.some(
			(k) =>
				(sim.choices.conflictPerTitle[k.title.id] ??
					sim.choices.conflictDefault) === "file",
		)
	const badge = useEntered()

	if (phase.at === "undoing")
		return (
			<Frame
				top={
					<>
						<ArrowUturnLeftIcon className="size-14 text-gray-400" aria-hidden />
						<LayerHeading>Undoing this import</LayerHeading>
						<div className="w-full max-w-sm">
							<Bar value={phase.progress} label="Undo progress" />
							<p className="mt-2 text-sm text-gray-400" aria-hidden>
								{Math.round(phase.progress * 100)}% done
							</p>
							<p className="sr-only" aria-live="polite">
								{spoken(phase.progress)} done
							</p>
						</div>
					</>
				}
				bottom={
					<button
						type="button"
						className={`${secondaryButton} w-full`}
						onClick={onBackground}
					>
						Keep going in the background
					</button>
				}
			/>
		)

	if (phase.at === "undone")
		return (
			<Frame
				top={
					<>
						<ArrowUturnLeftIcon className="size-14 text-gray-400" aria-hidden />
						<LayerHeading>Undone</LayerHeading>
						<p>
							GoodWatch is back to how it was before this {src} import.
							{leaves.length > 0 &&
								` ${names(leaves)} stay as they are, since you changed them after the import.`}
						</p>
					</>
				}
				bottom={
					<button
						type="button"
						data-continue
						className={`${primaryButton} w-full`}
						onClick={sim.reset}
					>
						Back to Imports
					</button>
				}
			/>
		)

	return (
		<Frame
			top={
				<>
					{!past && (
						<span
							aria-hidden
							className="flex size-14 items-center justify-center rounded-full bg-amber-400 text-gray-950 transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none"
							style={{
								transform: badge ? "none" : "scale(0.6)",
								opacity: badge ? 1 : 0,
							}}
						>
							<CheckIcon className="size-8" />
						</span>
					)}
					<LayerHeading>
						{past
							? `${src} import from ${day(s.previous?.at ?? "")}`
							: `${plural(count, "title")} are in GoodWatch`}
					</LayerHeading>
					{past && (
						<p className="-mt-2 break-all text-sm text-gray-400">
							{s.fileName} · added {plural(count, "title")}
						</p>
					)}
					<ArrivedGrid titles={s.sample} total={count} />
					<ul className="flex flex-wrap justify-center gap-2">
						{kindsIn.map((k) => (
							<li
								key={k}
								className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-sm text-gray-200 ring-1 ring-white/10"
							>
								<CheckIcon className="size-4 text-amber-300" aria-hidden />
								{kindLine(k, s.kinds[k])}
							</li>
						))}
						{tookFile && (
							<li className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-sm text-gray-200 ring-1 ring-white/10">
								<CheckIcon className="size-4 text-amber-300" aria-hidden />
								Some scores now match {src}
							</li>
						)}
					</ul>
					{restMatching > 0 && (
						<p className="text-sm text-gray-400">
							{fmt(restMatching)} more join as soon as GoodWatch finishes
							matching them.
						</p>
					)}
					{leaves.length > 0 && (
						<div className="flex items-center gap-3 text-left">
							<PosterStack titles={leaves} size="w-10" />
							<p className="text-sm text-gray-300">
								If you undo, {names(leaves)} stay as they are. You changed them
								after this import.
							</p>
						</div>
					)}
				</>
			}
			bottom={
				past ? (
					<>
						<button
							type="button"
							className={`${dangerButton} w-full`}
							onClick={sim.undo}
						>
							<ArrowUturnLeftIcon className="size-5" aria-hidden />
							Undo this import
						</button>
						<button
							type="button"
							data-continue
							className={`${secondaryButton} w-full`}
							onClick={sim.reset}
						>
							Back to Imports
						</button>
					</>
				) : (
					<>
						<div className="grid grid-cols-2 gap-3">
							<a href="/taste" className={`${primaryButton} w-full`}>
								See your taste
							</a>
							<button
								type="button"
								data-continue
								className={`${secondaryButton} w-full`}
								onClick={sim.reset}
							>
								Back to Imports
							</button>
						</div>
						<button
							type="button"
							onClick={sim.undo}
							className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 self-center rounded-lg px-3 text-sm font-semibold text-gray-400 hover:text-white"
						>
							<ArrowUturnLeftIcon className="size-4" aria-hidden />
							Changed your mind? Undo this import
						</button>
					</>
				)
			}
		/>
	)
}
