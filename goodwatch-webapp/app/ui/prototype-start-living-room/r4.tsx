// PROTOTYPE - throwaway. Round 4 of the living room start page (#178). Owner on round 3: keep the hand and the
// current remote's looks, but its layout is confusing; the TV should boot into a start experience for new
// users (two or three columns: what GoodWatch is, or dive into what makes it different); every screen trimmed
// to the essentials; the remote is for quick navigation.
//
// The TV is a small stack of screens: boot, home (3 columns), about (3 columns, one per unique feature), the
// feature screens (round 1's channels, in lean mode), your mix (moods and services), search, a title, and
// rating three titles to get picks. The wheel moves the focus, OK opens, Back and Home go back.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogo from "~/img/metacritic-logo-icon-250.png"
import rottenLogo from "~/img/rotten-logo-icon-250.png"
import disneyMark from "~/img/disneyplus-logo.svg"
import huluMark from "~/img/hulu-logo.png"
import netflixMark from "~/img/netflix-logo.svg"
import primeMark from "~/img/primevideo-logo.svg"
import type { LRData, LRServiceButton } from "~/server/prototype-start-living-room.server"
import { PILLAR_CONFIG, type PillarName } from "~/ui/fingerprint/Pillars"
import { GwBadge, Lean, Search, ease, img, renderChannel } from "./channels"
import { Icon, Mix3, type MixSpec, PicksTv, type R3, Small, TitleTv } from "./r3"
import { MOODS, SUGGESTIONS, Wheel } from "./remote2"
import { type Zapper, zapSound } from "./tv"

// ---------------------------------------------------------------------------------------------------------
// Screens and state.

type Feature = "tonight" | "scores" | "fingerprint" | "where"
type Scr =
	| { k: "boot" }
	| { k: "home" }
	| { k: "about" }
	| { k: "feature"; id: Feature }
	| { k: "mix" }
	| { k: "keyboard" }
	| { k: "moods" }
	| { k: "search" }
	| { k: "title"; key: string }
	| { k: "picks" }
	| { k: "page"; id: PageId }

// Round 7: remote keys for pages that don't exist on the TV yet. The TV shows a card; no link leaves the room.
export type PageId = "watchnext" | "explorer" | "taste" | "discover"
export const PAGES: Record<PageId, { name: string; line: string }> = {
	watchnext: { name: "Watch now", line: "Your Want to See list, best match first, on your services." },
	explorer: { name: "Explorer", line: "Steer through taste: drift from a title you love to what sits next to it." },
	taste: { name: "Taste", line: "The sides of you, you versus everyone, and your fingerprint." },
	discover: { name: "Discover", line: "Browse and search in one place, For you on by default." },
}

// The order the wheel zaps through on a feature screen.
const FEATURES: Feature[] = ["tonight", "scores", "fingerprint", "where"]
const FEATURE_NAME: Record<Feature, string> = { tonight: "Tonight", scores: "One score", fingerprint: "How it feels", where: "Where it streams" }
// Round 1 channel index for each feature, so its screen can be reused.
const CHANNEL_OF: Record<Feature, number> = { tonight: 0, scores: 2, fingerprint: 3, where: 4 }

const HOME_COLS = ["about", "tonight", "picks"] as const
// Three distinct searches to point at on the keyboard screen.
export const SEARCH_PRESETS = ["a cozy mystery for a rainy sunday", "mind-bending sci-fi that makes you cry", "feel-good comedy to watch with my parents"]
const ABOUT_COLS: Feature[] = ["scores", "fingerprint", "where"]

export function useTv4(z: Zapper, country: string) {
	const [stack, setStack] = useState<Scr[]>([{ k: "boot" }])
	const [focus, setFocus] = useState(0)
	const [mode, setMode] = useState<"nav" | "mood" | "search">("nav")
	const [moodIdx, setMoodIdx] = useState(0)
	const [mix, setMix] = useState<MixSpec>({ switches: {}, service: null, seeds: [], label: null })
	const [draft, setDraft] = useState("")
	const [query, setQuery] = useState<string | null>(null)
	const [loved, setLoved] = useState<string[]>([])
	const [deckPage, setDeckPage] = useState(0)
	const [pulse, setPulse] = useState(0)
	const [muted, setMuted] = useState(false)
	const [menu, setMenu] = useState(false)
	const top = stack[stack.length - 1]

	// Off means off: the next time it's turned on, it boots again.
	useEffect(() => {
		if (z.on) return
		setMode("nav")
		setStack([{ k: "boot" }])
	}, [z.on])

	// Boot once the set is on, then land on home.
	useEffect(() => {
		if (!z.on || top.k !== "boot") return
		const t = setTimeout(() => setStack([{ k: "home" }]), 2600)
		return () => clearTimeout(t)
	}, [z.on, top.k])

	const click = useCallback(() => {
		setPulse((p) => p + 1)
		if (!muted) tick()
	}, [muted])

	const go = (s: Scr) => {
		setMenu(false)
		setFocus(0)
		setStack((st) => [...st.filter((x) => x.k !== "boot"), s])
		if (!muted) zapSound()
	}
	const replace = (s: Scr) => setStack((st) => [...st.slice(0, -1), s])
	const back = () => {
		if (menu) return setMenu(false)
		setMode("nav")
		setStack((st) => (st.length > 1 && st[st.length - 1].k !== "home" ? st.slice(0, -1) : st))
		setFocus(0)
	}
	const home = () => {
		setMode("nav")
		setFocus(0)
		setStack([{ k: "home" }])
	}

	const chooseMood = (i: number) => {
		setMoodIdx(i)
		applyMood(i, true)
		setMode("mood")
	}
	const applyMood = (i: number, fromPicker = false) => {
		const m = MOODS[i]
		const switches: Record<string, 1 | -1> = {}
		for (const k of m.inc) switches[k] = 1
		for (const k of m.exc) switches[k] = -1
		setMix((prev) => ({ ...prev, switches, seeds: [], label: `${m.emoji} ${m.name}` }))
		if (fromPicker) replace({ k: "mix" })
		else if (top.k !== "mix") go({ k: "mix" })
	}

	const open = (i = focus) => {
		if (top.k === "home") {
			const c = HOME_COLS[i]
			if (c === "about") go({ k: "about" })
			else if (c === "tonight") go({ k: "feature", id: "tonight" })
			else go({ k: "picks" })
		} else if (top.k === "about") go({ k: "feature", id: ABOUT_COLS[i] })
		else if (top.k === "moods") chooseMood(i)
	}

	const step = (d: 1 | -1) => {
		click()
		if (mode === "mood") {
			const i = (moodIdx + d + MOODS.length) % MOODS.length
			setMoodIdx(i)
			applyMood(i)
		} else if (mode === "search") {
			const i = (SUGGESTIONS.indexOf(draft) + d + SUGGESTIONS.length) % SUGGESTIONS.length
			setDraft(SUGGESTIONS[i])
		} else if (top.k === "home" || top.k === "about") setFocus((f) => (f + d + 3) % 3)
		else if (top.k === "moods") setFocus((f) => (f + d + MOODS.length) % MOODS.length)
		else if (top.k === "feature") {
			const i = (FEATURES.indexOf(top.id) + d + FEATURES.length) % FEATURES.length
			replace({ k: "feature", id: FEATURES[i] })
			if (!muted) zapSound()
		} else if (top.k === "picks") setDeckPage((p) => Math.max(0, p + d))
	}

	const submit = (text = draft) => {
		const q = text.trim()
		if (q.length < 2) return
		setDraft(q)
		setQuery(q)
		setMode("nav")
		if (top.k === "search" || top.k === "keyboard") replace({ k: "search" })
		else go({ k: "search" })
	}

	const ok = () => {
		click()
		if (mode === "search") return submit()
		if (mode === "mood") return setMode("nav")
		if (top.k === "picks") return loved.length >= 3 && finishPicks()
		open()
	}

	const finishPicks = () => {
		setMix({ switches: {}, service: null, seeds: loved, label: "Your picks" })
		replace({ k: "mix" })
	}

	const pickMode = (m: "mood" | "search") => {
		click()
		if (mode === m) {
			setMode("nav")
			if (m === "search" && top.k === "keyboard") back()
			return
		}
		setMenu(false)
		// Mood opens a screen of moods to choose from; the wheel then changes the mood on the mix.
		if (m === "mood") {
			setMode("nav")
			go({ k: "moods" })
			setFocus(moodIdx)
			return
		}
		setMode(m)
		// Search opens the on-screen keyboard; typing on a real keyboard works too.
		if (m === "search" && top.k !== "keyboard") go({ k: "keyboard" })
	}

	const pickService = (key: string) => {
		click()
		setMix((prev) => ({ ...prev, service: prev.service === key ? null : key }))
		if (top.k !== "mix") go({ k: "mix" })
	}

	// Anything pointable on the TV: columns, titles, and the picks screen's hearts and buttons.
	const pick = (el: HTMLElement) => {
		const v = el.dataset.pick ?? ""
		click()
		if (v.startsWith("key:")) {
			const k = v.slice(4)
			if (k === "del") setDraft((d) => d.slice(0, -1))
			else if (k === "space") setDraft((d) => (d.endsWith(" ") || !d ? d : `${d} `))
			else if (k === "go") submit()
			else setDraft((d) => (d + k).slice(0, 120))
		} else if (v.startsWith("preset:")) submit(SEARCH_PRESETS[Number(v.slice(7))])
		else if (v.startsWith("mood:")) chooseMood(Number(v.slice(5)))
		else if (v === "bar:more") setMenu((m) => !m)
		else if (v.startsWith("bar:")) {
			setMenu(false)
			const a = v.slice(4)
			if (a === "back") back()
			else if (a === "home") home()
			else if (a === "search") pickMode("search")
			else if (a === "mood") pickMode("mood")
			else if (a === "picks") go({ k: "picks" })
			else if (a === "power") z.setOn(false)
		} else if (v.startsWith("svc:")) {
			setMenu(false)
			pickService(v.slice(4))
		}
		else if (v.startsWith("col:")) {
			const i = Number(v.slice(4))
			setFocus(i)
			open(i)
		} else if (v === "action:back") back()
		else if (v.startsWith("action:more:")) {
			const [, , type, id, ...rest] = v.split(":")
			setMix({ switches: {}, service: null, seeds: [`${type}:${id}`], label: `More like ${rest.join(":")}` })
			replace({ k: "mix" })
		} else if (v === "action:deck-next") setDeckPage((p) => p + 1)
		else if (v === "action:finish") loved.length >= 3 && finishPicks()
		else if (v.startsWith("love:")) {
			const k = v.slice(5)
			setLoved((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]))
		} else if (/^(movie|show):\d+$/.test(v)) go({ k: "title", key: v })
	}

	return {
		stack, top, focus, setFocus, mode, moodIdx, mix, menu, draft, setDraft, query, loved, deckPage, pulse, muted, setMuted, on: z.on, wake: () => z.setOn(true),
		click, step, ok, back, home, pickMode, pickService, pick, submit, startPicks: () => go({ k: "picks" }), country,
		openPage: (id: PageId) => (click(), go({ k: "page", id })),
		openTitle: (key: string) => (click(), go({ k: "title", key })),
		okLabel: mode === "search" ? "GO" : top.k === "picks" ? "DONE" : "OK",
	}
}

export type Tv4 = ReturnType<typeof useTv4>

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

// Round 3's screens read these fields; the round 4 state provides them.
const asR3 = (t: Tv4) => ({ country: t.country, loved: t.loved, deckPage: t.deckPage, mix: t.mix }) as unknown as R3

// ---------------------------------------------------------------------------------------------------------
// The TV.

export function Tv4Screen({ t, data, services }: { t: Tv4; data: LRData; services: LRServiceButton[] }) {
	const s = t.top
	const key = s.k === "feature" ? `f-${s.id}` : s.k === "title" ? `t-${s.key}` : s.k === "page" ? `p-${s.id}` : s.k
	return (
		<div className="absolute inset-0 overflow-hidden bg-[#07080b] text-white">
			<AnimatePresence initial={false}>
				<motion.div
					key={key}
					className="absolute inset-0"
					initial={{ opacity: 0, scale: 1.015 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.28, ease }}
				>
					<Lean.Provider value>
						{s.k === "boot" && <Boot />}
						{s.k === "home" && <Home t={t} data={data} />}
						{s.k === "about" && <About t={t} data={data} services={services} />}
						{s.k === "feature" && renderChannel(CHANNEL_OF[s.id], data, SUGGESTIONS)}
						{s.k === "mix" && <Mix3 r={asR3(t)} services={services} />}
						{s.k === "search" && t.query && <Search queries={SUGGESTIONS} fixed={t.query} />}
						{s.k === "title" && <TitleTv r={asR3(t)} keyId={s.key} />}
						{s.k === "picks" && <PicksTv r={asR3(t)} />}
						{s.k === "keyboard" && <Keyboard t={t} />}
						{s.k === "moods" && <Moods t={t} />}
						{s.k === "page" && <PageCard id={s.id} data={data} />}
					</Lean.Provider>
				</motion.div>
			</AnimatePresence>
			{s.k !== "boot" && <TvBar t={t} services={services} />}
		</div>
	)
}

function PageCard({ id, data }: { id: PageId; data: LRData }) {
	const l = data.lineup
	const at = { watchnext: 0, explorer: 3, taste: 6, discover: 9 }[id]
	return (
		<>
			<img src={img(l[at]?.backdrop, "w780")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-md" />
			<div className="absolute inset-0 flex items-center gap-10 px-[8%]">
				<div className="relative h-[60%] w-[34%] shrink-0">
					<PosterFan posters={l.slice(at, at + 3).map((x) => x.poster)} />
				</div>
				<div>
					<div className="text-[11px] font-bold uppercase tracking-[0.25em] text-orange-300/80">GoodWatch</div>
					<div className="mt-2 text-[34px] font-extrabold leading-none">{PAGES[id].name}</div>
					<p className="mt-3 max-w-[32ch] text-[15px] leading-snug text-white/70">{PAGES[id].line}</p>
					<p className="mt-5 text-[12px] text-white/40">Prototype: this page opens here once it's built.</p>
				</div>
			</div>
		</>
	)
}

function Boot() {
	return (
		<div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
			<motion.div
				className="relative flex h-[120px] w-[120px] items-center justify-center rounded-full"
				initial={{ scale: 0.6, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
				style={{ background: "radial-gradient(circle, rgba(251,191,36,0.28), transparent 70%)" }}
			>
				<img src={gwLogo} alt="" className="h-16" />
			</motion.div>
			<motion.div className="mt-5 text-[30px] font-bold tracking-[0.35em] text-white/90" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.6 }}>
				GOODWATCH
			</motion.div>
			<div className="mt-8 h-[3px] w-[180px] overflow-hidden rounded-full bg-white/10">
				<motion.div className="h-full w-full origin-left bg-amber-300" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.6, duration: 1.8, ease: "easeInOut" }} />
			</div>
		</div>
	)
}

// Three big columns, one focused. The wheel moves the focus, OK or a point opens it.
function Columns({ t, items, title }: { t: Tv4; title: string; items: { label: string; line: string; visual: ReactNode }[] }) {
	return (
		<div className="absolute inset-0">
			<div className="absolute left-12 top-10 flex items-center gap-3">
				<img src={gwLogo} alt="" className="h-6 opacity-80" />
				<span className="text-[22px] font-semibold text-white/85">{title}</span>
			</div>
			<div className="absolute inset-x-12 bottom-12 top-[104px] grid grid-cols-3 gap-6">
				{items.map((it, i) => {
					const on = t.focus === i
					return (
						<motion.button
							key={it.label}
							type="button"
							data-pick={`col:${i}`}
							onMouseEnter={() => t.setFocus(i)}
							className={`flex flex-col overflow-hidden rounded-3xl text-left ring-2 transition-colors ${on ? "bg-white/[0.09] ring-amber-300" : "bg-white/[0.04] ring-white/5"}`}
							animate={{ scale: on ? 1.035 : 1, opacity: on ? 1 : 0.62 }}
							transition={{ type: "spring", stiffness: 380, damping: 30 }}
						>
							<div className="relative h-[210px] w-full overflow-hidden">{it.visual}</div>
							<div className="px-6 pt-4">
								<div className="text-[26px] font-extrabold leading-tight tracking-tight">{it.label}</div>
								<div className="mt-1.5 text-[16px] leading-snug text-white/65">{it.line}</div>
							</div>
						</motion.button>
					)
				})}
			</div>
		</div>
	)
}

function PosterFan({ posters, heart }: { posters: (string | null)[]; heart?: boolean }) {
	return (
		<div className="absolute inset-0 flex items-center justify-center">
			{posters.slice(0, 3).map((p, i) => (
				<div key={i} className="relative -mx-3 first:mt-6 last:mt-6" style={{ transform: `rotate(${(i - 1) * 7}deg)`, zIndex: i === 1 ? 2 : 1 }}>
					<img src={img(p, "w185")} alt="" className="w-[92px] rounded-lg shadow-xl ring-1 ring-white/10" />
					{heart && <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[13px] text-black">♥</span>}
				</div>
			))}
		</div>
	)
}

function Home({ t, data }: { t: Tv4; data: LRData }) {
	const l = data.lineup
	return (
		<>
			<img src={img(l[0]?.backdrop, "w780")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-md" />
			<Columns
				t={t}
				title="Welcome to GoodWatch"
				items={[
					{
						label: "What is GoodWatch?",
						line: "Find what's good, and where to watch it.",
						visual: (
							<div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle,rgba(34,197,94,0.25),transparent_65%)]">
								<GwBadge gw={85} size={84} text="text-[58px]" />
							</div>
						),
					},
					{ label: "Tonight", line: "Great picks, ready to press play.", visual: <PosterFan posters={l.slice(0, 3).map((x) => x.poster)} /> },
					{ label: "Pick for me", line: "Rate three you loved. Get your picks.", visual: <PosterFan posters={l.slice(3, 6).map((x) => x.poster)} heart /> },
				]}
			/>
		</>
	)
}

const PILLARS: PillarName[] = ["Energy", "Heart", "Humor", "World", "Craft", "Style"]

function About({ t, data, services }: { t: Tv4; data: LRData; services: LRServiceButton[] }) {
	const d = data.lineup[0]
	return (
		<Columns
			t={t}
			title="What makes GoodWatch different"
			items={[
				{
					label: "One score",
					line: "IMDb, Rotten Tomatoes, and Metacritic in one number.",
					visual: (
						<div className="absolute inset-0 flex items-center justify-center gap-4">
							<div className="flex flex-col gap-2 opacity-80">
								{[imdbLogo, rottenLogo, metacriticLogo].map((s) => (
									<img key={s} src={s} alt="" className="h-8 w-8 object-contain" />
								))}
							</div>
							<span className="text-[28px] text-white/40">→</span>
							<GwBadge gw={d?.gw ?? 85} size={64} text="text-[44px]" />
						</div>
					),
				},
				{
					label: "How it feels",
					line: "Energy, heart, humor, and more, before you press play.",
					visual: (
						<div className="absolute inset-0 flex flex-col justify-center gap-2 px-10">
							{PILLARS.map((p) => (
								<div key={p} className="flex items-center gap-3">
									<span className="w-6 text-[16px]">{PILLAR_CONFIG[p].emoji}</span>
									<span className="flex flex-1 gap-1">
										{[0, 1, 2, 3].map((i) => (
											<span key={i} className={`h-2.5 flex-1 rounded-sm ${i < (d?.pillars?.[p] ?? 2) ? "bg-orange-300" : "bg-white/10"}`} />
										))}
									</span>
								</div>
							))}
						</div>
					),
				},
				{
					label: "Where it streams",
					line: "Every service in your country, at a glance.",
					visual: (
						<div className="absolute inset-0 grid grid-cols-2 place-content-center gap-3 px-16">
							{services.slice(0, 4).map((s) => (
								<img key={s.key} src={img(s.logo, "w92")} alt="" className="aspect-square w-full rounded-2xl" />
							))}
						</div>
					),
				},
			]}
		/>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The remote: the current look, regrouped the way modern remotes are. Power, the screen, the pad, Back and
// Home, Mood and Search, and four streaming keys. Nothing else; Get my picks lives on the TV.

export function Remote4({ z, t, services, pointing, grip }: { z: Zapper; t: Tv4; services: LRServiceButton[]; pointing: boolean; grip?: number }) {
	const [blink, setBlink] = useState(0)
	const waking = useRef(false)
	useEffect(() => setBlink((b) => b + 1), [t.pulse])
	const press = (fn: () => void) => () => {
		t.click()
		fn()
	}
	return (
		<div
			className="lr2-remote lr3-remote relative select-none"
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
			<div className="lr2-body lr3-body relative flex flex-col items-center gap-4 rounded-[52px] px-6 pb-6 pt-4" style={grip ? { minHeight: grip } : undefined}>
				<div className="flex w-full items-center justify-between">
					<button type="button" aria-label={z.on ? "Turn off" : "Turn on"} onClick={press(() => z.setOn(!z.on))} className="lr2-key flex h-9 w-9 items-center justify-center rounded-full text-rose-400">
						<Icon d="M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0" className="h-4 w-4" />
					</button>
					<div className="lr3-ir relative h-2 w-20 rounded-full bg-black/70">
						<motion.div className="absolute inset-0 rounded-full bg-orange-400" animate={{ opacity: pointing ? 0.9 : 0 }} transition={{ duration: 0.2 }} style={{ boxShadow: "0 0 14px 3px rgba(251,146,60,0.7)" }} />
						<motion.div key={blink} className="absolute inset-0 rounded-full bg-sky-300" initial={{ opacity: blink > 1 ? 1 : 0 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} />
					</div>
					<span className="h-9 w-9" aria-hidden />
				</div>

				<Lcd4 t={t} services={services} />

				<Wheel z={z} r={{ mode: t.mode, step: t.step, ok: t.ok, click: t.click, okLabel: t.okLabel, up: () => t.step(-1), down: () => t.step(1) }} size={214} />

				<div className="grid w-full grid-cols-2 gap-2.5">
					<Key4 label="Back" d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" onClick={press(t.back)} />
					<Key4 label="Home" d="M3 11l9-7 9 7M5 10v10h14V10" onClick={press(t.home)} />
					<Key4 label="Mood" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" on={t.mode === "mood"} onClick={() => t.pickMode("mood")} />
					<Key4 label="Search" d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" on={t.mode === "search"} onClick={() => t.pickMode("search")} />
				</div>

				{/* Streaming keys like real remotes print them: the same key, the brand's wordmark in its color. */}
				<div className="grid w-full grid-cols-4 gap-2">
					{REMOTE_SERVICES.filter((key) => services.some((x) => x.key === key)).map((key) => {
						const on = t.mix.service === key
						const label = services.find((x) => x.key === key)?.label ?? key
						return (
							<button
								key={key}
								type="button"
								aria-pressed={on}
								aria-label={`Only ${label}`}
								title={`Only ${label}`}
								onClick={() => t.pickService(key)}
								className={`lr2-key flex h-11 items-center justify-center rounded-xl ${on ? "lr2-key-on" : ""}`}
							>
								<Brand k={key} />
							</button>
						)
					})}
				</div>

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

function Key4({ label, d, onClick, on }: { label: string; d: string; onClick: () => void; on?: boolean }) {
	return (
		<button type="button" aria-pressed={on} onClick={onClick} className={`lr2-key flex h-12 items-center justify-center gap-2 rounded-2xl text-[12px] font-semibold uppercase tracking-wider ${on ? "lr2-key-on" : ""}`}>
			<Icon d={d} className="h-[18px] w-[18px]" />
			{label}
		</button>
	)
}

// What the remote's screen says: a headline and one line of help. Round 5 reuses it.
export function lcdLines(t: Tv4, services: LRServiceButton[]): [string, string] {
	// The TV flow prototype (#187) says what its own screens are.
	if ("lcd" in t) return t.lcd as [string, string]
	const s = t.top
	const svc = services.find((x) => x.key === t.mix.service)
	return t.mode === "mood"
			? [`${MOODS[t.moodIdx].emoji} ${MOODS[t.moodIdx].name}`, "Turn to change the mood"]
			: s.k === "boot"
				? ["Starting…", "GoodWatch"]
				: s.k === "home"
					? [["What is GoodWatch?", "Tonight", "Pick for me"][t.focus], "Turn to choose, OK to open"]
					: s.k === "about"
						? [["One score", "How it feels", "Where it streams"][t.focus], "Turn to choose, OK to open"]
						: s.k === "feature"
							? [FEATURE_NAME[s.id], "Turn for the next feature"]
							: s.k === "mix"
								? [t.mix.label ?? (svc ? `Best on ${svc.label}` : "Your mix"), svc ? `Only ${svc.label}` : "Point at a title to open it"]
								: s.k === "picks"
									? [`${Math.min(t.loved.length, 3)} of 3 loved`, t.loved.length >= 3 ? "OK shows your picks" : "Point at titles you loved"]
									: s.k === "title"
										? ["Title", "Back to return"]
										: s.k === "page"
											? [PAGES[s.id].name, "Back to return"]
										: s.k === "moods"
											? [`${MOODS[t.focus]?.emoji ?? ""} ${MOODS[t.focus]?.name ?? ""}`, "Turn to choose, OK to pick"]
										: s.k === "keyboard"
											? ["Search", "Type, or point at the keys"]
											: ["Search", "Point at a title to open it"]
}

// The screen on the remote says what the wheel does right now, in one line.
function Lcd4({ t, services }: { t: Tv4; services: LRServiceButton[] }) {
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (t.mode === "search") input.current?.focus({ preventScroll: true })
	}, [t.mode])
	const [head, line] = lcdLines(t, services)
	return (
		<div className="lr2-lcd relative h-[96px] w-full overflow-hidden rounded-[20px] px-4 py-3">
			<div className="lr2-lcd-grid pointer-events-none absolute inset-0" />
			{t.mode === "search" ? (
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
						className="w-full bg-transparent text-[18px] font-medium text-white placeholder:text-white/35 focus:outline-none"
					/>
					<div className="mt-1 h-px w-full bg-[var(--lcd)] opacity-40" />
					<Small>Enter to search, turn for ideas</Small>
				</form>
			) : (
				<div className="relative">
					<div className="lr-vt truncate text-[27px] leading-none text-[var(--lcd)]">{head}</div>
					<Small>{line}</Small>
				</div>
			)}
			<div className="pointer-events-none absolute inset-0 rounded-[20px] bg-[linear-gradient(160deg,rgba(255,255,255,0.10)_0%,transparent_35%)]" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// On-screen versions of the remote: a compact bar with everything the remote has, and a keyboard for Search.

const BAR_ICON = {
	back: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
	home: "M3 11l9-7 9 7M5 10v10h14V10",
	search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
	mood: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01",
	more: "M5 12h.01M12 12h.01M19 12h.01",
	heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
	power: "M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0",
}

// Minimal: Back and Home only away from home, Search, and one More button for the rest.
function TvBar({ t, services }: { t: Tv4; services: LRServiceButton[] }) {
	const atHome = t.top.k === "home"
	const icon = (k: string, d: string, label: string, on?: boolean) => (
		<button key={k} type="button" data-pick={`bar:${k}`} aria-label={label} title={label} className={`flex h-9 w-9 items-center justify-center rounded-full ${on ? "bg-white/90 text-black" : "bg-black/45 text-white/85 ring-1 ring-white/10"}`}>
			<Icon d={d} className="h-[18px] w-[18px]" />
		</button>
	)
	return (
		<div className="absolute right-6 top-5 z-20 flex flex-col items-end gap-2">
			<div className="flex items-center gap-2">
				{!atHome && icon("back", BAR_ICON.back, "Back")}
				{!atHome && icon("home", BAR_ICON.home, "Home")}
				{icon("search", BAR_ICON.search, "Search", t.top.k === "keyboard")}
				{icon("more", BAR_ICON.more, "More", t.menu)}
			</div>
			<AnimatePresence>
				{t.menu && (
					<motion.div
						className="flex w-[230px] flex-col gap-1 rounded-2xl bg-[#0c0e12]/95 p-2 ring-1 ring-white/10"
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.15 }}
					>
						<MenuItem pick="bar:mood" d={BAR_ICON.mood} label="Pick a mood" />
						<MenuItem pick="bar:picks" d={BAR_ICON.heart} label="Get my picks" />
						<div className="mx-2 my-1 h-px bg-white/10" />
						<div className="grid grid-cols-4 gap-1.5 px-1">
							{REMOTE_SERVICES.filter((key) => services.some((x) => x.key === key)).map((key) => (
								<button key={key} type="button" data-pick={`svc:${key}`} title={`Only ${key}`} className={`lr4-brandkey flex h-9 items-center justify-center rounded-lg ${t.mix.service === key ? "ring-2 ring-amber-300" : ""}`}>
									<Brand k={key} />
								</button>
							))}
						</div>
						<div className="mx-2 my-1 h-px bg-white/10" />
						<MenuItem pick="bar:power" d={BAR_ICON.power} label="Turn off" />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

function MenuItem({ pick, d, label }: { pick: string; d: string; label: string }) {
	return (
		<button type="button" data-pick={pick} className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-medium text-white/90">
			<Icon d={d} className="h-[18px] w-[18px] text-white/70" />
			{label}
		</button>
	)
}

// The moods, as a screen: pick one, and the mix tunes to it.
function Moods({ t }: { t: Tv4 }) {
	return (
		<div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]">
			<div className="absolute left-12 top-10 text-[22px] font-semibold text-white/85">What are you in the mood for?</div>
			<div className="absolute inset-x-12 bottom-12 top-[100px] grid grid-cols-3 gap-4">
				{MOODS.map((m, i) => (
					<button
						key={m.id}
						type="button"
						data-pick={`mood:${i}`}
						onMouseEnter={() => t.setFocus(i)}
						className={`flex items-center gap-4 rounded-2xl px-6 text-left ring-2 transition-colors ${t.focus === i ? "bg-white/10 ring-amber-300" : "bg-white/[0.04] ring-white/5"}`}
					>
						<span className="text-[36px]">{m.emoji}</span>
						<span className="text-[22px] font-bold">{m.name}</span>
					</button>
				))}
			</div>
		</div>
	)
}

// Streaming keys the way real remotes print them: one key shape, the brand's wordmark on it.
export const REMOTE_SERVICES = ["netflix", "prime", "disney", "hulu"] as const
const BRAND: Record<(typeof REMOTE_SERVICES)[number], { src: string; color: string; w: string }> = {
	netflix: { src: netflixMark, color: "#e50914", w: "78%" },
	prime: { src: primeMark, color: "#ffffff", w: "80%" },
	disney: { src: disneyMark, color: "#ffffff", w: "62%" },
	hulu: { src: huluMark, color: "#1ce783", w: "64%" },
}

export function Brand({ k }: { k: string }) {
	const b = BRAND[k as keyof typeof BRAND]
	if (!b) return null
	return (
		<span
			aria-hidden
			className="block h-[60%]"
			// Quoted: small SVGs are inlined as data URLs, which break an unquoted url().
			style={{ width: b.w, background: b.color, WebkitMask: `url("${b.src}") center / contain no-repeat`, mask: `url("${b.src}") center / contain no-repeat` }}
		/>
	)
}

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]

export function Keyboard({ t }: { t: Tv4 }) {
	// A real keyboard works too, wherever the focus is (except in a text field, which types by itself).
	useEffect(() => {
		const on = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return
			if (e.key === "Backspace") t.setDraft((d) => d.slice(0, -1))
			else if (e.key === "Enter") t.submit()
			else if (e.key.length === 1) t.setDraft((d) => (d + e.key).slice(0, 120))
			else return
			e.preventDefault()
			e.stopPropagation()
		}
		window.addEventListener("keydown", on, true)
		return () => window.removeEventListener("keydown", on, true)
	})
	return (
		<div className="absolute inset-0 bg-[radial-gradient(100%_80%_at_50%_0%,#0b2a28_0%,#05080a_60%)]">
			<div className="absolute left-12 right-12 top-[84px] flex h-[60px] items-center gap-4 rounded-2xl bg-white/[0.07] px-6 ring-1 ring-white/15">
				<Icon d={BAR_ICON.search} className="h-6 w-6 shrink-0 text-teal-300" />
				<span className="truncate text-[24px] font-medium">
					{t.draft || <span className="text-white/35">What do you feel like watching?</span>}
					<span className="ml-0.5 inline-block h-6 w-[3px] translate-y-1 animate-pulse bg-teal-300" />
				</span>
			</div>
			<div className="absolute left-12 right-12 top-[160px] grid grid-cols-3 gap-3">
				{SEARCH_PRESETS.map((q, i) => (
					<button key={q} type="button" data-pick={`preset:${i}`} className="truncate rounded-xl bg-teal-400/10 px-4 py-2.5 text-left text-[15px] text-teal-100 ring-1 ring-teal-300/25">
						{q}
					</button>
				))}
			</div>
			<div className="absolute bottom-8 left-12 right-12 flex flex-col items-center gap-2.5">
				{ROWS.map((row) => (
					<div key={row} className="flex gap-2.5">
						{[...row].map((c) => (
							<button key={c} type="button" data-pick={`key:${c}`} className="h-12 w-[64px] rounded-xl bg-white/[0.08] text-[20px] font-semibold uppercase ring-1 ring-white/10">
								{c}
							</button>
						))}
					</div>
				))}
				<div className="flex gap-2.5">
					<button type="button" data-pick="key:del" className="h-12 w-[130px] rounded-xl bg-white/[0.08] text-[15px] font-semibold ring-1 ring-white/10">
						Delete
					</button>
					<button type="button" data-pick="key:space" className="h-12 w-[330px] rounded-xl bg-white/[0.08] text-[15px] font-semibold ring-1 ring-white/10">
						Space
					</button>
					<button type="button" data-pick="key:go" className="h-12 w-[130px] rounded-xl bg-teal-400 text-[15px] font-bold text-black">
						Search
					</button>
				</div>
			</div>
		</div>
	)
}
