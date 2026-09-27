// PROTOTYPE - throwaway. Round 2 of the living room start page (#178): a bigger, modern remote with an LCD.
// Four modes on the remote drive the TV:
//   CH     - zap channels; the wheel and the side arrows step, OK opens the guide.
//   MOOD   - pick a mood; the TV tunes a "Your mix" channel to it.
//   TUNE   - switch fingerprint attributes on (+) or off (-); the mix re-ranks live.
//   SEARCH - type what you want; the Search channel runs it.
// The click wheel turns: drag around it or scroll over it to step through whatever the LCD shows.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import type { LRData, LRTuned } from "~/server/prototype-start-living-room.server"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { CHANNELS, GwBadge, Search, ease, img, renderChannel } from "./channels"
import { type ChannelInfo, type Zapper, zapSound } from "./tv"

// ---------------------------------------------------------------------------------------------------------
// Channels: round 1's six plus the mix the remote tunes.

export const CHANNELS2: ChannelInfo[] = [
	...CHANNELS,
	{ num: 7, id: "mix", name: "Your mix", short: "Mix", glow: "#fb923c", pitch: "Tune it to your mood", line: "Pick a mood or switch attributes on and off. The picks re-rank as you go." },
]
const MIX = CHANNELS2.length - 1
const SEARCH_CH = CHANNELS2.findIndex((c) => c.id === "search")

export const MOODS: { id: string; emoji: string; name: string; inc: string[]; exc: string[] }[] = [
	{ id: "cozy", emoji: "🛋️", name: "Cozy", inc: ["wholesome", "hopefulness"], exc: ["violence", "scare"] },
	{ id: "edge", emoji: "😬", name: "Edge of my seat", inc: ["tension", "adrenaline"], exc: [] },
	{ id: "laugh", emoji: "😂", name: "Laugh out loud", inc: ["situational_comedy", "wit_wordplay"], exc: ["bleakness"] },
	{ id: "mind", emoji: "🌀", name: "Mind-bending", inc: ["complexity", "philosophical"], exc: [] },
	{ id: "cry", emoji: "😭", name: "A good cry", inc: ["pathos", "catharsis"], exc: [] },
	{ id: "date", emoji: "💞", name: "Date night", inc: ["romance", "wit_wordplay"], exc: ["violence"] },
	{ id: "whodunit", emoji: "🔎", name: "Whodunit", inc: ["mystery", "intrigue"], exc: [] },
	{ id: "spooky", emoji: "👻", name: "Spooky", inc: ["scare", "tension"], exc: [] },
	{ id: "epic", emoji: "🏔️", name: "Epic", inc: ["spectacle", "wonder"], exc: [] },
]

export const TUNE_KEYS = [
	"adrenaline", "tension", "scare", "romance", "wholesome", "wonder", "pathos", "catharsis", "melancholy",
	"situational_comedy", "wit_wordplay", "dark_humor", "absurdist_humor", "mystery", "intrigue", "crime",
	"fantasy", "futuristic", "complexity", "philosophical", "surrealism", "slow_burn", "fast_pace", "violence",
	"hopefulness", "bleakness", "cinematography", "spectacle", "nostalgia", "coming_of_age",
]

export const SUGGESTIONS = [
	"a cozy mystery for a rainy sunday",
	"mind-bending sci-fi that makes you cry",
	"feel-good comedy to watch with my parents",
	"slow-burn thriller set in winter",
]

export type Mode = "ch" | "mood" | "tune" | "search"

// ---------------------------------------------------------------------------------------------------------
// Remote state: which mode the LCD is in and what each mode has selected.

export function useRemote2(z: Zapper, onGuide: () => void) {
	const [mode, setMode] = useState<Mode>("ch")
	const [moodIdx, setMoodIdx] = useState(0)
	const [focus, setFocus] = useState(0)
	const [switches, setSwitches] = useState<Record<string, 1 | -1>>({})
	const [label, setLabel] = useState<string | null>(null)
	const [draft, setDraft] = useState("")
	const [query, setQuery] = useState<string | null>(null)
	const [sugg, setSugg] = useState(-1)
	const [pulse, setPulse] = useState(0)
	const moodTimer = useRef<ReturnType<typeof setTimeout>>()

	const applyMood = useCallback(
		(i: number) => {
			const m = MOODS[i]
			const next: Record<string, 1 | -1> = {}
			for (const k of m.inc) next[k] = 1
			for (const k of m.exc) next[k] = -1
			setSwitches(next)
			setLabel(`${m.emoji} ${m.name}`)
			z.tune(MIX)
		},
		[z],
	)

	const click = () => {
		setPulse((p) => p + 1)
		if (!z.muted) tick()
	}

	// One detent of the wheel or one press of a side arrow.
	const step = (d: 1 | -1) => {
		click()
		if (mode === "ch") z.tune(z.ch + d)
		else if (mode === "mood") {
			const i = (moodIdx + d + MOODS.length) % MOODS.length
			setMoodIdx(i)
			// Spinning previews on the LCD; the TV follows once the wheel rests.
			clearTimeout(moodTimer.current)
			moodTimer.current = setTimeout(() => applyMood(i), 650)
		} else if (mode === "tune") setFocus((f) => (f + d + TUNE_KEYS.length) % TUNE_KEYS.length)
		else if (mode === "search") {
			const i = (sugg + d + SUGGESTIONS.length) % SUGGESTIONS.length
			setSugg(i)
			setDraft(SUGGESTIONS[i])
		}
	}

	const ok = () => {
		click()
		if (mode === "ch") onGuide()
		else if (mode === "mood") {
			clearTimeout(moodTimer.current)
			applyMood(moodIdx)
		} else if (mode === "tune") {
			const k = TUNE_KEYS[focus]
			setSwitches((s) => {
				const next = { ...s }
				// Off, then include, then exclude, then off.
				if (!next[k]) next[k] = 1
				else if (next[k] === 1) next[k] = -1
				else delete next[k]
				return next
			})
			setLabel("Tuned by you")
			z.tune(MIX)
		} else if (mode === "search") submit()
	}

	const submit = () => {
		const q = draft.trim()
		if (q.length < 2) return
		setQuery(q)
		z.tune(SEARCH_CH)
	}

	const pickMode = (m: Mode) => {
		click()
		setMode(m)
		if (m === "mood" && z.ch !== MIX) applyMood(moodIdx)
		if (m === "tune") z.tune(MIX)
		if (m === "search" && query) z.tune(SEARCH_CH)
	}

	return { mode, pickMode, step, ok, moodIdx, focus, switches, label, draft, setDraft, query, submit, pulse, click }
}

export type Remote2State = ReturnType<typeof useRemote2>

// A short dry click for the wheel's detents.
let actx: AudioContext | null = null
function tick() {
	try {
		actx ??= new AudioContext()
		const o = actx.createOscillator()
		const g = actx.createGain()
		o.type = "square"
		o.frequency.value = 3200
		g.gain.setValueAtTime(0.018, actx.currentTime)
		g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.012)
		o.connect(g).connect(actx.destination)
		o.start()
		o.stop(actx.currentTime + 0.015)
	} catch {}
}

// ---------------------------------------------------------------------------------------------------------
// The remote.

const MODE_KEYS: { m: Mode; label: string; icon: ReactNode }[] = [
	{
		m: "ch",
		label: "CH",
		icon: (
			<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
				<rect x="3" y="5" width="18" height="12" rx="2" />
				<path d="M8 21h8" />
			</svg>
		),
	},
	{
		m: "mood",
		label: "Mood",
		icon: (
			<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
				<circle cx="12" cy="12" r="9" />
				<path d="M8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8" />
				<path d="M9 9.5h.01M15 9.5h.01" strokeWidth="3" />
			</svg>
		),
	},
	{
		m: "tune",
		label: "Tune",
		icon: (
			<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
				<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
				<circle cx="16" cy="6" r="2" />
				<circle cx="10" cy="12" r="2" />
				<circle cx="18" cy="18" r="2" />
			</svg>
		),
	},
	{
		m: "search",
		label: "Search",
		icon: (
			<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
				<circle cx="11" cy="11" r="7" />
				<path d="M20 20l-3.5-3.5" />
			</svg>
		),
	},
]

export function Remote2({ z, r, onGuide, className = "" }: { z: Zapper; r: Remote2State; onGuide: () => void; className?: string }) {
	const [blink, setBlink] = useState(0)
	useEffect(() => setBlink((b) => b + 1), [r.pulse, z.zapId])
	return (
		<div className={`lr2-remote relative select-none ${className}`} role="group" aria-label="Remote control">
			<div className="lr2-body relative flex flex-col items-center gap-4 rounded-[44px] px-5 pb-7 pt-4">
				{/* Send light along the top edge. */}
				<div className="relative h-1 w-16 rounded-full bg-black/60">
					<motion.div
						key={blink}
						className="absolute inset-0 rounded-full bg-sky-300"
						initial={{ opacity: blink > 1 ? 1 : 0, boxShadow: "0 0 12px 3px rgba(125,211,252,0.8)" }}
						animate={{ opacity: 0, boxShadow: "0 0 0 0 rgba(125,211,252,0)" }}
						transition={{ duration: 0.4 }}
					/>
				</div>

				<Lcd z={z} r={r} />

				{/* Mode keys. */}
				<div className="grid w-full grid-cols-4 gap-2">
					{MODE_KEYS.map((k) => {
						const on = r.mode === k.m
						return (
							<button
								key={k.m}
								type="button"
								aria-pressed={on}
								onClick={() => r.pickMode(k.m)}
								className={`lr2-key flex h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold uppercase tracking-wider ${on ? "lr2-key-on" : ""}`}
							>
								{k.icon}
								{k.label}
							</button>
						)
					})}
				</div>

				<Wheel z={z} r={r} />

				{/* Utility row. */}
				<div className="grid w-full grid-cols-3 gap-2">
					<UKey label={z.on ? "Turn off" : "Turn on"} onClick={() => { r.click(); z.setOn(!z.on) }}>
						<svg viewBox="0 0 24 24" className="h-4 w-4 text-rose-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
							<path d="M12 3v8" />
							<path d="M6.3 7.3a8 8 0 1 0 11.4 0" />
						</svg>
					</UKey>
					<UKey label="Guide" onClick={() => { r.click(); onGuide() }}>
						<span className="text-[10px] font-bold tracking-wider">GUIDE</span>
					</UKey>
					<UKey label={z.muted ? "Sound on" : "Sound off"} onClick={() => z.setMuted(!z.muted)}>
						<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M11 5L6 9H3v6h3l5 4V5z" />
							{z.muted ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
						</svg>
					</UKey>
				</div>

				<a
					href="/taste"
					className="flex w-full items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 py-3 text-[13px] font-extrabold uppercase tracking-wider text-black shadow-[0_2px_0_#8a5a0a,0_8px_20px_rgba(251,191,36,0.25)] transition-transform active:translate-y-[2px]"
				>
					Get my picks
				</a>
				<img src={gwLogo} alt="" className="h-5 opacity-20" />
			</div>
		</div>
	)
}

function UKey({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
	return (
		<button type="button" aria-label={label} title={label} onClick={onClick} className="lr2-key flex h-10 items-center justify-center rounded-full">
			{children}
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The LCD: a small glass screen that says what the wheel will change.

function Lcd({ z, r }: { z: Zapper; r: Remote2State }) {
	const c = CHANNELS2[z.ch]
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (r.mode === "search") input.current?.focus({ preventScroll: true })
	}, [r.mode])
	const on = Object.entries(r.switches)
	const k = TUNE_KEYS[r.focus]
	const meta = getFingerprintMeta(k)
	const state = r.switches[k]
	const MODE_NAME: Record<Mode, string> = { ch: "Channel", mood: "Mood", tune: "Tune", search: "Search" }
	return (
		<div className="lr2-lcd relative h-[128px] w-full overflow-hidden rounded-[18px] px-4 py-3">
			<div className="lr2-lcd-grid pointer-events-none absolute inset-0" />
			<div className="relative flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[var(--lcd)] opacity-70">
				<span>{MODE_NAME[r.mode]}</span>
				<span className="flex items-center gap-2">
					{z.on ? <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--lcd)]" />Live</span> : "Standby"}
					<Battery />
				</span>
			</div>
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={r.mode + (r.mode === "ch" ? z.ch : r.mode === "mood" ? r.moodIdx : r.mode === "tune" ? r.focus : "")}
					className="relative mt-1.5"
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -6 }}
					transition={{ duration: 0.14 }}
				>
					{r.mode === "ch" && (
						<>
							<div className="lr-vt flex items-baseline gap-2 text-[34px] leading-none text-[var(--lcd)]">
								<span>{String(c.num).padStart(2, "0")}</span>
								<span className="truncate text-[26px] uppercase">{c.short}</span>
							</div>
							<Marquee text={c.line} />
						</>
					)}
					{r.mode === "mood" && (
						<>
							<div className="flex items-center gap-2 text-[22px] font-semibold leading-tight text-white">
								<span className="text-[26px]">{MOODS[r.moodIdx].emoji}</span>
								<span className="truncate">{MOODS[r.moodIdx].name}</span>
							</div>
							<div className="mt-1.5 truncate text-[11px] text-[var(--lcd)] opacity-80">
								{[...MOODS[r.moodIdx].inc.map((x) => `+${getFingerprintMeta(x).label}`), ...MOODS[r.moodIdx].exc.map((x) => `−${getFingerprintMeta(x).label}`)].join("  ")}
							</div>
							<Dots n={MOODS.length} i={r.moodIdx} />
						</>
					)}
					{r.mode === "tune" && (
						<>
							<div className="flex items-center gap-2 text-[20px] font-semibold leading-tight text-white">
								<span className="text-[22px]">{meta.emoji}</span>
								<span className="flex-1 truncate">{meta.label}</span>
								<span
									className={`rounded-md px-2 py-0.5 text-[13px] font-bold ${state === 1 ? "bg-emerald-400/25 text-emerald-200" : state === -1 ? "bg-rose-400/25 text-rose-200" : "bg-white/10 text-white/50"}`}
								>
									{state === 1 ? "MORE" : state === -1 ? "NONE" : "ANY"}
								</span>
							</div>
							<div className="mt-2 flex h-5 gap-1 overflow-hidden">
								{on.length === 0 ? (
									<span className="text-[11px] text-[var(--lcd)] opacity-70">Turn the wheel, press OK to switch</span>
								) : (
									on.map(([key, v]) => (
										<span key={key} className={`shrink-0 rounded px-1.5 text-[11px] leading-5 ${v === 1 ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200 line-through"}`}>
											{getFingerprintMeta(key).emoji} {getFingerprintMeta(key).label}
										</span>
									))
								)}
							</div>
						</>
					)}
				</motion.div>
			</AnimatePresence>
			{r.mode === "search" && (
				<form
					className="relative mt-1.5"
					onSubmit={(e) => {
						e.preventDefault()
						r.submit()
					}}
				>
					<input
						ref={input}
						value={r.draft}
						onChange={(e) => r.setDraft(e.target.value)}
						placeholder="Say what you want…"
						maxLength={120}
						aria-label="Search"
						className="w-full bg-transparent text-[17px] font-medium text-white placeholder:text-white/35 focus:outline-none"
					/>
					<div className="mt-1 h-px w-full bg-[var(--lcd)] opacity-40" />
					<div className="mt-1.5 truncate text-[11px] text-[var(--lcd)] opacity-75">Enter or OK runs it · the wheel suggests</div>
				</form>
			)}
			{/* Glass sheen. */}
			<div className="pointer-events-none absolute inset-0 rounded-[18px] bg-[linear-gradient(160deg,rgba(255,255,255,0.10)_0%,transparent_35%)]" />
		</div>
	)
}

function Marquee({ text }: { text: string }) {
	return (
		<div className="mt-2 overflow-hidden whitespace-nowrap text-[11px] text-[var(--lcd)] opacity-75">
			<motion.div className="inline-block" animate={{ x: ["0%", "-50%"] }} transition={{ duration: text.length * 0.22, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}>
				{text}&nbsp;&nbsp;·&nbsp;&nbsp;{text}&nbsp;&nbsp;·&nbsp;&nbsp;
			</motion.div>
		</div>
	)
}

function Dots({ n, i }: { n: number; i: number }) {
	return (
		<div className="mt-2 flex gap-1">
			{Array.from({ length: n }, (_, k) => (
				<span key={k} className={`h-1 rounded-full transition-all ${k === i ? "w-4 bg-[var(--lcd)]" : "w-1 bg-white/25"}`} />
			))}
		</div>
	)
}

function Battery() {
	return (
		<svg viewBox="0 0 20 10" className="h-2.5 w-5" fill="none" stroke="currentColor" strokeWidth="1.2">
			<rect x="0.6" y="0.6" width="16.8" height="8.8" rx="2" />
			<rect x="2.4" y="2.4" width="10" height="5.2" rx="0.8" fill="currentColor" stroke="none" />
			<path d="M18.8 3.5v3" />
		</svg>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The click wheel. Drag around the ring (or scroll over it) to step; press the edges; OK in the middle.

export interface WheelDriver {
	mode: string
	step: (d: 1 | -1) => void
	ok: () => void
	click: () => void
	okLabel?: string
	up?: () => void
	down?: () => void
}

export function Wheel({ z, r, size = 176 }: { z: Zapper; r: WheelDriver; size?: number }) {
	const ref = useRef<HTMLDivElement>(null)
	const drag = useRef<{ a: number; acc: number; moved: boolean } | null>(null)
	const [rot, setRot] = useState(0)
	const angle = (e: { clientX: number; clientY: number }) => {
		const b = ref.current!.getBoundingClientRect()
		return (Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180) / Math.PI
	}
	const DETENT = 28
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
				setRot((x) => x + d * DETENT)
				r.step(d)
			}
		}
		el.addEventListener("wheel", onWheel, { passive: false })
		return () => el.removeEventListener("wheel", onWheel)
	})
	const ringTarget = (e: React.PointerEvent) => (e.target as HTMLElement).closest("[data-ring]")
	return (
		<div
			ref={ref}
			data-ring
			className="lr2-wheel relative touch-none rounded-full"
			style={{ width: size, height: size }}
			onPointerDown={(e) => {
				if (!ringTarget(e) || (e.target as HTMLElement).closest("button")) return
				;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
				drag.current = { a: angle(e), acc: 0, moved: false }
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
				setRot((x) => x + delta)
				while (Math.abs(d.acc) >= DETENT) {
					const dir = d.acc > 0 ? 1 : -1
					d.acc -= dir * DETENT
					d.moved = true
					r.step(dir)
				}
			}}
			onPointerUp={() => (drag.current = null)}
			onPointerCancel={() => (drag.current = null)}
			aria-label="Click wheel: drag around or scroll to step"
		>
			{/* Knurled ring that turns with your finger. */}
			<div className="lr2-knurl pointer-events-none absolute inset-0 rounded-full" style={{ transform: `rotate(${rot}deg)` }} />
			<div className="pointer-events-none absolute inset-[10px] rounded-full bg-[radial-gradient(circle_at_50%_30%,#34363b,#1d1e21_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-2px_6px_rgba(0,0,0,0.6)]" />
			<Edge pos="top" label="Up" onClick={() => { r.click(); r.up ? r.up() : z.tune(z.ch + 1) }}>
				<Arrow d="M6 15l6-6 6 6" />
			</Edge>
			<Edge pos="bottom" label="Down" onClick={() => { r.click(); r.down ? r.down() : z.tune(z.ch - 1) }}>
				<Arrow d="M6 9l6 6 6-6" />
			</Edge>
			<Edge pos="left" label="Previous" onClick={() => r.step(-1)}>
				<Arrow d="M15 6l-6 6 6 6" />
			</Edge>
			<Edge pos="right" label="Next" onClick={() => r.step(1)}>
				<Arrow d="M9 6l6 6-6 6" />
			</Edge>
			<button
				type="button"
				onClick={r.ok}
				className="lr2-ok absolute left-1/2 top-1/2 flex h-[40%] w-[40%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[13px] font-bold tracking-wider text-white/85 transition active:scale-95"
			>
				{r.okLabel ?? (r.mode === "tune" ? "SET" : r.mode === "search" ? "GO" : "OK")}
			</button>
		</div>
	)
}

function Edge({ pos, label, onClick, children }: { pos: "top" | "bottom" | "left" | "right"; label: string; onClick: () => void; children: ReactNode }) {
	const place = {
		top: "left-1/2 top-3 -translate-x-1/2",
		bottom: "bottom-3 left-1/2 -translate-x-1/2",
		left: "left-3 top-1/2 -translate-y-1/2",
		right: "right-3 top-1/2 -translate-y-1/2",
	}[pos]
	return (
		<button type="button" aria-label={label} title={label} onClick={onClick} className={`absolute ${place} flex h-9 w-9 items-center justify-center rounded-full text-white/55 transition hover:text-white active:scale-90`}>
			{children}
		</button>
	)
}

function Arrow({ d }: { d: string }) {
	return (
		<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
			<path d={d} />
		</svg>
	)
}

// ---------------------------------------------------------------------------------------------------------
// CH 07 · Your mix. Posters that stay in the mix glide to their new place when it re-ranks.

const tuneMemo = new Map<string, Promise<LRTuned[]>>()
function fetchTune(inc: string[], exc: string[]) {
	const key = `inc=${inc.join(",")}&exc=${exc.join(",")}`
	let p = tuneMemo.get(key)
	if (!p) {
		p = fetch(`/prototype/start-living-room/tune?${key}`).then((r) => {
			if (!r.ok) throw new Error(String(r.status))
			return r.json()
		})
		p.catch(() => tuneMemo.delete(key))
		tuneMemo.set(key, p)
	}
	return p
}

function Mix({ switches, label }: { switches: Record<string, 1 | -1>; label: string | null }) {
	const inc = useMemo(() => Object.keys(switches).filter((k) => switches[k] === 1).sort(), [switches])
	const exc = useMemo(() => Object.keys(switches).filter((k) => switches[k] === -1).sort(), [switches])
	const [rows, setRows] = useState<LRTuned[] | null>(null)
	const [busy, setBusy] = useState(false)
	useEffect(() => {
		let alive = true
		setBusy(true)
		const t = setTimeout(() => {
			fetchTune(inc, exc)
				.then((r) => alive && setRows(r))
				.catch(() => {})
				.finally(() => alive && setBusy(false))
		}, 180)
		return () => {
			alive = false
			clearTimeout(t)
		}
	}, [inc.join(), exc.join()])
	const shown = rows?.slice(0, 6) ?? []
	return (
		<div className="absolute inset-0 overflow-hidden bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)] text-white">
			<div className="absolute left-12 top-9 flex items-center gap-3">
				<span className="text-[13px] font-bold uppercase tracking-[0.3em] text-orange-300/85">Your mix</span>
				{busy && <span className="h-1.5 w-1.5 animate-ping rounded-full bg-orange-300" />}
			</div>
			<div className="absolute left-12 right-12 top-[60px]">
				<AnimatePresence mode="wait">
					<motion.div key={label ?? "none"} className="text-[34px] font-extrabold tracking-tight" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease }}>
						{label ?? "Pick a mood on the remote"}
					</motion.div>
				</AnimatePresence>
				<div className="mt-3 flex min-h-[30px] flex-wrap gap-2">
					<AnimatePresence>
						{[...inc.map((k) => [k, 1] as const), ...exc.map((k) => [k, -1] as const)].map(([k, v]) => {
							const m = getFingerprintMeta(k)
							return (
								<motion.span
									key={k}
									layout
									initial={{ opacity: 0, scale: 0.8 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.8 }}
									className={`rounded-full px-3 py-1 text-[14px] ring-1 ${v === 1 ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30" : "bg-rose-500/15 text-rose-200 ring-rose-400/30"}`}
								>
									{v === 1 ? "More" : "No"} {m.emoji} {m.label}
								</motion.span>
							)
						})}
					</AnimatePresence>
				</div>
			</div>
			<div className="absolute left-12 right-12 top-[168px] grid grid-cols-6 gap-4">
				<AnimatePresence mode="popLayout">
					{shown.map((t, k) => (
						<motion.div
							key={t.key}
							layout
							initial={{ opacity: 0, y: 30, rotateX: 25 }}
							animate={{ opacity: 1, y: 0, rotateX: 0 }}
							exit={{ opacity: 0, scale: 0.9 }}
							transition={{ duration: 0.5, delay: k * 0.04, ease }}
							style={{ transformPerspective: 800 }}
						>
							<div className="relative">
								<img src={img(t.poster, "w185")} alt={t.title} className="aspect-[2/3] w-full rounded-lg object-cover shadow-xl ring-1 ring-white/10" />
								<span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-orange-200 backdrop-blur">#{k + 1}</span>
							</div>
							<div className="mt-2 truncate text-[13px] font-semibold">{t.title}</div>
							<div className="mt-0.5 flex items-center gap-2">
								<GwBadge gw={t.gw} size={16} text="text-[12px]" />
								<span className="truncate text-[11px] text-white/45">{t.top.map((x) => getFingerprintMeta(x).emoji).join(" ")}</span>
							</div>
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</div>
	)
}

export function renderChannel2(ch: number, data: LRData, queries: string[], r: Remote2State) {
	const id = CHANNELS2[ch]?.id
	if (id === "mix") return <Mix switches={r.switches} label={r.label} />
	if (id === "search" && r.query) return <Search queries={queries} fixed={r.query} />
	return renderChannel(ch, data, queries)
}

// ---------------------------------------------------------------------------------------------------------

export const LR2_CSS = `
.lr2-body {
	width: 264px;
	background:
		radial-gradient(140% 50% at 50% -10%, rgba(255,255,255,0.10), transparent 60%),
		linear-gradient(180deg, #2c2e33 0%, #212226 45%, #18191c 100%);
	box-shadow:
		inset 0 1px 0 rgba(255,255,255,0.18),
		inset 0 0 0 1px rgba(255,255,255,0.05),
		inset 0 -3px 0 rgba(0,0,0,0.45),
		0 40px 80px -20px rgba(0,0,0,0.9),
		0 16px 32px -12px rgba(0,0,0,0.7);
}
.lr2-lcd {
	--lcd: #8ef0c6;
	background: radial-gradient(120% 120% at 50% 0%, #11201b 0%, #070b0a 70%);
	box-shadow: inset 0 2px 6px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.08);
	text-shadow: 0 0 8px color-mix(in srgb, var(--lcd) 45%, transparent);
}
.lr2-lcd-grid {
	background:
		repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px),
		repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0 1px, transparent 1px 3px);
	mix-blend-mode: multiply;
}
.lr2-key {
	color: rgba(255,255,255,0.8);
	background: linear-gradient(180deg, #34363b, #26272b);
	box-shadow: 0 1px 0 rgba(255,255,255,0.08) inset, 0 2px 0 #0e0f11, 0 5px 10px rgba(0,0,0,0.4);
	transition: transform 80ms, box-shadow 80ms, color 120ms;
}
.lr2-key:hover { color: #fff; }
.lr2-key:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 0 0 #0e0f11, 0 2px 4px rgba(0,0,0,0.4); }
.lr2-key-on { color: #fdba74 !important; box-shadow: 0 1px 0 rgba(255,255,255,0.08) inset, 0 2px 0 #0e0f11, 0 0 16px rgba(251,146,60,0.25), inset 0 0 0 1px rgba(251,146,60,0.55) !important; }
.lr2-wheel { background: #121315; box-shadow: 0 1px 0 rgba(255,255,255,0.08), inset 0 2px 5px rgba(0,0,0,0.8); cursor: grab; }
.lr2-wheel:active { cursor: grabbing; }
.lr2-knurl {
	background: repeating-conic-gradient(from 0deg, rgba(255,255,255,0.10) 0deg 2deg, rgba(0,0,0,0) 2deg 6deg);
	-webkit-mask: radial-gradient(circle, transparent 60%, #000 61%, #000 70%, transparent 71%);
	mask: radial-gradient(circle, transparent 60%, #000 61%, #000 70%, transparent 71%);
}
.lr2-ok {
	background: radial-gradient(circle at 50% 30%, #3e4046, #25262a 70%);
	box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 3px 8px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.6);
}
`
