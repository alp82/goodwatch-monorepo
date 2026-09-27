// PROTOTYPE - throwaway. Round 6 of the final Remote (#186). Owner on round 5: "refined" is the better
// direction; the wheel's display and movement feel a bit weird; more space between controls and between
// groups; hover states for every control; more variations.
//
// Every layout here is Refined's controls (screen, wheel, Back, Home, Mood, Search, four streaming keys) with
// different spacing and grouping. The wheel gets four new displays next to round 5's two. All of them change
// only transform or opacity while you turn.
import { animate, motion, useMotionValue } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { Icon } from "./r3"
import type { Tv4 } from "./r4"
import { Edge, ICON, KEY_LABEL, Lcd, type Props, Remote5, RoundKey, Services, Shell, Turner } from "./r5"

export type Layout = "refined" | "airy" | "wells" | "pairs" | "labeled"
export type Feel6 = "dpad" | "dots" | "arc" | "smooth" | "detent" | "touch"

export const LAYOUTS: Record<Layout, { name: string; wheel: Feel6; idea: string }> = {
	refined: { name: "Refined (round 5)", wheel: "detent", idea: "Round 5's Refined, unchanged, for comparison." },
	airy: {
		name: "Airy",
		wheel: "dots",
		idea: "Refined with more room: wide gaps between the groups, tighter spacing inside each group.",
	},
	wells: {
		name: "Wells",
		wheel: "dpad",
		idea: "Each group sits in a shallow recess in the body: the screen, the wheel, Back and Home, Mood and Search, the streaming keys.",
	},
	pairs: {
		name: "Pairs",
		wheel: "arc",
		idea: "Two rows of two: Back and Home, then Mood and Search. Bigger keys, a printed hairline between the groups.",
	},
	labeled: {
		name: "Labeled keys",
		wheel: "smooth",
		idea: "Back, Home, Mood, and Search as wide keys with the name on the key, like round 4, with Refined's spacing.",
	},
}

export const FEELS6: Record<Feel6, string> = {
	dpad: "Fixed ring: the arrow you move toward lights up",
	dots: "Twelve printed dots: the current one glows",
	arc: "A short light glides around a fixed ring",
	smooth: "Fine ridges follow your finger, no snapping",
	detent: "Round 5: snaps a notch per step",
	touch: "Round 5: flat ring, a light under your thumb",
}

export function Remote6({ layout, feel, ...p }: Props & { layout: Layout; feel?: Feel6 }) {
	const wheel = feel ?? LAYOUTS[layout].wheel
	if (layout === "refined" && !feel) return <Remote5 design="refined" {...p} />
	const { t } = p
	const dial = (size: number) => <Dial6 t={t} feel={wheel} size={size} />
	if (layout === "refined")
		return (
			<Shell {...p}>
				<Lcd t={t} services={p.services} />
				{dial(220)}
				<div className="flex w-full items-start justify-between px-1">
					<RoundKey k="back" t={t} size={54} />
					<RoundKey k="home" t={t} size={54} />
					<RoundKey k="mood" t={t} size={54} />
					<RoundKey k="search" t={t} size={54} />
				</div>
				<Services t={t} services={p.services} caps={false} cols={2} />
			</Shell>
		)
	if (layout === "airy")
		return (
			<Shell {...p} gap="gap-7" className="lr6">
				<Lcd t={t} services={p.services} />
				{dial(212)}
				<div className="flex w-full justify-between px-1">
					<div className="flex gap-3">
						<RoundKey k="back" t={t} size={52} />
						<RoundKey k="home" t={t} size={52} />
					</div>
					<div className="flex gap-3">
						<RoundKey k="mood" t={t} size={52} />
						<RoundKey k="search" t={t} size={52} />
					</div>
				</div>
				<Services t={t} services={p.services} caps={false} cols={2} />
			</Shell>
		)
	if (layout === "wells")
		return (
			<Shell {...p} gap="gap-4" className="lr6">
				<Lcd t={t} services={p.services} />
				<div className="lr6-well flex w-full justify-center rounded-[34px] py-3">{dial(204)}</div>
				<div className="flex w-full gap-3">
					<div className="lr6-well flex flex-1 justify-around rounded-[28px] px-1 pb-2 pt-2.5">
						<RoundKey k="back" t={t} size={48} />
						<RoundKey k="home" t={t} size={48} />
					</div>
					<div className="lr6-well flex flex-1 justify-around rounded-[28px] px-1 pb-2 pt-2.5">
						<RoundKey k="mood" t={t} size={48} />
						<RoundKey k="search" t={t} size={48} />
					</div>
				</div>
				<div className="lr6-well w-full rounded-[28px] p-2.5">
					<Services t={t} services={p.services} caps={false} cols={2} />
				</div>
			</Shell>
		)
	if (layout === "pairs")
		return (
			<Shell {...p} gap="gap-5" className="lr6">
				<Lcd t={t} services={p.services} />
				{dial(200)}
				<div className="grid w-full grid-cols-2 gap-x-6 gap-y-2 px-10">
					<RoundKey k="back" t={t} size={54} />
					<RoundKey k="home" t={t} size={54} />
					<RoundKey k="mood" t={t} size={54} />
					<RoundKey k="search" t={t} size={54} />
				</div>
				<div className="lr6-rule h-px w-3/4" aria-hidden />
				<Services t={t} services={p.services} caps={false} cols={2} />
			</Shell>
		)
	return (
		<Shell {...p} gap="gap-6" className="lr6">
			<Lcd t={t} services={p.services} />
			{dial(212)}
			<div className="flex w-full flex-col gap-4">
				<div className="grid grid-cols-2 gap-3">
					<WideKey k="back" t={t} />
					<WideKey k="home" t={t} />
				</div>
				<div className="grid grid-cols-2 gap-3">
					<WideKey k="mood" t={t} />
					<WideKey k="search" t={t} />
				</div>
			</div>
			<Services t={t} services={p.services} caps={false} cols={2} />
		</Shell>
	)
}

function WideKey({ k, t }: { k: keyof typeof KEY_LABEL; t: Tv4 }) {
	const on = (k === "mood" && (t.top.k === "moods" || t.mode === "mood")) || (k === "search" && t.mode === "search")
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
		<button
			type="button"
			aria-pressed={k === "mood" || k === "search" ? on : undefined}
			onClick={act}
			className={`lr2-key flex h-12 items-center justify-center gap-2 rounded-full text-[12px] font-semibold uppercase tracking-wider ${on ? "lr2-key-on" : ""}`}
		>
			<Icon d={ICON[k]} className="h-[18px] w-[18px]" />
			{KEY_LABEL[k]}
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The wheel. Turning (drag around the ring or scroll) and the four edges work the same in every display.

const STEP = 30

export function Dial6({ t, feel, size }: { t: Tv4; feel: Feel6; size: number }) {
	if (feel === "detent" || feel === "touch") return <Turner t={t} feel={feel} size={size} />
	return <Ring t={t} feel={feel} size={size} />
}

function Ring({ t, feel, size }: { t: Tv4; feel: Exclude<Feel6, "detent" | "touch">; size: number }) {
	const ref = useRef<HTMLDivElement>(null)
	const drag = useRef<{ a: number; acc: number } | null>(null)
	const [steps, setSteps] = useState(0)
	// The last direction moved, so the D-pad can light that arrow for a moment.
	const [flash, setFlash] = useState<{ pos: keyof typeof GLOW; n: number } | null>(null)
	// Smooth: the ridges follow the finger exactly, and scroll steps glide there.
	const rot = useMotionValue(0)
	const turn = (d: 1 | -1, pos: keyof typeof GLOW = d > 0 ? "right" : "left", glide = true) => {
		setSteps((s) => s + d)
		setFlash((f) => ({ pos, n: (f?.n ?? 0) + 1 }))
		if (glide) animate(rot, rot.get() + d * STEP, { type: "spring", stiffness: 300, damping: 40 })
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
	useEffect(() => {
		if (!flash) return
		const id = setTimeout(() => setFlash(null), 260)
		return () => clearTimeout(id)
	}, [flash])
	const idx = ((steps % 12) + 12) % 12
	return (
		<div
			ref={ref}
			className="lr6-ring lr2-wheel relative touch-none rounded-full"
			style={{ width: size, height: size }}
			onPointerDown={(e) => {
				if ((e.target as HTMLElement).closest("button")) return
				;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
				drag.current = { a: angle(e), acc: 0 }
			}}
			onPointerMove={(e) => {
				const d = drag.current
				if (!d) return
				const a = angle(e)
				let delta = a - d.a
				if (delta > 180) delta -= 360
				if (delta < -180) delta += 360
				d.a = a
				d.acc += delta
				rot.set(rot.get() + delta)
				while (Math.abs(d.acc) >= STEP) {
					const dir = d.acc > 0 ? 1 : -1
					d.acc -= dir * STEP
					turn(dir, dir > 0 ? "right" : "left", false)
				}
			}}
			onPointerUp={() => (drag.current = null)}
			onPointerCancel={() => (drag.current = null)}
			aria-label="Wheel: drag around or scroll to step"
		>
			{feel === "smooth" && <motion.div className="lr6-fine pointer-events-none absolute inset-0 rounded-full" style={{ rotate: rot }} />}
			{feel === "dots" && (
				<div className="pointer-events-none absolute inset-0">
					{Array.from({ length: 12 }, (_, i) => (
						<span key={i} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: `rotate(${i * STEP}deg) translateY(-${size / 2 - 7}px)` }}>
							<span className={`absolute -left-[3px] -top-[3px] h-1.5 w-1.5 rounded-full bg-white/15`} />
							<span
								className="absolute -left-[3.5px] -top-[3.5px] h-[7px] w-[7px] rounded-full bg-orange-300 shadow-[0_0_8px_2px_rgba(251,146,60,0.6)] transition-opacity duration-150"
								style={{ opacity: i === idx ? 1 : 0 }}
							/>
						</span>
					))}
				</div>
			)}
			{feel === "arc" && (
				<motion.div className="pointer-events-none absolute inset-0" animate={{ rotate: steps * STEP }} transition={{ type: "spring", stiffness: 260, damping: 34 }}>
					<div className="lr6-arc absolute inset-0 rounded-full" />
				</motion.div>
			)}
			{feel === "dpad" &&
				(Object.keys(GLOW) as (keyof typeof GLOW)[]).map((pos) => (
					<span
						key={pos}
						className={`lr6-glow pointer-events-none absolute ${GLOW[pos]} h-12 w-12 rounded-full transition-opacity duration-200`}
						style={{ opacity: flash?.pos === pos ? 1 : 0 }}
					/>
				))}
			<div className="lr6-face pointer-events-none absolute inset-[12px] rounded-full" />
			<Edge pos="top" label="Up" onClick={() => turn(-1, "top")} />
			<Edge pos="bottom" label="Down" onClick={() => turn(1, "bottom")} />
			<Edge pos="left" label="Previous" onClick={() => turn(-1, "left")} />
			<Edge pos="right" label="Next" onClick={() => turn(1, "right")} />
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

const GLOW = {
	top: "left-1/2 -translate-x-1/2 top-0.5",
	bottom: "left-1/2 -translate-x-1/2 bottom-0.5",
	left: "top-1/2 -translate-y-1/2 left-0.5",
	right: "top-1/2 -translate-y-1/2 right-0.5",
}

// ---------------------------------------------------------------------------------------------------------
// Hover: every control lifts a little and brightens; the pressed state still sinks. Scoped to round 6
// bodies, plus Refined itself so the comparison is fair.
export const LR6_CSS = `
.lr3-remote .lr2-key:hover { background: linear-gradient(180deg, #3d4046, #2c2e33); color: #fff; box-shadow: 0 1px 0 rgba(255,255,255,0.12) inset, 0 3px 0 #0e0f11, 0 7px 14px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08); transform: translateY(-1px); }
.lr3-remote .lr2-key:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 0 0 #0e0f11, 0 2px 4px rgba(0,0,0,0.4); }
.lr3-remote .lr2-key-on:hover { color: #fed7aa !important; }
.lr3-remote .lr2-ok:hover { background: radial-gradient(circle at 50% 30%, #4a4d54, #2b2c31 70%); color: #fff; }
.lr3-remote .lr2-wheel, .lr3-remote .lr5-touch { transition: box-shadow 150ms; }
.lr3-remote .lr2-wheel:hover, .lr3-remote .lr5-touch:hover { box-shadow: 0 1px 0 rgba(255,255,255,0.08), inset 0 2px 5px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.10); }
.lr3-remote [aria-label="Up"]:hover, .lr3-remote [aria-label="Down"]:hover, .lr3-remote [aria-label="Previous"]:hover, .lr3-remote [aria-label="Next"]:hover { background: rgba(255,255,255,0.06); }
.lr5-cap:hover { transform: translateY(-1px); }
.lr6-well { background: rgba(0,0,0,0.20); box-shadow: inset 0 2px 5px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.05); }
.lr6-rule { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent); }
.lr6-face { background: radial-gradient(circle at 50% 30%, #303237, #1d1e21 70%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -2px 6px rgba(0,0,0,0.6); }
.lr6-fine {
	background: repeating-conic-gradient(from 0deg, rgba(255,255,255,0.07) 0deg 1deg, rgba(0,0,0,0) 1deg 3deg);
	-webkit-mask: radial-gradient(circle, transparent 62%, #000 63%, #000 71%, transparent 72%);
	mask: radial-gradient(circle, transparent 62%, #000 63%, #000 71%, transparent 72%);
}
.lr6-arc {
	background: conic-gradient(from -20deg, rgba(251,146,60,0.85) 0deg 40deg, transparent 40deg);
	-webkit-mask: radial-gradient(circle, transparent 66%, #000 67%, #000 69%, transparent 70%);
	mask: radial-gradient(circle, transparent 66%, #000 67%, #000 69%, transparent 70%);
}
.lr6-glow { background: radial-gradient(circle, rgba(251,146,60,0.45), transparent 70%); }
`
