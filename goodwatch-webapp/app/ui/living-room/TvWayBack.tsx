// The TV button: the way back into the living room's TV from a page the TV opened (see TvWayBackHost.tsx for
// where it stands and for how long, and tv-transition.ts for the motion). A small TV set in 16:9 with its bezel
// and foot, showing the picture the TV showed on leaving, with the brackets of the way out pointing inward, and
// the words "Back to TV". The owner chose this design ("Set") from three, and the dock's left part as its place
// on a phone. It loads only for a person who left through the TV.
import { useLocation } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import { TV_BACK_ATTR, TV_BRACKET_ATTR, readLiveTrip, tvProperties } from "./tv-way-back"

/** One history move, however many pages away: the router replays the transition into the TV. */
const backToTv = (pages: number) => window.history.go(-pages)

/**
 * History is about to land on the TV's entry. For the way in to move the brackets, they must stand at the
 * window's edge, with their names, before the router takes this page's picture; and so must the mark that names
 * the header. The room takes over from there when it mounts (`useReturnIntoTv` in tv-transition.ts, which is the
 * start page's code and not on this page): it measures the TV and clears all of it when the animation ends.
 */
function prepareReturn() {
	let trip = null
	try {
		trip = readLiveTrip(sessionStorage, document)
	} catch {
		// Without storage there is no way in to prepare.
	}
	const html = document.documentElement
	if (!trip?.box || !trip.out || trip.idx !== ((window.history.state as { idx?: number } | null)?.idx ?? 0)) return
	if (typeof document.startViewTransition !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
	for (const [name, value] of Object.entries(tvProperties(trip.box, { w: html.clientWidth, h: window.innerHeight }))) html.style.setProperty(name, value)
	html.dataset.tvTransition = "in"
	if (document.querySelector(`[${TV_BRACKET_ATTR}]`)) return
	for (const corner of [0, 1, 2, 3]) {
		const el = document.createElement("div")
		el.setAttribute(TV_BRACKET_ATTR, String(corner))
		el.setAttribute("aria-hidden", "true")
		el.style.viewTransitionName = `living-room-tv-bracket-${corner}`
		document.body.appendChild(el)
	}
}

/** The brackets of the way out, pointing inward: the button does the reverse of what brought the person here. */
function InwardBrackets() {
	return (
		<svg viewBox="0 0 32 18" fill="none" stroke="#fbbf24" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="absolute inset-0 h-full w-full" aria-hidden="true">
			{/* Small, and near the corners: they frame the picture and leave its middle free. */}
			<path d="M7 2.6V5.4H4.2M25 2.6V5.4H27.8M7 15.4V12.6H4.2M25 15.4V12.6H27.8" />
		</svg>
	)
}

// One-off values stay out of the stylesheet, which every page loads: they are set here, on the elements.
const SCREEN = { borderRadius: 4, padding: 2, boxShadow: "0 0 0 1px rgba(255,255,255,.22), 0 0 12px rgba(251,191,36,.22)" }
const PICTURE = { borderRadius: 2, background: "linear-gradient(135deg,#1f2937,#0b1220)" }
const FOOT = { height: 2.5, width: "42%" }

/** A TV in small: a 16:9 picture in a dark bezel on a foot. */
function MiniTv({ width, art }: { width: number; art: string | null }) {
	const height = Math.round((width * 9) / 16)
	return (
		<span className="relative block shrink-0" style={{ width, height: height + 5 }}>
			<span className="absolute inset-x-0 top-0 block overflow-hidden bg-black" style={{ ...SCREEN, height }}>
				<span className="relative block h-full w-full overflow-hidden" style={PICTURE}>
					{art && <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
					<span className="absolute inset-0 bg-black/35" />
					<InwardBrackets />
				</span>
			</span>
			<span className="absolute bottom-0 left-1/2 block -translate-x-1/2 rounded-full bg-white/40" style={FOOT} />
		</span>
	)
}

// `tv-back` (main.css): it stays out of sight until the way out has ended. The brackets arrive at it, and then it is there.
const BUTTON = "tv-back focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"

/** A dialog or a menu of the page takes Escape first. Pages keep their closed sheets in the document: only what shows counts. */
function somethingIsOpen() {
	if (document.querySelector('[aria-haspopup][aria-expanded="true"], #site-hub')) return true
	return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"], [role="menu"]')).some((el) => {
		const b = el.getBoundingClientRect()
		return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden"
	})
}

/**
 * The desktop's TV button: a tab that hangs from the header's lower edge. It is out of the way while the person
 * scrolls down and back as soon as they scroll up or stand at the top. Mounted on every viewport (hidden below the
 * large breakpoint, where the dock has the button), because it also carries the keys: Escape goes back to the TV,
 * and the browser's Back gets its brackets.
 */
export function TvWayBackBar({ pages, art }: { pages: number; art: string | null }) {
	const { pathname } = useLocation()

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
			if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")) return
			if (somethingIsOpen()) return
			e.preventDefault()
			backToTv(pages)
		}
		window.addEventListener("keydown", onKey)
		window.addEventListener("popstate", prepareReturn)
		return () => {
			window.removeEventListener("keydown", onKey)
			window.removeEventListener("popstate", prepareReturn)
		}
	}, [pages])

	const [shown, setShown] = useState(true)
	const last = useRef(0)
	// A new page starts at its top, with the tab showing
	useEffect(() => {
		last.current = window.scrollY
		setShown(true)
		const onScroll = () => {
			const y = window.scrollY
			if (Math.abs(y - last.current) < 6) return
			setShown(y < last.current || y < 80)
			last.current = y
		}
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => window.removeEventListener("scroll", onScroll)
	}, [pathname])

	return (
		<div className={`tv-back-bar pointer-events-none fixed top-16 left-1/2 hidden -translate-x-1/2 lg:block ${shown ? "" : "-translate-y-full opacity-0"}`}>
			<button
				type="button"
				{...{ [TV_BACK_ATTR]: "" }}
				onClick={() => backToTv(pages)}
				tabIndex={shown ? 0 : -1}
				title="Back to the TV (Esc)"
				className={`${BUTTON} ${shown ? "pointer-events-auto" : ""} flex items-center gap-2.5 rounded-b-xl border border-t-0 border-white/10 bg-gray-950/95 pr-3 pl-2.5 text-left backdrop-blur-md`}
				style={{ height: 58, boxShadow: "0 10px 30px rgba(0,0,0,.55)" }}
			>
				<MiniTv width={60} art={art} />
				<span className="text-sm font-bold whitespace-nowrap text-white">Back to TV</span>
				<kbd className="rounded bg-white/10 px-1.5 py-0.5 font-sans text-xs text-white/60">Esc</kbd>
			</button>
		</div>
	)
}

/** The phone's TV button: it stands in the dock where the Watch next key is, in that key's two lines. */
export function TvBackKey({ pages, art }: { pages: number; art: string | null }) {
	return (
		<button
			type="button"
			{...{ [TV_BACK_ATTR]: "" }}
			onClick={() => backToTv(pages)}
			aria-label="Back to the TV"
			className={`${BUTTON} flex min-w-0 items-center gap-2.5 rounded-lg border border-amber-400/40 bg-amber-400/5 py-1 pr-3 pl-1.5 text-left`}
			style={{ height: 50 }}
		>
			<MiniTv width={56} art={art} />
			<span className="flex flex-col leading-tight">
				<span className="text-xs font-bold whitespace-nowrap text-amber-400">Back to</span>
				<span className="text-sm font-bold text-white">TV</span>
			</span>
		</button>
	)
}
