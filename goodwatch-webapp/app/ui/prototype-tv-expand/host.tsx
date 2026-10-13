// PROTOTYPE - throwaway. The part of /prototype/tv-expand that stays while a real page is on screen: the
// transitions' CSS (the room's own stylesheet is gone by the time the page it opens animates in), and the ways
// back to the TV. root.tsx mounts it in development only. See trip.ts and
// docs/prototypes/tv-expand-transitions/README.md.
import { useLocation } from "@remix-run/react"
import { useEffect, useReducer, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AMBER, BACK_LIVES, BACKS, type BackKey, EASE, MS, TRANSITIONS, type Trip, backToTv, depthFromTv, install, readTrip, subscribe, transitionRunning, writeTrip } from "./trip"

const CORNERS = ["tvx-c0", "tvx-c1", "tvx-c2", "tvx-c3"]
const FLYING = ["tvx-m0", "tvx-m1", "tvx-m2", "tvx-m3", "tvx-art", "tvx-title"]
const PICTURES = FLYING.slice(0, 5)
const each = (mark: string, part: string, names: string[]) => names.map((name) => `html[data-tvx${mark}]::view-transition-${part}(${name})`).join(", ")

const CSS = `
.tsqd-open-btn-container { display: none !important; }
html[data-tvx-own] .tvx-own-brackets { visibility: hidden; }

html[data-tvx]::view-transition-old(root), html[data-tvx]::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
@keyframes tvx-fade-in { from { opacity: 0; } }
@keyframes tvx-fade-out { to { opacity: 0; } }

/* Reduced motion, and the Live page's way out (its frame already covers the window): the page is simply there. */
html[data-tvx="none"]::view-transition-group(*), html[data-tvx="none"]::view-transition-old(*), html[data-tvx="none"]::view-transition-new(*) { animation: none !important; }
html[data-tvx="none"]::view-transition-old(*) { display: none; }

/* 2 New: the picture has grown to the window in the room; the page fades in over it, and out again on the way back. */
html[data-tvx^="grow"]::view-transition-new(root) { animation: tvx-fade-in ${MS.grow.out}ms linear both; }

/* 3 Frame: today's growing clip, and the four brackets as elements of their own that ride its edge. */
html[data-tvx="frame-out"]::view-transition-new(root) { animation: tvx-clip-grow ${MS.frame.out}ms ${EASE} both; }
html[data-tvx="frame-in"]::view-transition-old(root) { z-index: 1; animation: tvx-clip-shrink ${MS.frame.in}ms ${EASE} both; }
${each('="frame-out"', "group", CORNERS)} { animation-duration: ${MS.frame.out}ms; animation-timing-function: ${EASE}; }
${each('="frame-in"', "group", CORNERS)} { animation-duration: ${MS.frame.in}ms; animation-timing-function: ${EASE}; }
@keyframes tvx-clip-grow { from { clip-path: var(--tvx-inset); } to { clip-path: inset(0 0 0 0 round 0); } }
@keyframes tvx-clip-shrink { from { clip-path: inset(0 0 0 0 round 0); } to { clip-path: var(--tvx-inset); } }

/* 4 Morph: the page fades in over the room while the named posters, the backdrop and the title fly to their places. */
html[data-tvx="morph-out"]::view-transition-new(root) { animation: tvx-fade-in ${MS.morph.out - 150}ms ease both; }
html[data-tvx="morph-in"]::view-transition-new(root) { animation: tvx-fade-in ${MS.morph.in - 100}ms ease both; }
${each('="morph-out"', "group", FLYING)} { animation-duration: ${MS.morph.out}ms; animation-timing-function: ${EASE}; }
${each('="morph-in"', "group", FLYING)} { animation-duration: ${MS.morph.in}ms; animation-timing-function: ${EASE}; }
${each('^="morph"', "old", PICTURES)}, ${each('^="morph"', "new", PICTURES)} { height: 100%; object-fit: cover; }

/* 5 Camera: the room scales up around the TV until its picture is the window; the page sits in the picture from the start. */
html[data-tvx^="camera"]::view-transition-old(root), html[data-tvx^="camera"]::view-transition-new(root), html[data-tvx="live-in"]::view-transition-old(root) { transform-origin: 0 0; }
html[data-tvx="camera-out"]::view-transition-old(root) { animation: tvx-room-out ${MS.camera.out}ms ${EASE} both; }
html[data-tvx="camera-out"]::view-transition-new(root) { animation: tvx-page-out ${MS.camera.out}ms ${EASE} both, tvx-fade-in 260ms linear both; }
html[data-tvx="camera-in"]::view-transition-new(root) { animation: tvx-room-in ${MS.camera.in}ms ${EASE} both; }
html[data-tvx="camera-in"]::view-transition-old(root) { z-index: 1; animation: tvx-page-in ${MS.camera.in}ms ${EASE} both, tvx-fade-out 200ms linear ${MS.camera.in - 200}ms both; }
html[data-tvx^="camera"]::view-transition-group(tvx-header) { animation: none; }
html[data-tvx^="camera"]::view-transition-old(tvx-header) { display: none; }
html[data-tvx^="camera"]::view-transition-new(tvx-header) { animation: none; }
@keyframes tvx-room-out { to { transform: var(--tvx-room); } }
@keyframes tvx-room-in { from { transform: var(--tvx-room); } }
@keyframes tvx-page-out { from { transform: var(--tvx-page); clip-path: var(--tvx-page-clip); } to { transform: none; clip-path: inset(0 0 0 0); } }
@keyframes tvx-page-in { from { transform: none; clip-path: inset(0 0 0 0); } to { transform: var(--tvx-page); clip-path: var(--tvx-page-clip); } }

/* 8 Lean in and 9 Lean in, light: 5's zoom with 3's brackets. 9 goes out as a transition; 8 goes out in the room, on the live page. */
html[data-tvx^="lean"]::view-transition-old(root), html[data-tvx^="lean"]::view-transition-new(root) { transform-origin: 0 0; }
html[data-tvx="leanlite-out"]::view-transition-old(root) { animation: tvx-room-out ${MS.leanlite.out}ms ${EASE} both; }
html[data-tvx="leanlite-out"]::view-transition-new(root) { animation: tvx-page-out ${MS.leanlite.out}ms ${EASE} both, tvx-fade-in 260ms linear both; }
html[data-tvx="lean-in"]::view-transition-new(root), html[data-tvx="leanlite-in"]::view-transition-new(root) { animation: tvx-room-in ${MS.lean.in}ms ${EASE} both; }
html[data-tvx="lean-in"]::view-transition-old(root), html[data-tvx="leanlite-in"]::view-transition-old(root) { z-index: 1; animation: tvx-page-in ${MS.lean.in}ms ${EASE} both, tvx-fade-out 200ms linear ${MS.lean.in - 200}ms both; }
html[data-tvx^="lean"]::view-transition-group(tvx-header) { animation: none; }
html[data-tvx^="lean"]::view-transition-old(tvx-header) { display: none; }
html[data-tvx^="lean"]::view-transition-new(tvx-header) { animation: none; }
${each('="leanlite-out"', "group", CORNERS)} { animation-duration: ${MS.leanlite.out}ms; animation-timing-function: ${EASE}; }
${each('="lean-in"', "group", CORNERS)}, ${each('="leanlite-in"', "group", CORNERS)} { animation-duration: ${MS.lean.in}ms; animation-timing-function: ${EASE}; }

/* 6 Live page, the way back: the page scales down into the picture, where the mini screen takes over. */
html[data-tvx="live-in"]::view-transition-old(root) { z-index: 1; animation: tvx-page-in ${MS.live.in}ms ${EASE} both, tvx-fade-out 150ms linear ${MS.live.in - 150}ms both; }

/* 7 Wipe: a circle from the Expand key. */
html[data-tvx="wipe-out"]::view-transition-new(root) { animation: tvx-wipe-grow ${MS.wipe.out}ms ${EASE} both; }
html[data-tvx="wipe-in"]::view-transition-old(root) { z-index: 1; animation: tvx-wipe-shrink ${MS.wipe.in}ms ${EASE} both; }
@keyframes tvx-wipe-grow { from { clip-path: circle(var(--tvx-wipe-r0) at var(--tvx-wipe-at)); } to { clip-path: circle(var(--tvx-wipe-r) at var(--tvx-wipe-at)); } }
@keyframes tvx-wipe-shrink { from { clip-path: circle(var(--tvx-wipe-r) at var(--tvx-wipe-at)); } to { clip-path: circle(var(--tvx-wipe-r0) at var(--tvx-wipe-at)); } }

/* The phone: the TV key takes a place in the dock's row, and Search gives up its word for it. */
html[data-tvx-dock] nav[aria-label="Site"] [data-search-entry] { width: 44px; padding: 0; gap: 0; justify-content: center; font-size: 0; }

.tvx-back { transition: opacity .3s ease, transform .3s cubic-bezier(.2,.8,.2,1); }
.tvx-back[data-shown="false"] { opacity: 0; transform: scale(.85); pointer-events: none; }
.tvx-back-more { display: grid; grid-template-columns: 0fr; transition: grid-template-columns .22s ease; }
.tvx-back:hover .tvx-back-more, .tvx-back:focus-visible .tvx-back-more { grid-template-columns: 1fr; }
.tvx-bar { transition: transform .25s cubic-bezier(.2,.8,.2,1), opacity .25s ease; }
@media (prefers-reduced-motion: reduce) { .tvx-back, .tvx-back-more, .tvx-bar { transition: none; } }
`

/** A TV with its corner brackets pointing inward: the Expand key's motif, reversed. */
function TvIcon({ size = 30 }: { size?: number }) {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative, the control around it carries the label
		<svg width={size} height={(size * 24) / 30} viewBox="0 0 30 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<rect x="1.5" y="1.5" width="27" height="17" rx="2.5" />
			<path d="M10 22.5h10" />
			<path d="M7.5 9H11V5.5M22.5 9H19V5.5M7.5 11H11v3.5M22.5 11H19v3.5" stroke={AMBER} />
		</svg>
	)
}

/**
 * What the site pins to the window's bottom edge on a phone: its height, so nothing of ours sits under it, and the
 * dock itself (ui/navigation/MobileDock.tsx), so the TV key can take a place in it.
 */
function useBottomChrome(pathname: string) {
	const [chrome, setChrome] = useState<{ h: number; dock: HTMLElement | null }>({ h: 0, dock: null })
	useEffect(() => {
		const read = () => {
			let most = 0
			for (const el of document.querySelectorAll<HTMLElement>("body div.fixed.bottom-0, body nav.fixed.bottom-0")) {
				if (el.closest("[data-tvx-chrome]")) continue
				const b = el.getBoundingClientRect()
				if (b.width > window.innerWidth * 0.8 && b.height > 0 && b.height < 220 && b.bottom >= window.innerHeight - 2) most = Math.max(most, b.height)
			}
			const nav = document.querySelector<HTMLElement>('nav[aria-label="Site"]')
			const dock = nav && nav.getBoundingClientRect().height > 0 ? nav.parentElement : null
			setChrome((was) => (was.h === most && was.dock === dock ? was : { h: most, dock }))
		}
		read()
		const timer = setInterval(read, 600)
		window.addEventListener("resize", read)
		return () => {
			clearInterval(timer)
			window.removeEventListener("resize", read)
		}
	}, [pathname])
	return chrome
}

function BackControls({ trip, depth, shown }: { trip: Trip; depth: number; shown: boolean }) {
	const { pathname } = useLocation()
	const { h: dock, dock: dockEl } = useBottomChrome(pathname)
	const phone = typeof window !== "undefined" && window.innerWidth < 768
	const label = `Back to the TV: ${trip.screen}`
	// After a step or two the TV is no longer where the person is coming from: the way back is gone, Escape too.
	const alive = depth <= BACK_LIVES
	// On a phone the way back is a key in the dock's row, whichever control the desktop shows.
	const inDock = alive && Boolean(dockEl) && trip.back !== "esc"
	useEffect(() => {
		if (!inDock) return
		document.documentElement.dataset.tvxDock = ""
		return () => {
			delete document.documentElement.dataset.tvxDock
		}
	}, [inDock])

	// Escape goes back to the TV, unless something of the page's own is open or being typed into.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return
			const target = e.target as HTMLElement
			if (target.closest?.("input, textarea, select, [contenteditable]")) return
			if (e.key === "Escape" && alive) {
				// A dialog or a menu of the page's own takes Escape first. The pages keep their closed sheets in the
				// document (Discover one, Watch next three): hidden and without height, so only what shows counts.
				const open = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"], [role="menu"]')).some((el) => {
					const b = el.getBoundingClientRect()
					return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden"
				})
				if (e.defaultPrevented || open) return
				e.preventDefault()
				backToTv()
			}
			// The prototype's own key: B switches between the ways back, in place.
			if (e.key.toLowerCase() === "b") {
				const now = readTrip()
				if (now) writeTrip({ ...now, back: BACKS[(BACKS.findIndex((b) => b.key === now.back) + 1) % BACKS.length].key })
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [alive])

	// The bar: out of the way while the person reads on, back as soon as they scroll up or stand at the top.
	const [up, setUp] = useState(true)
	const [top, setTop] = useState(true)
	const last = useRef(0)
	useEffect(() => {
		last.current = window.scrollY
		const onScroll = () => {
			const y = window.scrollY
			if (Math.abs(y - last.current) < 6) return
			setUp(y < last.current)
			setTop(y < 80)
			last.current = y
		}
		onScroll()
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => window.removeEventListener("scroll", onScroll)
	}, [pathname])

	// Escape only: say so once, briefly.
	const [hint, setHint] = useState(trip.back === "esc")
	useEffect(() => {
		if (trip.back !== "esc") return
		setHint(true)
		const timer = setTimeout(() => setHint(false), 4500)
		return () => clearTimeout(timer)
	}, [trip.back, pathname])

	const name = TRANSITIONS.find((x) => x.key === trip.t)?.name
	const narrow = typeof window !== "undefined" && window.innerWidth < 350
	return (
		<div data-tvx-chrome>
			{inDock &&
				dockEl &&
				createPortal(
					// Between the round key and Search, which stands 12 px from the edge and is 44 px wide while this is here.
					<button
						type="button"
						data-tvx-back
						data-tvx-chrome
						data-shown={shown}
						onClick={backToTv}
						aria-label={label}
						className={`tvx-back absolute flex h-11 items-center justify-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-400/10 text-[13.5px] font-bold text-white ${narrow ? "w-11" : "pl-2.5 pr-3.5"}`}
						style={{ right: 64, bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
					>
						<TvIcon size={26} />
						{!narrow && "TV"}
					</button>,
					dockEl,
				)}
			{alive && !inDock && trip.back === "key" && (
				<button
					type="button"
					data-tvx-back
					data-shown={shown}
					onClick={backToTv}
					aria-label={label}
					title={`${label} (Esc)`}
					className="tvx-back fixed z-[1100] flex h-11 items-center rounded-xl border border-amber-400/60 bg-gray-950/90 pl-2.5 pr-3 text-white shadow-[0_6px_24px_rgba(0,0,0,.55)] backdrop-blur-md hover:border-amber-300 focus-visible:outline-2 focus-visible:outline-amber-300"
					style={{ right: 16, bottom: dock + 16 }}
				>
					<TvIcon />
					<span className="ml-2 text-sm font-bold tracking-wide">TV</span>
					<span className="tvx-back-more">
						<span className="overflow-hidden whitespace-nowrap text-sm text-white/70">
							<span className="pl-2">{trip.screen}</span>
						</span>
					</span>
				</button>
			)}
			{alive && !inDock && trip.back === "bar" && (
				<button
					type="button"
					data-tvx-back
					data-shown={shown}
					onClick={backToTv}
					aria-label={label}
					title={`${label} (Esc)`}
					className="tvx-back tvx-bar fixed left-1/2 z-[999] flex h-9 items-center gap-2 rounded-b-xl border border-t-0 border-amber-400/50 bg-gray-950/95 px-3.5 text-sm text-white shadow-[0_6px_24px_rgba(0,0,0,.5)] backdrop-blur-md"
					style={{ top: 64, transform: `translate(-50%, ${up || top ? "0" : "-110%"})`, opacity: up || top ? 1 : 0 }}
				>
					<TvIcon size={24} />
					<span className="font-bold">TV</span>
					{!top && <span className="whitespace-nowrap text-white/70">{trip.screen}</span>}
					{!phone && !top && <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white/70">Esc</kbd>}
				</button>
			)}
			{alive && trip.back === "esc" && (
				<div aria-live="polite" className="tvx-back pointer-events-none fixed left-1/2 z-[1100] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-gray-950/90 px-3.5 py-2 text-sm text-white/85 shadow-lg backdrop-blur-md" data-shown={shown && hint} style={{ bottom: dock + (phone ? 60 : 16) }}>
					<TvIcon size={22} />
					{phone ? "The browser's Back returns to the TV" : "Esc returns to the TV"}
				</div>
			)}
			{/* The prototype's own readout, not part of the design. */}
			<button
				type="button"
				onClick={() => writeTrip({ ...trip, back: BACKS[(BACKS.findIndex((b) => b.key === trip.back) + 1) % BACKS.length].key })}
				title="B: the next way back"
				className="fixed left-3 z-[1100] max-w-[70vw] truncate rounded-full bg-white px-3 py-1.5 text-left text-[12px] font-semibold text-black shadow-xl ring-2 ring-fuchsia-500"
				style={{ bottom: dock + 12 }}
			>
				{name} · {depth === 1 ? "1 page" : `${depth} pages`} from the TV · {alive ? `back: ${inDock ? "in the dock" : BACKS.find((b) => b.key === trip.back)?.name.toLowerCase()}` : "the way back has gone"}
			</button>
		</div>
	)
}

export default function TvExpandHost() {
	const location = useLocation()
	const [, bump] = useReducer((n: number) => n + 1, 0)
	const [on, setOn] = useState(false)
	useEffect(() => {
		// The Live page's copy of the app inside the TV has no ways back of its own.
		if (window.self !== window.top) return
		install()
		setOn(true)
		return subscribe(bump)
	}, [])
	const trip = on ? readTrip() : null
	const depth = on ? depthFromTv(trip, location.pathname) : 0
	return (
		<>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: our own constant CSS */}
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			{trip && depth > 0 && <BackControls key={trip.back as BackKey} trip={trip} depth={depth} shown={!transitionRunning()} />}
		</>
	)
}
