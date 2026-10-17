// PROTOTYPE - throwaway. Pieces the landing variants share: the boot, the capabilities, the ping, and a way to
// drive the TV from outside it (the TV's screen lives in the address, so a link changes it).
import { useLocation, useNavigate } from "@remix-run/react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { BootGStandby } from "~/ui/prototype-intro/clips/r13/boot"
import type { TvAppArt } from "~/ui/living-room/tv/tv-home"
import { MapArt, PrintArt } from "~/ui/living-room/tv/screens/app-art"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { TvHomeData } from "~/ui/living-room/tv/tv-home"

/**
 * The boot, over the TV's picture. CSS only: it plays from the first paint, before any script. The owner's boot
 * (round 13): the G turns in with the amber arc and the standby light, then the wordmark (prototype-intro r13).
 */
export function Boot() {
	return (
		<div className="lp-boot" aria-hidden="true">
			<BootGStandby k={1} />
		</div>
	)
}

/** How long the boot takes, to the end of its fade. */
export const BOOT_MS = 2850

export type Capability = {
	id: string
	name: string
	/** What it does, in one line. */
	line: string
	/** The real page for it: what a crawler follows, and the link without script. */
	href: string
	/** The TV's address for it. */
	tv: Record<string, string>
	/** The TV item that opens it on home. */
	item: string
	art: (data: TvHomeData) => TvAppArt
}

const posters = (data: TvHomeData, from = 0) => ({
	kind: "posters" as const,
	paths: data.startTitles.flatMap((t) => t.poster_path ?? []).slice(from, from + 4),
})

export const CAPABILITIES: Capability[] = [
	{
		id: "tonight",
		name: "Tonight",
		line: "One pick at a time, best rated right now.",
		href: "/discover",
		tv: { tv: "tonight" },
		item: "app:tonight",
		art: (data) => ({ kind: "backdrop", path: data.picture }),
	},
	{
		id: "score",
		name: "One score",
		line: "IMDb, Rotten Tomatoes and Metacritic in one number.",
		href: "/how-it-works",
		tv: { tv: "about" },
		item: "app:tonight",
		art: (data) => posters(data, 4),
	},
	{
		id: "discover",
		name: "Discover",
		line: "Pick a mood, get titles that fit it.",
		href: "/discover",
		tv: { tv: "discover" },
		item: "app:discover",
		art: (data) => posters(data),
	},
	{
		id: "streams",
		name: "Where it streams",
		line: "See what's on your services, in your country.",
		href: "/movies/streaming",
		tv: { tv: "service", service: "8" },
		item: "service:8",
		art: () => ({ kind: "backdrop", path: null, color: "#b1060f" }),
	},
	{
		id: "explorer",
		name: "Explorer",
		line: "A map of titles that belong together.",
		href: "/explorer",
		tv: { tv: "explorer" },
		item: "app:explorer",
		art: () => ({ kind: "map" }),
	},
	{
		id: "taste",
		name: "Taste",
		line: "Rate a few, get picks made for you.",
		href: "/taste",
		tv: { tv: "taste" },
		item: "app:taste",
		art: () => ({ kind: "print" }),
	},
]

/** Opens a screen on the TV, keeping the prototype's own params. */
export function useOpenOnTv() {
	const navigate = useNavigate()
	const location = useLocation()
	return useCallback(
		(tv: Record<string, string> | null) => {
			const p = new URLSearchParams()
			const variant = new URLSearchParams(location.search).get("variant")
			if (variant) p.set("variant", variant)
			for (const [k, v] of Object.entries(tv ?? {})) p.set(k, v)
			navigate({ search: `?${p}` })
		},
		[navigate, location.search],
	)
}

/** True once `ms` have passed since the page was first shown. */
export function useAfter(ms: number) {
	const [done, setDone] = useState(false)
	useEffect(() => {
		const left = Math.max(0, ms - performance.now())
		const t = setTimeout(() => setDone(true), left)
		return () => clearTimeout(t)
	}, [ms])
	return done
}

const isTouch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches

/**
 * The Explorer tutorial's pointer and ripple, aimed at the first visible element `target` matches. Follows it on
 * resize and scroll. The pointer comes in from below and to the right.
 */
export function Ping({ target, small }: { target: string | null; small?: boolean }) {
	const el = useRef<HTMLDivElement>(null)
	const [touch, setTouch] = useState(false)
	useEffect(() => setTouch(isTouch()), [])
	useEffect(() => {
		const root = el.current
		if (!root || !target) return
		let raf = 0
		const update = () => {
			const found = [...document.querySelectorAll(target)].find((n) => {
				const r = n.getBoundingClientRect()
				return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight
			})
			if (!found) {
				root.style.visibility = "hidden"
				return
			}
			const r = found.getBoundingClientRect()
			const x = r.left + r.width / 2
			const y = r.top + r.height / 2
			const set = (k: string, v: number) => root.style.setProperty(k, `${Math.round(v)}px`)
			set("--tx", x)
			set("--ty", y)
			set("--fx", x + Math.min(140, innerWidth * 0.2))
			set("--fy", y + 150)
			root.style.visibility = "visible"
		}
		const loop = () => {
			update()
			raf = window.setTimeout(loop, 400)
		}
		loop()
		addEventListener("resize", update)
		return () => {
			clearTimeout(raf)
			removeEventListener("resize", update)
		}
	}, [target])
	if (!target) return null
	return (
		<div ref={el} key={target} className={`lp-ping ${small ? "lp-small" : ""}`} style={{ visibility: "hidden" }} aria-hidden="true">
			<div className="lp-ripple" />
			<div className="lp-hand">{touch ? <Finger /> : <Cursor />}</div>
		</div>
	)
}

/** The tutorial's line at the bottom, with its buttons. */
export function Say({ children, actions }: { children: ReactNode; actions: ReactNode }) {
	return (
		<div className="lp-say" aria-live="polite">
			<p>{children}</p>
			{actions}
		</div>
	)
}

const Finger = () => (
	<svg className="lp-finger" viewBox="0 0 64 64" style={{ transform: "translate(-50%, -50%)" }} aria-hidden="true">
		<circle cx="32" cy="32" r="22" fill="rgba(255,255,255,0.28)" />
		<circle cx="32" cy="32" r="14" fill="#fff" stroke="rgba(10,14,26,0.35)" strokeWidth="2" />
	</svg>
)
const Cursor = () => (
	<svg className="lp-cursor" viewBox="0 0 32 40" aria-hidden="true">
		<path
			d="M3 2l24 22-11 1.5 6.5 12-5 2.5-6.5-12.5L3 34z"
			fill="#fff"
			stroke="#0a0e1a"
			strokeWidth="2.2"
			strokeLinejoin="round"
		/>
	</svg>
)

/** An app's picture, as home's tiles draw it (app-art.tsx), for use outside the TV's canvas. Fills its box. */
export function Art({ art, className = "", big }: { art: TvAppArt; className?: string; big?: boolean }) {
	if (art.kind === "map") return <MapArt className={className} />
	if (art.kind === "print") return <PrintArt className={className} />
	if (art.kind === "posters")
		return (
			<span className={`flex bg-[#10131c] ${className}`}>
				{art.paths.map((p) => (
					<img key={p} src={tmdbImageUrl(p, "w185")} alt="" loading="lazy" className="h-full min-w-0 flex-1 object-cover" />
				))}
			</span>
		)
	return art.path ? (
		<img src={tmdbImageUrl(art.path, big ? "w1280" : "w780")} alt="" className={`object-cover ${className}`} />
	) : (
		<span
			className={`block ${className}`}
			style={{
				background: art.color
					? `linear-gradient(160deg, color-mix(in srgb, ${art.color} 58%, #05060a) 0%, color-mix(in srgb, ${art.color} 20%, #05060a) 100%)`
					: "linear-gradient(160deg,#1c2433,#0b0e15)",
			}}
		/>
	)
}
