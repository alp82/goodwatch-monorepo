// PROTOTYPE - throwaway. Round 5 of the living room: the final Remote (#186). Owner on round 4: likes the dark
// "current" look but still wants changes. Open points: which controls earn a place, the key shapes and
// printing, the small screen's role, how the wheel feels, and how the remote sits in the hand photo.
//
// Every design keeps the round 4 material (dark body, green screen, knurled keys) and drives the same round 4
// TV. What varies: the controls, their grouping, the keys, the screen, and the wheel. All round 5 bodies have
// the corner radius of the hand photo's placeholder, so no room shows through at the bottom corners.
import { motion } from "framer-motion"
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import disneyMark from "~/img/disneyplus-logo.svg"
import huluMark from "~/img/hulu-logo.png"
import netflixMark from "~/img/netflix-logo.svg"
import primeMark from "~/img/primevideo-logo.svg"
import type { LRServiceButton } from "~/server/prototype-start-living-room.server"
import { Icon, Small } from "./r3"
import { REMOTE_SERVICES, Remote4, type Tv4, lcdLines } from "./r4"
import { Wheel } from "./remote2"
import type { Zapper } from "./tv"

export type Design = "r4" | "refined" | "softkeys" | "screenless" | "essentials"
export type Feel = "knurl" | "detent" | "touch"

export const DESIGNS: Record<Design, { name: string; wheel: Feel; idea: string }> = {
	r4: { name: "Round 4 (reference)", wheel: "knurl", idea: "Unchanged, for comparison." },
	refined: {
		name: "Refined",
		wheel: "detent",
		idea: "Same controls as round 4. Round keys with the label printed on the body, a one-line screen, bigger streaming keys.",
	},
	softkeys: {
		name: "Soft keys",
		wheel: "detent",
		idea: "The screen labels the two keys under it, and the labels change with the TV: Mood and Search, Clear and Go, Next and Done. Colored streaming keys.",
	},
	screenless: {
		name: "No screen",
		wheel: "touch",
		idea: "No screen: the TV already says everything. A light ring around the wheel shows Mood or Search. Bigger wheel.",
	},
	essentials: {
		name: "Essentials",
		wheel: "detent",
		idea: "Fewest keys: Back, Home, Search. Mood lives on the TV's More menu. More room for everything else.",
	},
}

export const FEELS: Record<Feel, string> = {
	knurl: "Knurled ring, turns freely (round 4)",
	detent: "Clicks into place every step",
	touch: "Flat touch ring, a light follows your thumb",
}

export const ICON = {
	back: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
	home: "M3 11l9-7 9 7M5 10v10h14V10",
	mood: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01",
	search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
	power: "M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0",
}

export type Props = { z: Zapper; t: Tv4; services: LRServiceButton[]; pointing: boolean; grip?: number }

export function Remote5({ design, feel, ...p }: Props & { design: Design; feel?: Feel }) {
	if (design === "r4") return <Remote4 {...p} />
	const wheel = feel ?? DESIGNS[design].wheel
	const { t } = p
	const keys = (list: ("back" | "home" | "mood" | "search")[], size = 54) => (
		<div className="flex w-full items-start justify-between px-1">
			{list.map((k) => (
				<RoundKey key={k} k={k} t={t} size={size} />
			))}
		</div>
	)
	if (design === "refined")
		return (
			<Shell {...p}>
				<Lcd t={t} services={p.services} />
				<Dial t={t} z={p.z} feel={wheel} size={220} />
				{keys(["back", "home", "mood", "search"])}
				<Services t={t} services={p.services} caps={false} cols={2} />
			</Shell>
		)
	if (design === "softkeys")
		return (
			<Shell {...p}>
				<SoftScreen t={t} services={p.services} />
				<Dial t={t} z={p.z} feel={wheel} size={214} />
				<div className="flex w-full justify-between px-6">
					<RoundKey k="back" t={t} size={56} />
					<RoundKey k="home" t={t} size={56} />
				</div>
				<Services t={t} services={p.services} caps cols={4} />
			</Shell>
		)
	if (design === "screenless")
		return (
			<Shell {...p} logo>
				<Dial t={t} z={p.z} feel={wheel} size={240} ring />
				{keys(["back", "home", "mood", "search"], 56)}
				<Services t={t} services={p.services} caps cols={2} />
			</Shell>
		)
	return (
		<Shell {...p}>
			<Lcd t={t} services={p.services} />
			<Dial t={t} z={p.z} feel={wheel} size={226} />
			<div className="flex w-full justify-between px-3">
				<RoundKey k="back" t={t} size={60} />
				<RoundKey k="home" t={t} size={60} />
				<RoundKey k="search" t={t} size={60} />
			</div>
			<Services t={t} services={p.services} caps={false} cols={2} tall />
		</Shell>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The body: the round 4 material, the hand photo's corner radius, power and the IR window on top.

export function Shell({ z, t, pointing, grip, logo, gap = "gap-[18px]", className = "", children }: Props & { logo?: boolean; gap?: string; className?: string; children: ReactNode }) {
	const [blink, setBlink] = useState(0)
	const waking = useRef(false)
	useEffect(() => setBlink((b) => b + 1), [t.pulse])
	return (
		<div
			className={`lr2-remote lr3-remote relative select-none ${className}`}
			role="group"
			aria-label="Remote control"
			// While the set is off, any press only turns it on.
			onPointerDownCapture={(e) => {
				if (z.on) return
				waking.current = true
				e.stopPropagation()
				z.setOn(true)
				t.click()
			}}
			onClickCapture={(e) => {
				if (!waking.current) return
				waking.current = false
				e.stopPropagation()
				e.preventDefault()
			}}
		>
			<div className={`lr2-body lr3-body lr5-body relative flex flex-col items-center ${gap} px-6 pb-6 pt-4`} style={grip ? { minHeight: grip } : undefined}>
				<div className="flex w-full items-center justify-between">
					<button
						type="button"
						aria-label={z.on ? "Turn off" : "Turn on"}
						onClick={() => {
							t.click()
							z.setOn(!z.on)
						}}
						className="lr2-key flex h-9 w-9 items-center justify-center rounded-full text-rose-400"
					>
						<Icon d={ICON.power} className="h-4 w-4" />
					</button>
					<div className="lr3-ir relative h-2 w-20 rounded-full bg-black/70">
						<motion.div className="absolute inset-0 rounded-full bg-orange-400" animate={{ opacity: pointing ? 0.9 : 0 }} transition={{ duration: 0.2 }} style={{ boxShadow: "0 0 14px 3px rgba(251,146,60,0.7)" }} />
						<motion.div key={blink} className="absolute inset-0 rounded-full bg-sky-300" initial={{ opacity: blink > 1 ? 1 : 0 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} />
					</div>
					<span className="h-9 w-9" aria-hidden />
				</div>
				{logo && (
					<div className="-mt-2 flex items-center gap-1.5 opacity-45">
						<img src={gwLogo} alt="" className="h-3.5" />
						<span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white">GoodWatch</span>
					</div>
				)}
				{children}
				{grip ? (
					<>
						<div className="flex-1" />
						<img src={gwLogo} alt="" className="mb-2 h-7 opacity-20" />
					</>
				) : null}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Keys. Round keys carry an icon; their name is printed on the body underneath, like real remotes.

export const KEY_LABEL = { back: "Back", home: "Home", mood: "Mood", search: "Search" } as const

export function RoundKey({ k, t, size }: { k: keyof typeof KEY_LABEL; t: Tv4; size: number }) {
	const on = (k === "mood" && t.top.k === "moods") || (k === "mood" && t.mode === "mood") || (k === "search" && t.mode === "search")
	const act = () => {
		if (k === "back") {
			t.click()
			t.back()
		} else if (k === "home") {
			t.click()
			t.home()
		} else t.pickMode(k)
	}
	return (
		<div className="flex flex-col items-center gap-1.5">
			<button
				type="button"
				aria-label={KEY_LABEL[k]}
				aria-pressed={k === "mood" || k === "search" ? on : undefined}
				onClick={act}
				className={`lr2-key flex items-center justify-center rounded-full ${on ? "lr2-key-on" : ""}`}
				style={{ width: size, height: size }}
			>
				<Icon d={ICON[k]} className="h-5 w-5" />
			</button>
			<span className="lr5-print" aria-hidden>
				{KEY_LABEL[k]}
			</span>
		</div>
	)
}

// Streaming keys. Printed: one key shape with the brand's wordmark (round 4). Caps: the key is the brand's
// color, the wordmark knocked out in white, like many TV remotes print them.
const BRAND: Record<(typeof REMOTE_SERVICES)[number], { src: string; ink: string; cap: string; capInk: string; w: string }> = {
	netflix: { src: netflixMark, ink: "#e50914", cap: "#b20710", capInk: "#ffffff", w: "78%" },
	prime: { src: primeMark, ink: "#ffffff", cap: "#1a73c8", capInk: "#ffffff", w: "80%" },
	disney: { src: disneyMark, ink: "#ffffff", cap: "#122a7a", capInk: "#ffffff", w: "62%" },
	hulu: { src: huluMark, ink: "#1ce783", cap: "#1ce783", capInk: "#0b0c0f", w: "64%" },
}

export function Services({ t, services, caps, cols, tall }: { t: Tv4; services: LRServiceButton[]; caps: boolean; cols: 2 | 4; tall?: boolean }) {
	return (
		<div className={`grid w-full gap-2 ${cols === 2 ? "grid-cols-2 px-2" : "grid-cols-4"}`}>
			{REMOTE_SERVICES.filter((key) => services.some((x) => x.key === key)).map((key) => {
				const on = t.mix.service === key
				const label = services.find((x) => x.key === key)?.label ?? key
				const b = BRAND[key]
				const mask = `url("${b.src}") center / contain no-repeat`
				return (
					<button
						key={key}
						type="button"
						aria-pressed={on}
						aria-label={`Only ${label}`}
						title={`Only ${label}`}
						onClick={() => t.pickService(key)}
						className={`${caps ? "lr5-cap" : "lr2-key"} flex items-center justify-center ${cols === 2 ? "rounded-full" : "rounded-xl"} ${tall ? "h-12" : cols === 2 ? "h-10" : "h-11"} ${on ? "lr5-on" : ""}`}
						style={caps ? { background: `linear-gradient(180deg, color-mix(in srgb, ${b.cap} 88%, white), ${b.cap})` } : undefined}
					>
						{/* Quoted: small SVGs are inlined as data URLs, which break an unquoted url(). */}
						<span aria-hidden className="block h-[52%]" style={{ width: cols === 2 ? `calc(${b.w} * 0.62)` : b.w, background: caps ? b.capInk : b.ink, WebkitMask: mask, mask }} />
					</button>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Screens. A one-line screen (what the wheel does now), or a screen that also labels the two keys under it.

function useSearchFocus(t: Tv4) {
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (t.mode === "search") input.current?.focus({ preventScroll: true })
	}, [t.mode])
	return input
}

function SearchLine({ t, input }: { t: Tv4; input: RefObject<HTMLInputElement> }) {
	return (
		<form
			className="relative"
			onSubmit={(e) => {
				e.preventDefault()
				t.submit()
			}}
		>
			<input
				ref={input}
				value={t.draft}
				onChange={(e) => t.setDraft(e.target.value)}
				placeholder="What do you feel like?"
				maxLength={120}
				aria-label="Search"
				className="w-full bg-transparent text-[16px] font-medium text-white placeholder:text-white/35 focus:outline-none"
			/>
			<div className="mt-0.5 h-px w-full bg-[var(--lcd)] opacity-40" />
		</form>
	)
}

export function Lcd({ t, services }: { t: Tv4; services: LRServiceButton[] }) {
	const input = useSearchFocus(t)
	const [head, line] = lcdLines(t, services)
	return (
		<div className="lr2-lcd lr5-lcd relative h-[64px] w-full overflow-hidden rounded-[16px] px-4 py-2.5">
			<div className="relative">
				{t.mode === "search" ? <SearchLine t={t} input={input} /> : <div className="lr-vt truncate text-[24px] leading-none text-[var(--lcd)]">{head}</div>}
				<Small>{t.mode === "search" ? "Enter to search, turn for ideas" : line}</Small>
			</div>
			<div className="pointer-events-none absolute inset-0 rounded-[16px] bg-[linear-gradient(160deg,rgba(255,255,255,0.10)_0%,transparent_35%)]" />
		</div>
	)
}

// The two soft keys do what the screen prints above them, and that changes with what's on the TV.
function softActions(t: Tv4): [{ label: string; run: () => void }, { label: string; run: () => void }] {
	const mood = { label: "Mood", run: () => t.pickMode("mood") }
	const search = { label: "Search", run: () => t.pickMode("search") }
	if (t.mode === "search" || t.top.k === "keyboard")
		return [
			{ label: "Clear", run: () => (t.click(), t.setDraft("")) },
			{ label: "Go", run: () => (t.click(), t.submit()) },
		]
	if (t.mode === "mood" || t.top.k === "moods") return [{ label: "Moods", run: () => t.pickMode("mood") }, { label: "Done", run: () => t.ok() }]
	if (t.top.k === "picks") return [{ label: "More", run: () => t.step(1) }, { label: t.loved.length >= 3 ? "Done" : `${t.loved.length}/3`, run: () => t.ok() }]
	return [mood, search]
}

function SoftScreen({ t, services }: { t: Tv4; services: LRServiceButton[] }) {
	const input = useSearchFocus(t)
	const [head, line] = lcdLines(t, services)
	const [a, b] = softActions(t)
	return (
		<div className="flex w-full flex-col items-stretch gap-2">
			<div className="lr2-lcd lr5-lcd relative h-[92px] w-full overflow-hidden rounded-[16px] px-4 pt-2.5">
				<div className="relative">
					{t.mode === "search" ? <SearchLine t={t} input={input} /> : <div className="lr-vt truncate text-[24px] leading-none text-[var(--lcd)]">{head}</div>}
					<Small>{t.mode === "search" ? "Turn for ideas" : line}</Small>
				</div>
				{/* The labels sit on the screen's bottom edge, right above their keys. */}
				<div className="absolute inset-x-0 bottom-0 flex justify-between border-t border-[var(--lcd)]/25 px-4 py-1">
					<span className="lr-vt text-[18px] leading-none text-[var(--lcd)]">◂ {a.label}</span>
					<span className="lr-vt text-[18px] leading-none text-[var(--lcd)]">{b.label} ▸</span>
				</div>
				<div className="pointer-events-none absolute inset-0 rounded-[16px] bg-[linear-gradient(160deg,rgba(255,255,255,0.10)_0%,transparent_35%)]" />
			</div>
			<div className="flex justify-between px-1">
				<button type="button" onClick={a.run} aria-label={a.label} className="lr2-key h-7 w-[108px] rounded-full" />
				<button type="button" onClick={b.run} aria-label={b.label} className="lr2-key h-7 w-[108px] rounded-full" />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The wheel, three ways. Knurl is round 4's. Detent snaps to a notch every step with a small overshoot, like
// a volume knob. Touch is a flat ring that doesn't move; a soft light follows your thumb. All three turn by
// dragging around the ring or scrolling, and all animate transform or opacity only.

const DETENT = 30

function Dial({ t, z, feel, size, ring }: { t: Tv4; z: Zapper; feel: Feel; size: number; ring?: boolean }) {
	const mode = t.mode === "mood" || t.top.k === "moods" ? "mood" : t.mode === "search" || t.top.k === "keyboard" ? "search" : null
	const wheel =
		feel === "knurl" ? (
			<Wheel z={z} r={{ mode: t.mode, step: t.step, ok: t.ok, click: t.click, okLabel: t.okLabel, up: () => t.step(-1), down: () => t.step(1) }} size={size} />
		) : (
			<Turner t={t} feel={feel} size={size} />
		)
	if (!ring) return wheel
	// No screen: a ring of light around the wheel says what it does. Static color, no looping glow.
	const color = mode === "mood" ? "rgba(251,146,60,0.9)" : mode === "search" ? "rgba(125,211,252,0.9)" : "rgba(255,255,255,0.08)"
	return (
		<div className="flex flex-col items-center gap-2">
			<div className="relative rounded-full p-[5px] transition-[box-shadow] duration-300" style={{ boxShadow: `0 0 0 2px ${color}, 0 0 ${mode ? 18 : 0}px ${mode ? color : "transparent"}` }}>
				{wheel}
			</div>
			<span className="lr5-print" style={{ color: mode ? color : undefined }}>
				{mode === "mood" ? "Turn to change the mood" : mode === "search" ? "Type, or turn for ideas" : "Turn to choose · OK to open"}
			</span>
		</div>
	)
}

export function Turner({ t, feel, size }: { t: Tv4; feel: Exclude<Feel, "knurl">; size: number }) {
	const ref = useRef<HTMLDivElement>(null)
	const drag = useRef<{ a: number; acc: number } | null>(null)
	const [steps, setSteps] = useState(0)
	// Where the thumb is on the touch ring, in degrees from the top.
	const [thumb, setThumb] = useState<number | null>(null)
	const turn = (d: 1 | -1) => {
		setSteps((s) => s + d)
		t.step(d)
	}
	const angle = (e: { clientX: number; clientY: number }) => {
		const b = ref.current!.getBoundingClientRect()
		return (Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180) / Math.PI
	}
	useEffect(() => {
		const el = ref.current
		if (!el) return
		let acc = 0
		const onWheel = (e: WheelEvent) => {
			e.preventDefault()
			acc += e.deltaY
			if (Math.abs(acc) >= 40) {
				const d = acc > 0 ? 1 : -1
				acc = 0
				turn(d)
			}
		}
		el.addEventListener("wheel", onWheel, { passive: false })
		return () => el.removeEventListener("wheel", onWheel)
	})
	const ringHit = (e: React.PointerEvent) => !(e.target as HTMLElement).closest("button")
	return (
		<div
			ref={ref}
			className={`relative touch-none rounded-full ${feel === "touch" ? "lr5-touch" : "lr2-wheel"}`}
			style={{ width: size, height: size }}
			onPointerDown={(e) => {
				if (!ringHit(e)) return
				;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
				drag.current = { a: angle(e), acc: 0 }
				setThumb(angle(e) + 90)
			}}
			onPointerMove={(e) => {
				const d = drag.current
				if (feel === "touch" && !d && ringHit(e)) setThumb(angle(e) + 90)
				if (!d) return
				const a = angle(e)
				let delta = a - d.a
				if (delta > 180) delta -= 360
				if (delta < -180) delta += 360
				d.a = a
				d.acc += delta
				setThumb(a + 90)
				while (Math.abs(d.acc) >= DETENT) {
					const dir = d.acc > 0 ? 1 : -1
					d.acc -= dir * DETENT
					turn(dir)
				}
			}}
			onPointerUp={() => (drag.current = null)}
			onPointerCancel={() => (drag.current = null)}
			onPointerLeave={() => !drag.current && setThumb(null)}
			aria-label="Wheel: drag around or scroll to step"
		>
			{feel === "detent" ? (
				// Twelve ridges and one notch: the ring snaps a notch per step and settles with a small bounce.
				<motion.div className="lr5-ridges pointer-events-none absolute inset-0 rounded-full" animate={{ rotate: steps * DETENT }} transition={{ type: "spring", stiffness: 900, damping: 22 }}>
					<span className="absolute left-1/2 top-[5px] h-2 w-2 -translate-x-1/2 rounded-full bg-orange-300/80" />
				</motion.div>
			) : (
				// The light under the thumb: one element, rotated, so only a transform changes.
				<motion.div className="pointer-events-none absolute inset-0" animate={{ rotate: thumb ?? steps * DETENT, opacity: thumb === null ? 0 : 1 }} transition={{ rotate: { type: "spring", stiffness: 500, damping: 40 }, opacity: { duration: 0.2 } }}>
					<span className="absolute left-1/2 top-[3px] h-9 w-9 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),transparent_70%)]" />
				</motion.div>
			)}
			<div className={`pointer-events-none absolute rounded-full ${feel === "touch" ? "inset-[24%] lr5-touch-inner" : "inset-[10px] bg-[radial-gradient(circle_at_50%_30%,#34363b,#1d1e21_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-2px_6px_rgba(0,0,0,0.6)]"}`} />
			<Edge pos="top" label="Up" onClick={() => turn(-1)} />
			<Edge pos="bottom" label="Down" onClick={() => turn(1)} />
			<Edge pos="left" label="Previous" onClick={() => turn(-1)} />
			<Edge pos="right" label="Next" onClick={() => turn(1)} />
			<button
				type="button"
				onClick={t.ok}
				className="lr2-ok absolute left-1/2 top-1/2 flex h-[40%] w-[40%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[13px] font-bold tracking-wider text-white/85 transition active:scale-95"
			>
				{t.okLabel}
			</button>
		</div>
	)
}

const ARROW = { top: "M6 15l6-6 6 6", bottom: "M6 9l6 6 6-6", left: "M15 6l-6 6 6 6", right: "M9 6l6 6-6 6" }

export function Edge({ pos, label, onClick }: { pos: keyof typeof ARROW; label: string; onClick: () => void }) {
	const place = { top: "left-1/2 top-3 -translate-x-1/2", bottom: "bottom-3 left-1/2 -translate-x-1/2", left: "left-3 top-1/2 -translate-y-1/2", right: "right-3 top-1/2 -translate-y-1/2" }[pos]
	return (
		<button type="button" aria-label={label} title={label} onClick={onClick} className={`absolute ${place} flex h-9 w-9 items-center justify-center rounded-full text-white/55 transition hover:text-white active:scale-90`}>
			<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
				<path d={ARROW[pos]} />
			</svg>
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------

// The hand photo's placeholder has a 46 px corner at 1024 px wide; at the remote's 312 px that is 38 px.
export const LR5_CSS = `
.lr5-body {
	border-radius: 38px;
	/* A warm edge on the lantern side and a cool one on the window side, so the body sits in the room's light. */
	box-shadow:
		inset 0 1px 0 rgba(255,255,255,0.18),
		inset 0 0 0 1px rgba(255,255,255,0.05),
		inset 2px 0 0 rgba(255,176,110,0.10),
		inset -2px 0 0 rgba(140,200,210,0.06),
		inset 0 -3px 0 rgba(0,0,0,0.45),
		0 40px 80px -20px rgba(0,0,0,0.9),
		0 16px 32px -12px rgba(0,0,0,0.7);
}
.lr5-lcd { background:
	repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 3px),
	radial-gradient(120% 120% at 50% 0%, #11201b 0%, #070b0a 70%); }
.lr5-print { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.42); line-height: 1; }
.lr5-cap {
	box-shadow: 0 1px 0 rgba(255,255,255,0.25) inset, 0 2px 0 #0e0f11, 0 5px 10px rgba(0,0,0,0.4);
	transition: transform 80ms, box-shadow 80ms, filter 120ms;
	filter: saturate(0.85) brightness(0.9);
}
.lr5-cap:hover { filter: none; }
.lr5-cap:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(255,255,255,0.2) inset, 0 0 0 #0e0f11, 0 2px 4px rgba(0,0,0,0.4); }
.lr5-on { filter: none; box-shadow: 0 1px 0 rgba(255,255,255,0.25) inset, 0 2px 0 #0e0f11, 0 0 0 2px #fdba74, 0 0 16px rgba(251,146,60,0.35) !important; }
.lr5-ridges {
	background: repeating-conic-gradient(from -4deg, rgba(255,255,255,0.13) 0deg 8deg, rgba(0,0,0,0) 8deg 30deg);
	-webkit-mask: radial-gradient(circle, transparent 60%, #000 61%, #000 72%, transparent 73%);
	mask: radial-gradient(circle, transparent 60%, #000 61%, #000 72%, transparent 73%);
}
.lr5-touch {
	background: radial-gradient(circle at 50% 35%, #2a2c30, #1a1b1e 75%);
	box-shadow: 0 1px 0 rgba(255,255,255,0.08), inset 0 1px 2px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04);
	cursor: grab;
}
.lr5-touch-inner { box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05); }
`
