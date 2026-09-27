// PROTOTYPE - throwaway. Round 3 of the living room start page (#178). Owner on round 2: the scene and remote
// wiggle and the remote is hard to catch; controls feel late; the TV should take more space; the remote
// should be bigger with streaming service buttons and work like a smart-TV pointer for the guide and real
// content; no link may leave the start page yet. So in this round:
//   - Nothing moves with the mouse. The remote stands still beside the TV, scaled to fit the height.
//   - The TV takes most of the space left of the remote.
//   - Pointing: over the TV the mouse becomes the remote's pointer (with a faint beam from the remote).
//     Point at a poster to open it on the TV; the guide and the title pages are TV screens.
//   - Service buttons filter the mix to one service in your country, combined with the mood or attributes.
//   - "Get my picks" rates three titles on the TV and tunes the mix to them. Nothing navigates away.
import { AnimatePresence, motion, useMotionValueEvent, useSpring, useTransform } from "framer-motion"
import { type ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import handBack from "~/img/prototype-living-room/hand2-back.webp"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogo from "~/img/metacritic-logo-icon-250.png"
import rottenLogo from "~/img/rotten-logo-icon-250.png"
import type { LRData, LRServiceButton, LRTitle, LRTuned } from "~/server/prototype-start-living-room.server"
import { PILLAR_CONFIG, type PillarName } from "~/ui/fingerprint/Pillars"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { GwBadge, Lean, Search, ease, img, renderChannel } from "./channels"
import { CHANNELS2, LR2_CSS, MOODS, SUGGESTIONS, TUNE_KEYS, Wheel } from "./remote2"
import { Remote4, Tv4Screen, useTv4 } from "./r4"
import { Screen, type Zapper, useAutoPowerOn, useRemoteKeys, useZapper } from "./tv"

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect
const MIX = CHANNELS2.length - 1
const SEARCH_CH = CHANNELS2.findIndex((c) => c.id === "search")

// ---------------------------------------------------------------------------------------------------------
// Data: one memoized fetch per distinct request, so repeats are instant.

const memo = new Map<string, Promise<unknown>>()
export function api<T>(params: Record<string, string>): Promise<T> {
	const qs = new URLSearchParams(params).toString()
	let p = memo.get(qs) as Promise<T> | undefined
	if (!p) {
		p = fetch(`/prototype/start-living-room/api3?${qs}`).then((r) => {
			if (!r.ok) throw new Error(String(r.status))
			return r.json()
		})
		p.catch(() => memo.delete(qs))
		memo.set(qs, p)
	}
	return p
}

export interface MixSpec {
	switches: Record<string, 1 | -1>
	service: string | null
	seeds: string[]
	label: string | null
}

export const tuneParams = (m: MixSpec, country: string) => ({
	op: "tune",
	country,
	inc: Object.keys(m.switches).filter((k) => m.switches[k] === 1).sort().join(","),
	exc: Object.keys(m.switches).filter((k) => m.switches[k] === -1).sort().join(","),
	service: m.service ?? "",
	seeds: m.seeds.join(","),
})

export function useApi<T>(params: Record<string, string> | null) {
	const [data, setData] = useState<T | null>(null)
	const [busy, setBusy] = useState(false)
	const key = params ? new URLSearchParams(params).toString() : ""
	useEffect(() => {
		if (!params) return
		let alive = true
		setBusy(true)
		api<T>(params)
			.then((d) => alive && setData(d))
			.catch(() => {})
			.finally(() => alive && setBusy(false))
		return () => {
			alive = false
		}
	}, [key])
	return { data, busy }
}

// ---------------------------------------------------------------------------------------------------------
// Remote state.

type Mode = "ch" | "mood" | "tune" | "search"
type Nav = { kind: "guide" } | { kind: "title"; key: string } | { kind: "picks" }

export function useRemote3(z: Zapper, country: string) {
	const [mode, setModeRaw] = useState<Mode>("ch")
	const [moodIdx, setMoodIdx] = useState(0)
	const [focus, setFocus] = useState(0)
	const [mix, setMix] = useState<MixSpec>({ switches: {}, service: null, seeds: [], label: null })
	const [draft, setDraft] = useState("")
	const [query, setQuery] = useState<string | null>(null)
	const [sugg, setSugg] = useState(-1)
	const [nav, setNav] = useState<Nav[]>([])
	const [guideFocus, setGuideFocus] = useState(0)
	const [loved, setLoved] = useState<string[]>([])
	const [deckPage, setDeckPage] = useState(0)
	const [pulse, setPulse] = useState(0)
	const [muted, setMuted] = useState(false)
	const top = nav[nav.length - 1] ?? null

	const click = useCallback(() => {
		setPulse((p) => p + 1)
		if (!muted) tick()
	}, [muted])

	const zap = (n: number) => {
		setNav([])
		z.tune(n)
	}
	const toMix = (m: Partial<MixSpec>) => {
		setMix((prev) => ({ ...prev, ...m }))
		setNav([])
		z.tune(MIX)
	}
	const applyMood = (i: number) => {
		const m = MOODS[i]
		const switches: Record<string, 1 | -1> = {}
		for (const k of m.inc) switches[k] = 1
		for (const k of m.exc) switches[k] = -1
		toMix({ switches, seeds: [], label: `${m.emoji} ${m.name}` })
	}

	const openGuide = () => {
		setGuideFocus(z.ch)
		setNav((n) => (n[n.length - 1]?.kind === "guide" ? n : [...n, { kind: "guide" }]))
	}
	const back = () => setNav((n) => n.slice(0, -1))
	const home = () => zap(0)
	const openTitle = (key: string) => setNav((n) => [...n.filter((x) => x.kind !== "title"), { kind: "title", key }])
	const moreLike = (key: string, title: string) => toMix({ seeds: [key], switches: {}, label: `More like ${title}` })
	const startPicks = () => {
		setDeckPage(0)
		setNav([{ kind: "picks" }])
	}
	const toggleLove = (key: string) => setLoved((l) => (l.includes(key) ? l.filter((x) => x !== key) : [...l, key]))
	const finishPicks = () => toMix({ seeds: loved, switches: {}, label: "Your picks" })
	const pickService = (key: string) => {
		click()
		setMix((prev) => {
			const service = prev.service === key ? null : key
			return { ...prev, service }
		})
		setNav([])
		z.tune(MIX)
	}

	const setMode = (m: Mode) => {
		click()
		setModeRaw(m)
		setNav([])
		if (m === "mood") applyMood(moodIdx)
		if (m === "tune") z.tune(MIX)
		if (m === "search" && query) z.tune(SEARCH_CH)
	}

	const step = (d: 1 | -1) => {
		click()
		if (top?.kind === "guide") return setGuideFocus((g) => (g + d + CHANNELS2.length) % CHANNELS2.length)
		if (top?.kind === "picks") return setDeckPage((p) => Math.max(0, p + d))
		if (mode === "ch") zap(z.ch + d)
		else if (mode === "mood") {
			const i = (moodIdx + d + MOODS.length) % MOODS.length
			setMoodIdx(i)
			applyMood(i)
		} else if (mode === "tune") setFocus((f) => (f + d + TUNE_KEYS.length) % TUNE_KEYS.length)
		else if (mode === "search") {
			const i = (sugg + d + SUGGESTIONS.length) % SUGGESTIONS.length
			setSugg(i)
			setDraft(SUGGESTIONS[i])
		}
	}

	const submit = () => {
		const q = draft.trim()
		if (q.length < 2) return
		setQuery(q)
		zap(SEARCH_CH)
	}

	const ok = () => {
		click()
		if (top?.kind === "guide") return zap(guideFocus)
		if (top?.kind === "picks") return loved.length >= 3 && finishPicks()
		if (mode === "ch") openGuide()
		else if (mode === "mood") applyMood(moodIdx)
		else if (mode === "tune") {
			const k = TUNE_KEYS[focus]
			const next = { ...mix.switches }
			// Any, then more, then none, then any.
			if (!next[k]) next[k] = 1
			else if (next[k] === 1) next[k] = -1
			else delete next[k]
			toMix({ switches: next, seeds: [], label: "Tuned by you" })
		} else if (mode === "search") submit()
	}

	const up = () => (top?.kind === "guide" ? setGuideFocus((g) => (g - 1 + CHANNELS2.length) % CHANNELS2.length) : zap(z.ch + 1))
	const down = () => (top?.kind === "guide" ? setGuideFocus((g) => (g + 1) % CHANNELS2.length) : zap(z.ch - 1))

	return {
		mode, setMode, moodIdx, focus, mix, draft, setDraft, query, submit, nav, top, guideFocus, setGuideFocus,
		loved, toggleLove, deckPage, setDeckPage, finishPicks, pulse, click, muted, setMuted,
		step, ok, up, down, back, home, zap, openGuide, openTitle, moreLike, startPicks, pickService, country,
		okLabel: top?.kind === "guide" ? "WATCH" : top?.kind === "picks" ? "DONE" : undefined,
	}
}

export type R3 = ReturnType<typeof useRemote3>

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

const MODE_KEYS: { m: Mode; label: string; d: string }[] = [
	{ m: "ch", label: "CH", d: "M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5zM8 21h8" },
	{ m: "mood", label: "Mood", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" },
	{ m: "tune", label: "Tune", d: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4" },
	{ m: "search", label: "Search", d: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" },
]

export function Icon({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d={d} />
		</svg>
	)
}

export type Look = "current" | "aluminum" | "solar" | "pebble"

export function Remote3({ z, r, services, pointing, grip, look = "current" }: { z: Zapper; r: R3; services: LRServiceButton[]; pointing: boolean; grip?: number; look?: Look }) {
	const [blink, setBlink] = useState(0)
	useEffect(() => setBlink((b) => b + 1), [r.pulse, z.zapId])
	if (look !== "current") return <RemoteLook z={z} r={r} services={services} pointing={pointing} grip={grip} look={look} blink={blink} />
	return (
		<div className="lr2-remote lr3-remote relative select-none" role="group" aria-label="Remote control">
			<div className="lr2-body lr3-body relative flex flex-col items-center gap-3.5 rounded-[52px] px-6 pb-6 pt-4" style={grip ? { minHeight: grip } : undefined}>
				<div className="flex w-full items-center justify-between">
					<button
						type="button"
						aria-label={z.on ? "Turn off" : "Turn on"}
						onClick={() => {
							r.click()
							z.setOn(!z.on)
						}}
						className="lr2-key flex h-9 w-9 items-center justify-center rounded-full text-rose-400"
					>
						<Icon d="M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0" className="h-4 w-4" />
					</button>
					{/* The pointer's window: lights while you point at the screen, blinks on every press. */}
					<div className="lr3-ir relative h-2 w-20 rounded-full bg-black/70">
						<motion.div className="absolute inset-0 rounded-full bg-orange-400" animate={{ opacity: pointing ? 0.9 : 0 }} transition={{ duration: 0.2 }} style={{ boxShadow: "0 0 14px 3px rgba(251,146,60,0.7)" }} />
						<motion.div
							key={blink}
							className="absolute inset-0 rounded-full bg-sky-300"
							initial={{ opacity: blink > 1 ? 1 : 0 }}
							animate={{ opacity: 0 }}
							transition={{ duration: 0.35 }}
						/>
					</div>
					<button
						type="button"
						aria-label={r.muted ? "Sound on" : "Sound off"}
						onClick={() => {
							r.setMuted(!r.muted)
							z.setMuted(!r.muted)
						}}
						className="lr2-key flex h-9 w-9 items-center justify-center rounded-full"
					>
						<Icon d={r.muted ? "M11 5L6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6" : "M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"} className="h-4 w-4" />
					</button>
				</div>

				<Lcd3 z={z} r={r} services={services} pointing={pointing} />

				<div className="grid w-full grid-cols-4 gap-2">
					{MODE_KEYS.map((k) => (
						<button
							key={k.m}
							type="button"
							aria-pressed={r.mode === k.m}
							onClick={() => r.setMode(k.m)}
							className={`lr2-key flex h-[52px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold uppercase tracking-wider ${r.mode === k.m ? "lr2-key-on" : ""}`}
						>
							<Icon d={k.d} />
							{k.label}
						</button>
					))}
				</div>

				{/* Streaming buttons, like on real remotes: they filter the mix to that service. */}
				<div className="grid w-full grid-cols-4 gap-2">
					{services.slice(0, 8).map((s) => {
						const on = r.mix.service === s.key
						return (
							<button
								key={s.key}
								type="button"
								aria-pressed={on}
								aria-label={`Only ${s.label}`}
								title={`Only ${s.label}`}
								onClick={() => r.pickService(s.key)}
								className={`lr3-svc relative flex h-10 items-center justify-center overflow-hidden rounded-xl ${on ? "lr3-svc-on" : ""}`}
								style={{ background: s.color }}
							>
								{s.logo ? <img src={img(s.logo, "w92")} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-white">{s.label}</span>}
							</button>
						)
					})}
				</div>

				<button
					type="button"
					onClick={() => {
						r.click()
						r.startPicks()
					}}
					className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 py-3 text-[13px] font-extrabold uppercase tracking-wider text-black shadow-[0_2px_0_#8a5a0a,0_8px_20px_rgba(251,191,36,0.25)] transition-transform active:translate-y-[2px]"
				>
					<img src={gwLogo} alt="" className="h-4 invert" />
					Get my picks
				</button>

				<div className="grid w-full grid-cols-4 gap-2">
					<UKey label="Back" onClick={() => { r.click(); r.back() }}>
						<Icon d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" className="h-4 w-4" />
					</UKey>
					<UKey label="Home" onClick={() => { r.click(); r.home() }}>
						<Icon d="M3 11l9-7 9 7M5 10v10h14V10" className="h-4 w-4" />
					</UKey>
					<UKey label="Guide" onClick={() => { r.click(); r.openGuide() }}>
						<Icon d="M4 5h16M4 10h16M4 15h10M4 20h7" className="h-4 w-4" />
					</UKey>
					<UKey label="Channel up" onClick={() => { r.click(); r.zap(z.ch + 1) }}>
						<span className="text-[10px] font-bold tracking-wider">CH+</span>
					</UKey>
				</div>

				<Wheel z={z} r={{ mode: r.mode, step: r.step, ok: r.ok, click: r.click, okLabel: r.okLabel, up: r.up, down: r.down }} size={206} />
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

function UKey({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
	return (
		<button type="button" aria-label={label} title={label} onClick={onClick} className="lr2-key flex h-10 items-center justify-center rounded-full">
			{children}
		</button>
	)
}

function Lcd3({ z, r, services, pointing }: { z: Zapper; r: R3; services: LRServiceButton[]; pointing: boolean }) {
	const c = CHANNELS2[z.ch]
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (r.mode === "search" && !r.top) input.current?.focus({ preventScroll: true })
	}, [r.mode, r.top])
	const k = TUNE_KEYS[r.focus]
	const meta = getFingerprintMeta(k)
	const state = r.mix.switches[k]
	const svc = services.find((s) => s.key === r.mix.service)
	const status = r.top?.kind === "guide" ? "Guide" : r.top?.kind === "title" ? "Info" : r.top?.kind === "picks" ? "Get my picks" : { ch: "Channel", mood: "Mood", tune: "Tune", search: "Search" }[r.mode]
	const body = (): ReactNode => {
		if (r.top?.kind === "guide") {
			const g = CHANNELS2[r.guideFocus]
			return (
				<>
					<Big>
						{String(g.num).padStart(2, "0")} {g.short.toUpperCase()}
					</Big>
					<Small>Wheel or arrows to choose · Watch</Small>
				</>
			)
		}
		if (r.top?.kind === "title") return (<><div className="truncate text-[20px] font-semibold text-white">Title info</div><Small>OK for more like this · Back to return</Small></>)
		if (r.top?.kind === "picks")
			return (
				<>
					<div className="flex items-baseline gap-2 text-white">
						<span className="lr-vt text-[40px] leading-none text-[var(--lcd)]">{Math.min(r.loved.length, 3)}/3</span>
						<span className="text-[16px] font-semibold">loved</span>
					</div>
					<Small>{r.loved.length >= 3 ? "OK shows your picks" : "Point at titles you loved"}</Small>
				</>
			)
		if (r.mode === "ch")
			return (
				<>
					<Big>
						{String(c.num).padStart(2, "0")} {c.short.toUpperCase()}
					</Big>
					<Small>{svc ? `Only ${svc.label}` : c.line}</Small>
				</>
			)
		if (r.mode === "mood")
			return (
				<>
					<div className="flex items-center gap-2 text-[22px] font-semibold leading-tight text-white">
						<span className="text-[26px]">{MOODS[r.moodIdx].emoji}</span>
						<span className="truncate">{MOODS[r.moodIdx].name}</span>
					</div>
					<Small>{svc ? `On ${svc.label} · ` : ""}{MOODS[r.moodIdx].inc.map((x) => getFingerprintMeta(x).label).join(" + ")}</Small>
					<div className="mt-2 flex gap-1">
						{MOODS.map((m, i) => (
							<span key={m.id} className={`h-1 rounded-full transition-all ${i === r.moodIdx ? "w-4 bg-[var(--lcd)]" : "w-1 bg-white/25"}`} />
						))}
					</div>
				</>
			)
		if (r.mode === "tune")
			return (
				<>
					<div className="flex items-center gap-2 text-[20px] font-semibold leading-tight text-white">
						<span className="text-[22px]">{meta.emoji}</span>
						<span className="flex-1 truncate">{meta.label}</span>
						<span className={`rounded-md px-2 py-0.5 text-[13px] font-bold ${state === 1 ? "bg-emerald-400/25 text-emerald-200" : state === -1 ? "bg-rose-400/25 text-rose-200" : "bg-white/10 text-white/50"}`}>
							{state === 1 ? "MORE" : state === -1 ? "NONE" : "ANY"}
						</span>
					</div>
					<Small>Wheel picks an attribute · SET switches it</Small>
				</>
			)
		return null
	}
	return (
		<div className="lr2-lcd relative h-[132px] w-full overflow-hidden rounded-[20px] px-4 py-3">
			<div className="lr2-lcd-grid pointer-events-none absolute inset-0" />
			<div className="relative flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[var(--lcd)] opacity-75">
				<span>{status}</span>
				<span className="flex items-center gap-2">
					{pointing && <span className="rounded bg-orange-400/25 px-1.5 text-orange-200">Point</span>}
					{svc && <span className="rounded bg-white/10 px-1.5 normal-case tracking-normal text-white/80">{svc.label}</span>}
					{z.on ? "Live" : "Standby"}
				</span>
			</div>
			{r.mode === "search" && !r.top ? (
				<form
					className="relative mt-2"
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
						className="w-full bg-transparent text-[16px] font-medium text-white placeholder:text-white/35 focus:outline-none"
					/>
					<div className="mt-1 h-px w-full bg-[var(--lcd)] opacity-40" />
					<Small>Enter or GO runs it · the wheel suggests</Small>
				</form>
			) : (
				<div className="relative mt-2">{body()}</div>
			)}
			<div className="pointer-events-none absolute inset-0 rounded-[20px] bg-[linear-gradient(160deg,rgba(255,255,255,0.10)_0%,transparent_35%)]" />
		</div>
	)
}

export const Big = ({ children }: { children: ReactNode }) => <div className="lr-vt truncate text-[34px] leading-none text-[var(--lcd)]">{children}</div>
export const Small = ({ children }: { children: ReactNode }) => <div className="mt-2 truncate text-[11px] text-[var(--lcd)] opacity-80">{children}</div>

// ---------------------------------------------------------------------------------------------------------
// TV screens that sit on top of the channels: the guide, a title's page, and rating titles.

function TvPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<motion.div
			className={`absolute inset-0 z-20 overflow-hidden text-white ${className}`}
			initial={{ opacity: 0, scale: 1.02 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.99 }}
			transition={{ duration: 0.2, ease }}
		>
			{children}
		</motion.div>
	)
}

function GuideTv({ r, now }: { r: R3; now: number }) {
	return (
		<TvPanel className="bg-[#07090d]/95 backdrop-blur-md">
			<div className="flex items-baseline justify-between px-12 pt-9">
				<span className="lr-vt text-[40px] leading-none tracking-wider text-[#7CFF9B]">GUIDE</span>
				<span className="text-[14px] text-white/45">Point at a channel, or turn the wheel</span>
			</div>
			<div className="mt-5 grid grid-cols-2 gap-3 px-12">
				{CHANNELS2.map((c, i) => (
					<button
						key={c.id}
						type="button"
						data-pick={`ch:${i}`}
						onMouseEnter={() => r.setGuideFocus(i)}
						className={`flex items-center gap-4 rounded-2xl px-5 py-3 text-left ring-1 ${r.guideFocus === i ? "bg-white/12 ring-white/40" : "bg-white/[0.04] ring-white/10"}`}
					>
						<span className="lr-vt w-12 text-[36px] leading-none" style={{ color: c.glow }}>
							{String(c.num).padStart(2, "0")}
						</span>
						<span className="min-w-0 flex-1">
							<span className="block text-[20px] font-bold">{c.name}</span>
							<span className="block truncate text-[13px] text-white/55">{c.line}</span>
						</span>
						{now === i && <span className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold tracking-wider">ON AIR</span>}
					</button>
				))}
			</div>
		</TvPanel>
	)
}

const PILLARS: PillarName[] = ["Energy", "Heart", "Humor", "World", "Craft", "Style"]

export function TitleTv({ r, keyId }: { r: R3; keyId: string }) {
	const { data: t } = useApi<LRTitle | null>({ op: "title", key: keyId, country: r.country })
	return (
		<TvPanel className="bg-[#06070a]">
			{!t ? (
				<div className="flex h-full items-center justify-center">
					<motion.div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-orange-300" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY, ease: "linear" }} />
				</div>
			) : (
				<>
					<img src={img(t.backdrop, "w1280")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
					<div className="absolute inset-0 bg-[linear-gradient(90deg,#06070a_30%,rgba(6,7,10,0.7)_60%,rgba(6,7,10,0.3))]" />
					<motion.img
						src={img(t.poster)}
						alt={t.title}
						className="absolute left-12 top-10 w-[210px] rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, ease }}
					/>
					<div className="absolute left-[290px] right-12 top-10">
						<div className="text-[14px] font-medium text-amber-300/90">
							{[t.year, t.genres.slice(0, 3).join(" · "), t.type === "movie" && t.runtime ? `${Math.floor(t.runtime / 60)}h ${t.runtime % 60}m` : t.seasons ? `${t.seasons} seasons` : ""].filter(Boolean).join("  ·  ")}
						</div>
						<h2 className="mt-1 text-[40px] font-extrabold leading-[1.02] tracking-tight">{t.title}</h2>
						<p className="mt-3 line-clamp-3 text-[15px] leading-snug text-white/75">{t.essence || t.tagline}</p>
						<div className="mt-5 flex items-center gap-5">
							<GwBadge gw={t.gw} size={38} text="text-[26px]" />
							<span className="flex items-center gap-4 border-l border-white/15 pl-5 text-[16px] font-semibold">
								{t.imdb ? <Src logo={imdbLogo} v={t.imdb.toFixed(1)} /> : null}
								{t.metacritic ? <Src logo={metacriticLogo} v={String(t.metacritic)} /> : null}
								{t.rt ? <Src logo={rottenLogo} v={`${t.rt}%`} /> : null}
							</span>
						</div>
						<div className="mt-5 flex items-end gap-6">
							<div className="grid grid-cols-3 gap-x-5 gap-y-1.5">
								{PILLARS.map((p) => {
									const tier = t.pillars?.[p] ?? 0
									return (
										<div key={p} className="flex items-center gap-2 text-[13px]">
											<span>{PILLAR_CONFIG[p].emoji}</span>
											<span className="w-12 text-white/70">{p}</span>
											<span className="flex gap-0.5">
												{[0, 1, 2, 3].map((i) => (
													<span key={i} className={`h-2.5 w-2.5 rounded-sm ${i < tier ? "bg-orange-300" : "bg-white/15"}`} />
												))}
											</span>
										</div>
									)
								})}
							</div>
						</div>
						<div className="mt-5 flex items-center gap-2">
							{t.services.filter((s) => s.kind === "stream" || s.kind === "free").slice(0, 5).map((s) => (
								<img key={s.id} src={img(s.logo, "w92")} alt={s.name} title={s.name} className="h-9 w-9 rounded-lg" />
							))}
							<span className="ml-auto flex gap-3">
								<button type="button" data-pick="action:back" className="rounded-full bg-white/10 px-5 py-2.5 text-[15px] font-semibold ring-1 ring-white/20">
									Back
								</button>
								<button type="button" data-pick={`action:more:${t.key}:${t.title}`} className="rounded-full bg-orange-400 px-5 py-2.5 text-[15px] font-bold text-black">
									More like this
								</button>
							</span>
						</div>
					</div>
				</>
			)}
		</TvPanel>
	)
}

function Src({ logo, v }: { logo: string; v: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<img src={logo} alt="" className="h-6 w-6 object-contain" />
			{v}
		</span>
	)
}

export function PicksTv({ r }: { r: R3 }) {
	const { data: deck } = useApi<LRTuned[]>({ op: "deck" })
	const per = 16
	const pages = deck ? Math.ceil(deck.length / per) : 1
	const page = Math.min(r.deckPage, pages - 1)
	const shown = deck?.slice(page * per, page * per + per) ?? []
	const done = r.loved.length >= 3
	return (
		<TvPanel className="bg-[radial-gradient(100%_80%_at_50%_0%,#2a1a05_0%,#07080b_65%)]">
			<div className="flex items-end justify-between px-12 pt-8">
				<div>
					<div className="text-[13px] font-bold uppercase tracking-[0.3em] text-amber-300/85">Get my picks</div>
					<div className="mt-1 text-[30px] font-extrabold tracking-tight">Point at three you loved</div>
				</div>
				<div className="flex items-center gap-2">
					{[0, 1, 2].map((i) => (
						<motion.span key={i} className="flex h-8 w-8 items-center justify-center rounded-full text-[16px]" animate={{ backgroundColor: i < r.loved.length ? "rgba(251,191,36,1)" : "rgba(255,255,255,0.08)", scale: i === r.loved.length - 1 ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.3 }}>
							{i < r.loved.length ? "♥" : ""}
						</motion.span>
					))}
				</div>
			</div>
			<AnimatePresence mode="wait">
				<motion.div key={page} className="mt-5 grid grid-cols-8 gap-2.5 px-12" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
					{shown.map((t) => {
						const on = r.loved.includes(t.key)
						return (
							<div key={t.key} data-pick={`love:${t.key}`} className="relative">
								<img src={img(t.poster, "w185")} alt={t.title} className={`aspect-[2/3] w-full rounded-lg object-cover ring-2 transition ${on ? "ring-amber-300" : "ring-transparent"}`} />
								<AnimatePresence>
									{on && (
										<motion.span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[15px] text-black shadow-lg" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
											♥
										</motion.span>
									)}
								</AnimatePresence>
							</div>
						)
					})}
				</motion.div>
			</AnimatePresence>
			<div className="absolute bottom-5 left-12 right-12 flex items-center justify-between">
				<button type="button" data-pick="action:deck-next" className="rounded-full bg-white/10 px-5 py-2 text-[14px] font-semibold ring-1 ring-white/20">
					Show others
				</button>
				<motion.button
					type="button"
					data-pick="action:finish"
					className="rounded-full px-6 py-2.5 text-[15px] font-bold"
					animate={{ backgroundColor: done ? "rgba(251,191,36,1)" : "rgba(255,255,255,0.08)", color: done ? "#000" : "rgba(255,255,255,0.35)" }}
				>
					{done ? "See my picks" : `${3 - r.loved.length} more`}
				</motion.button>
			</div>
		</TvPanel>
	)
}

// CH 07 · Your mix, round 3: mood or attributes, a service, and taste seeds, all combined.
export function Mix3({ r, services }: { r: R3; services: LRServiceButton[] }) {
	const lean = useContext(Lean)
	const m = r.mix
	const { data: rows, busy } = useApi<LRTuned[]>(tuneParams(m, r.country))
	const svc = services.find((s) => s.key === m.service)
	const inc = Object.keys(m.switches).filter((k) => m.switches[k] === 1)
	const exc = Object.keys(m.switches).filter((k) => m.switches[k] === -1)
	const title = m.label ?? (svc ? `Best on ${svc.label}` : "Pick a mood on the remote")
	const shown = rows?.slice(0, 6) ?? []
	return (
		<div className="absolute inset-0 overflow-hidden bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)] text-white">
			<div className="absolute left-12 top-9 flex items-center gap-3">
				{!lean && <span className="text-[13px] font-bold uppercase tracking-[0.3em] text-orange-300/85">Your mix</span>}
				{svc && (
					<span className="flex items-center gap-1.5 rounded-full bg-white/10 py-0.5 pl-0.5 pr-2.5 text-[12px] font-semibold">
						{svc.logo && <img src={img(svc.logo, "w92")} alt="" className="h-5 w-5 rounded-full" />}
						Only {svc.label}
					</span>
				)}
				{busy && <span className="h-1.5 w-1.5 animate-ping rounded-full bg-orange-300" />}
			</div>
			<div className="absolute left-12 right-12 top-[60px]">
				<AnimatePresence mode="wait">
					<motion.div key={title} className="text-[34px] font-extrabold tracking-tight" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease }}>
						{title}
					</motion.div>
				</AnimatePresence>
				<div className={`mt-3 min-h-[30px] flex-wrap items-center gap-2 ${lean ? "hidden" : "flex"}`}>
					{m.seeds.length > 0 && <span className="text-[14px] text-white/55">Matched on the fingerprint of what you loved</span>}
					{[...inc.map((k) => [k, 1] as const), ...exc.map((k) => [k, -1] as const)].map(([k, v]) => {
						const f = getFingerprintMeta(k)
						return (
							<span key={k} className={`rounded-full px-3 py-1 text-[14px] ring-1 ${v === 1 ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30" : "bg-rose-500/15 text-rose-200 ring-rose-400/30"}`}>
								{v === 1 ? "More" : "No"} {f.emoji} {f.label}
							</span>
						)
					})}
				</div>
			</div>
			<div className={`absolute left-12 right-12 top-[168px] grid grid-cols-6 gap-4 transition-opacity ${busy ? "opacity-60" : ""}`}>
				<AnimatePresence mode="popLayout">
					{shown.map((t, k) => (
						<motion.div key={t.key} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.35, delay: k * 0.03, ease }}>
							<div className="relative" data-pick={t.key}>
								<img src={img(t.poster, "w185")} alt={t.title} className="aspect-[2/3] w-full rounded-lg object-cover shadow-xl ring-1 ring-white/10" />
								{m.seeds.length > 0 ? (
									<span className="absolute -right-1.5 -top-1.5 rounded-full bg-orange-500 px-2 py-0.5 text-[12px] font-extrabold shadow-lg">{t.fit}%</span>
								) : (
									!lean && <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-orange-200">#{k + 1}</span>
								)}
							</div>
							<div className="mt-2 truncate text-[13px] font-semibold">{t.title}</div>
							<div className="mt-0.5 flex items-center gap-2">
								<GwBadge gw={t.gw} size={16} text="text-[12px]" />
								<span className="truncate text-[11px] text-white/45">{t.top.map((x) => getFingerprintMeta(x).emoji).join(" ")}</span>
							</div>
						</motion.div>
					))}
				</AnimatePresence>
				{rows && rows.length === 0 && <div className="col-span-6 pt-10 text-[18px] text-white/55">Nothing matches all of that here. Switch something off.</div>}
			</div>
		</div>
	)
}

function render3(ch: number, data: LRData, queries: string[], r: R3, services: LRServiceButton[]) {
	const id = CHANNELS2[ch]?.id
	if (id === "mix") return <Mix3 r={r} services={services} />
	if (id === "search" && r.query) return <Search queries={queries} fixed={r.query} />
	return renderChannel(ch, data, queries)
}

// ---------------------------------------------------------------------------------------------------------
// The room: steady camera, a big TV, the remote beside it.

export interface Room3 {
	name: string
	src: string
	w: number
	h: number
	tv: { x: number; y: number; w: number; h: number }
	alt: string
}

const QUERIES = SUGGESTIONS
const pct = (v: number, of: number) => `${(v / of) * 100}%`
const REMOTE_W = 312
// The hand photo (1024 x 1536): where the placeholder the remote replaces was.
const HAND = { w: 1024, h: 1536, x: 321, y: 68, pw: 382, ph: 1060 }
// In the hand, the remote is as long as the placeholder: the extra length is a plain grip with the logo.
const GRIP_H = Math.round((REMOTE_W * HAND.ph) / HAND.pw)
export type Pose = "side" | "front" | "hand"

// Wide-screen layout, computed from the window and the remote's natural size only (no measuring after
// transforms, so it can't feed back on itself). Side: the remote stands in a column on the right, turned
// toward the TV. Front and hand: centered below the TV, never over it, tipped back so it points at the screen.
function layout(cw: number, ch: number, pose: Pose, rh: number) {
	if (pose === "side") {
		const s = Math.min(1, (ch - 48) / rh, (cw * 0.28) / REMOTE_W)
		const rw = REMOTE_W * s
		const right = 28
		const areaW = cw - rw - right - 36
		return {
			tv: { cx: areaW / 2 + 12, cy: ch * 0.46, maxW: areaW * 0.94, maxH: ch * 0.74 },
			remote: { s, left: cw - right - rw, top: (ch - rh * s) / 2, rx: 0, ry: -12, persp: 1400, yawMax: 6 },
		}
	}
	if (pose === "front") {
		// Centered, standing on the bottom edge and tipped 38 degrees back so its top points into the screen.
		// Tipped, it looks about 0.76 of its height; it must end below the TV's bottom (47% down) plus a gap.
		const s = Math.min(1.1, (ch * 0.5 - 8) / (rh * 0.76), (cw * 0.3) / REMOTE_W)
		return {
			tv: { cx: cw * 0.5, cy: ch * 0.25, maxW: cw * 0.8, maxH: ch * 0.44 },
			remote: { s, left: cw / 2 - (REMOTE_W * s) / 2, top: ch - 8 - rh * s, rx: 38, ry: 0, persp: 900, yawMax: 70 },
		}
	}
	// Hand: centered below the TV, hand and remote tipped a little toward the screen. The plain grip at the
	// bottom (about 17% of its length) may run below the fold, under the hand.
	const top = ch * 0.47
	const s = Math.min(1.1, (ch - top) / (rh * 0.83 * 0.97), (cw * 0.3) / REMOTE_W)
	return {
		tv: { cx: cw * 0.5, cy: ch * 0.235, maxW: cw * 0.8, maxH: ch * 0.41 },
		remote: { s, left: cw / 2 - (REMOTE_W * s) / 2, top, rx: 12, ry: 0, persp: 1400, yawMax: 70 },
	}
}

export function LivingRoom3({ data, room, pose = "hand", look = "current", round4 = false }: { data: LRData; room: Room3; pose?: Pose; look?: Look; round4?: boolean }) {
	const root = useRef<HTMLDivElement>(null)
	const area = useRef<HTMLDivElement>(null)
	const remoteBox = useRef<HTMLDivElement>(null)
	const z = useZapper(CHANNELS2.length)
	const r = useRemote3(z, data.country)
	// Round 4 drives the TV with its own screen stack; both hooks run, one is used.
	const t4 = useTv4(z, data.country)
	const { data: services } = useApi<LRServiceButton[]>({ op: "services" })
	const [pointing, setPointing] = useState(false)
	// Aiming: while you point at the TV, the remote swivels from its bottom toward the pointer. Springs and
	// refs only, so moving the mouse never re-renders the page.
	const yaw = useSpring(0, { stiffness: 900, damping: 60 })
	const pitch = useSpring(0, { stiffness: 900, damping: 60 })
	const cursorAt = useRef<{ x: number; y: number } | null>(null)
	// The enter event and the first move arrive together, before a re-render: read pointing from a ref.
	const pointingRef = useRef(false)
	const beamSvg = useRef<SVGSVGElement>(null)
	const beamLine = useRef<SVGLineElement>(null)
	const beamGrad = useRef<SVGLinearGradientElement>(null)
	const [box, setBox] = useState({ cw: 0, ch: 0, wide: true, rh: 760 })
	useAutoPowerOn(z)
	useRemoteKeys(
		round4 ? { ...z, tune: (n: number) => (z.on ? t4.step(n > z.ch ? 1 : -1) : z.setOn(true)) } : z,
		round4 ? 0 : CHANNELS2.length,
		(e) => {
		const k = e.key.toLowerCase()
		if (round4) {
			// Off: any key turns the set on. Searching: the keyboard screen takes Enter and Backspace.
			if (!z.on) return z.setOn(true)
			if (t4.mode === "search") return
			if (k === "escape" || k === "backspace") t4.back()
			if (k === "enter") t4.ok()
			if (k === "h") t4.home()
			return
		}
		if (k === "g") r.openGuide()
		if (k === "escape" || k === "backspace") r.back()
		if (k === "enter") r.ok()
		},
	)

	// Warm the caches: every mood, the deck, so presses answer at once.
	useEffect(() => {
		const t = setTimeout(async () => {
			await api({ op: "deck" }).catch(() => {})
			for (const m of MOODS) {
				const switches: Record<string, 1 | -1> = {}
				for (const k of m.inc) switches[k] = 1
				for (const k of m.exc) switches[k] = -1
				await api(tuneParams({ switches, service: null, seeds: [], label: null }, data.country)).catch(() => {})
			}
		}, 1200)
		return () => clearTimeout(t)
	}, [])

	// The window's size and the remote's natural height (offsetHeight ignores transforms).
	useIso(() => {
		const el = root.current
		if (!el) return
		const measure = () => {
			const rem = el.querySelector(".lr3-remote") as HTMLElement | null
			const rh = rem?.offsetHeight || 760
			setBox((b) =>
				b.cw === el.clientWidth && b.ch === el.clientHeight && Math.abs(b.rh - rh) < 2
					? b
					: { cw: el.clientWidth, ch: el.clientHeight, wide: el.clientWidth >= 1024, rh },
			)
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		const rem = el.querySelector(".lr3-remote")
		if (rem) ro.observe(rem)
		return () => ro.disconnect()
		// Again once the remote exists and once the service buttons (a whole row) have arrived.
	}, [pose, box.cw > 0, services?.length ?? 0])

	const L = box.cw ? layout(box.cw, box.ch, pose, box.rh) : null

	// Place the photo so the TV fills the space left of the remote (or the top of a phone screen).
	const frame = useMemo(() => {
		if (!box.cw) return null
		const ah = box.wide ? box.ch : Math.round(box.cw * 0.62)
		const aspect = room.tv.w / room.tv.h
		const tvW = box.wide && L ? Math.min(L.tv.maxW, L.tv.maxH * aspect) : Math.min(box.cw * 0.96, ah * 0.8 * aspect)
		let s = tvW / room.tv.w
		s = Math.max(s, Math.max(box.cw / room.w, ah / room.h))
		const cx = (room.tv.x + room.tv.w / 2) * s
		const cy = (room.tv.y + room.tv.h / 2) * s
		const W = room.w * s
		const H = room.h * s
		let left = (box.wide && L ? L.tv.cx : box.cw / 2) - cx
		let top = (box.wide && L ? L.tv.cy : ah / 2) - cy
		left = Math.min(0, Math.max(box.cw - W, left))
		top = Math.min(0, Math.max(ah - H, top))
		// Where the TV ended up on screen, for placing the remote beside it.
		const tvRect = { x: left + room.tv.x * s, y: top + room.tv.y * s, w: room.tv.w * s, h: room.tv.h * s }
		return { s, left, top, W, H, ah, tvRect }
	}, [box, room, pose])

	const glow = CHANNELS2[z.ch].glow
	const tv = room.tv
	const cx = pct(tv.x + tv.w / 2, room.w)
	const cy = pct(tv.y + tv.h / 2, room.h)

	const onPick = (el: HTMLElement) => {
		const v = el.dataset.pick ?? ""
		r.click()
		if (v.startsWith("ch:")) r.zap(Number(v.slice(3)))
		else if (v === "action:back") r.back()
		else if (v.startsWith("action:more:")) {
			const [, , type, id, ...rest] = v.split(":")
			r.moreLike(`${type}:${id}`, rest.join(":"))
		} else if (v === "action:deck-next") r.setDeckPage(r.deckPage + 1)
		else if (v === "action:finish") r.loved.length >= 3 && r.finishPicks()
		else if (v.startsWith("love:")) r.toggleLove(v.slice(5))
		else if (/^(movie|show):\d+$/.test(v)) r.openTitle(v)
	}

	const overlay = (
		<AnimatePresence>
			{r.top?.kind === "guide" && <GuideTv key="guide" r={r} now={z.ch} />}
			{r.top?.kind === "title" && <TitleTv key={`t-${r.top.key}`} r={r} keyId={r.top.key} />}
			{r.top?.kind === "picks" && <PicksTv key="picks" r={r} />}
		</AnimatePresence>
	)

	const rx = useTransform(pitch, (p) => (L?.remote.rx ?? 0) + p)
	const pivot = () => (L ? { x: L.remote.left + (REMOTE_W * L.remote.s) / 2, y: L.remote.top + box.rh * L.remote.s } : null)

	// The beam leaves the remote's tip (its pointer window, just below the top) at the remote's current angle.
	const drawBeam = () => {
		const svg = beamSvg.current
		const c = cursorAt.current
		const p = pivot()
		if (!svg) return
		if (!c || !p || !L) {
			svg.style.opacity = "0"
			return
		}
		const len = box.rh * L.remote.s * 0.96 * Math.cos(((L.remote.rx + pitch.get()) * Math.PI) / 180)
		const a = (yaw.get() * Math.PI) / 180
		const x1 = p.x + Math.sin(a) * len
		const y1 = p.y - Math.cos(a) * len
		for (const el of [beamLine.current, beamGrad.current]) {
			el?.setAttribute("x1", String(x1))
			el?.setAttribute("y1", String(y1))
			el?.setAttribute("x2", String(c.x))
			el?.setAttribute("y2", String(c.y))
		}
		svg.style.opacity = "1"
	}
	useMotionValueEvent(yaw, "change", drawBeam)

	const onMove = (e: React.PointerEvent) => {
		if (!pointingRef.current || !box.wide || e.pointerType !== "mouse" || !root.current || !L) return
		const b = root.current.getBoundingClientRect()
		const c = { x: e.clientX - b.left, y: e.clientY - b.top }
		cursorAt.current = c
		const p = pivot()!
		const max = L.remote.yawMax
		yaw.set(Math.max(-max, Math.min(max, (Math.atan2(c.x - p.x, p.y - c.y) * 180) / Math.PI)))
		// Aiming higher up the screen tips the remote a little further back.
		pitch.set(Math.max(-4, Math.min(8, ((p.y - c.y) / box.ch - 0.55) * 20)))
		drawBeam()
	}
	const stopAim = () => {
		cursorAt.current = null
		yaw.set(0)
		pitch.set(0)
		drawBeam()
	}

	return (
		<div
			ref={root}
			className={`lr-root lr3 fixed inset-x-0 bottom-16 top-16 z-40 bg-[#07080b] text-white lg:bottom-0 ${box.wide ? "overflow-clip" : "overflow-y-auto overflow-x-clip"}`}
			onPointerMove={onMove}
		>
			{/* Raw, so the server doesn't escape the CSS child combinator (a hydration mismatch otherwise). */}
			<style dangerouslySetInnerHTML={{ __html: `html, body { overflow: hidden !important; } ${LR2_CSS} ${LR3_CSS} ${LR4_CSS}` }} />

			<div ref={area} className={box.wide ? "absolute inset-0 overflow-clip" : "relative overflow-clip"} style={box.wide ? undefined : { height: frame?.ah ?? 240 }}>
				{!box.wide && <img src={room.src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl brightness-50" />}
				{frame && (
					<div className="absolute" style={{ left: frame.left, top: frame.top, width: frame.W, height: frame.H }}>
						<AnimatePresence initial={false}>
							<motion.img key={room.src} src={room.src} alt={room.alt} className="absolute inset-0 h-full w-full select-none" draggable={false} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} />
						</AnimatePresence>
						<motion.div className="absolute inset-0 bg-[#05060a]" initial={{ opacity: 0.6 }} animate={{ opacity: z.on ? 0.12 : 0.6 }} transition={{ duration: 1.4, ease: "easeOut" }} />
						{/* The TV's light on the room: a plain translucent gradient. A blend mode here (and dust drifting
						    through it) made the browser re-blend the whole room every frame: 86% of a core while idle. */}
						<motion.div
							className="pointer-events-none absolute inset-0"
							initial={false}
							animate={{ opacity: z.on ? 0.28 : 0, background: `radial-gradient(40% 55% at ${cx} ${cy}, ${glow}66 0%, ${glow}22 45%, ${glow}00 100%)` }}
							transition={{ duration: 0.6, ease: "easeOut" }}
						/>
						<motion.div
							className={`absolute ${pointing ? "lr-pointing" : ""}`}
							style={{ left: pct(tv.x, room.w), top: pct(tv.y, room.h), width: pct(tv.w, room.w), height: pct(tv.h, room.h) }}
							animate={{ boxShadow: z.on ? `0 0 90px 8px ${glow}40, 0 0 18px 1px ${glow}50` : "0 0 0px 0px rgba(0,0,0,0)" }}
							transition={{ duration: 0.6 }}
						>
							<Screen
								z={z}
								channels={CHANNELS2}
								render={(ch) => (round4 ? <Tv4Screen t={t4} data={data} services={services ?? []} /> : render3(ch, data, QUERIES, r, services ?? []))}
								className="h-full w-full"
								pointer={box.wide}
								onPick={round4 ? (el) => (z.on ? t4.pick(el) : z.setOn(true)) : onPick}
								overlay={round4 ? null : overlay}
								osd={!round4}
								onPointerOver={(o) => {
									pointingRef.current = o
									setPointing(o)
									if (!o) stopAim()
								}}
								swipe={!box.wide}
							/>
						</motion.div>
					</div>
				)}
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_100%_at_40%_40%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
			</div>

			<div className={box.wide ? "pointer-events-none absolute bottom-6 left-8 max-w-[30%]" : "px-4 pt-4"}>
				{box.wide && (
					<div className="mb-4 flex items-center gap-3 [text-shadow:0_2px_14px_rgba(0,0,0,0.9)]">
						<img src={gwLogo} alt="" className="h-6" />
						<span className="text-[15px] font-bold uppercase tracking-[0.28em] text-white/90">GoodWatch</span>
						<span className="text-[15px] text-white/70">Pull up a seat.</span>
					</div>
				)}
				{!round4 && <Caption ch={z.ch} className="" />}
			</div>

			{/* The remote: placed by layout() and never moved by the mouse. In the hand pose, a hand holds it from
			    behind: in the photo the fingers tuck behind the placeholder, so no finger layer goes in front. */}
			{box.wide && L ? (
				<motion.div
					className="absolute will-change-transform"
					style={{
						left: L.remote.left,
						top: L.remote.top,
						width: REMOTE_W * L.remote.s,
						height: box.rh * L.remote.s,
						originX: 0.5,
						originY: 1,
						transformPerspective: L.remote.persp,
						rotate: yaw,
						rotateX: rx,
						rotateY: L.remote.ry,
					}}
				>
					{pose === "hand" && (() => {
						const k = (REMOTE_W * L.remote.s) / HAND.pw
						const x = REMOTE_W * L.remote.s / 2 - (HAND.x + HAND.pw / 2) * k
						return <img src={handBack} alt="" aria-hidden className="pointer-events-none absolute max-w-none select-none" style={{ left: x, top: -HAND.y * k, width: HAND.w * k, height: HAND.h * k }} draggable={false} />
					})()}
					<div ref={remoteBox} className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${L.remote.s})` }}>
						{round4 ? (
							<Remote4 z={z} t={t4} services={services ?? []} pointing={pointing} grip={pose === "hand" ? GRIP_H : undefined} />
						) : (
							<Remote3 z={z} r={r} services={services ?? []} pointing={pointing} grip={pose === "hand" ? GRIP_H : undefined} look={look} />
						)}
					</div>
					<Callout gone={(round4 ? t4.pulse : r.pulse) > 0} />
				</motion.div>
			) : (
				<div ref={remoteBox} className="flex justify-center px-4 pb-8 pt-4">
					<Remote3 z={z} r={r} services={services ?? []} pointing={pointing} />
				</div>
			)}

			<svg ref={beamSvg} className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-150" style={{ opacity: 0 }} aria-hidden>
				<defs>
					<linearGradient ref={beamGrad} id="lr3-beam" gradientUnits="userSpaceOnUse">
						<stop offset="0" stopColor="#fb923c" stopOpacity="0.6" />
						<stop offset="1" stopColor="#fb923c" stopOpacity="0.05" />
					</linearGradient>
				</defs>
				<line ref={beamLine} stroke="url(#lr3-beam)" strokeWidth="3" strokeLinecap="round" />
			</svg>
		</div>
	)
}

// A friend's idea: say out loud that the remote is real. Leaves after the first press.
function Callout({ gone }: { gone: boolean }) {
	return (
		<AnimatePresence>
			{!gone && (
				<motion.div
					className="pointer-events-none absolute right-full top-[6%] mr-3 flex w-[260px] flex-col items-end"
					initial={{ opacity: 0, x: -10 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -10, transition: { duration: 0.25 } }}
					transition={{ delay: 2.2, duration: 0.5, ease }}
				>
					<div className="rounded-2xl bg-black/65 px-5 py-3.5 text-[19px] font-bold leading-snug text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-md">
						This is the remote, and yes, <span className="text-amber-300">it works.</span>
					</div>
					<svg width="120" height="70" viewBox="0 0 120 70" className="-mt-1 mr-2" aria-hidden>
						<motion.path
							d="M10 6 C 20 40, 55 58, 104 52"
							fill="none"
							stroke="white"
							strokeWidth="3"
							strokeLinecap="round"
							initial={{ pathLength: 0 }}
							animate={{ pathLength: 1 }}
							transition={{ delay: 2.6, duration: 0.6, ease: "easeOut" }}
						/>
						<motion.path
							d="M92 42 L105 52 L90 60"
							fill="none"
							stroke="white"
							strokeWidth="3"
							strokeLinecap="round"
							strokeLinejoin="round"
							initial={{ pathLength: 0 }}
							animate={{ pathLength: 1 }}
							transition={{ delay: 3.1, duration: 0.25 }}
						/>
					</svg>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

function Caption({ ch, className }: { ch: number; className: string }) {
	const c = CHANNELS2[ch]
	return (
		<div className={className} aria-live="polite">
			<AnimatePresence mode="wait">
				<motion.div
					key={c.id}
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -6 }}
					transition={{ duration: 0.25, ease }}
					className="[text-shadow:0_2px_16px_rgba(0,0,0,0.9)]"
				>
					<div className="lr-vt text-xl tracking-wider" style={{ color: c.glow }}>
						CH {String(c.num).padStart(2, "0")} · {c.name.toUpperCase()}
					</div>
					<div className="mt-0.5 text-2xl font-extrabold leading-tight tracking-tight text-white">{c.pitch}</div>
					<div className="mt-1 text-sm text-white/75">{c.line}</div>
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

const LR3_CSS = `
.lr3-body { width: ${REMOTE_W}px; }
.lr3-svc { box-shadow: 0 2px 0 rgba(0,0,0,0.55), 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18); transition: transform 70ms, box-shadow 70ms, filter 120ms; filter: saturate(0.9) brightness(0.92); }
.lr3-svc:hover { filter: none; }
.lr3-svc:active { transform: translateY(2px); box-shadow: 0 0 0 rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.4); }
.lr3-svc-on { filter: none; box-shadow: 0 0 0 2px #fdba74, 0 0 18px rgba(251,146,60,0.5), 0 2px 0 rgba(0,0,0,0.55); }
.lr2-key:active, .lr3-svc:active, .lr2-ok:active { transition-duration: 0ms; }
`

// ---------------------------------------------------------------------------------------------------------
// Round 3, later: remote designs after real modern remotes. Same controls, different groupings and materials.
//   aluminum - after Apple's Siri Remote: brushed metal, a black glass clickpad on top, round Back and TV-style
//              keys right under it, and a long rocker (here channels).
//   solar    - after Samsung's SolarCell: slim matte black, flat keys, a thin navigation ring, side-by-side
//              rockers (channels and moods), a row of dedicated streaming buttons.
//   pebble   - after the Google TV Streamer remote: soft off-white, a round pad, round keys in pairs,
//              front rockers, app buttons at the bottom; the LCD becomes a paper-like screen.

const I = {
	power: "M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0",
	back: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
	home: "M3 11l9-7 9 7M5 10v10h14V10",
	guide: "M4 5h16M4 10h16M4 15h10M4 20h7",
	search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
	mood: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01",
	tune: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4",
	tv: "M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5zM8 21h8",
	up: "M6 15l6-6 6 6",
	down: "M6 9l6 6 6-6",
	mute: "M11 5L6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6",
	sound: "M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13",
}

function RemoteLook({ z, r, services, pointing, grip, look, blink }: { z: Zapper; r: R3; services: LRServiceButton[]; pointing: boolean; grip?: number; look: Exclude<Look, "current">; blink: number }) {
	const press = (fn: () => void) => () => {
		r.click()
		fn()
	}
	const Key = ({ label, d, onClick, on, className = "", text }: { label: string; d?: string; onClick: () => void; on?: boolean; className?: string; text?: string }) => (
		<button type="button" aria-label={label} title={label} aria-pressed={on} onClick={onClick} className={`lr4-key flex items-center justify-center ${on ? "lr4-on" : ""} ${className}`}>
			{d && <Icon d={d} className="h-[18px] w-[18px]" />}
			{text && <span className={`${d ? "mt-0.5" : ""} text-[9.5px] font-semibold uppercase tracking-[0.12em]`}>{text}</span>}
		</button>
	)
	const Rocker = ({ label, up, down, upLabel, downLabel }: { label: string; up: () => void; down: () => void; upLabel: string; downLabel: string }) => (
		<div className="lr4-rocker flex h-[108px] w-[46px] flex-col items-center justify-between overflow-hidden rounded-full">
			<button type="button" aria-label={upLabel} title={upLabel} onClick={press(up)} className="flex h-10 w-full items-center justify-center">
				<Icon d={I.up} className="h-4 w-4" />
			</button>
			<span className="text-[9px] font-bold tracking-[0.14em] opacity-60">{label}</span>
			<button type="button" aria-label={downLabel} title={downLabel} onClick={press(down)} className="flex h-10 w-full items-center justify-center">
				<Icon d={I.down} className="h-4 w-4" />
			</button>
		</div>
	)
	const ir = (
		<div className="lr3-ir relative h-1.5 w-16 rounded-full bg-black/70">
			<motion.div className="absolute inset-0 rounded-full bg-orange-400" animate={{ opacity: pointing ? 0.9 : 0 }} transition={{ duration: 0.2 }} style={{ boxShadow: "0 0 14px 3px rgba(251,146,60,0.7)" }} />
			<motion.div key={blink} className="absolute inset-0 rounded-full bg-sky-300" initial={{ opacity: blink > 1 ? 1 : 0 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} />
		</div>
	)
	const services8 = (rows: string) => (
		<div className={`grid w-full grid-cols-4 gap-2 ${rows}`}>
			{services.slice(0, 8).map((sv) => {
				const on = r.mix.service === sv.key
				return (
					<button
						key={sv.key}
						type="button"
						aria-pressed={on}
						aria-label={`Only ${sv.label}`}
						title={`Only ${sv.label}`}
						onClick={() => r.pickService(sv.key)}
						className={`lr3-svc lr4-svc relative flex items-center justify-center overflow-hidden ${on ? "lr3-svc-on" : ""}`}
						style={{ background: sv.color }}
					>
						{sv.logo ? <img src={img(sv.logo, "w92")} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-white">{sv.label}</span>}
					</button>
				)
			})}
		</div>
	)
	const picks = (
		<button type="button" onClick={press(r.startPicks)} className="lr4-picks flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[12px] font-extrabold uppercase tracking-wider">
			<img src={gwLogo} alt="" className="h-3.5 invert" />
			Get my picks
		</button>
	)
	const wheel = (size: number) => <Wheel z={z} r={{ mode: r.mode, step: r.step, ok: r.ok, click: r.click, okLabel: r.okLabel, up: r.up, down: r.down }} size={size} />
	const mute = <Key label={r.muted ? "Sound on" : "Sound off"} d={r.muted ? I.mute : I.sound} onClick={() => { r.setMuted(!r.muted); z.setMuted(!r.muted) }} className="h-9 w-9 rounded-full" />
	const power = <Key label={z.on ? "Turn off" : "Turn on"} d={I.power} onClick={press(() => z.setOn(!z.on))} className="lr4-power h-9 w-9 rounded-full" />
	const tail = grip ? (
		<>
			<div className="flex-1" />
			<img src={gwLogo} alt="" className="lr4-mark mb-2 h-6" />
		</>
	) : null

	return (
		<div className={`lr2-remote lr3-remote lr4-${look} relative select-none`} role="group" aria-label="Remote control">
			<div className="lr4-body relative flex flex-col items-center" style={grip ? { minHeight: grip } : undefined}>
				{look === "aluminum" && (
					<>
						<div className="flex w-full items-center justify-between">
							{mute}
							{ir}
							{power}
						</div>
						<Lcd3 z={z} r={r} services={services} pointing={pointing} />
						<div className="lr4-glass flex w-full justify-center rounded-[36px] py-2">{wheel(214)}</div>
						<div className="grid w-full grid-cols-[1fr_1fr_46px] items-center gap-x-4 gap-y-3 px-1">
							<Key label="Back" d={I.back} onClick={press(r.back)} className="h-[50px] w-[50px] justify-self-center rounded-full" />
							<Key label="Home" d={I.home} onClick={press(r.home)} className="h-[50px] w-[50px] justify-self-center rounded-full" />
							<div className="row-span-2">
								<Rocker label="CH" up={() => r.zap(z.ch + 1)} down={() => r.zap(z.ch - 1)} upLabel="Next channel" downLabel="Previous channel" />
							</div>
							<Key label="Guide" d={I.guide} onClick={press(r.openGuide)} className="h-[50px] w-[50px] justify-self-center rounded-full" />
							<Key label="Search" d={I.search} on={r.mode === "search"} onClick={() => r.setMode("search")} className="h-[50px] w-[50px] justify-self-center rounded-full" />
						</div>
						<div className="grid w-full grid-cols-3 gap-2">
							<Key label="Channels" text="CH" on={r.mode === "ch"} onClick={() => r.setMode("ch")} className="h-9 rounded-full" />
							<Key label="Mood" text="Mood" on={r.mode === "mood"} onClick={() => r.setMode("mood")} className="h-9 rounded-full" />
							<Key label="Tune" text="Tune" on={r.mode === "tune"} onClick={() => r.setMode("tune")} className="h-9 rounded-full" />
						</div>
						{services8("[&>button]:h-9 [&>button]:rounded-[10px]")}
						{picks}
						{tail}
					</>
				)}
				{look === "solar" && (
					<>
						<div className="flex w-full items-center justify-between">
							{power}
							{ir}
							<Key label="Search" d={I.search} on={r.mode === "search"} onClick={() => r.setMode("search")} className="h-9 w-9 rounded-full" />
						</div>
						<Lcd3 z={z} r={r} services={services} pointing={pointing} />
						<div className="grid w-full grid-cols-4 gap-1.5">
							{(["ch", "mood", "tune", "search"] as const).map((m) => (
								<Key key={m} label={m} text={m === "ch" ? "CH" : m} on={r.mode === m} onClick={() => r.setMode(m)} className="h-8 rounded-lg" />
							))}
						</div>
						{wheel(200)}
						<div className="flex w-full items-center justify-center gap-5">
							<Key label="Back" d={I.back} onClick={press(r.back)} className="h-10 w-10 rounded-full" />
							<Key label="Home" d={I.home} onClick={press(r.home)} className="h-10 w-10 rounded-full" />
							<Key label="Guide" d={I.guide} onClick={press(r.openGuide)} className="h-10 w-10 rounded-full" />
						</div>
						<div className="flex w-full items-center justify-center gap-10">
							<Rocker label="CH" up={() => r.zap(z.ch + 1)} down={() => r.zap(z.ch - 1)} upLabel="Next channel" downLabel="Previous channel" />
							{mute}
							<Rocker label="MOOD" up={() => { r.setMode("mood"); r.step(1) }} down={() => { r.setMode("mood"); r.step(-1) }} upLabel="Next mood" downLabel="Previous mood" />
						</div>
						{services8("[&>button]:h-8 [&>button]:rounded-md")}
						{picks}
						{tail}
					</>
				)}
				{look === "pebble" && (
					<>
						<div className="flex w-full items-center justify-between px-2">
							{power}
							{ir}
							{mute}
						</div>
						{wheel(206)}
						<Lcd3 z={z} r={r} services={services} pointing={pointing} />
						<div className="grid grid-cols-3 gap-x-5 gap-y-2.5">
							<Key label="Back" d={I.back} onClick={press(r.back)} className="h-12 w-12 rounded-full" />
							<Key label="Home" d={I.home} onClick={press(r.home)} className="h-12 w-12 rounded-full" />
							<Key label="Search" d={I.search} on={r.mode === "search"} onClick={() => r.setMode("search")} className="h-12 w-12 rounded-full" />
							<Key label="Mood" d={I.mood} on={r.mode === "mood"} onClick={() => r.setMode("mood")} className="h-12 w-12 rounded-full" />
							<Key label="Tune" d={I.tune} on={r.mode === "tune"} onClick={() => r.setMode("tune")} className="h-12 w-12 rounded-full" />
							<Key label="Guide" d={I.guide} onClick={press(r.openGuide)} className="h-12 w-12 rounded-full" />
						</div>
						<div className="lr4-rocker flex h-10 w-[150px] items-center justify-between rounded-full px-1">
							<button type="button" aria-label="Previous channel" onClick={press(() => r.zap(z.ch - 1))} className="flex h-9 w-12 items-center justify-center text-[18px] font-bold">−</button>
							<span className="text-[9px] font-bold tracking-[0.14em] opacity-60">CH</span>
							<button type="button" aria-label="Next channel" onClick={press(() => r.zap(z.ch + 1))} className="flex h-9 w-12 items-center justify-center text-[18px] font-bold">+</button>
						</div>
						{services8("[&>button]:h-9 [&>button]:rounded-xl")}
						{picks}
						{tail}
					</>
				)}
			</div>
		</div>
	)
}

export const LR4_CSS = `
.lr4-body { width: 312px; gap: 14px; padding: 18px 22px 22px; }
.lr4-key { transition: transform 70ms, box-shadow 70ms, background 120ms, color 120ms; flex-direction: column; }
.lr4-key:active, .lr4-rocker button:active { transform: translateY(1.5px); }
.lr4-picks { background: linear-gradient(180deg, #fcd34d, #f59e0b); color: #000; box-shadow: 0 2px 0 #8a5a0a, 0 6px 16px rgba(251,191,36,0.25); }
.lr4-picks:active { transform: translateY(2px); box-shadow: 0 0 0 #8a5a0a; }
.lr4-svc { transition: transform 70ms, box-shadow 70ms, filter 120ms; }

/* Aluminum: brushed metal, black glass, glossy black keys. */
.lr4-aluminum .lr4-body {
	border-radius: 46px;
	background:
		repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, rgba(0,0,0,0.035) 1px 2px),
		linear-gradient(90deg, #8e949a 0%, #cfd3d7 14%, #bfc4c8 50%, #d8dbde 86%, #8e949a 100%);
	box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(0,0,0,0.25), 0 40px 80px -20px rgba(0,0,0,0.9), 0 16px 30px -12px rgba(0,0,0,0.7);
}
.lr4-aluminum .lr4-glass { background: radial-gradient(120% 90% at 50% 0%, #2a2c30, #0c0d0f 70%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 0 rgba(255,255,255,0.5); }
.lr4-aluminum .lr2-wheel { background: #0b0c0e; box-shadow: none; }
.lr4-aluminum .lr2-knurl { opacity: 0.35; }
.lr4-aluminum .lr2-ok { background: radial-gradient(circle at 50% 30%, #2b2d31, #121315 70%); }
.lr4-aluminum .lr4-key { color: rgba(255,255,255,0.88); background: radial-gradient(circle at 50% 25%, #2d2f33, #111214 75%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 3px rgba(0,0,0,0.35); }
.lr4-aluminum .lr4-on { color: #fdba74; box-shadow: inset 0 0 0 1.5px rgba(251,146,60,0.8), 0 0 12px rgba(251,146,60,0.35); }
.lr4-aluminum .lr4-rocker { color: rgba(255,255,255,0.85); background: linear-gradient(90deg, #111214, #2b2d31 50%, #111214); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 3px rgba(0,0,0,0.35); }
.lr4-aluminum .lr4-power { color: #fda4af; }
.lr4-aluminum .lr4-mark { opacity: 0.35; filter: invert(1); }

/* Solar: matte black, flat and quiet. */
.lr4-solar .lr4-body {
	border-radius: 70px;
	background: linear-gradient(180deg, #1a1a1b, #111112);
	box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05), 0 40px 80px -20px rgba(0,0,0,0.9);
}
.lr4-solar .lr2-wheel { background: #151516; box-shadow: inset 0 0 0 1.5px #2b2b2d; }
.lr4-solar .lr2-knurl { display: none; }
.lr4-solar .lr2-ok { background: #1f1f21; box-shadow: inset 0 0 0 1px #2e2e31; }
.lr4-solar .lr4-key { color: #cfcfd2; background: #1f1f21; box-shadow: inset 0 0 0 1px #2c2c2f; }
.lr4-solar .lr4-key:hover { color: #fff; background: #262628; }
.lr4-solar .lr4-on { color: #fdba74; box-shadow: inset 0 0 0 1.5px rgba(251,146,60,0.7); }
.lr4-solar .lr4-rocker { color: #cfcfd2; background: #1f1f21; box-shadow: inset 0 0 0 1px #2c2c2f; }
.lr4-solar .lr4-power { color: #f87171; }
.lr4-solar .lr4-mark { opacity: 0.18; }
.lr4-solar .lr3-svc { filter: none; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); }

/* Pebble: soft off-white plastic, a paper-like screen. */
.lr4-pebble .lr4-body {
	border-radius: 150px;
	padding-top: 26px;
	background: radial-gradient(130% 60% at 30% 0%, #f7f4ef, #e7e2da 55%, #d9d3c9 100%);
	box-shadow: inset 0 1px 0 #fff, inset 0 -3px 6px rgba(0,0,0,0.08), 0 40px 80px -20px rgba(0,0,0,0.85), 0 16px 30px -12px rgba(0,0,0,0.6);
}
.lr4-pebble .lr2-wheel { background: #d6d0c6; box-shadow: inset 0 2px 4px rgba(0,0,0,0.12), 0 1px 0 #fff; cursor: grab; }
.lr4-pebble .lr2-knurl { filter: invert(1); opacity: 0.35; }
.lr4-pebble .lr2-wheel > div:nth-child(2) { background: radial-gradient(circle at 50% 30%, #ebe6de, #d9d3c9 75%) !important; box-shadow: inset 0 1px 0 #fff, inset 0 -2px 4px rgba(0,0,0,0.06) !important; }
.lr4-pebble .lr2-wheel button { color: #57534e; }
.lr4-pebble .lr2-ok { color: #3f3a35 !important; background: radial-gradient(circle at 50% 30%, #fbf9f6, #e6e0d7 75%); box-shadow: 0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 #fff; }
.lr4-pebble .lr4-key { color: #44403c; background: radial-gradient(circle at 50% 25%, #fbf9f6, #e3ddd4 80%); box-shadow: inset 0 1px 0 #fff, 0 2px 4px rgba(0,0,0,0.14); }
.lr4-pebble .lr4-on { color: #c2410c; box-shadow: inset 0 0 0 1.5px rgba(234,88,12,0.7), 0 2px 4px rgba(0,0,0,0.14); }
.lr4-pebble .lr4-rocker { color: #44403c; background: #e3ddd4; box-shadow: inset 0 1px 0 #fff, 0 2px 4px rgba(0,0,0,0.14); }
.lr4-pebble .lr4-power { color: #dc2626; }
.lr4-pebble .lr4-mark { opacity: 0.25; filter: invert(1); }
.lr4-pebble .lr3-ir { background: rgba(0,0,0,0.75); }
.lr4-pebble .lr2-lcd { --lcd: #26312b; background: linear-gradient(180deg, #cdd3c5, #bfc6b6); box-shadow: inset 0 2px 4px rgba(0,0,0,0.25), 0 1px 0 #fff; text-shadow: none; }
.lr4-pebble .lr2-lcd .text-white { color: #1f2a24; }
.lr4-pebble .lr2-lcd .lr2-lcd-grid { opacity: 0.35; }
.lr4-pebble .lr2-lcd input::placeholder { color: rgba(31,42,36,0.45); }
`
