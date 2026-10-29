// The little living room: the old start page's room photo with one TV on it, and a Remote in the hand under it with
// Power, a channel rocker, OK, and the Netflix and Prime Video keys. The 404, error and signed-out pages draw their
// screen in it (NotFoundTv, ErrorTv, SignedOutTv). Power works the same on every page: the tube switches off and the
// lamps go down, and back on. Nothing on the screen explains the Remote: people find it or they don't (the owner).
//
// It draws in the browser only: the layout needs the window's size, and the static is drawn on a canvas.
import "./tv-egg.css"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { whiteMark } from "~/ui/brand/white-mark"
import { ICON, Icon, ServiceMark } from "~/ui/living-room/Remote"
import { HAND_IMAGE } from "~/ui/living-room/room"
import { PHONE_ROOM_ART, ROOM_ART } from "~/ui/living-room/tv/room-art"
import { REMOTE_H, REMOTE_REST_TRANSFORM, REMOTE_W, REMOTE_WRIST } from "~/ui/living-room/tv/room-layout"
import { assetUrl } from "~/utils/asset-url"
import { goodwatchScoreDisplay, goodwatchVibeIndex, hasGoodwatchScore } from "~/utils/ratings"
import { type Box, type EggLayout, layoutEgg } from "./layout"

/** The site header's height: the scene fills the window under it. */
const HEADER = 64

export type Key = "power" | "up" | "down" | "ok"

function useLayout() {
	const ref = useRef<HTMLDivElement>(null)
	const [layout, setLayout] = useState<EggLayout | null>(null)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		// The window's height, not the scene's: the scene grows to the layout's height where the window is short.
		const measure = () => setLayout(layoutEgg(el.clientWidth, window.innerHeight - HEADER))
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(el)
		window.addEventListener("resize", measure)
		return () => {
			observer.disconnect()
			window.removeEventListener("resize", measure)
		}
	}, [])
	return { ref, layout }
}

/** The TV's power: Power switches it off (the tube, the lamps down) and back on. */
export function useTvPower(initial = true) {
	const [on, setOn] = useState(initial)
	return { on, setOn, toggle: () => setOn((value) => !value), power: (on ? "on" : "off") as "on" | "off" }
}

const px = (b: Box) => ({ left: b.left, top: b.top, width: b.width, height: b.height })

export function Room({
	screen,
	remote,
	power = "on",
}: {
	screen: ReactNode
	/** The Remote's body; the room puts it in the hand. */
	remote: ReactNode
	/** "off" plays the tube switching off and dims the room; "on" after "off" plays it switching on. */
	power?: "on" | "off"
}) {
	const { ref, layout: L } = useLayout()
	// While the tube switches off it keeps the last picture it showed: a page whose screen changes with Power (the
	// signed-out page's sign-in card) shows the change only when the set is back on.
	const lastOn = useRef<ReactNode>(screen)
	if (power === "on") lastOn.current = screen
	const [wasOff, setWasOff] = useState(false)
	useEffect(() => {
		if (power === "off") setWasOff(true)
	}, [power])
	return (
		<div ref={ref} className="tve-scene" style={{ height: L ? L.height : `calc(100svh - ${HEADER}px)` }}>
			{L && (
				<>
					<picture>
						<source type="image/avif" srcSet={assetUrl((L.phone ? PHONE_ROOM_ART : ROOM_ART).avif)} />
						<img
							src={assetUrl((L.phone ? PHONE_ROOM_ART : ROOM_ART).webp)}
							alt=""
							className="tve-photo"
							style={px(L.photo)}
							draggable={false}
						/>
					</picture>
					<div
						className="absolute"
						style={{
							left: L.remote.left,
							top: L.remote.top,
							width: REMOTE_W * L.remote.scale,
							height: REMOTE_H * L.remote.scale,
							transformOrigin: `50% ${REMOTE_WRIST * 100}%`,
							transform: REMOTE_REST_TRANSFORM,
						}}
					>
						<picture>
							<source type="image/avif" srcSet={assetUrl(HAND_IMAGE.avif)} />
							<img
								src={assetUrl(HAND_IMAGE.webp)}
								alt=""
								className="pointer-events-none absolute max-w-none select-none"
								style={px(L.hand)}
								draggable={false}
							/>
						</picture>
						<div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${L.remote.scale})` }}>
							{remote}
						</div>
					</div>
					{/* Lamps down while the set is off: the room and the hand darken, the TV keeps its own dark. */}
					<div className="tve-dim" style={{ opacity: power === "off" ? 0.6 : 0 }} />
					<div className={`tve-screen ${power === "off" ? "tve-off" : wasOff ? "tve-on" : ""}`} style={px(L.tv)}>
						{/* Off, the last picture stays for the tube's animation but is out of reach: no focus, not read out. */}
						<div className="tve-screen-inner" aria-hidden={power === "off" || undefined} {...(power === "off" ? { inert: "" } : {})}>
							{power === "on" ? screen : lastOn.current}
						</div>
						{power === "off" && <div className="tve-dot" />}
					</div>
				</>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The Remote: the old start page's body and size, so the hand holds it. The signal light over Power flashes on
// every press; the channel rocker and a tall OK stand side by side as two pills of one size (the owner's pick).

export type ServiceKey = "netflix" | "prime"
export const SERVICE_KEYS: readonly { key: ServiceKey; id: number; name: string }[] = [
	{ key: "netflix", id: 8, name: "Netflix" },
	{ key: "prime", id: 9, name: "Prime Video" },
]

const KEY_EVENT = "tve-remote-key"

export function Remote({
	press,
	enabled = ["power", "up", "down", "ok"],
	off,
	pulse,
	services,
	openService,
	onService,
}: {
	press: (key: Key) => void
	/** The keys this page uses; the others show dimmed. */
	enabled?: Key[]
	/** The set is off: only Power works, and it pulses. */
	off?: boolean
	/** A key that pulses to invite a press. */
	pulse?: Key
	/** Whether the streaming keys work on this page. */
	services?: boolean
	openService?: ServiceKey | null
	onService?: (key: ServiceKey) => void
}) {
	const on = (key: Key) => (off ? key === "power" : enabled.includes(key))
	const invite = off ? "power" : pulse
	const [blink, setBlink] = useState(0)
	useEffect(() => {
		const flash = () => setBlink((n) => n + 1)
		window.addEventListener(KEY_EVENT, flash)
		return () => window.removeEventListener(KEY_EVENT, flash)
	}, [])
	const key = (k: Key, label: string, className: string, children: ReactNode) => (
		<button
			type="button"
			aria-label={label}
			disabled={!on(k)}
			onClick={() => press(k)}
			className={`${className} ${invite === k ? "tve-pulse" : ""}`}
		>
			{children}
		</button>
	)
	return (
		<section
			aria-label="Remote control"
			className="tve-body relative flex select-none flex-col px-6 pb-6 pt-5"
			style={{ height: REMOTE_H }}
			onPointerDownCapture={(e) => {
				if ((e.target as HTMLElement).closest("button:not(:disabled)")) setBlink((n) => n + 1)
			}}
			onKeyDownCapture={(e) => {
				if (e.key === "Enter" || e.key === " ") setBlink((n) => n + 1)
			}}
		>
			<div className="flex flex-col items-center">
				<span aria-hidden className="relative h-3 w-3 rounded-full bg-[#3a1512] shadow-[inset_0_1px_2px_rgba(0,0,0,.8)]">
					{blink > 0 && <span key={blink} className="tve-led absolute inset-0 rounded-full bg-red-500" />}
				</span>
				{key(
					"power",
					"Power",
					"tve-key mt-3 flex h-14 w-14 items-center justify-center rounded-full text-rose-400 disabled:opacity-30",
					<Icon d={ICON.power} className="h-6 w-6" />,
				)}
			</div>
			<div className="flex flex-1 items-center justify-center gap-6">
				<div className="tve-rocker flex h-[212px] w-[84px] flex-col overflow-hidden rounded-full">
					{key("up", "Next channel", "flex flex-1 items-center justify-center text-[40px] font-bold leading-none", "+")}
					<div className="mx-auto h-px w-10 bg-black/50" />
					{key("down", "Previous channel", "flex flex-1 items-center justify-center text-[40px] font-bold leading-none", "−")}
				</div>
				{key(
					"ok",
					"OK",
					"tve-ok flex h-[212px] w-[84px] items-center justify-center rounded-full text-[20px] font-bold tracking-wider text-white/85 transition-transform active:scale-95 disabled:opacity-30",
					"OK",
				)}
			</div>
			<div className="grid grid-cols-2 gap-3 px-[7px]">
				{SERVICE_KEYS.map((service) => (
					<button
						key={service.key}
						type="button"
						disabled={!services || off}
						aria-pressed={openService === service.key}
						aria-label={`On ${service.name}`}
						title={`On ${service.name}`}
						onClick={() => onService?.(service.key)}
						className="tve-key tve-service flex h-[52px] min-w-0 items-center justify-center rounded-full px-3 disabled:opacity-30"
					>
						<ServiceMark service={{ id: service.id, name: service.name, logo_path: null }} height={32} onKey={1} />
					</button>
				))}
			</div>
			<img {...whiteMark()} alt="" className="mx-auto mb-1 mt-10 h-7 opacity-20" />
		</section>
	)
}

/** The keyboard as the Remote: ↑ next channel, ↓ previous, Enter OK, P power. */
export function useRemoteKeys(press: (key: Key) => void) {
	const latest = useRef(press)
	latest.current = press
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return
			const target = e.target as HTMLElement
			if (target.closest("input, textarea, select, [contenteditable], [role='dialog']")) return
			if (e.key === "Enter" && target.closest("button, a")) return
			const key: Key | null =
				e.key === "ArrowUp"
					? "up"
					: e.key === "ArrowDown"
						? "down"
						: e.key === "Enter"
							? "ok"
							: e.key === "p" || e.key === "P"
								? "power"
								: null
			if (!key) return
			e.preventDefault()
			window.dispatchEvent(new Event(KEY_EVENT))
			latest.current(key)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])
}

// ---------------------------------------------------------------------------------------------------------
// Screen parts, sized in the screen's own units (cqw, cqh) so they fit any TV.

let noiseUrl: string | null = null
/** A tile of dim grain, drawn once per page. */
function noise(): string {
	if (noiseUrl) return noiseUrl
	const canvas = document.createElement("canvas")
	canvas.width = canvas.height = 180
	const context = canvas.getContext("2d")
	if (!context) return ""
	const image = context.createImageData(180, 180)
	for (let i = 0; i < image.data.length; i += 4) {
		const value = 20 + Math.random() * 90
		image.data[i] = image.data[i + 1] = image.data[i + 2] = value
		image.data[i + 3] = 255
	}
	context.putImageData(image, 0, 0)
	noiseUrl = canvas.toDataURL()
	return noiseUrl
}

/** Static: calm grain at rest, or one flash (`flash` changes on every channel change). */
export function Static({ opacity = 1, flash }: { opacity?: number; flash?: number }) {
	const [url, setUrl] = useState<string | null>(null)
	useEffect(() => setUrl(noise()), [])
	if (!url) return <div className="absolute inset-0 bg-neutral-800" style={{ opacity }} />
	return (
		<div
			key={flash}
			className={`pointer-events-none absolute inset-0 overflow-hidden ${flash != null ? "tve-flash" : ""}`}
			style={{ opacity }}
		>
			<div className={`tve-static ${flash != null ? "" : "tve-static-calm"}`} style={{ backgroundImage: `url(${url})` }} />
		</div>
	)
}

/** The channel number in the corner, like a set's on-screen display: the same on CH 404 and on every title. */
export function ChannelNumber({ n, label }: { n: number; label: string }) {
	return (
		<div
			key={n}
			className="tve-fade-in absolute right-[3cqw] top-[3cqh] text-right font-mono text-[5cqw] font-bold leading-none text-lime-300 [text-shadow:0_0_1cqw_rgba(0,0,0,.9)]"
		>
			CH {n}
			<div className="mt-[0.8cqh] font-sans text-[1.8cqw] font-semibold uppercase tracking-[0.12em] text-white/80">{label}</div>
		</div>
	)
}

/** The site's score ring (details/hero/ScoreRing), sized in screen units. */
export function Ring({ score, size }: { score: number | null; size: string }) {
	const shown = hasGoodwatchScore(score) ? goodwatchScoreDisplay(score) : null
	const vibe = hasGoodwatchScore(score) ? goodwatchVibeIndex(score) : null
	const r = 44
	const c = 2 * Math.PI * r
	return (
		<span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
			<svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
				<circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="10" />
				{shown != null && (
					<circle
						cx="50"
						cy="50"
						r={r}
						fill="none"
						stroke={`var(--color-vibe-${vibe})`}
						strokeWidth="10"
						strokeLinecap="round"
						strokeDasharray={`${(shown / 100) * c} ${c}`}
					/>
				)}
			</svg>
			<span className="absolute inset-0 flex items-center justify-center font-bold tabular-nums" style={{ fontSize: `calc(${size} * 0.38)` }}>
				{shown ?? "–"}
			</span>
		</span>
	)
}

export function Wordmark({ size }: { size: string }) {
	return <GoodWatchG height={size} />
}
