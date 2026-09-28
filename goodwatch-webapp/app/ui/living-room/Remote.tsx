// The Remote ("Grid, tiles", #186): power and the IR window, a one-line screen, the D-pad wheel with OK, the
// Back / Home / Search row, a well of four feature tiles, and the four streaming keys low on the body. Every
// control sends a TV flow action; the Remote keeps no state of its own besides the wheel's arrow flash.
import { type ReactNode, useEffect, useRef, useState } from "react"
import disneyMark from "~/img/disneyplus-logo.svg"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import huluMark from "~/img/hulu-logo.png"
import netflixMark from "~/img/netflix-logo.svg"
import primeMark from "~/img/primevideo-logo.svg"
import { REMOTE_SERVICES, type RemoteServiceKey } from "./living-room-data"
import { REMOTE_H } from "./room"
import type { TvAction, TvApp, TvScreen } from "./tv-flow"

export const ICON = {
	back: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
	home: "M3 11l9-7 9 7M5 10v10h14V10",
	search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
	power: "M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0",
	more: "M5 12h.01M12 12h.01M19 12h.01",
	mood: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01",
	pickForMe:
		"M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
} as const

/** The four apps: name, one line, icon, and tint. */
export const APP: Record<
	TvApp,
	{ name: string; line: string; d: string; tint: string; href: string }
> = {
	"watch-now": {
		name: "Watch now",
		line: "Your Wishlist, best match first, on your services.",
		d: "M6 4h12v16l-6-4-6 4z",
		tint: "#38bdf8",
		href: "/watch-next",
	},
	taste: {
		name: "Taste",
		line: "The sides of you, you versus everyone, and your fingerprint.",
		d: "M12 11v3M8.5 8.5a5 5 0 0 1 7 0M6 12a6 6 0 0 1 12 0v2M9 13v1a3 3 0 0 0 6 0",
		tint: "#f472b6",
		href: "/taste",
	},
	discover: {
		name: "Discover",
		line: "Browse and search everything, sorted for you.",
		d: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
		tint: "#34d399",
		href: "/discover",
	},
	explorer: {
		name: "Explorer",
		line: "Wander a map of titles grouped by how they feel.",
		d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z",
		tint: "#a78bfa",
		href: "/explorer",
	},
}

export function Icon({
	d,
	className = "h-[18px] w-[18px]",
}: { d: string; className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={d} />
		</svg>
	)
}

const BRAND: Record<RemoteServiceKey, { src: string; ink: string; w: string }> =
	{
		netflix: { src: netflixMark, ink: "#e50914", w: "48%" },
		prime: { src: primeMark, ink: "#ffffff", w: "50%" },
		disney: { src: disneyMark, ink: "#ffffff", w: "38%" },
		hulu: { src: huluMark, ink: "#1ce783", w: "40%" },
	}

type Feature = "mood" | "watch-now" | "explorer" | "taste"
const FEATURES: Feature[] = ["mood", "watch-now", "explorer", "taste"]

export type RemoteProps = {
	screen: TvScreen
	power: "off" | "booting" | "on"
	/** The one-line screen: what is focused, and what the wheel does. */
	lcd: [string, string]
	/** The service a streaming key stands for, as the catalog spells it. */
	serviceName: (key: RemoteServiceKey) => string
	/** The service the picks are narrowed to, if any. */
	activeService: string | null
	dispatch: (action: TvAction) => void
	/** OK: submits the search draft on the keyboard screen, otherwise opens the focused item. */
	onOk: () => void
}

export function Remote({
	screen,
	power,
	lcd,
	serviceName,
	activeService,
	dispatch,
	onOk,
}: RemoteProps) {
	const waking = useRef(false)
	const featureOn = (f: Feature) =>
		f === "mood"
			? screen.name === "moods"
			: screen.name === "app" && screen.app === f
	const runFeature = (f: Feature) =>
		dispatch(
			f === "mood" ? { type: "open-moods" } : { type: "open-app", app: f },
		)
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: only drops focus after pointer presses; keys need nothing
		<section
			className="relative select-none"
			aria-label="Remote control"
			// While the set is off, any press only turns it on.
			onPointerDownCapture={(e) => {
				if (power !== "off") return
				if ((e.target as HTMLElement).closest("[data-power]")) return
				waking.current = true
				e.stopPropagation()
				dispatch({ type: "power", on: true })
			}}
			onClickCapture={(e) => {
				if (!waking.current) return
				waking.current = false
				e.stopPropagation()
				e.preventDefault()
			}}
			// A pointer press must not leave the button focused, or the next Enter repeats it instead of
			// reaching the TV's focused item. Keyboard presses (detail 0) keep their focus.
			onClick={(e) => {
				if (e.detail === 0) return
				const button = (e.target as HTMLElement).closest("button")
				if (button === document.activeElement) button?.blur()
			}}
		>
			<div
				className="remote-body relative flex flex-col items-center px-6 pb-6 pt-4"
				style={{ minHeight: REMOTE_H }}
			>
				<div className="flex w-full items-center justify-between">
					<button
						type="button"
						data-power
						aria-label={power === "off" ? "Turn on" : "Turn off"}
						onClick={() => dispatch({ type: "power", on: power === "off" })}
						className="remote-key flex h-9 w-9 items-center justify-center rounded-full text-rose-400"
					>
						<Icon d={ICON.power} className="h-4 w-4" />
					</button>
					<div className="h-2 w-20 rounded-full bg-black/70" aria-hidden />
					<span className="h-9 w-9" aria-hidden />
				</div>
				{/* Ends where the hand photo leaves the window, so the streaming keys sit low but stay visible. */}
				<div className="mt-4 flex h-[612px] w-full flex-col items-center gap-5">
					<Lcd lines={lcd} />
					<Wheel dispatch={dispatch} onOk={onOk} />
					<div className="flex w-full items-center gap-3">
						<WideKey
							d={ICON.back}
							label="Back"
							onClick={() => dispatch({ type: "back" })}
						/>
						<button
							type="button"
							aria-label="Home"
							title="Home"
							onClick={() => dispatch({ type: "home" })}
							className="remote-key flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
						>
							<Icon d={ICON.home} className="h-6 w-6" />
						</button>
						<WideKey
							d={ICON.search}
							label="Search"
							pressed={screen.name === "search"}
							onClick={() => dispatch({ type: "open-search" })}
						/>
					</div>
					{/* The well's 8 px inset and gap match the streaming keys' grid, so both blocks share columns. */}
					<div className="remote-well grid w-full grid-cols-2 gap-2 rounded-[26px] p-2">
						{FEATURES.map((f) => (
							<button
								key={f}
								type="button"
								aria-pressed={featureOn(f)}
								onClick={() => runFeature(f)}
								className="remote-key flex h-[60px] w-full flex-col items-center justify-center gap-1.5 rounded-[18px] text-[10.5px] font-semibold uppercase tracking-wider"
							>
								<Icon
									d={f === "mood" ? ICON.mood : APP[f].d}
									className="h-5 w-5"
								/>
								{f === "mood" ? "Mood" : APP[f].name}
							</button>
						))}
					</div>
					<div className="flex-1" />
					<div className="grid w-full grid-cols-2 gap-2 px-2">
						{REMOTE_SERVICES.map(({ key }) => {
							const name = serviceName(key)
							const b = BRAND[key]
							const mask = `url("${b.src}") center / contain no-repeat`
							return (
								<button
									key={key}
									type="button"
									aria-pressed={activeService === name}
									aria-label={`Only ${name}`}
									title={`Only ${name}`}
									onClick={() =>
										dispatch({ type: "service-key", service: name })
									}
									className="remote-key remote-service flex h-10 items-center justify-center rounded-full"
								>
									{/* Quoted: small SVGs are inlined as data URLs, which break an unquoted url(). */}
									<span
										aria-hidden
										className="block h-[52%]"
										style={{
											width: b.w,
											background: b.ink,
											WebkitMask: mask,
											mask,
										}}
									/>
								</button>
							)
						})}
					</div>
				</div>
				<div className="flex-1" />
				<img src={gwLogo} alt="" className="mb-2 h-7 opacity-20" />
			</div>
		</section>
	)
}

function WideKey({
	d,
	label,
	pressed,
	onClick,
}: { d: string; label: string; pressed?: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			onClick={onClick}
			className="remote-key flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[12px] font-semibold uppercase tracking-wider"
		>
			<Icon d={d} className="h-[18px] w-[18px]" />
			{label}
		</button>
	)
}

function Lcd({ lines: [head, line] }: { lines: [string, string] }) {
	return (
		<div className="remote-lcd relative h-[64px] w-full overflow-hidden rounded-[16px] px-4 py-2.5">
			<div
				className="lcd-font truncate text-[24px] leading-none text-[var(--lcd)]"
				aria-live="polite"
			>
				{head}
			</div>
			<div className="mt-2 truncate text-[11px] text-[var(--lcd)] opacity-80">
				{line}
			</div>
			<div className="pointer-events-none absolute inset-0 rounded-[16px] bg-[linear-gradient(160deg,rgba(255,255,255,0.10)_0%,transparent_35%)]" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The D-pad wheel. The ring doesn't move: the arrow in the direction you move lights up briefly. Dragging
// around the ring and scrolling step too; the four arrows and OK work as buttons.

const STEP_DEG = 30
const SIZE = 196
type Dir = "top" | "bottom" | "left" | "right"

const GLOW_AT: Record<Dir, string> = {
	top: "left-1/2 -translate-x-1/2 top-0.5",
	bottom: "left-1/2 -translate-x-1/2 bottom-0.5",
	left: "top-1/2 -translate-y-1/2 left-0.5",
	right: "top-1/2 -translate-y-1/2 right-0.5",
}
const ARROW: Record<Dir, string> = {
	top: "M6 15l6-6 6 6",
	bottom: "M6 9l6 6 6-6",
	left: "M15 6l-6 6 6 6",
	right: "M9 6l6 6-6 6",
}
const ARROW_AT: Record<Dir, string> = {
	top: "left-1/2 top-3 -translate-x-1/2",
	bottom: "bottom-3 left-1/2 -translate-x-1/2",
	left: "left-3 top-1/2 -translate-y-1/2",
	right: "right-3 top-1/2 -translate-y-1/2",
}
const ARROW_LABEL: Record<Dir, string> = {
	top: "Up",
	bottom: "Down",
	left: "Previous",
	right: "Next",
}

function Wheel({
	dispatch,
	onOk,
}: { dispatch: (action: TvAction) => void; onOk: () => void }) {
	const ref = useRef<HTMLDivElement>(null)
	const drag = useRef<{ angle: number; acc: number } | null>(null)
	const [flash, setFlash] = useState<{ dir: Dir; n: number } | null>(null)
	const latest = useRef(dispatch)
	latest.current = dispatch

	const turn = (by: 1 | -1, dir: Dir = by > 0 ? "right" : "left") => {
		setFlash((f) => ({ dir, n: (f?.n ?? 0) + 1 }))
		latest.current({ type: "step", by })
	}
	const turnRef = useRef(turn)
	turnRef.current = turn

	const angle = (e: { clientX: number; clientY: number }) => {
		const b = (ref.current as HTMLDivElement).getBoundingClientRect()
		return (
			(Math.atan2(
				e.clientY - (b.top + b.height / 2),
				e.clientX - (b.left + b.width / 2),
			) *
				180) /
			Math.PI
		)
	}

	// Scrolling over the wheel steps; a passive listener couldn't stop the page from scrolling.
	useEffect(() => {
		const el = ref.current
		if (!el) return
		let acc = 0
		const onWheel = (e: WheelEvent) => {
			e.preventDefault()
			acc += e.deltaY
			if (Math.abs(acc) >= 40) {
				const by = acc > 0 ? 1 : -1
				acc = 0
				turnRef.current(by)
			}
		}
		el.addEventListener("wheel", onWheel, { passive: false })
		return () => el.removeEventListener("wheel", onWheel)
	}, [])

	useEffect(() => {
		if (!flash) return
		const id = setTimeout(() => setFlash(null), 260)
		return () => clearTimeout(id)
	}, [flash])

	return (
		<div
			ref={ref}
			className="remote-wheel relative touch-none rounded-full"
			style={{ width: SIZE, height: SIZE }}
			onPointerDown={(e) => {
				if ((e.target as HTMLElement).closest("button")) return
				e.currentTarget.setPointerCapture(e.pointerId)
				drag.current = { angle: angle(e), acc: 0 }
			}}
			onPointerMove={(e) => {
				const d = drag.current
				if (!d) return
				const a = angle(e)
				let delta = a - d.angle
				if (delta > 180) delta -= 360
				if (delta < -180) delta += 360
				d.angle = a
				d.acc += delta
				while (Math.abs(d.acc) >= STEP_DEG) {
					const by = d.acc > 0 ? 1 : -1
					d.acc -= by * STEP_DEG
					turn(by)
				}
			}}
			onPointerUp={() => {
				drag.current = null
			}}
			onPointerCancel={() => {
				drag.current = null
			}}
			title="Wheel: drag around or scroll to step"
		>
			{(Object.keys(GLOW_AT) as Dir[]).map((dir) => (
				<span
					key={dir}
					aria-hidden
					className={`remote-glow pointer-events-none absolute ${GLOW_AT[dir]} h-12 w-12 rounded-full transition-opacity duration-200`}
					style={{ opacity: flash?.dir === dir ? 1 : 0 }}
				/>
			))}
			<div className="remote-face pointer-events-none absolute inset-[12px] rounded-full" />
			{(Object.keys(ARROW) as Dir[]).map((dir) => (
				<ArrowKey
					key={dir}
					dir={dir}
					onClick={() => turn(dir === "top" || dir === "left" ? -1 : 1, dir)}
				/>
			))}
			<button
				type="button"
				onClick={onOk}
				className="remote-ok absolute left-1/2 top-1/2 flex h-[40%] w-[40%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[13px] font-bold tracking-wider text-white/85 transition-transform active:scale-95"
			>
				OK
			</button>
		</div>
	)
}

function ArrowKey({
	dir,
	onClick,
}: { dir: Dir; onClick: () => void }): ReactNode {
	return (
		<button
			type="button"
			aria-label={ARROW_LABEL[dir]}
			title={ARROW_LABEL[dir]}
			onClick={onClick}
			className={`remote-arrow absolute ${ARROW_AT[dir]} flex h-9 w-9 items-center justify-center rounded-full text-white/55 transition hover:text-white active:scale-90`}
		>
			<svg
				viewBox="0 0 24 24"
				className="h-4 w-4"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.6"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d={ARROW[dir]} />
			</svg>
		</button>
	)
}
