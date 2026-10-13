// PROTOTYPE - throwaway. The part of /prototype/tv-expand that stays while a real page is on screen: the
// transitions' CSS (the room's own stylesheet is gone by the time the page it opens animates in), and the ways
// back to the TV. root.tsx mounts it in development only. See trip.ts and
// docs/prototypes/tv-expand-transitions/README.md.
import { useLocation } from "@remix-run/react"
import { type ReactNode, useEffect, useReducer, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AMBER, BACK_LIVES, BACKS, BUTTONS, type ButtonKey, CHOSEN, DOCKS, EASE, MS, TRANSITIONS, type Trip, backToTv, depthFromTv, install, next, readTrip, subscribe, transitionRunning, writeTrip } from "./trip"

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

/* The phone, while the way back lives: the TV button stands in place of the dock's left part (Watch next), which
   keeps its room but does not show. For comparison, round two's place: between the round key and Search, which
   gives up its word for it. */
html[data-tvx-dock="left"] nav[aria-label="Site"] > a:first-child { visibility: hidden; }
html[data-tvx-dock="between"] nav[aria-label="Site"] [data-search-entry] { width: 44px; padding: 0; gap: 0; justify-content: center; font-size: 0; }

.tvx-back { transition: opacity .3s ease, transform .3s cubic-bezier(.2,.8,.2,1); }
.tvx-back[data-shown="false"] { opacity: 0; transform: scale(.85); pointer-events: none; }
.tvx-back:focus-visible { outline: 2px solid ${AMBER}; outline-offset: 2px; }
.tvx-back:hover .tvx-screen, .tvx-back:focus-visible .tvx-screen { box-shadow: 0 0 0 1px rgba(251,191,36,.9), 0 0 16px rgba(251,191,36,.45); }
.tvx-back:active { transform: scale(.97); }
.tvx-bar { transition: transform .25s cubic-bezier(.2,.8,.2,1), opacity .25s ease; }
@media (prefers-reduced-motion: reduce) { .tvx-back, .tvx-bar { transition: none; } }
`

/** The Expand key's brackets, pointing inward: what the TV button does is the reverse of what brought the person here. */
function InwardBrackets({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 32 18" fill="none" stroke={AMBER} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
			<title>Back into the TV</title>
			{/* Small, and near the corners: they frame the picture and leave its middle free. */}
			<path d="M7 2.6V5.4H4.2M25 2.6V5.4H27.8M7 15.4V12.6H4.2M25 15.4V12.6H27.8" />
		</svg>
	)
}

/**
 * A TV in small: a 16:9 picture in a dark bezel, with the backdrop of the screen the person left and the inward
 * brackets on it. `stand` adds the foot. `children` is written on the picture.
 */
function MiniTv({ width, art, stand, children }: { width: number; art: string | null; stand?: boolean; children?: ReactNode }) {
	const height = Math.round((width * 9) / 16)
	return (
		<span className="relative block shrink-0" style={{ width, height: height + (stand ? 5 : 0) }}>
			<span className="tvx-screen absolute inset-x-0 top-0 block overflow-hidden rounded-[4px] bg-black p-[2px] shadow-[0_0_0_1px_rgba(255,255,255,.22),0_0_12px_rgba(251,191,36,.22)] transition-shadow duration-200" style={{ height }}>
				<span className="relative block h-full w-full overflow-hidden rounded-[2px] bg-[linear-gradient(135deg,#1f2937,#0b1220)]">
					{art && <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
					<span className="absolute inset-0 bg-black/35" />
					<InwardBrackets className="absolute inset-0 h-full w-full" />
					{children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
				</span>
			</span>
			{stand && <span className="absolute bottom-0 left-1/2 block h-[2.5px] w-[42%] -translate-x-1/2 rounded-full bg-white/40" />}
		</span>
	)
}

/** The TV as a line drawing, for the key without a picture. */
function TvGlyph({ width = 30 }: { width?: number }) {
	return (
		<svg width={width} height={(width * 20) / 32} viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
			<title>TV</title>
			<rect x="1.5" y="1.5" width="29" height="17" rx="2" />
			<path d="M9 4.6V7.6H6M23 4.6V7.6H26M9 15.4V12.4H6M23 15.4V12.4H26" stroke={AMBER} strokeWidth="1.5" />
		</svg>
	)
}

/**
 * The TV button in its three designs (T switches). `room` is how much the place gives it: `full` in the desktop's
 * bar (which is its frame already), `slot` in the dock's left part, `short` in the gap beside Search.
 *   set     a small TV set with the screen the person left, and in words where the key leads
 *   screen  the key is the TV: its picture, its bezel, the word on it
 *   plain   a drawn TV and words, like the site's other keys; no picture
 */
function TvButton({ design, trip, room }: { design: ButtonKey; trip: Trip; room: "full" | "slot" | "short" }) {
	if (design === "screen")
		return (
			<span className="block p-[3px]">
				<MiniTv width={room === "slot" ? 92 : room === "full" ? 80 : 66} art={trip.art} stand>
					<span className="text-[13px] font-black tracking-[0.16em] text-white [text-shadow:0_1px_6px_rgba(0,0,0,.95)]">TV</span>
				</MiniTv>
			</span>
		)
	if (design === "plain")
		return (
			<span className="flex h-11 items-center gap-2 rounded-lg border border-amber-400/55 bg-amber-400/[0.09] px-3 text-[13.5px] font-bold whitespace-nowrap text-white">
				<TvGlyph />
				{room === "short" ? "TV" : "Back to TV"}
			</span>
		)
	// In the bar the tab is the key's frame; in the dock the key brings its own.
	const frame = room === "full" ? "" : "rounded-lg border border-amber-400/35 bg-amber-400/[0.06]"
	return (
		<span className={`flex h-[50px] min-w-0 items-center gap-2.5 py-1 pr-3 pl-1.5 text-left ${frame}`}>
			<MiniTv width={room === "full" ? 60 : room === "slot" ? 56 : 46} art={trip.art} stand />
			{room === "full" && (
				<span className="flex min-w-0 flex-col leading-tight">
					<span className="text-[10.5px] font-bold tracking-wide whitespace-nowrap text-amber-400 uppercase">Back to TV</span>
					<span className="truncate text-[13.5px] font-bold text-white">{trip.screen}</span>
				</span>
			)}
			{/* The dock's left part reads in two lines (Wishlist over Watch next); the button keeps that. */}
			{room === "slot" && (
				<span className="flex flex-col leading-[1.15]">
					<span className="text-[11px] font-bold whitespace-nowrap text-amber-400">Back to</span>
					<span className="text-[15px] font-bold text-white">TV</span>
				</span>
			)}
			{room === "short" && <span className="text-[13.5px] font-bold text-white">TV</span>}
		</span>
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
	// On a phone the way back is the TV button in the dock, whichever control the desktop shows.
	const inDock = alive && Boolean(dockEl) && trip.back !== "esc"
	const dockAt = inDock ? trip.dock : null
	useEffect(() => {
		if (!dockAt) return
		document.documentElement.dataset.tvxDock = dockAt
		return () => {
			delete document.documentElement.dataset.tvxDock
		}
	}, [dockAt])

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
				// The site's own menus (the round key's, the header's) say that they are open on the key that opened them.
				const expanded = document.querySelector('[aria-haspopup][aria-expanded="true"], #site-hub')
				if (e.defaultPrevented || open || expanded) return
				e.preventDefault()
				backToTv()
			}
			// The prototype's own keys, in place: B the way back, T the button's design, L its place in the dock.
			const now = readTrip()
			const key = e.key.toLowerCase()
			if (!now) return
			if (key === "b") writeTrip({ ...now, back: next(BACKS, now.back) })
			if (key === "t") writeTrip({ ...now, button: next(BUTTONS, now.button) })
			if (key === "l") writeTrip({ ...now, dock: next(DOCKS, now.dock) })
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

	const design = trip.button
	const name = trip.t === CHOSEN ? "Lean in" : TRANSITIONS.find((x) => x.key === trip.t)?.name
	return (
		<div data-tvx-chrome>
			{inDock &&
				dockEl &&
				createPortal(
					<button
						type="button"
						data-tvx-back
						data-tvx-chrome
						data-design={design}
						data-shown={shown}
						onClick={backToTv}
						aria-label={label}
						className="tvx-back absolute flex items-center rounded-lg"
						style={
							trip.dock === "left"
								? // Where Watch next stands: from the dock's edge to just short of the round key.
									{ left: 12, bottom: "calc(env(safe-area-inset-bottom, 0px) + 36px)", transform: "translateY(50%)", maxWidth: "calc(50vw - 56px)" }
								: // Between the round key and Search, which stands 12 px from the edge and is 44 px wide meanwhile.
									{ right: 64, bottom: "calc(env(safe-area-inset-bottom, 0px) + 36px)", transform: "translateY(50%)" }
						}
					>
						<TvButton design={design} trip={trip} room={trip.dock === "left" ? "slot" : "short"} />
					</button>,
					dockEl,
				)}
			{alive && !inDock && trip.back === "key" && (
				<button type="button" data-tvx-back data-design={design} data-shown={shown} onClick={backToTv} aria-label={label} title={`${label} (Esc)`} className="tvx-back fixed z-[1100] flex items-center rounded-lg bg-gray-950/90 shadow-[0_6px_24px_rgba(0,0,0,.55)] backdrop-blur-md" style={{ right: 16, bottom: dock + 16 }}>
					<TvButton design={design} trip={trip} room="full" />
				</button>
			)}
			{alive && !inDock && trip.back === "bar" && (
				// The tab hangs from the header's lower edge like a set on its mount: square at the top, the button in it.
				<button
					type="button"
					data-tvx-back
					data-design={design}
					data-shown={shown}
					onClick={backToTv}
					aria-label={label}
					title={`${label} (Esc)`}
					className="tvx-back tvx-bar fixed left-1/2 z-[999] flex items-center gap-2 rounded-b-xl border border-t-0 border-white/[0.09] bg-gray-950/95 p-1.5 pt-1 shadow-[0_10px_30px_rgba(0,0,0,.55)] backdrop-blur-md"
					style={{ top: 64, transform: `translate(-50%, ${up || top ? "0" : "-110%"})`, opacity: up || top ? 1 : 0 }}
				>
					<TvButton design={design} trip={trip} room="full" />
					{!phone && <kbd className="mr-1 rounded bg-white/10 px-1.5 py-0.5 font-sans text-[11px] text-white/60">Esc</kbd>}
				</button>
			)}
			{alive && trip.back === "esc" && (
				<div aria-live="polite" className="tvx-back pointer-events-none fixed left-1/2 z-[1100] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-gray-950/90 px-3.5 py-2 text-sm text-white/85 shadow-lg backdrop-blur-md" data-shown={shown && hint} style={{ bottom: dock + (phone ? 60 : 16) }}>
					<TvGlyph width={24} />
					{phone ? "The browser's Back returns to the TV" : "Esc returns to the TV"}
				</div>
			)}
			{/* The prototype's own readout, not part of the design. */}
			<button
				type="button"
				data-tvx-readout
				onClick={() => writeTrip({ ...trip, button: next(BUTTONS, trip.button) })}
				title="T: the next TV button. B: the next way back. L: the other place in the dock"
				className="fixed left-3 z-[1100] max-w-[70vw] truncate rounded-full bg-white px-3 py-1.5 text-left text-[12px] font-semibold text-black shadow-xl ring-2 ring-fuchsia-500"
				style={{ bottom: dock + 12 }}
			>
				{name} · {depth === 1 ? "1 page" : `${depth} pages`} from the TV ·{" "}
				{alive ? `TV button: ${BUTTONS.find((b) => b.key === design)?.name.toLowerCase()}${inDock ? `, in the dock (${trip.dock === "left" ? "left part" : "beside Search"})` : `, ${BACKS.find((b) => b.key === trip.back)?.name.toLowerCase()}`}` : "the way back has gone"}
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
			{trip && depth > 0 && <BackControls key={trip.back} trip={trip} depth={depth} shown={!transitionRunning()} />}
		</>
	)
}
