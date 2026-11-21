// One Browse dial: a plain question, a track with named stops and a knob. Every stop is a real link (the page with the
// dial there). Drag, tap a stop, or use the arrow keys; while it moves the page's titles re-sort. The places at either
// end are where you land when you keep going that way.
//
// At rest a dial has no knob: its stops show as small open rings, the header says "Any amount" or "Anywhere" in a
// dashed outline, and a mouse sees a ghost knob on the stop it points at. The first touch puts a solid knob right there
// (it scales in, it never travels from the middle). A place's own position, where a "how much" dial has one, is a small
// diamond above the track in the dial's color. `look="pill"` draws the same dial as one compact pill (end words either
// side) for filter rows like Top's.
//
// The knob may rest between the named stops: each gap is split so a track has 6-10 resting places (`finePlaces`), small
// ticks show the in-between places, and the words read the nearest stop. While a finger or mouse drags, the knob
// follows the pointer every animation frame and the page hears about it only when the nearest resting place changes, at
// most every 90 ms, so the re-sorting list never fights the drag. On release the knob settles onto the resting place it
// showed. Nothing changes size when a dial is set: the pill reserves the room of its ×.
import { Link, useNavigate } from "@remix-run/react"
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react"
import { type DialSpec, type Exit, clamp01, finePlaces, nearestStop, snapFine } from "./tune"

const INSET = 14
const PAST = 0.14

export interface DialChange {
	/** The dial's position 0-1, or null for a dial put to rest. */
	at: number | null
	/** False while the knob is being dragged. */
	final: boolean
}

function ExitLink({
	exit,
	side,
	word,
	armed,
	atEnd,
}: {
	exit: Exit
	side: "low" | "high"
	word: string
	armed: boolean
	atEnd: boolean
}) {
	return (
		<Link
			to={exit.to}
			prefetch="intent"
			data-exit={side}
			title={`${word} still: ${exit.place.label}`}
			className={`group/exit flex h-7 ${atEnd || armed ? "max-w-[72%]" : "max-w-[48%]"} items-center gap-1.5 rounded-full px-2 text-xs font-bold outline-none transition-[background-color,color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none ${side === "high" ? "ml-auto flex-row-reverse" : ""} ${
				armed
					? "scale-105 bg-amber-400/20 text-amber-200"
					: atEnd
						? "bg-amber-400/15 text-amber-200"
						: "text-gray-400 hover:bg-white/10 hover:text-white"
			}`}
		>
			<span aria-hidden className="transition-transform duration-200 group-hover/exit:scale-125">
				{side === "low" ? "‹" : "›"}
			</span>
			<span
				aria-hidden
				className="h-2 w-2 shrink-0 rounded-full"
				style={{ background: exit.place.hue ?? "currentColor" }}
			/>
			<span className="truncate">
				{atEnd || armed ? <span className="font-medium">Keep going: </span> : null}
				{exit.place.label}
			</span>
		</Link>
	)
}

export function Dial({
	spec,
	at,
	onChange,
	dense = false,
	rest,
	look = "full",
}: {
	spec: DialSpec
	/** The knob's position 0-1, or null at rest. */
	at: number | null
	onChange: (change: DialChange) => void
	/** No line under the track. */
	dense?: boolean
	/** What the line under the track says while the dial is at rest. */
	rest?: string
	/** "pill": one compact pill, the end words either side of the track and no header or line (Best's filter row). */
	look?: "full" | "pill"
}) {
	const navigate = useNavigate()
	const track = useRef<HTMLDivElement>(null)
	const [dragging, setDragging] = useState(false)
	const [armed, setArmed] = useState<"low" | "high" | null>(null)
	const [over, setOver] = useState(0)
	const moved = useRef(false)
	const [ghost, setGhost] = useState<number | null>(null)
	// While dragging: where the pointer is (0-1, unsnapped). The knob shows this, not the page's value.
	const [dragAt, setDragAt] = useState<number | null>(null)
	const frame = useRef(0)
	const pending = useRef<number | null>(null)
	const told = useRef<{ place: number; time: number } | null>(null)
	const later = useRef<ReturnType<typeof setTimeout> | null>(null)
	useEffect(
		() => () => {
			cancelAnimationFrame(frame.current)
			if (later.current) clearTimeout(later.current)
		},
		[],
	)
	// While dragging, the name, the lit stop and the value read the knob itself (the place it will settle on), not the
	// page's throttled copy, so what you see while pressing is exactly where it lands.
	const live = dragging && dragAt !== null ? snapFine(spec, dragAt) : at
	const stop = live === null ? null : nearestStop(spec, live)
	const places = finePlaces(spec)
	const near = (a: number, b: number) => Math.abs(a - b) < 0.004
	const index = live === null ? -1 : places.findIndex((p) => near(p, snapFine(spec, live)))
	// Where the knob was last: a dial put back to rest fades its knob out in place.
	const last = useRef<number | null>(at)
	const wasRest = useRef(at === null)
	const appearing = wasRest.current && at !== null
	useEffect(() => {
		wasRest.current = at === null
		if (at !== null) last.current = at
	}, [at])
	const shown = (dragging ? dragAt : null) ?? at ?? last.current ?? spec.home ?? 0.5
	const restWords = spec.restName ?? (spec.kind === "much" ? "Any amount" : "Anywhere")
	const restText = rest?.replace(/^The ringed knob is /, "The diamond marks ")
	/** A "how much" dial of a trait or mood has its color; a direction dial is neutral. */
	const colored = spec.kind === "much" && spec.color !== "#e5e7eb"
	const labelId = `dial-${spec.id}`

	const read = (e: PointerEvent) => {
		const el = track.current
		if (!el) return 0
		const r = el.getBoundingClientRect()
		return (e.clientX - r.left - INSET) / Math.max(1, r.width - INSET * 2)
	}
	const move = (e: PointerEvent) => {
		const raw = read(e)
		const side =
			raw < -PAST && spec.lowExit ? "low" : raw > 1 + PAST && spec.highExit ? "high" : null
		setArmed(side)
		// Past the end the knob stretches a little, like something you lean against.
		const past = raw < 0 ? raw : raw > 1 ? raw - 1 : 0
		setOver(Math.sign(past) * Math.min(18, Math.abs(past) * 60))
		// The knob: one state update per animation frame.
		pending.current = clamp01(raw)
		if (!frame.current)
			frame.current = requestAnimationFrame(() => {
				frame.current = 0
				setDragAt(pending.current)
			})
		// The page: only when the nearest resting place changes, at most every 90 ms (the last one always lands).
		const place = snapFine(spec, clamp01(raw))
		if (told.current?.place === place) return
		const tell = () => {
			later.current = null
			const now = snapFine(spec, pending.current ?? place)
			told.current = { place: now, time: performance.now() }
			onChange({ at: now, final: false })
		}
		const wait = told.current ? 90 - (performance.now() - told.current.time) : 0
		if (later.current) clearTimeout(later.current)
		if (wait <= 0) tell()
		else later.current = setTimeout(tell, wait)
	}
	const down = (e: PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0) return
		if ((e.target as HTMLElement).closest("[data-exit],[data-reset]")) return
		e.currentTarget.setPointerCapture(e.pointerId)
		moved.current = false
		told.current = null
		setDragAt(clamp01(read(e)))
		setDragging(true)
		move(e)
	}
	const up = (e: PointerEvent<HTMLDivElement>) => {
		if (!dragging) return
		cancelAnimationFrame(frame.current)
		frame.current = 0
		if (later.current) clearTimeout(later.current)
		later.current = null
		setDragging(false)
		setDragAt(null)
		setOver(0)
		const exit = armed === "low" ? spec.lowExit : armed === "high" ? spec.highExit : null
		setArmed(null)
		if (exit) {
			navigate(exit.to)
			return
		}
		// The place the knob showed last, not a fresh read of the release point (a finger lifts a pixel off).
		onChange({ at: snapFine(spec, clamp01(pending.current ?? read(e))), final: true })
	}
	const key = (e: KeyboardEvent<HTMLDivElement>) => {
		const last = places.length - 1
		const start = places.indexOf(snapFine(spec, spec.home ?? 0.5))
		let next: number | null = null
		if (e.key === "ArrowRight" || e.key === "ArrowUp")
			next = index < 0 ? start : Math.min(last, index + 1)
		else if (e.key === "ArrowLeft" || e.key === "ArrowDown")
			next = index < 0 ? start : Math.max(0, index - 1)
		else if (e.key === "Home") next = 0
		else if (e.key === "End") next = last
		else if (e.key === "Escape" || e.key === "Backspace" || e.key === "Delete") {
			e.preventDefault()
			onChange({ at: null, final: true })
			return
		} else return
		e.preventDefault()
		// At the end already: the next press steps onto the way out.
		if (next === index) {
			const side = index === last ? "high" : "low"
			track.current?.parentElement
				?.querySelector<HTMLAnchorElement>(`[data-exit="${side}"]`)
				?.focus()
			return
		}
		onChange({ at: places[next], final: true })
	}

	// A knob released between stops glides to its stop; a dragged knob follows the finger without easing.
	// The first touch puts the knob where it lands: no travel from the middle.
	const ease = dragging || appearing ? "none" : "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)"
	const atLow = index === 0
	const atHigh = index === places.length - 1
	useEffect(() => {
		if (!dragging) return
		const stopScroll = (e: TouchEvent) => e.preventDefault()
		document.addEventListener("touchmove", stopScroll, { passive: false })
		return () => document.removeEventListener("touchmove", stopScroll)
	}, [dragging])

	// Names under the notches only when five of them fit a track of about 350 px.
	const named = spec.stops.length <= 5 && spec.stops.reduce((n, s) => n + s.name.length, 0) <= 46
	const pill = look === "pill"
	const tint = colored ? spec.color : null
	const reset = (
		<Link
			to={spec.off}
			replace
			preventScrollReset
			data-reset
			aria-label={`Put "${spec.question}" back to rest`}
			onClick={(e) => {
				e.preventDefault()
				onChange({ at: null, final: true })
			}}
			tabIndex={stop ? 0 : -1}
			className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-gray-400 outline-none transition-[opacity,background-color,transform] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${stop ? "opacity-100" : "pointer-events-none scale-75 opacity-0"}`}
		>
			<svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
				<path
					d="M2 2l8 8M10 2l-8 8"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				/>
			</svg>
		</Link>
	)
	const trackEl = (
		<div
			ref={track}
			role="slider"
			tabIndex={0}
			aria-labelledby={pill ? undefined : labelId}
			aria-label={pill ? spec.question : undefined}
			aria-valuemin={0}
			aria-valuemax={places.length}
			aria-valuenow={index + 1}
			aria-valuetext={stop ? stop.name : `Not set: ${restWords}`}
			onPointerDown={down}
			onPointerMove={(e) => {
				if (!dragging) {
					if (e.pointerType === "mouse" && at === null) setGhost(snapFine(spec, clamp01(read(e))))
					return
				}
				moved.current = true
				move(e)
			}}
			onPointerLeave={() => setGhost(null)}
			onPointerUp={up}
			onPointerCancel={up}
			onKeyDown={key}
			className={`group/track relative touch-none rounded-lg [overflow-x:clip] outline-none select-none focus-visible:ring-2 focus-visible:ring-amber-400 ${pill ? "h-9 min-w-[5.5rem] flex-1" : "mt-1.5 h-11"} ${dragging ? "cursor-grabbing" : "cursor-pointer"}`}
		>
			{/* The rail: at rest a quiet groove, set it carries the color up to the knob. */}
			<div
				className={`pointer-events-none absolute inset-x-[6px] top-1/2 -translate-y-1/2 rounded-full transition-[background-color,box-shadow] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${pill ? "h-[6px]" : "h-[10px]"} ${
					at === null
						? "bg-white/[0.06] ring-1 ring-white/[0.09]"
						: "bg-black/35 shadow-[inset_0_1px_2px_rgba(0,0,0,.6),0_1px_0_rgba(255,255,255,.06)] ring-1 ring-white/[0.07]"
				}`}
			/>
			<div
				className={`pointer-events-none absolute inset-x-[14px] top-1/2 -translate-y-1/2 overflow-hidden rounded-full ${pill ? "h-[2px]" : "h-[4px]"}`}
			>
				<div
					className="h-full w-full origin-left rounded-full"
					style={{
						background: tint ?? "rgba(251,191,36,.85)",
						opacity: at === null ? 0 : tint ? 0.9 : pill ? 0.7 : 0,
						transform: `scaleX(${shown})`,
						transition: dragging ? "opacity 150ms" : `${ease}, opacity 240ms`,
					}}
				/>
			</div>
			{/* Where the place itself sits: a small diamond above the track, in the dial's color, at rest too. */}
			{spec.home !== null && !pill && (
				<div
					className="pointer-events-none absolute inset-x-[14px] top-1/2"
					style={{ transform: `translateX(${spec.home * 100}%)` }}
					title={spec.homeLabel}
				>
					<span
						className="absolute -top-[13px] -left-[3.5px] h-[7px] w-[7px] rotate-45 rounded-[1px]"
						style={{ background: tint ?? "rgba(255,255,255,.6)" }}
					/>
				</div>
			)}
			{/* The places between the named stops: small ticks the knob can rest on. */}
			{places
				.filter((p) => !spec.stops.some((s) => near(s.at, p)))
				.map((p) => (
					<span
						key={p}
						aria-hidden
						className={`pointer-events-none absolute top-1/2 block h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-[160ms] ${at === null ? "bg-white/15 group-hover/track:bg-white/30" : "bg-white/25"}`}
						style={{ left: `calc(${INSET}px + (100% - ${INSET * 2}px) * ${p})` }}
					/>
				))}
			{/* The stops: each a real link to the page with the dial there. At rest they are the choices. */}
			{spec.stops.map((s) => (
				<a
					key={s.id}
					href={s.to}
					tabIndex={-1}
					aria-label={`${spec.question} ${s.name}`}
					title={s.name}
					onClick={(e) => e.preventDefault()}
					draggable={false}
					className="absolute top-1/2 grid h-9 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center"
					style={{ left: `calc(${INSET}px + (100% - ${INSET * 2}px) * ${s.at})` }}
				>
					<span
						className={`block rounded-full transition-[background-color,box-shadow,transform,opacity] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
							at === null
								? "h-[7px] w-[7px] bg-transparent ring-[1.5px] ring-white/35 group-hover/track:ring-white/60"
								: near(s.at, at)
									? "h-[5px] w-[5px] bg-transparent"
									: "h-[5px] w-[5px] bg-white/40 group-hover/track:bg-white/70"
						}`}
						style={at === null && tint ? { ["--tw-ring-color" as string]: `${tint}99` } : undefined}
					/>
				</a>
			))}
			{/* A mouse at rest sees where a click would put the knob. */}
			{at === null && ghost !== null && !dragging && (
				<div
					className="pointer-events-none absolute inset-x-[14px] top-1/2"
					style={{
						transform: `translateX(${ghost * 100}%)`,
						transition: "transform 160ms cubic-bezier(0.22,1,0.36,1)",
					}}
				>
					<span
						className={`absolute block rounded-full border-2 border-dashed border-white/45 ${pill ? "-top-[9px] -left-[9px] h-[18px] w-[18px]" : "-top-[12px] -left-[12px] h-[24px] w-[24px]"}`}
					/>
				</div>
			)}
			{/* The knob: only when the dial is set. It scales in where it lands and fades out in place. */}
			<div
				className="pointer-events-none absolute inset-x-[14px] top-1/2"
				style={{ transform: `translateX(${shown * 100}%)`, transition: ease }}
			>
				<span
					className={`absolute block rounded-full bg-gradient-to-b from-white to-gray-200 shadow-[0_2px_10px_rgba(0,0,0,.6)] ring-1 ring-black/10 transition-[scale,opacity] duration-[200ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${pill ? "-top-[10px] -left-[10px] h-[20px] w-[20px]" : "-top-[14px] -left-[14px] h-[28px] w-[28px]"} ${
						at === null
							? "scale-50 opacity-0"
							: dragging
								? "scale-110 opacity-100"
								: "scale-100 opacity-100 group-hover/track:scale-105"
					}`}
					style={{ translate: `${over}px 0` }}
				>
					{tint && (
						<span
							className={`absolute rounded-full ${pill ? "inset-[6px]" : "inset-[9px]"}`}
							style={{ background: tint }}
						/>
					)}
				</span>
			</div>
		</div>
	)

	if (pill) {
		// One pill: low word, track, high word, and the × once it's set. The word it leans to lights up.
		const lean = stop ? (stop.at < 0.5 ? "low" : stop.at > 0.5 ? "high" : null) : null
		return (
			<div
				title={stop ? `${spec.question} ${stop.name}` : `${spec.question} Not set`}
				className={`flex h-11 min-w-0 items-center gap-2 rounded-full pr-2 pl-4 ring-1 transition-[background-color,box-shadow] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
					stop
						? "bg-amber-400/[0.07] ring-amber-400/40"
						: "bg-white/[0.03] ring-white/10 hover:ring-white/20"
				}`}
			>
				<span
					className={`shrink-0 text-[13px] font-semibold whitespace-nowrap transition-colors duration-[160ms] ${lean === "low" || atLow ? "text-white" : "text-gray-400"}`}
				>
					{spec.low}
				</span>
				{trackEl}
				<span
					className={`shrink-0 text-[13px] font-semibold whitespace-nowrap transition-colors duration-[160ms] ${lean === "high" || atHigh ? "text-white" : "text-gray-400"}`}
				>
					{spec.high}
				</span>
				<span className="grid w-5 shrink-0 place-items-center">{reset}</span>
			</div>
		)
	}

	return (
		<div className="@container min-w-0">
			<div className="flex items-baseline gap-2">
				<span id={labelId} className="text-[15px] leading-tight font-bold text-white">
					{spec.question}
				</span>
				<span
					aria-hidden
					className={`ml-auto truncate text-sm font-semibold transition-colors duration-[160ms] ${
						stop
							? "text-white"
							: "rounded-full border border-dashed border-white/15 px-2 py-px text-xs font-medium text-gray-500"
					}`}
					style={stop && colored ? { color: spec.color } : undefined}
				>
					{stop ? stop.name : restWords}
				</span>
				{reset}
			</div>

			{trackEl}

			{/* The stops' names under their notches where the track is long enough; otherwise the two ends. */}
			{named && (
				<div aria-hidden className="relative -mt-1 hidden h-4 @[21rem]:block">
					{spec.stops.map((s, i) => (
						<span
							key={s.id}
							className={`absolute top-0 text-[11px] leading-4 font-semibold whitespace-nowrap transition-colors duration-[160ms] ${s.id === stop?.id || (at === null && s.at === ghost) ? "text-white" : "text-gray-500"} ${
								i === 0
									? ""
									: i === spec.stops.length - 1
										? "-translate-x-full"
										: "-translate-x-1/2"
							}`}
							style={{
								left:
									i === 0
										? 4
										: i === spec.stops.length - 1
											? "calc(100% - 4px)"
											: `calc(${INSET}px + (100% - ${INSET * 2}px) * ${s.at})`,
							}}
						>
							{s.name}
						</span>
					))}
				</div>
			)}
			<div
				className={`-mt-1 flex justify-between px-1 text-[11px] leading-4 font-semibold text-gray-500 ${named ? "@[21rem]:hidden" : ""}`}
			>
				<span className={atLow ? "text-gray-200" : ""}>{spec.low}</span>
				<span className={atHigh ? "text-gray-200" : ""}>{spec.high}</span>
			</div>

			{!dense && (
				<p
					aria-live="polite"
					title={stop?.blurb}
					className={`mt-1.5 h-[1.35em] truncate text-[13px] leading-snug transition-colors duration-[160ms] ${stop ? "text-gray-300" : `text-gray-500 ${restText ? "" : "max-lg:hidden"}`}`}
				>
					{stop ? stop.blurb : (restText ?? "")}
				</p>
			)}

			{(spec.lowExit || spec.highExit) && (
				<div className="mt-1 flex items-center">
					{spec.lowExit && (
						<ExitLink
							exit={spec.lowExit}
							side="low"
							word={spec.low}
							armed={armed === "low"}
							atEnd={atLow}
						/>
					)}
					{spec.highExit && (
						<ExitLink
							exit={spec.highExit}
							side="high"
							word={spec.high}
							armed={armed === "high"}
							atEnd={atHigh}
						/>
					)}
				</div>
			)}
		</div>
	)
}
