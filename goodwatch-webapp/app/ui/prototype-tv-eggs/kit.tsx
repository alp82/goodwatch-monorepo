// PROTOTYPE - throwaway (TV easter eggs, 2026-10-29). The simplified TV: the room photo, one screen, and a Remote
// with four keys (Power, CH+, CH-, OK). Every page of the prototype draws its screen inside `Scene`.
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { whiteMark } from "~/ui/brand/white-mark"
import { ICON, Icon } from "~/ui/living-room/Remote"
import { PHONE_ROOM, ROOM } from "~/ui/living-room/room"
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
// The room and its TV

export function Scene({
	screen,
	remote,
	power = "on",
	dimRoom = 0,
	below,
	msg,
}: {
	/** A short answer to a press, shown on the screen (prototype stand-in for navigating). */
	msg?: string | null
	screen: ReactNode
	remote?: ReactNode
	/** "off" plays the tube switching off once; "on" after "off" plays it switching on. */
	power?: "on" | "off"
	/** Darkens the room around the TV, 0..1 (lamps off after sign-out). */
	dimRoom?: number
	below?: ReactNode
}) {
	const [wasOff, setWasOff] = useState(false)
	useEffect(() => {
		if (power === "off") setWasOff(true)
	}, [power])
	return (
		<div className="living-room w-full">
			<div className="egg-stage">
				<picture>
					<source media="(max-width: 767px)" type="image/avif" srcSet={PHONE_ROOM.avif} />
					<source media="(max-width: 767px)" type="image/webp" srcSet={PHONE_ROOM.webp} />
					<source type="image/avif" srcSet={ROOM.avif} sizes="100vw" />
					<source type="image/webp" srcSet={ROOM.webp} sizes="100vw" />
					<img src={ROOM.fallback} alt={ROOM.alt} draggable={false} />
				</picture>
				<div className="egg-dim" style={{ opacity: dimRoom }} />
				<div className={`egg-screen ${power === "off" ? "egg-off" : wasOff ? "egg-on" : ""}`}>
					<div className="egg-screen-inner">
						{screen}
						<Toast msg={msg ?? null} />
					</div>
					{power === "off" && <div className="egg-dot" />}
				</div>
				{remote && <div className="egg-remote-spot">{remote}</div>}
			</div>
			{below}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The Remote: Power, a channel rocker, and OK. Keys a page doesn't use are left out or shown disabled.

export function MiniRemote({
	press,
	enabled = ["power", "up", "down", "ok"],
	powerLabel,
	okLabel = "OK",
	pulse,
	note,
}: {
	press: (key: Key) => void
	enabled?: Key[]
	/** A word printed under Power, for pages where Power is the one key that matters. */
	powerLabel?: string
	okLabel?: string
	/** The key that pulses to invite a press. */
	pulse?: Key
	/** A tiny line printed on the body (a hint). */
	note?: string
}) {
	const on = (k: Key) => enabled.includes(k)
	return (
		<section aria-label="Remote control" className="remote-body egg-remote flex select-none flex-col items-center px-4 pb-5 pt-4">
			<div className="flex w-full items-center justify-between">
				<div className="h-1.5 w-8 rounded-full bg-black/70" aria-hidden />
				<div className="flex flex-col items-center gap-1">
					<button
						type="button"
						aria-label="Power"
						disabled={!on("power")}
						onClick={() => press("power")}
						className={`remote-key flex h-11 w-11 items-center justify-center rounded-full text-rose-400 ${pulse === "power" ? "egg-pulse" : ""}`}
					>
						<Icon d={ICON.power} className="h-5 w-5" />
					</button>
				</div>
			</div>
			{powerLabel && (
				<span className="mt-1.5 self-end text-right text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-white/55">
					{powerLabel}
				</span>
			)}
			<div className="mt-6 flex w-full items-center justify-between gap-3">
				<div className="egg-rocker flex h-[132px] w-[52px] flex-col overflow-hidden rounded-full">
					<button
						type="button"
						aria-label="Next channel"
						disabled={!on("up")}
						onClick={() => press("up")}
						className={`flex flex-1 items-center justify-center text-2xl font-bold ${pulse === "up" ? "egg-pulse" : ""}`}
					>
						+
					</button>
					<span className="text-center text-[10px] font-bold tracking-[0.15em] text-white/45">CH</span>
					<button
						type="button"
						aria-label="Previous channel"
						disabled={!on("down")}
						onClick={() => press("down")}
						className="flex flex-1 items-center justify-center text-2xl font-bold"
					>
						−
					</button>
				</div>
				<button
					type="button"
					disabled={!on("ok")}
					onClick={() => press("ok")}
					className={`remote-ok flex h-[62px] w-[62px] items-center justify-center rounded-full text-[15px] font-bold tracking-wider text-white/85 ${pulse === "ok" ? "egg-pulse" : ""}`}
				>
					{okLabel}
				</button>
			</div>
			{note && <p className="mt-4 text-center text-[10px] leading-snug text-white/40">{note}</p>}
			<img {...whiteMark()} alt="" className="mx-auto mt-5 h-5 opacity-20" />
		</section>
	)
}

/** Keyboard: ↑ next channel, ↓ previous, Enter OK, P power. ← and → stay with the variant switcher. */
export function useRemoteKeys(press: (key: Key) => void) {
	const latest = useRef(press)
	latest.current = press
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea, [contenteditable], button, a")) {
				if (e.key === "Enter") return
			}
			if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return
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

let noiseUrl: string | null = null
function noise(): string {
	if (noiseUrl) return noiseUrl
	const c = document.createElement("canvas")
	c.width = c.height = 180
	const ctx = c.getContext("2d") as CanvasRenderingContext2D
	const img = ctx.createImageData(180, 180)
	for (let i = 0; i < img.data.length; i += 4) {
		const v = Math.random() * 255
		img.data[i] = img.data[i + 1] = img.data[i + 2] = v
		img.data[i + 3] = 255
	}
	ctx.putImageData(img, 0, 0)
	noiseUrl = c.toDataURL()
	return noiseUrl
}

/** Moving static. `flash` plays it once (a channel change) instead of looping. */
export function Static({ opacity = 1, flash }: { opacity?: number; flash?: number }) {
	const [url, setUrl] = useState<string | null>(null)
	useEffect(() => setUrl(noise()), [])
	if (!url) return <div className="absolute inset-0 bg-neutral-700" style={{ opacity }} />
	return (
		<div key={flash} className={`pointer-events-none absolute inset-0 overflow-hidden ${flash != null ? "egg-flash" : ""}`} style={{ opacity }}>
			<div className="egg-static" style={{ backgroundImage: `url(${url})` }} />
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

// ---------------------------------------------------------------------------------------------------------
// Under the room: the plain page that works without the TV (and for crawlers).

const BUTTON = "flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold"
export const PRIMARY = `${BUTTON} bg-amber-400 text-black hover:bg-amber-300`
export const SECONDARY = `${BUTTON} bg-white/[0.07] text-gray-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:bg-white/[0.1]`

export function Below({
	kicker,
	heading,
	text,
	children,
}: {
	kicker?: string
	heading: string
	text: ReactNode
	children?: ReactNode
}) {
	return (
		<div className="mx-auto flex max-w-xl flex-col items-center px-4 pb-24 pt-8 text-center">
			{kicker && <p className="brand-header text-5xl leading-none text-amber-400">{kicker}</p>}
			<h1 className="mt-4 text-2xl font-bold text-gray-100 sm:text-3xl">{heading}</h1>
			<div className="mt-2 text-base text-gray-400">{text}</div>
			{children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
		</div>
	)
}

export function HomeLink({ label = "Go home" }: { label?: string }) {
	return (
		<Link to="/" className={PRIMARY}>
			{label}
		</Link>
	)
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
