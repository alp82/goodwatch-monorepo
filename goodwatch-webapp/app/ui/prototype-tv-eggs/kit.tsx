// PROTOTYPE - throwaway (TV easter eggs, round 2, 2026-10-29). The simplified TV: the room, one screen, and a
// Remote in the hand with Power, CH+, CH-, OK and two streaming keys. Every page draws its screen inside `Scene`.
import { useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { whiteMark } from "~/ui/brand/white-mark"
import { ICON, Icon, ServiceMark } from "~/ui/living-room/Remote"
import { HAND_IMAGE } from "~/ui/living-room/room"
import { PHONE_ROOM_ART, ROOM_ART } from "~/ui/living-room/tv/room-art"
import {
	HAND,
	PHONE_BELOW,
	PHONE_ROOM_PHOTO,
	REMOTE_H,
	ROOM_PHOTO,
	REMOTE_REST_TRANSFORM,
	REMOTE_W,
	REMOTE_WRIST,
} from "~/ui/living-room/tv/room-layout"
import { assetUrl } from "~/utils/asset-url"
import { goodwatchScoreDisplay, goodwatchVibeIndex, hasGoodwatchScore } from "~/utils/ratings"
import TITLES from "./titles.json"

export type Title = (typeof TITLES)[number]
export const titles: Title[] = TITLES
export const backdrop = (t: Title, size = "w1280") => `https://image.tmdb.org/t/p/${size}${t.backdrop}`
export const poster = (t: Title, size = "w342") => `https://image.tmdb.org/t/p/${size}${t.poster}`
export const titleHref = (t: Title) => `https://goodwatch.app/${t.type === "movie" ? "movie" : "show"}/${t.id}`
/** The prototype runs offline: titles open on the live site in a new tab. */
export const openTitle = (t: Title) => window.open(titleHref(t), "_blank", "noopener")
export const score = (t: Title) => (hasGoodwatchScore(t.score) ? goodwatchScoreDisplay(t.score) : null)

export type Key = "power" | "up" | "down" | "ok"

// ---------------------------------------------------------------------------------------------------------
// The room and its TV. The scene fills the window under the site's header. On a desktop the old start page's
// TV sits on the room photo as on the old start page, with the Remote in the hand under it, the Remote sized first;
// on a phone the portrait room covers the scene from the top and the Remote rises from the bottom edge.

const HEADER = 64
const WRIST = `50% ${REMOTE_WRIST * 100}%`

type Box = { left: number; top: number; width: number; height: number }
type Layout = { photo: Box; tv: Box; remote: { left: number; top: number; scale: number }; hand: Box; phone: boolean }

const handFor = (scale: number): Box => {
	const k = (REMOTE_W * scale) / HAND.pw
	return {
		left: (REMOTE_W * scale) / 2 - (HAND.x + HAND.pw / 2) * k,
		top: REMOTE_H * scale - (HAND.y + HAND.ph) * k,
		width: HAND.w * k,
		height: HAND.h * k,
	}
}

/** The phone's bottom bar (MobileDock) covers this much of the scene's foot. */
const PHONE_DOCK = 84

function layoutFor(w: number, h: number): Layout {
	if (w >= PHONE_BELOW) {
		// The Remote first (the owner, round 2: bigger), then the TV as large as the rest allows; the Remote's top
		// reaches a little over the picture's bottom edge, as on the old start page.
		const P = ROOM_PHOTO
		// The room shows around the TV (the owner, round 3: "I want to see more of the room").
		const top = Math.max(16, h * 0.06)
		const scale = Math.max(0.55, Math.min(0.8, h / 1150))
		const remoteH = REMOTE_H * scale
		const aspect = P.tv.w / P.tv.h
		const want = Math.min(w * 0.4, h * 0.36 * aspect, Math.max(200, h - top - 8 - remoteH + 18) * aspect)
		// Never so small that the photo stops covering the scene: it scales with the TV.
		const s = Math.max(want / P.tv.w, w / (P.w - 2), (h - top) / (P.h - P.tv.y - 2), top / P.tv.y)
		const tvW = P.tv.w * s
		const tvH = tvW / aspect
		const tv = { left: (w - tvW) / 2, top, width: tvW, height: tvH }
		const photo = { left: tv.left - P.tv.x * s, top: tv.top - P.tv.y * s, width: P.w * s, height: P.h * s }
		const remote = { left: w / 2 - (REMOTE_W * scale) / 2, top: h - 8 - remoteH, scale }
		return { photo, tv, remote, hand: handFor(scale), phone: false }
	}
	const P = PHONE_ROOM_PHOTO
	const c = Math.max(w / P.w, h / P.h)
	const photo = { left: (w - P.w * c) / 2, top: 0, width: P.w * c, height: P.h * c }
	const tv = { left: photo.left + P.tv.x * c, top: P.tv.y * c, width: P.tv.w * c, height: P.tv.h * c }
	const scale = Math.min(0.72, (w * 0.56) / REMOTE_W)
	// Down to the streaming keys (they end 522 of the Remote's 610 px down) above the bottom bar.
	const remote = { left: w / 2 - (REMOTE_W * scale) / 2, top: Math.max(tv.top + tv.height + 24, h - PHONE_DOCK - 8 - 530 * scale), scale }
	return { photo, tv, remote, hand: handFor(scale), phone: true }
}

function useLayout() {
	const ref = useRef<HTMLDivElement>(null)
	const [layout, setLayout] = useState<Layout | null>(null)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const measure = () => setLayout(layoutFor(el.clientWidth, el.clientHeight))
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	return { ref, layout }
}

/** The TV's power, the same on every page: Power switches it off (the tube, the lamps down) and back on. */
export function useTvPower(initial = true) {
	const [on, setOn] = useState(initial)
	return { on, toggle: () => setOn((v) => !v), setOn, power: (on ? "on" : "off") as "on" | "off" }
}

export function Scene({
	screen,
	remote,
	power = "on",
	dimRoom,
	heading,
	msg,
}: {
	screen: ReactNode
	/** The Remote's body; the scene puts it in the hand. */
	remote?: ReactNode
	/** "off" plays the tube switching off once; "on" after "off" plays it switching on. */
	power?: "on" | "off"
	/** Darkens the room around the TV, 0..1; by default the lamps go down while the TV is off. */
	dimRoom?: number
	/** The page's H1, for screen readers and crawlers; everything a person reads is on the TV. */
	heading: string
	/** A short answer to a press, shown on the screen (prototype stand-in for navigating). */
	msg?: string | null
}) {
	const { ref, layout: L } = useLayout()
	// While the tube switches off it keeps the last picture it showed: a page that changes its screen on Power off
	// (sign-out's Welcome back) shows the change only when the set comes back on.
	const lastOn = useRef<ReactNode>(screen)
	if (power === "on") lastOn.current = screen
	const [wasOff, setWasOff] = useState(false)
	useEffect(() => {
		if (power === "off") setWasOff(true)
	}, [power])
	const px = (b: Box) => ({ left: b.left, top: b.top, width: b.width, height: b.height })
	return (
		<div ref={ref} className="living-room egg-scene" style={{ height: `calc(100svh - ${HEADER}px)` }}>
			<h1 className="sr-only">{heading}</h1>
			{L && (
				<>
					<picture>
						{L.phone ? (
							<>
								<source type="image/avif" srcSet={assetUrl(PHONE_ROOM_ART.avif)} />
								<img src={assetUrl(PHONE_ROOM_ART.webp)} alt="" className="egg-photo" style={px(L.photo)} draggable={false} />
							</>
						) : (
							<>
								<source type="image/avif" srcSet={assetUrl(ROOM_ART.avif)} />
								<img src={assetUrl(ROOM_ART.webp)} alt="" className="egg-photo" style={px(L.photo)} draggable={false} />
							</>
						)}
					</picture>
					{remote && (
						<div
							className="absolute"
							style={{
								left: L.remote.left,
								top: L.remote.top,
								width: REMOTE_W * L.remote.scale,
								height: REMOTE_H * L.remote.scale,
								transformOrigin: WRIST,
								transform: REMOTE_REST_TRANSFORM,
							}}
						>
							<picture>
								<source type="image/avif" srcSet={assetUrl(HAND_IMAGE.avif)} />
								<img src={assetUrl(HAND_IMAGE.webp)} alt="" className="pointer-events-none absolute max-w-none select-none" style={px(L.hand)} draggable={false} />
							</picture>
							<div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${L.remote.scale})` }}>
								{remote}
							</div>
						</div>
					)}
					{/* Lamps off: the room and the hand darken, the TV stays as it is. */}
					<div className="egg-dim" style={{ opacity: dimRoom ?? (power === "off" ? 0.6 : 0) }} />
					<div className={`egg-screen ${power === "off" ? "egg-off" : wasOff ? "egg-on" : ""}`} style={px(L.tv)}>
						<div className="egg-screen-inner">
							{power === "on" ? screen : lastOn.current}
							<Toast msg={msg ?? null} />
						</div>
						{power === "off" && <div className="egg-dot" />}
					</div>
				</>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The Remote, at the old Remote's size so the hand holds it: Power, a channel rocker, OK, and the two streaming
// keys (Netflix, Prime Video). Keys a page doesn't use are dimmed.

export type ServiceKey = "netflix" | "prime"
const SERVICE_KEYS: { key: ServiceKey; id: number; name: string; catalog: string }[] = [
	{ key: "netflix", id: 8, name: "Netflix", catalog: "Netflix" },
	{ key: "prime", id: 9, name: "Prime Video", catalog: "Amazon Prime Video" },
]
export const serviceCatalogName = (k: ServiceKey) => SERVICE_KEYS.find((s) => s.key === k)?.catalog as string
export const serviceName = (k: ServiceKey) => SERVICE_KEYS.find((s) => s.key === k)?.name as string

export function BigRemote({
	press,
	enabled = ["power", "up", "down", "ok"],
	pulse,
	off,
	services,
	openService,
	onService,
}: {
	press: (key: Key) => void
	enabled?: Key[]
	/** The TV is off: only Power works, and it invites a press. */
	off?: boolean
	/** The key that pulses to invite a press. */
	pulse?: Key
	/** Whether the streaming keys work on this page. */
	services?: boolean
	openService?: ServiceKey | null
	onService?: (k: ServiceKey) => void
}) {
	const on = (k: Key) => (off ? k === "power" : enabled.includes(k))
	if (off) pulse = "power"
	const [params] = useSearchParams()
	const layout = params.get("variant") ?? "a"
	// The signal light flashes on every press.
	const [blink, setBlink] = useState(0)
	return (
		<section
			aria-label="Remote control"
			className="remote-body relative flex select-none flex-col px-6 pb-6 pt-5"
			style={{ height: REMOTE_H }}
			onPointerDownCapture={(e) => {
				if ((e.target as HTMLElement).closest("button:not(:disabled)")) setBlink((n) => n + 1)
			}}
			onKeyDownCapture={(e) => {
				if (e.key === "Enter" || e.key === " ") setBlink((n) => n + 1)
			}}
		>
			<RemoteKeyBlink onKey={() => setBlink((n) => n + 1)} />
			{/* Top: the signal light over Power, both on the centre line. */}
			<div className="flex flex-col items-center">
				<span aria-hidden className="relative h-3 w-3 rounded-full bg-[#3a1512] shadow-[inset_0_1px_2px_rgba(0,0,0,.8)]">
					{blink > 0 && <span key={blink} className="egg-led absolute inset-0 rounded-full bg-red-500" />}
				</span>
				<button
					type="button"
					aria-label="Power"
					disabled={!on("power")}
					onClick={() => press("power")}
					className={`remote-key mt-3 flex h-14 w-14 items-center justify-center rounded-full text-rose-400 disabled:opacity-30 ${pulse === "power" ? "egg-pulse" : ""}`}
				>
					<Icon d={ICON.power} className="h-6 w-6" />
				</button>
			</div>
			<div className="flex flex-1 flex-col items-center justify-center">
				<Controls layout={layout} on={on} press={press} pulse={pulse} />
			</div>
			<div className="grid grid-cols-2 gap-3 px-[7px]">
				{SERVICE_KEYS.map((s) => (
					<button
						key={s.key}
						type="button"
						disabled={!services}
						aria-pressed={openService === s.key}
						aria-label={`On ${s.name}`}
						title={`On ${s.name}`}
						onClick={() => onService?.(s.key)}
						className="remote-key remote-service flex h-[52px] min-w-0 items-center justify-center rounded-full px-3 disabled:opacity-30"
					>
						<ServiceMark service={{ id: s.id, name: s.name, logo_path: null }} height={32} onKey={1} />
					</button>
				))}
			</div>
			<img {...whiteMark()} alt="" className="mx-auto mb-1 mt-10 h-7 opacity-20" />
		</section>
	)
}

export const REMOTE_VARIANTS: Record<string, string> = {
	a: "Remote: OK over a CH bar",
	b: "Remote: twin pills",
	c: "Remote: wheel",
	d: "Remote: − OK + row",
}

type ControlsProps = { layout: string; on: (k: Key) => boolean; press: (k: Key) => void; pulse?: Key }

const OK_CLASS =
	"remote-ok flex items-center justify-center rounded-full font-bold tracking-wider text-white/85 transition-transform active:scale-95 disabled:opacity-30"
const SIGN = "flex items-center justify-center text-[40px] font-bold leading-none disabled:opacity-30"

/** The channel keys and OK, laid out symmetrically about the Remote's centre line (round 6: four takes). */
function Controls({ layout, on, press, pulse }: ControlsProps) {
	const ok = (cls: string) => (
		<button type="button" disabled={!on("ok")} onClick={() => press("ok")} className={`${OK_CLASS} ${cls} ${pulse === "ok" ? "egg-pulse" : ""}`}>
			OK
		</button>
	)
	const plus = (cls: string) => (
		<button type="button" aria-label="Next channel" disabled={!on("up")} onClick={() => press("up")} className={`${SIGN} ${cls} ${pulse === "up" ? "egg-pulse" : ""}`}>
			+
		</button>
	)
	const minus = (cls: string) => (
		<button type="button" aria-label="Previous channel" disabled={!on("down")} onClick={() => press("down")} className={`${SIGN} ${cls}`}>
			−
		</button>
	)
	// b. Two pills of the same size side by side: the channel rocker and a tall OK.
	if (layout === "b")
		return (
			<div className="flex items-center justify-center gap-6">
				<div className="egg-rocker flex h-[212px] w-[84px] flex-col overflow-hidden rounded-full">
					{plus("flex-1")}
					<div className="mx-auto h-px w-10 bg-black/50" />
					{minus("flex-1")}
				</div>
				{ok("h-[212px] w-[84px] text-[20px]")}
			</div>
		)
	// c. A wheel like the old Remote's: + on top, − at the bottom, OK in the middle.
	if (layout === "c")
		return (
			<div className="flex justify-center">
				<div className="remote-wheel relative h-[228px] w-[228px] rounded-full">
					<div className="remote-face pointer-events-none absolute inset-[14px] rounded-full" />
					{plus("remote-arrow absolute left-1/2 top-2 h-14 w-14 -translate-x-1/2 rounded-full text-white/70 hover:text-white")}
					{minus("remote-arrow absolute bottom-2 left-1/2 h-14 w-14 -translate-x-1/2 rounded-full text-white/70 hover:text-white")}
					<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{ok("h-[96px] w-[96px] text-[20px]")}</div>
				</div>
			</div>
		)
	// d. One row: − and + as round keys either side of a large OK.
	if (layout === "d")
		return (
			<div className="flex items-center justify-center gap-4">
				{minus("remote-key h-[68px] w-[68px] rounded-full")}
				{ok("h-[112px] w-[112px] text-[22px]")}
				{plus("remote-key h-[68px] w-[68px] rounded-full")}
			</div>
		)
	// a. OK on the centre line, a wide channel bar under it (− left, + right).
	return (
		<div className="flex flex-col items-center gap-6">
			{ok("h-[118px] w-[118px] text-[22px]")}
			<div className="egg-rocker flex h-[64px] w-[204px] items-stretch overflow-hidden rounded-full">
				{minus("flex-1")}
				<div className="my-auto h-8 w-px bg-black/50" />
				{plus("flex-1")}
			</div>
		</div>
	)
}

/** Keyboard: ↑ next channel, ↓ previous, Enter OK, P power. */
export function useRemoteKeys(press: (key: Key) => void) {
	const latest = useRef(press)
	latest.current = press
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const el = e.target as HTMLElement
			if (el.closest("input, textarea, [contenteditable]")) return
			if (e.key === "Enter" && el.closest("button, a")) return
			const key: Key | null =
				e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : e.key === "Enter" ? "ok" : e.key === "p" ? "power" : null
			if (!key) return
			e.preventDefault()
			window.dispatchEvent(new Event("egg-remote-key"))
			latest.current(key)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])
}

function RemoteKeyBlink({ onKey }: { onKey: () => void }) {
	const latest = useRef(onKey)
	latest.current = onKey
	useEffect(() => {
		const f = () => latest.current()
		window.addEventListener("egg-remote-key", f)
		return () => window.removeEventListener("egg-remote-key", f)
	}, [])
	return null
}

// ---------------------------------------------------------------------------------------------------------
// Screen parts

const noiseUrls: Record<string, string> = {}
function noise(calm = false): string {
	const id = calm ? "calm" : "loud"
	if (noiseUrls[id]) return noiseUrls[id]
	const c = document.createElement("canvas")
	c.width = c.height = 180
	const ctx = c.getContext("2d") as CanvasRenderingContext2D
	const img = ctx.createImageData(180, 180)
	for (let i = 0; i < img.data.length; i += 4) {
		const v = calm ? 20 + Math.random() * 90 : Math.random() * 255
		img.data[i] = img.data[i + 1] = img.data[i + 2] = v
		img.data[i + 3] = 255
	}
	ctx.putImageData(img, 0, 0)
	noiseUrls[id] = c.toDataURL()
	return noiseUrls[id]
}

/** Moving static. `flash` plays it once (a channel change) instead of looping. */
export function Static({ opacity = 1, flash, calm }: { opacity?: number; flash?: number; calm?: boolean }) {
	const [url, setUrl] = useState<string | null>(null)
	useEffect(() => setUrl(noise(calm)), [calm])
	if (!url) return <div className="absolute inset-0 bg-neutral-700" style={{ opacity }} />
	return (
		<div key={flash} className={`pointer-events-none absolute inset-0 overflow-hidden ${flash != null ? "egg-flash" : ""}`} style={{ opacity }}>
			<div className={`egg-static ${calm ? "egg-static-calm" : ""}`} style={{ backgroundImage: `url(${url})` }} />
		</div>
	)
}

/** A channel's picture: the backdrop, darkened at the bottom for the on-screen bar. */
export function Broadcast({ title, shade = true }: { title: Title; shade?: boolean }) {
	return (
		<div className="absolute inset-0">
			<img src={backdrop(title)} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
			{shade && <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />}
		</div>
	)
}

/** The small score ring of the site (details/hero/ScoreRing), sized in screen units. */
export function Ring({ t, size }: { t: Title; size: string }) {
	const s = score(t)
	const vibe = hasGoodwatchScore(t.score) ? goodwatchVibeIndex(t.score) : null
	const r = 44
	const c = 2 * Math.PI * r
	return (
		<span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
			<svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
				<circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="10" />
				{s != null && (
					<circle cx="50" cy="50" r={r} fill="none" stroke={`var(--color-vibe-${vibe})`} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(s / 100) * c} ${c}`} />
				)}
			</svg>
			<span className="absolute inset-0 flex items-center justify-center font-bold tabular-nums" style={{ fontSize: `calc(${size} * 0.38)` }}>
				{s ?? "–"}
			</span>
		</span>
	)
}

/** The channel number in the corner, like a set's on-screen display. */
export function ChannelNumber({ n, label }: { n: number; label?: string }) {
	return (
		<div key={n} className="egg-fade-in absolute right-[3cqw] top-[3cqh] text-right font-mono text-[5cqw] font-bold leading-none text-lime-300 [text-shadow:0_0_1cqw_rgba(0,0,0,.9)]">
			CH {n}
			{label && <div className="mt-[0.8cqh] font-sans text-[1.8cqw] font-semibold uppercase tracking-[0.12em] text-white/80">{label}</div>}
		</div>
	)
}

/** The bar at the foot of a channel: title, year, score, where it streams. */
export function InfoBar({ t, hint }: { t: Title; hint?: string }) {
	return (
		<div className="egg-fade-in absolute inset-x-[3cqw] bottom-[4cqh] flex items-end gap-[2cqw]">
			<Ring t={t} size="8cqw" />
			<div className="min-w-0 flex-1">
				<div className="truncate text-[4.2cqw] font-bold leading-tight">{t.title}</div>
				<div className="mt-[0.5cqh] truncate text-[2.1cqw] text-white/70">
					{[t.year, t.type === "movie" ? "Movie" : "Show", t.service].filter(Boolean).join(" · ")}
				</div>
			</div>
			{hint && <div className="shrink-0 rounded-[0.8cqw] bg-white/15 px-[1.4cqw] py-[0.8cqh] text-[1.8cqw] font-semibold text-white/85">{hint}</div>}
		</div>
	)
}

export function Wordmark({ size = "6cqw", color }: { size?: string; color?: string }) {
	return <GoodWatchG height={size} color={color} />
}

/** The kind of answer a fake press gives in the prototype: a short line in the corner. */
export function useToast(): [string | null, (s: string) => void] {
	const [msg, setMsg] = useState<string | null>(null)
	useEffect(() => {
		if (!msg) return
		const id = setTimeout(() => setMsg(null), 1800)
		return () => clearTimeout(id)
	}, [msg])
	return [msg, setMsg]
}

export function Toast({ msg }: { msg: string | null }) {
	if (!msg) return null
	return (
		<div className="egg-fade-in absolute left-1/2 top-[4cqh] -translate-x-1/2 rounded-full bg-black/75 px-[2cqw] py-[1cqh] text-[2cqw] font-semibold text-white">
			{msg}
		</div>
	)
}
