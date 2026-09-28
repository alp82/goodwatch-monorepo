// PROTOTYPE - throwaway. The mobile living room (#189), round 1: the same room, TV flow (`ask`), and final
// Remote ("Grid, tiles") on a phone. Four answers to "who holds the remote when the phone is in your hand":
//   couch     existing components: a portrait room (the locked room, extended down over your lap under the
//             blanket), the TV on top, the Remote in the graded hand below it. Tap the TV or press keys; the
//             remote turns a little toward what you touched (no beam, owner round 2).
//   remote    bolder: the phone IS the remote. The room shows the TV; the rest of the screen is the remote's
//             body, edge to edge: a touchpad (swipe to move, tap to choose), Back / Home / Search, the four
//             features in one row, the streaming keys. No hand: yours is already holding it.
//   touch     bolder: touch the TV itself, like a touchscreen. No remote on screen; the hub dock from the
//             navigation decision (#192) sits below, and its hub key picks the remote up: the hand rises from
//             the bottom edge. Tap the room to put it down.
//   sideways  couch in portrait, with an invitation to turn the phone. Turned sideways, the whole room: the
//             TV bigger than portrait allows, the hand and remote at the right edge. (?force=landscape shows the
//             landscape layout in a desktop browser at any size.)
// Rendering budget (#190): only transform and opacity animate, nothing loops at idle, no blend or live blur.
import { AnimatePresence, animate, motion, useMotionValue, useSpring } from "framer-motion"
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import type { LRData, LRServiceButton } from "~/server/prototype-start-living-room.server"
import { img } from "./channels"
import { GRIP_H, HAND, Icon, LR3_CSS, LR4_CSS, REMOTE_W, type TvSlot, useApi } from "./r3"
import { lcdLines, type Tv4 } from "./r4"
import { ICON, LR5_CSS, Services } from "./r5"
import { LR6_CSS } from "./r6"
import { type Feat, FEAT, Remote7, useFeat } from "./r7"
import { CHANNELS2, LR2_CSS } from "./remote2"
import { LR_CSS, Screen, type Zapper, useAutoPowerOn, useRemoteKeys, useZapper } from "./tv"

export type PhoneVariant = "couch" | "remote" | "touch" | "sideways"

export const PHONE_VARIANTS: Record<PhoneVariant, { name: string; kind: "existing components" | "bolder" }> = {
	couch: { name: "Couch: remote in hand", kind: "existing components" },
	remote: { name: "The phone is the remote", kind: "bolder" },
	touch: { name: "Touch the TV, remote on the hub key", kind: "bolder" },
	sideways: { name: "Turn sideways for the whole room", kind: "existing components" },
}

/** #224, the phone edition of the TV screens: an optional smaller canvas, something docked under the TV (in
 * page pixels), extra room between the TV and the remote, and a camera that leans in while `lean(t)` is true. */
export type PhoneTvOpts = {
	canvas?: { w: number; h: number }
	below?: (t: Tv4, tv: { x: number; y: number; w: number; h: number }, box: { cw: number; ch: number; landscape: boolean; remoteLeft: number }) => ReactNode
	gap?: number
	lean?: (t: Tv4) => boolean
}

// The camera leaning in: scale the room (transform only) so the TV fills most of the width (or height, sideways).
function leanOf(p: Placed, cw: number, ch: number, landscape: boolean) {
	const k = landscape ? Math.min((0.92 * cw) / p.tv.w, (0.86 * ch) / p.tv.h) : Math.min(cw / p.tv.w, 1.2)
	const tcx = cw / 2
	const tcy = landscape ? ch * 0.47 : Math.max(6, p.tv.y) + (k * p.tv.h) / 2
	const x = tcx - k * (p.tv.x + p.tv.w / 2)
	const y = tcy - k * (p.tv.y + p.tv.h / 2)
	return { k, x, y, dy: tcy + (k * p.tv.h) / 2 - (p.tv.y + p.tv.h) }
}

/** A room photo in its own pixel coordinates, with the TV's rectangle. */
export type PhoneRoom = { src: string; w: number; h: number; tv: { x: number; y: number; w: number; h: number }; alt: string }

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

// Scale and move the photo so the TV lands at (cx, top) with width w, while the photo still covers the box.
function place(room: PhoneRoom, cw: number, ch: number, want: { cx: number; top: number; w: number }) {
	let s = want.w / room.tv.w
	s = Math.max(s, cw / room.w, ch / room.h)
	const W = room.w * s
	const H = room.h * s
	let left = want.cx - (room.tv.x + room.tv.w / 2) * s
	let top = want.top - room.tv.y * s
	left = Math.min(0, Math.max(cw - W, left))
	top = Math.min(0, Math.max(ch - H, top))
	return { s, left, top, W, H, tv: { x: left + room.tv.x * s, y: top + room.tv.y * s, w: room.tv.w * s, h: room.tv.h * s } }
}
type Placed = ReturnType<typeof place>

function useBox() {
	const ref = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState({ cw: 0, ch: 0 })
	useIso(() => {
		const el = ref.current
		if (!el) return
		const m = () => setBox((b) => (b.cw === el.clientWidth && b.ch === el.clientHeight ? b : { cw: el.clientWidth, ch: el.clientHeight }))
		m()
		const ro = new ResizeObserver(m)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	return { ref, ...box }
}

// The shared brain: the zapper (power), the TV flow's state, the service keys, keyboard for desktop testing.
function usePhoneTv(tvSlot: TvSlot) {
	const z = useZapper(CHANNELS2.length)
	const { data: services } = useApi<LRServiceButton[]>({ op: "services" })
	const t = tvSlot.use(z, services ?? [])
	useAutoPowerOn(z)
	useRemoteKeys({ ...z, tune: (n: number) => (z.on ? t.step(n > z.ch ? 1 : -1) : z.setOn(true)) }, 0, (e) => {
		const k = e.key.toLowerCase()
		if (!z.on) return z.setOn(true)
		if (t.mode === "search") return
		if (k === "escape" || k === "backspace") t.back()
		if (k === "enter") t.ok()
	})
	return { z, t, services: services ?? [] }
}

// The room photo with the TV on the wall, placed by `p`. `onTap` hears every touch on the TV (for aiming).
function Room({ room, p, z, t, tvSlot, onTap, dim = 0, children, canvas }: { room: PhoneRoom; p: Placed; z: Zapper; t: Tv4; tvSlot: TvSlot; onTap?: (x: number, y: number) => void; dim?: number; children?: ReactNode; canvas?: { w: number; h: number } }) {
	const glow = "#fbbf24"
	const cx = `${((room.tv.x + room.tv.w / 2) / room.w) * 100}%`
	const cy = `${((room.tv.y + room.tv.h / 2) / room.h) * 100}%`
	return (
		<div className="absolute" style={{ left: p.left, top: p.top, width: p.W, height: p.H }}>
			<img src={room.src} alt={room.alt} className="absolute inset-0 h-full w-full select-none" draggable={false} />
			<motion.div className="absolute inset-0 bg-[#05060a]" initial={{ opacity: 0.6 }} animate={{ opacity: z.on ? 0.12 + dim : 0.6 }} transition={{ duration: 1.2, ease: "easeOut" }} />
			<motion.div
				className="pointer-events-none absolute inset-0"
				initial={false}
				animate={{ opacity: z.on ? 0.26 : 0 }}
				transition={{ duration: 0.6 }}
				style={{ background: `radial-gradient(45% 40% at ${cx} ${cy}, ${glow}55 0%, ${glow}1c 45%, ${glow}00 100%)` }}
			/>
			<motion.div
				className="absolute"
				style={{ left: `${(room.tv.x / room.w) * 100}%`, top: `${(room.tv.y / room.h) * 100}%`, width: `${(room.tv.w / room.w) * 100}%`, height: `${(room.tv.h / room.h) * 100}%` }}
				animate={{ boxShadow: z.on ? `0 0 60px 6px ${glow}33, 0 0 14px 1px ${glow}44` : "0 0 0px 0px rgba(0,0,0,0)" }}
				transition={{ duration: 0.6 }}
				onPointerDownCapture={(e) => onTap?.(e.clientX, e.clientY)}
			>
				<Screen
					z={z}
					channels={CHANNELS2}
					render={() => tvSlot.screen(t)}
					className="h-full w-full"
					pointer={false}
					swipe={false}
					osd={false}
						canvas={canvas}
					onPick={(el) => (z.on ? t.pick(el) : z.setOn(true))}
				/>
			</motion.div>
			{children}
		</div>
	)
}

// The final Remote in the graded hand, scaled to `s`, tipped back a little, turned by `yaw` (degrees).
function HandRemote({ s, z, t, services, handSrc, yaw, tip = 10 }: { s: number; z: Zapper; t: Tv4; services: LRServiceButton[]; handSrc: string; yaw: ReturnType<typeof useSpring>; tip?: number }) {
	const w = REMOTE_W * s
	const k = w / HAND.pw
	return (
		<motion.div className="relative will-change-transform" style={{ width: w, height: GRIP_H * s, originX: 0.5, originY: 1, transformPerspective: 1200, rotate: yaw, rotateX: tip }}>
			<img
				src={handSrc}
				alt=""
				aria-hidden
				draggable={false}
				className="pointer-events-none absolute max-w-none select-none"
				style={{ left: w / 2 - (HAND.x + HAND.pw / 2) * k, top: -HAND.y * k, width: HAND.w * k, height: HAND.h * k }}
			/>
			<div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${s})` }}>
				<Remote7 layout="tiles" z={z} t={t} services={services} pointing={false} grip={GRIP_H} />
			</div>
		</motion.div>
	)
}

// Aiming on a touch screen: nothing follows a finger that hovers, so the remote turns toward what was touched
// (or toward the TV's middle after a key press), then settles. Owner: no beam, in any variant.
// Owner, round 1: the turn was far too strong. It now turns a quarter of the way, at most 6 degrees.
function useAim(t: Tv4, tip: () => { x: number; y: number } | null, tvCenter: () => { x: number; y: number } | null, maxYaw = 6) {
	const yaw = useSpring(0, { stiffness: 220, damping: 28 })
	const last = useRef(0)
	const fire = (x: number, y: number) => {
		const a = tip()
		if (!a) return
		yaw.set(Math.max(-maxYaw, Math.min(maxYaw, ((Math.atan2(x - a.x, a.y - y) * 180) / Math.PI) * 0.25)))
		last.current = Date.now()
		setTimeout(() => yaw.set(0), 320)
	}
	// A key press: aim at the TV's middle, unless a touch on the TV just aimed.
	const first = useRef(true)
	useEffect(() => {
		if (first.current) {
			first.current = false
			return
		}
		if (Date.now() - last.current < 300) return
		const c = tvCenter()
		if (c) fire(c.x, c.y)
	}, [t.pulse])
	return { yaw, fire }
}

const CSS = `${LR_CSS} ${LR2_CSS} ${LR3_CSS} ${LR4_CSS} ${LR5_CSS} ${LR6_CSS}
html, body { overflow: hidden !important; }
.lrp-body { background: linear-gradient(180deg, #2a2b30 0%, #1c1d21 40%, #151619 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 -20px 50px rgba(0,0,0,0.6); }
.lrp-pad { background: radial-gradient(120% 90% at 50% 0%, #26272c, #121316 75%); box-shadow: inset 0 2px 8px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05), 0 1px 0 rgba(255,255,255,0.05); background-image: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1.2px), radial-gradient(120% 90% at 50% 0%, #26272c, #121316 75%); background-size: 14px 14px, 100% 100%; }
.lrp-dock { background: rgba(10,11,14,0.82); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 -10px 30px rgba(0,0,0,0.5); }
.lrp-hub { background: radial-gradient(circle at 50% 30%, #3a3b41, #1b1c20 75%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 14px rgba(0,0,0,0.6), 0 0 0 3px rgba(251,146,60,0.0); transition: transform 90ms; }
.lrp-hub:active { transform: scale(0.94); }
.lrp-hub-on { box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 2px #fdba74, 0 0 22px rgba(251,146,60,0.45); }
`

// The page box: under the site header, over the old bottom navigation (the new hub dock replaces it).
function Page({ full, children, boxRef }: { full?: boolean; children: ReactNode; boxRef: React.RefObject<HTMLDivElement> }) {
	return (
		<div ref={boxRef} className={`lr-root fixed inset-x-0 bottom-0 overflow-hidden bg-[#07080b] text-white ${full ? "top-0 z-[1001]" : "top-16 z-[60]"}`}>
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			{children}
		</div>
	)
}

function FirstHint({ t, text, className, style }: { t: Tv4; text: ReactNode; className: string; style?: React.CSSProperties }) {
	return (
		<AnimatePresence>
			{t.pulse === 0 && (
				<motion.div
					style={style}
					className={`pointer-events-none absolute z-10 rounded-2xl bg-black/65 px-3.5 py-2 text-[13px] font-semibold leading-snug text-white shadow-2xl ring-1 ring-white/15 ${className}`}
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, transition: { duration: 0.2 } }}
					transition={{ delay: 2.4, duration: 0.4 }}
				>
					{text}
				</motion.div>
			)}
		</AnimatePresence>
	)
}

// ---------------------------------------------------------------------------------------------------------
// couch: portrait room, TV on top, remote in hand below.

function Couch({ tall, handSrc, tvSlot, rotateHint, opts }: { tall: PhoneRoom; handSrc: string; tvSlot: TvSlot; rotateHint?: boolean; opts?: PhoneTvOpts }) {
	const { ref, cw, ch } = useBox()
	const { z, t, services } = usePhoneTv(tvSlot)
	const p = cw ? place(tall, cw, ch, { cx: cw / 2, top: Math.max(14, ch * 0.035), w: cw * 0.92 }) : null
	// The remote: under the TV, over the coffee table and the blanket; the streaming keys (about 700 remote
	// pixels down) stay on screen, the grip runs off the bottom under the hand.
	const top = p ? p.tv.y + p.tv.h + Math.max(26, ch * 0.05) + (opts?.gap ?? 0) : 0
	const s = p ? Math.min((cw * 0.66) / REMOTE_W, (ch - top - 10) / 700, 1) : 0
	const left = cw / 2 - (REMOTE_W * s) / 2
	const leaning = opts?.lean?.(t) ?? false
	const aim = useAim(
		t,
		() => (p ? { x: cw / 2, y: top + 14 * s } : null),
		() => (p ? { x: p.tv.x + p.tv.w / 2, y: p.tv.y + p.tv.h / 2 } : null),
	)
	return (
		<Page boxRef={ref}>
			{p && (
				<>
					<Leaning on={leaning} l={leanOf(p, cw, ch, false)}>
							<Room room={tall} p={p} z={z} t={t} tvSlot={tvSlot} canvas={opts?.canvas} onTap={(x, y) => aim.fire(x, y - (ref.current?.getBoundingClientRect().top ?? 0))} />
						</Leaning>
						<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_30%,transparent_55%,rgba(0,0,0,0.5)_100%)]" />
						{opts?.below?.(t, p.tv, { cw, ch, landscape: false, remoteLeft: left })}
						<motion.div className="absolute" style={{ left, top }} initial={false} animate={{ y: leaning ? leanOf(p, cw, ch, false).dy : 0 }} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.1, 1] }}>
							<HandRemote s={s} z={z} t={t} services={services} handSrc={handSrc} yaw={aim.yaw} />
						</motion.div>
					<FirstHint t={t} className="left-1/2 -translate-x-1/2 whitespace-nowrap !py-1.5 !text-[12px]" style={{ top: p.tv.y + p.tv.h + 8 }} text={<>Tap the TV or use the remote. <span className="text-amber-300">Both work.</span></>} />
					{rotateHint && <RotateHint />}
				</>
			)}
		</Page>
	)
}

function Leaning({ on, l, children }: { on: boolean; l: ReturnType<typeof leanOf>; children: ReactNode }) {
	return (
		<motion.div className="absolute inset-0 origin-top-left" initial={false} animate={on ? { x: l.x, y: l.y, scale: l.k } : { x: 0, y: 0, scale: 1 }} transition={{ duration: on ? 0.55 : 0.8, ease: [0.2, 0.7, 0.1, 1] }}>
			{children}
		</motion.div>
	)
}

function RotateHint() {
	const [gone, setGone] = useState(false)
	return (
		<AnimatePresence>
			{!gone && (
				<motion.button
					type="button"
					onClick={() => setGone(true)}
					className="absolute left-3 top-3 z-20 flex items-center gap-2.5 rounded-2xl bg-black/70 py-2 pl-2.5 pr-3.5 text-left text-[12.5px] font-semibold leading-tight text-white shadow-2xl ring-1 ring-white/15"
					initial={{ opacity: 0, y: -6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ delay: 1.2, duration: 0.4 }}
				>
					<motion.svg viewBox="0 0 24 24" className="h-7 w-7 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.6" initial={{ rotate: 0 }} animate={{ rotate: -90 }} transition={{ delay: 2, duration: 0.7, ease: "easeInOut" }}>
						<rect x="7" y="3" width="10" height="18" rx="2" />
						<path d="M11 18h2" />
					</motion.svg>
					<span>
						Turn your phone
						<br />
						<span className="font-normal text-white/70">for the whole room</span>
					</span>
				</motion.button>
			)}
		</AnimatePresence>
	)
}

// ---------------------------------------------------------------------------------------------------------
// sideways: landscape. The whole room, the remote at the right edge.

function Sideways({ wide, tall, handSrc, tvSlot, force, opts }: { wide: PhoneRoom; tall: PhoneRoom; handSrc: string; tvSlot: TvSlot; force: boolean; opts?: PhoneTvOpts }) {
	const [landscape, setLandscape] = useState(force)
	useIso(() => {
		if (force) return
		const m = window.matchMedia("(orientation: landscape) and (max-height: 540px)")
		const on = () => setLandscape(m.matches)
		on()
		m.addEventListener("change", on)
		return () => m.removeEventListener("change", on)
	}, [force])
	if (!landscape) return <Couch tall={tall} handSrc={handSrc} tvSlot={tvSlot} rotateHint opts={opts} />
	return <Landscape room={wide} handSrc={handSrc} tvSlot={tvSlot} opts={opts} />
}

function Landscape({ room, handSrc, tvSlot, opts }: { room: PhoneRoom; handSrc: string; tvSlot: TvSlot; opts?: PhoneTvOpts }) {
	const { ref, cw, ch } = useBox()
	const { z, t, services } = usePhoneTv(tvSlot)
	// Owner, round 1: the remote in the middle, like the desktop. Full screen (the header would take a sixth
	// of the height); the TV centered on top, the hand and remote centered under it, tipped toward the screen.
	const tvH = ch * 0.44
	const p = cw ? place(room, cw, ch, { cx: cw / 2, top: ch * 0.04, w: Math.min(cw * 0.7, (tvH * room.tv.w) / room.tv.h) }) : null
	const s = Math.min(ch / 760, 0.6)
	const left = cw / 2 - (REMOTE_W * s) / 2
	// Tipped back, the remote's top looks lower than it is: start it a little higher.
	const top = p ? p.tv.y + p.tv.h - 22 : 0
	// Only the screen, the pad, and Back / Home / Search fit under the TV. Drag the remote up to reach the
	// feature keys and the streaming keys; it may cover the bottom of the TV while it's lifted.
	const lift = Math.max(0, top + 700 * s - ch + 8)
	const y = useMotionValue(0)
	const aim = useAim(
		t,
		() => ({ x: cw / 2, y: top + y.get() + 14 * s }),
		() => (p ? { x: p.tv.x + p.tv.w / 2, y: p.tv.y + p.tv.h / 2 } : null),
	)
	const [lifted, setLifted] = useState(false)
	const leaning = opts?.lean?.(t) ?? false
	const settle = (up: boolean) => {
		setLifted(up)
		animate(y, up ? -lift : 0, { type: "spring", stiffness: 320, damping: 34 })
	}
	return (
		<Page boxRef={ref} full>
			{p && (
				<>
					<Leaning on={leaning} l={leanOf(p, cw, ch, true)}>
							<Room room={room} p={p} z={z} t={t} tvSlot={tvSlot} canvas={opts?.canvas} onTap={(x, yy) => aim.fire(x, yy)} />
						</Leaning>
						<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_35%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
						{opts?.below?.(t, p.tv, { cw, ch, landscape: true, remoteLeft: left })}
						{/* Leaning in, the remote drops to the bottom edge: its screen and pad still peek over it. */}
						<motion.div className="pointer-events-none absolute inset-0" initial={false} animate={{ y: leaning ? ch - top - 64 : 0 }} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.1, 1] }}>
						<motion.div
						className="pointer-events-auto absolute touch-none"
							style={{ left, top, y }}
						drag="y"
						dragConstraints={{ top: -lift, bottom: 0 }}
						dragElastic={0.08}
						dragMomentum={false}
						onDragEnd={(_, info) => settle(info.velocity.y < -150 || (info.velocity.y <= 150 && y.get() < -lift / 2))}
					>
						<HandRemote s={s} z={z} t={t} services={services} handSrc={handSrc} yaw={aim.yaw} tip={12} />
						</motion.div>
						</motion.div>
					<button
						type="button"
						onClick={() => settle(!lifted)}
						className="absolute bottom-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11.5px] font-semibold text-white/80 ring-1 ring-white/10"
						style={{ left: left + REMOTE_W * s + 14 }}
					>
						<svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${lifted ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
							<path d="M6 15l6-6 6 6" />
						</svg>
						{lifted ? "Lower the remote" : "Lift for more keys"}
					</button>
					<a href="/" onClick={(e) => e.preventDefault()} className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 py-1.5 pl-2 pr-3 text-[12px] font-semibold text-white/85 ring-1 ring-white/10">
						<img src={gwLogo} alt="" className="h-4" />
						GoodWatch
					</a>
				</>
			)}
		</Page>
	)
}

// ---------------------------------------------------------------------------------------------------------
// remote: the phone is the remote.

function PhoneIsRemote({ wide, tvSlot }: { wide: PhoneRoom; tvSlot: TvSlot }) {
	const { ref, cw, ch } = useBox()
	const { z, t, services } = usePhoneTv(tvSlot)
	// The room: a landscape window with the TV almost edge to edge, the sideboard under it, then the body.
	// The body keeps what it needs (about 430 px); the room gets the rest, so the sideboard and the table
	// still show under the TV. Only that window has to be covered, not the whole screen.
	const roomH = Math.max(Math.round(12 + ((cw * 0.94) / wide.tv.w) * wide.tv.h + 40), ch - Math.min(ch * 0.6, 440))
	const p = cw ? place(wide, cw, roomH + 28, { cx: cw / 2, top: 12, w: cw * 0.94 }) : null
	const f = useFeat(t)
	const [head, line] = lcdLines(t, services)
	const buzz = () => {
		try {
			navigator.vibrate?.(8)
		} catch {}
	}
	return (
		<Page boxRef={ref}>
			{p && (
				<>
					<div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: roomH + 28 }}>
						<Room room={wide} p={p} z={z} t={t} tvSlot={tvSlot} />
					</div>
					<div
						className="lrp-body absolute inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-[30px] px-4 pb-4 pt-3"
						style={{ top: roomH }}
						role="group"
						aria-label="Remote control"
						onPointerDownCapture={(e) => {
							buzz()
							if (!z.on) {
								e.stopPropagation()
								z.setOn(true)
							}
						}}
					>
						<div className="flex items-center gap-3">
							<div className="lr2-lcd lr5-lcd relative min-w-0 flex-1 overflow-hidden rounded-[14px] px-3 py-1.5">
								<div className="lr-vt truncate text-[19px] leading-none text-[var(--lcd)]">{head}</div>
								<div className="mt-1 truncate text-[10.5px] text-[var(--lcd)] opacity-80">{line}</div>
							</div>
							<button
								type="button"
								aria-label={z.on ? "Turn off" : "Turn on"}
								onClick={() => {
									t.click()
									z.setOn(!z.on)
								}}
								className="lr2-key flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rose-400"
							>
								<Icon d={ICON.power} className="h-4 w-4" />
							</button>
						</div>
						<Touchpad t={t} />
						<div className="flex items-center gap-3">
							<button type="button" onClick={() => (t.click(), t.back())} className="lr2-key flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[12px] font-semibold uppercase tracking-wider">
								<Icon d={ICON.back} className="h-[18px] w-[18px]" />
								Back
							</button>
							<button type="button" aria-label="Home" onClick={() => (t.click(), t.home())} className="lr2-key flex h-14 w-14 shrink-0 items-center justify-center rounded-full">
								<Icon d={ICON.home} className="h-6 w-6" />
							</button>
							<button
								type="button"
								aria-pressed={t.mode === "search"}
								onClick={() => t.pickMode("search")}
								className={`lr2-key flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[12px] font-semibold uppercase tracking-wider ${t.mode === "search" ? "lr2-key-on" : ""}`}
							>
								<Icon d={ICON.search} className="h-[18px] w-[18px]" />
								Search
							</button>
						</div>
						<div className="grid grid-cols-4 gap-2">
							{(["mood", "watchnext", "explorer", "taste"] as Feat[]).map((k) => (
								<button
									key={k}
									type="button"
									aria-pressed={f.on(k)}
									onClick={() => f.run(k)}
									className={`lr2-key flex h-[58px] flex-col items-center justify-center gap-1.5 rounded-[16px] text-[10px] font-semibold uppercase tracking-wide ${f.on(k) ? "lr2-key-on" : ""}`}
								>
									<Icon d={FEAT[k].d} className="h-5 w-5" />
									{FEAT[k].label}
								</button>
							))}
						</div>
						<Services t={t} services={services} caps={false} cols={4} />
					</div>
				</>
			)}
		</Page>
	)
}

// Swipe to move the focus (one step per 34 px of travel, either axis), tap to choose. A ripple shows the touch.
function Touchpad({ t }: { t: Tv4 }) {
	const start = useRef<{ x: number; y: number; at: number; used: number } | null>(null)
	const [ripple, setRipple] = useState<{ id: number; x: number; y: number } | null>(null)
	const STEP = 34
	return (
		<div
			className="lrp-pad relative min-h-[120px] flex-1 touch-none select-none overflow-hidden rounded-[26px]"
			role="button"
			tabIndex={0}
			aria-label="Touchpad: swipe to move, tap to choose"
			onPointerDown={(e) => {
				;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
				const b = e.currentTarget.getBoundingClientRect()
				start.current = { x: e.clientX, y: e.clientY, at: Date.now(), used: 0 }
				setRipple({ id: Date.now(), x: e.clientX - b.left, y: e.clientY - b.top })
			}}
			onPointerMove={(e) => {
				const s = start.current
				if (!s) return
				const dx = e.clientX - s.x
				const dy = e.clientY - s.y
				const d = Math.abs(dx) > Math.abs(dy) ? dx : dy
				const n = Math.trunc(d / STEP)
				while (s.used < n) {
					s.used++
					t.step(1)
				}
				while (s.used > n) {
					s.used--
					t.step(-1)
				}
			}}
			onPointerUp={(e) => {
				const s = start.current
				start.current = null
				if (s && s.used === 0 && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 12 && Date.now() - s.at < 400) {
					t.click()
					t.ok()
				}
			}}
			onKeyDown={(e) => e.key === "Enter" && t.ok()}
		>
			<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/30">
				<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
					<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" />
				</svg>
				<span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Swipe to move · tap to choose</span>
			</div>
			<AnimatePresence>
				{ripple && (
					<motion.div
						key={ripple.id}
						className="pointer-events-none absolute h-16 w-16 rounded-full bg-white/15"
						style={{ left: ripple.x - 32, top: ripple.y - 32 }}
						initial={{ scale: 0.3, opacity: 0.9 }}
						animate={{ scale: 1.6, opacity: 0 }}
						transition={{ duration: 0.45, ease: "easeOut" }}
					/>
				)}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// touch: the TV is a touchscreen; the hub key picks up the remote.

function TouchTv({ tall, handSrc, tvSlot, data }: { tall: PhoneRoom; handSrc: string; tvSlot: TvSlot; data: LRData }) {
	const { ref, cw, ch } = useBox()
	const { z, t, services } = usePhoneTv(tvSlot)
	const [up, setUp] = useState(false)
	const DOCK = 76
	const p = cw ? place(tall, cw, ch - DOCK, { cx: cw / 2, top: Math.max(14, ch * 0.05), w: cw * 0.96 }) : null
	const s = p ? Math.min((cw * 0.7) / REMOTE_W, (ch - DOCK - (p.tv.y + p.tv.h + 18) - 10) / 700, 1) : 0
	const remoteTop = p ? p.tv.y + p.tv.h + 18 : 0
	const aim = useAim(
		t,
		() => (p ? { x: cw / 2, y: remoteTop + 14 * s } : null),
		() => (p ? { x: p.tv.x + p.tv.w / 2, y: p.tv.y + p.tv.h / 2 } : null),
	)
	const tonight = data.lineup[0]
	return (
		<Page boxRef={ref}>
			{p && (
				<>
					<div className="absolute inset-x-0 top-0 overflow-hidden" style={{ bottom: DOCK }}>
						<Room room={tall} p={p} z={z} t={t} tvSlot={tvSlot} dim={up ? 0.25 : 0} onTap={(x, y) => up && aim.fire(x, y - (ref.current?.getBoundingClientRect().top ?? 0))} />
						<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_30%,transparent_55%,rgba(0,0,0,0.5)_100%)]" />
						{/* Tapping the room (not the TV, not the remote) puts the remote down. */}
						{up && <button type="button" aria-label="Put the remote down" className="absolute inset-x-0 bottom-0" style={{ top: p.tv.y + p.tv.h }} onClick={() => setUp(false)} />}
						<motion.div
							className="absolute"
							style={{ left: cw / 2 - (REMOTE_W * s) / 2, top: remoteTop }}
							initial={false}
							animate={{ y: up ? 0 : ch, opacity: up ? 1 : 0 }}
							transition={up ? { type: "spring", stiffness: 260, damping: 30 } : { duration: 0.28, ease: "easeIn" }}
						>
							<HandRemote s={s} z={z} t={t} services={services} handSrc={handSrc} yaw={aim.yaw} />
						</motion.div>
							<FirstHint t={t} className="left-1/2 -translate-x-1/2 whitespace-nowrap" text={<>Touch the TV. <span className="text-amber-300">It's a touchscreen.</span></>} />
					</div>
					<div className="lrp-dock absolute inset-x-0 bottom-0 flex items-center justify-between px-5" style={{ height: DOCK }}>
						<button type="button" className="flex items-center gap-2.5 text-left">
							{tonight?.poster && <img src={img(tonight.poster, "w92")} alt="" className="h-12 w-8 rounded-[5px] object-cover ring-1 ring-white/15" />}
							<span className="text-[11px] font-semibold leading-tight text-white/60">
								Tonight
								<br />
								<span className="text-[13px] text-white/90">{tonight?.title.slice(0, 14)}</span>
							</span>
						</button>
						<button type="button" aria-label={up ? "Put the remote down" : "Pick up the remote"} aria-pressed={up} onClick={() => setUp((u) => !u)} className={`lrp-hub -mt-7 flex h-[68px] w-[68px] items-center justify-center rounded-full ${up ? "lrp-hub-on" : ""}`}>
							<svg viewBox="0 0 24 24" className="h-7 w-7 text-white/90" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
								<rect x="8" y="2.5" width="8" height="19" rx="4" />
								<circle cx="12" cy="8.5" r="2" />
								<path d="M10.5 14h3M10.5 17h3" />
							</svg>
						</button>
						<button type="button" onClick={() => (setUp(true), t.pickMode("search"))} className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[13px] font-semibold text-white/85 ring-1 ring-white/10">
							<Icon d={ICON.search} className="h-4 w-4" />
							Search
						</button>
					</div>
				</>
			)}
		</Page>
	)
}

export function LivingRoomPhone({ variant, tall, wide, handSrc, tvSlot, data, force, opts }: { variant: PhoneVariant; tall: PhoneRoom; wide: PhoneRoom; handSrc: string; tvSlot: TvSlot; data: LRData; force: boolean; opts?: PhoneTvOpts }) {
	if (variant === "remote") return <PhoneIsRemote wide={wide} tvSlot={tvSlot} />
	if (variant === "touch") return <TouchTv tall={tall} handSrc={handSrc} tvSlot={tvSlot} data={data} />
	if (variant === "sideways") return <Sideways wide={wide} tall={tall} handSrc={handSrc} tvSlot={tvSlot} force={force} opts={opts} />
	return <Couch tall={tall} handSrc={handSrc} tvSlot={tvSlot} />
}
