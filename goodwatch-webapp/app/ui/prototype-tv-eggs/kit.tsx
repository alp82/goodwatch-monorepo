// PROTOTYPE - throwaway (TV easter eggs, round 2, 2026-10-29). The simplified TV: the room, one screen, and a
// Remote in the hand with Power, CH+, CH-, OK and two streaming keys. Every page draws its screen inside `Scene`.
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
		const top = Math.max(12, h * 0.025)
		const scale = Math.max(0.55, Math.min(0.8, h / 1150))
		const remoteH = REMOTE_H * scale
		const aspect = P.tv.w / P.tv.h
		const tvW = Math.min(w * 0.9, Math.max(200, h - top - 8 - remoteH + 18) * aspect)
		const tvH = tvW / aspect
		const tv = { left: (w - tvW) / 2, top, width: tvW, height: tvH }
		const s = tvW / P.tv.w
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

export function Scene({
	screen,
	remote,
	power = "on",
	dimRoom = 0,
	heading,
	msg,
}: {
	screen: ReactNode
	/** The Remote's body; the scene puts it in the hand. */
	remote?: ReactNode
	/** "off" plays the tube switching off once; "on" after "off" plays it switching on. */
	power?: "on" | "off"
	/** Darkens the room around the TV, 0..1 (lamps off after sign-out). */
	dimRoom?: number
	/** The page's H1, for screen readers and crawlers; everything a person reads is on the TV. */
	heading: string
	/** A short answer to a press, shown on the screen (prototype stand-in for navigating). */
	msg?: string | null
}) {
	const { ref, layout: L } = useLayout()
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
					<div className="egg-dim" style={{ opacity: dimRoom }} />
					<div className={`egg-screen ${power === "off" ? "egg-off" : wasOff ? "egg-on" : ""}`} style={px(L.tv)}>
						<div className="egg-screen-inner">
							{screen}
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
	powerLabel,
	okLabel = "OK",
	pulse,
	services,
	openService,
	onService,
}: {
	press: (key: Key) => void
	enabled?: Key[]
	/** The word printed beside Power, for pages where Power is the one key that matters. */
	powerLabel?: string
	okLabel?: string
	/** The key that pulses to invite a press. */
	pulse?: Key
	/** Whether the streaming keys work on this page. */
	services?: boolean
	openService?: ServiceKey | null
	onService?: (k: ServiceKey) => void
}) {
	const on = (k: Key) => enabled.includes(k)
	return (
		<section aria-label="Remote control" className="remote-body relative flex select-none flex-col px-6 pb-6 pt-5" style={{ height: REMOTE_H }}>
			<div className="flex w-full items-center justify-between">
				<button
					type="button"
					aria-label="Power"
					disabled={!on("power")}
					onClick={() => press("power")}
					className={`remote-key flex h-14 w-14 items-center justify-center rounded-full text-rose-400 disabled:opacity-30 ${pulse === "power" ? "egg-pulse" : ""}`}
				>
					<Icon d={ICON.power} className="h-6 w-6" />
				</button>
				{powerLabel ? (
					<span className="max-w-[170px] text-right text-[13px] font-semibold uppercase leading-tight tracking-[0.1em] text-white/60">{powerLabel}</span>
				) : (
					<div className="h-2 w-20 rounded-full bg-black/70" aria-hidden />
				)}
			</div>
			<div className="mt-9 flex items-center justify-between px-2">
				<div className="flex flex-col items-center gap-2">
					<div className="egg-rocker flex h-[212px] w-[84px] flex-col overflow-hidden rounded-full">
						<button
							type="button"
							aria-label="Next channel"
							disabled={!on("up")}
							onClick={() => press("up")}
							className={`flex flex-1 items-center justify-center text-[40px] font-bold leading-none ${pulse === "up" ? "egg-pulse" : ""}`}
						>
							+
						</button>
						<div className="mx-auto h-px w-10 bg-black/50" />
						<button
							type="button"
							aria-label="Previous channel"
							disabled={!on("down")}
							onClick={() => press("down")}
							className="flex flex-1 items-center justify-center text-[40px] font-bold leading-none"
						>
							−
						</button>
					</div>
					<span aria-hidden className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/60">
						Channel
					</span>
				</div>
				<div className="flex flex-col items-center gap-2">
					<button
						type="button"
						disabled={!on("ok")}
						onClick={() => press("ok")}
						className={`remote-ok flex h-[118px] w-[118px] items-center justify-center rounded-full text-[22px] font-bold tracking-wider text-white/85 transition-transform active:scale-95 disabled:opacity-30 ${pulse === "ok" ? "egg-pulse" : ""}`}
					>
						{okLabel}
					</button>
					<span aria-hidden className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/0">
						.
					</span>
				</div>
			</div>
			<div className="mt-9 grid grid-cols-2 gap-3 px-[7px]">
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
			<div className="flex-1" />
			<img {...whiteMark()} alt="" className="mx-auto mb-2 h-7 opacity-20" />
		</section>
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
			latest.current(key)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])
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
