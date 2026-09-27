// PROTOTYPE - throwaway. The six channels of the living room start page. Each draws on a fixed 960 x 528
// canvas (the Screen scales it), cycles through titles on its own like a broadcast, and reuses the site's
// existing pieces: the GoodWatch score badge and vibe colors, the rating logos, the fingerprint pillars.
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { LRData, LRRec, LRSearch, LRTitle } from "~/server/prototype-start-living-room.server"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogo from "~/img/metacritic-logo-icon-250.png"
import rottenLogo from "~/img/rotten-logo-icon-250.png"
import tmdbLogo from "~/img/tmdb-logo.svg"
import Pillars, { type PillarName } from "~/ui/fingerprint/Pillars"
import PillarDetails from "~/ui/fingerprint/PillarDetails"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { goodwatchVibeIndex, scoreLabels } from "~/utils/ratings"
import type { ChannelInfo } from "./tv"

export const CHANNELS: ChannelInfo[] = [
	{ num: 1, id: "tonight", name: "Tonight", short: "Tonight", glow: "#f5b642", pitch: "What's good tonight", line: "One great pick, with everything you need to decide." },
	{ num: 2, id: "for-you", name: "For you", short: "For you", glow: "#fb7185", pitch: "Picks that match your taste", line: "Recommendations matched on what you loved, not what's popular." },
	{ num: 3, id: "scores", name: "Scores", short: "Scores", glow: "#34d399", pitch: "Every score, one number", line: "IMDb, Metacritic, Rotten Tomatoes, and TMDB in one GoodWatch score." },
	{ num: 4, id: "fingerprint", name: "Fingerprint", short: "Fingerprint", glow: "#a78bfa", pitch: "Know how it feels before you press play", line: "Every title measured on 70+ attributes across six pillars." },
	{ num: 5, id: "where", name: "Where to watch", short: "Streaming", glow: "#38bdf8", pitch: "Where it's streaming, right now", line: "Streaming, free, rent, and buy options for your country." },
	{ num: 6, id: "search", name: "Search", short: "Search", glow: "#2dd4bf", pitch: "Search the way you'd ask a friend", line: "Describe a mood or a moment. The search reads it and finds the titles." },
]

export const img = (path: string | null | undefined, size = "w342") =>
	path ? (path.startsWith("http") ? path : `https://image.tmdb.org/t/p/${size}${path}`) : ""

export function useCycle(n: number, ms: number) {
	const [i, setI] = useState(0)
	useEffect(() => {
		if (n < 2) return
		const t = setInterval(() => setI((x) => (x + 1) % n), ms)
		return () => clearInterval(t)
	}, [n, ms])
	return i
}

// A cycle you can also drive: go(k) jumps to an item and holds it for 20 seconds before advancing again.
export function useCycleCtl(n: number, ms: number) {
	const [i, setI] = useState(0)
	const [run, setRun] = useState(0)
	const [held, setHeld] = useState(false)
	useEffect(() => {
		if (n < 2) return
		const t = setTimeout(() => {
			setHeld(false)
			setI((x) => (x + 1) % n)
			setRun((r) => r + 1)
		}, held ? 20000 : ms)
		return () => clearTimeout(t)
	}, [run, n, ms, held])
	const go = (k: number) => {
		setI(k)
		setHeld(true)
		setRun((r) => r + 1)
	}
	return { i: n ? i % n : 0, go, run, held, ms }
}

type Cycle = ReturnType<typeof useCycleCtl>

// Mini previews along the bottom of the screen: every item in the rotation, clickable, with the current
// one lifted and a bar that fills until the next switch (or a pause mark while you hold one).
export function Strip({ c, items }: { c: Cycle; items: { key: string; poster?: string | null; label?: string }[] }) {
	if (items.length < 2) return null
	return (
		<div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-end gap-2 rounded-2xl bg-black/70 px-3 py-2 ring-1 ring-white/10">
			{items.map((it, k) => {
				const on = k === c.i
				return (
					<button
						key={it.key}
						type="button"
						data-pick="strip"
						aria-label={it.label ?? `Show item ${k + 1}`}
						aria-current={on}
						onClick={(e) => {
							e.stopPropagation()
							c.go(k)
						}}
						className={`relative shrink-0 rounded-md transition-all duration-200 ${on ? "-translate-y-1 opacity-100" : "opacity-50 hover:opacity-100"}`}
					>
						{it.poster ? (
							<img src={img(it.poster, "w92")} alt="" className={`h-[45px] w-[30px] rounded-md object-cover ${on ? "ring-2 ring-amber-300" : "ring-1 ring-white/15"}`} />
						) : (
							<span className={`block max-w-[150px] truncate rounded-md px-2.5 py-1.5 text-[12px] font-semibold ${on ? "bg-white/15 text-white ring-2 ring-amber-300" : "bg-white/5 text-white/80 ring-1 ring-white/15"}`}>
								{it.label}
							</span>
						)}
						{on && (
							<span className="absolute -bottom-1.5 left-0 right-0 h-[3px] overflow-hidden rounded-full bg-white/15">
								{c.held ? (
									<span className="block h-full w-full bg-white/50" />
								) : (
									<span key={c.run} className="lr-progress block h-full w-full origin-left bg-amber-300" style={{ animationDuration: `${c.ms}ms` }} />
								)}
							</span>
						)}
					</button>
				)
			})}
		</div>
	)
}

export const ease = [0.2, 0.7, 0.1, 1] as const

// Round 4: lean screens drop section labels and secondary lines; only the essentials stay.
export const Lean = createContext(false)

// The existing GoodWatch score badge: the white logo on a vibe-colored circle next to the number.
export function GwBadge({ gw, size = 36, text = "text-2xl" }: { gw: number | null; size?: number; text?: string }) {
	const vibe = gw ? goodwatchVibeIndex(gw) : null
	return (
		<span className="inline-flex items-center gap-2">
			<img
				src={gwLogo}
				alt="GoodWatch score"
				className={`rounded-full shadow-xl ${vibe == null ? "bg-gray-950" : `bg-vibe-${vibe}`}`}
				style={{ height: size, width: size, padding: size * 0.17 }}
			/>
			<span className={`${text} font-semibold ${vibe == null ? "text-gray-300" : `text-vibe-${vibe}`}`}>{gw ? Math.floor(gw) : "–"}</span>
		</span>
	)
}

function ServiceLogo({ s, size = 34 }: { s: { name: string; logo: string }; size?: number }) {
	return <img src={img(s.logo, "w92")} alt={s.name} title={s.name} className="rounded-lg shadow-md" style={{ width: size, height: size }} />
}

function metaLine(t: LRTitle) {
	const parts = [t.year, t.genres.slice(0, 2).join(" · ")]
	if (t.type === "movie" && t.runtime) parts.push(`${Math.floor(t.runtime / 60)}h ${t.runtime % 60}m`)
	if (t.type === "show" && t.seasons) parts.push(`${t.seasons} season${t.seasons > 1 ? "s" : ""}`)
	return parts.filter(Boolean).join("  ·  ")
}

// ---------------------------------------------------------------------------------------------------------
// CH 1 · Tonight

function Tonight({ data }: { data: LRData }) {
	const lean = useContext(Lean)
	const list = data.lineup
	const c = useCycleCtl(list.length, 7000)
	const i = c.i
	const t = list[i]
	if (!t) return null
	const streams = t.services.filter((s) => s.kind === "stream" || s.kind === "free").slice(0, 4)
	return (
		<div className="absolute inset-0 overflow-hidden bg-[#07080b] text-white">
			<AnimatePresence initial={false}>
				<motion.div key={t.key} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.1 }}>
					<img src={img(t.backdrop, "w1280")} alt="" className="lr-kenburns absolute inset-0 h-full w-full object-cover" />
					<div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,9,0.96)_0%,rgba(5,6,9,0.78)_38%,rgba(5,6,9,0.1)_75%)]" />
					<div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(5,6,9,0.95)_0%,transparent_45%)]" />
				</motion.div>
			</AnimatePresence>

			{!lean && (
			<div className="absolute left-12 top-10 flex items-center gap-3">
					<img src={gwLogo} alt="" className="h-7" />
					<span className="text-[15px] font-bold uppercase tracking-[0.3em] text-white/80">GoodWatch</span>
					<span className="ml-3 flex items-center gap-1.5 rounded bg-red-600/90 px-2 py-0.5 text-[11px] font-bold tracking-widest">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> TONIGHT
					</span>
				</div>
			)}

			<AnimatePresence mode="wait">
				<motion.div
					key={t.key}
					className="absolute bottom-[84px] left-12 w-[600px]"
					initial="a"
					animate="b"
					exit="c"
					variants={{ a: {}, b: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } }, c: { opacity: 0, transition: { duration: 0.3 } } }}
				>
					{[
						<div key="m" className="text-[15px] font-medium tracking-wide text-amber-300/90">
							{metaLine(t)}
						</div>,
						<h2 key="t" data-pick={t.key} className="mt-2 text-[58px] font-extrabold leading-[0.95] tracking-tight">
							{t.title}
						</h2>,
						t.essence && (
							<p key="e" className="mt-4 line-clamp-2 text-[18px] leading-snug text-white/75">
								{t.essence}
							</p>
						),
						<div key="r" className="mt-6 flex items-center gap-6">
							<GwBadge gw={t.gw} size={44} text="text-[30px]" />
							{streams.length > 0 && (
								<span className="flex items-center gap-2 border-l border-white/15 pl-6">
									{streams.map((s) => (
										<ServiceLogo key={s.id} s={s} size={38} />
									))}
								</span>
							)}
						</div>,
					]
						.filter(Boolean)
						.map((el, k) => (
							<motion.div
								key={k}
								variants={{ a: { opacity: 0, y: 18, filter: "blur(6px)" }, b: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease } } }}
							>
								{el}
							</motion.div>
						))}
				</motion.div>
			</AnimatePresence>

			<Strip c={c} items={list.map((x) => ({ key: x.key, poster: x.poster, label: x.title }))} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// CH 2 · For you

function cosine(a: Record<string, number>, b: Record<string, number>) {
	let dot = 0
	let na = 0
	let nb = 0
	for (const k of Object.keys(a)) {
		const x = a[k] ?? 0
		const y = b[k] ?? 0
		dot += x * y
		na += x * x
		nb += y * y
	}
	return na && nb ? dot / Math.sqrt(na * nb) : 0
}

function sharedTraits(a: Record<string, number>, b: Record<string, number>) {
	return Object.keys(a)
		.filter((k) => k !== "overall" && (a[k] ?? 0) >= 6 && (b[k] ?? 0) >= 6)
		.sort((x, y) => Math.min(b[y], a[y]) - Math.min(b[x], a[x]))
		.slice(0, 2)
		.map(getFingerprintMeta)
}

function ForYou({ data }: { data: LRData }) {
	if (data.recs.length >= 5) return <ForYouMember recs={data.recs} />
	return <ForYouGuest lineup={data.lineup.filter((t) => t.scores)} />
}

function ForYouGuest({ lineup }: { lineup: LRTitle[] }) {
	const lean = useContext(Lean)
	const c = useCycleCtl(lineup.length, 8000)
	const i = c.i
	const seed = lineup[i]
	const matches = useMemo(() => {
		if (!seed?.scores) return []
		return lineup
			.filter((t) => t.key !== seed.key)
			.map((t) => ({ t, sim: cosine(seed.scores!, t.scores!) }))
			.sort((a, b) => b.sim - a.sim)
			.slice(0, 3)
			.map(({ t, sim }) => ({ t, match: Math.round(55 + (sim - 0.6) * 110), traits: sharedTraits(seed.scores!, t.scores!) }))
	}, [seed?.key])
	if (!seed) return null
	const rows = [96, 214, 332]
	return (
		<div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_20%_40%,#2a0f1a_0%,#0b0709_60%)] text-white">
			{!lean && (
			<div className="absolute left-12 top-9 text-[13px] font-bold uppercase tracking-[0.3em] text-rose-300/80">
				For you <span className="ml-3 normal-case tracking-normal text-white/40">matched on how titles feel, not just their genre</span>
			</div>
			)}
			<AnimatePresence mode="wait">
				<motion.div key={seed.key} className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.35 } }}>
					<motion.div
						className="absolute left-12 top-[92px]"
						initial={{ opacity: 0, x: -30, rotate: -4 }}
						animate={{ opacity: 1, x: 0, rotate: -2 }}
						transition={{ duration: 0.7, ease }}
					>
						<div className="mb-3 text-[17px] text-white/60">Because you loved</div>
						<img data-pick={seed.key} src={img(seed.poster)} alt={seed.title} className="w-[170px] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] ring-1 ring-white/15" />
						<div className="mt-3 w-[190px] text-[20px] font-bold leading-tight">{seed.title}</div>
					</motion.div>

					{/* Beams from the loved title to each match, drawn after the seed lands. */}
					<svg className="absolute inset-0" width={960} height={528} aria-hidden>
						<defs>
							<linearGradient id="lr-beam" x1="0" x2="1">
								<stop offset="0" stopColor="#fb7185" stopOpacity="0.9" />
								<stop offset="1" stopColor="#fb7185" stopOpacity="0.15" />
							</linearGradient>
						</defs>
						{matches.map((m, k) => (
							<motion.path
								key={m.t.key}
								d={`M 232 240 C 330 240, 330 ${rows[k] + 51}, 430 ${rows[k] + 51}`}
								fill="none"
								stroke="url(#lr-beam)"
								strokeWidth={2}
								initial={{ pathLength: 0, opacity: 0 }}
								animate={{ pathLength: 1, opacity: 1 }}
								transition={{ duration: 0.7, delay: 0.5 + k * 0.15, ease }}
							/>
						))}
					</svg>

					{matches.map((m, k) => (
						<motion.div
							key={m.t.key}
							className="absolute left-[440px] flex w-[470px] items-center gap-5"
							style={{ top: rows[k] }}
							initial={{ opacity: 0, x: 24 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.55, delay: 0.9 + k * 0.15, ease }}
						>
							<img data-pick={m.t.key} src={img(m.t.poster, "w185")} alt={m.t.title} className="w-[68px] rounded-lg shadow-lg ring-1 ring-white/10" />
							<div className="min-w-0 flex-1">
								<div className="flex items-baseline gap-3">
									<span className="text-[30px] font-extrabold tabular-nums text-rose-300">{m.match}%</span>
									<span className="truncate text-[20px] font-semibold">{m.t.title}</span>
								</div>
								<div className="mt-2 flex flex-wrap gap-2">
									{m.traits.map((tr) => (
										<span key={tr.key} className="rounded-full bg-white/10 px-2.5 py-1 text-[13px] text-white/85">
											{tr.emoji} {tr.label}
										</span>
									))}
									<span className="flex items-center">
										<GwBadge gw={m.t.gw} size={22} text="text-[15px]" />
									</span>
								</div>
							</div>
						</motion.div>
					))}
				</motion.div>
			</AnimatePresence>
			<Strip c={c} items={lineup.map((x) => ({ key: x.key, poster: x.poster, label: x.title }))} />
		</div>
	)
}

function ForYouMember({ recs }: { recs: LRRec[] }) {
	const pages = Math.ceil(recs.length / 5)
	const c = useCycleCtl(pages, 7000)
	const page = c.i
	const shown = recs.slice(page * 5, page * 5 + 5)
	return (
		<div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#2a0f1a_0%,#0b0709_65%)] text-white">
			<div className="absolute left-12 top-9 text-[13px] font-bold uppercase tracking-[0.3em] text-rose-300/80">For you</div>
			<div className="absolute left-12 top-[60px] text-[34px] font-extrabold tracking-tight">Picked for your taste</div>
			<AnimatePresence mode="wait">
				<motion.div key={page} className="absolute left-12 right-12 top-[140px] grid grid-cols-5 gap-5" exit={{ opacity: 0, transition: { duration: 0.3 } }}>
					{shown.map((r, k) => (
						<motion.div
							key={r.key}
							initial={{ opacity: 0, y: 30, rotateX: 30 }}
							animate={{ opacity: 1, y: 0, rotateX: 0 }}
							transition={{ duration: 0.6, delay: k * 0.08, ease }}
							style={{ transformPerspective: 800 }}
						>
							<div className="relative">
								<img data-pick={r.key} src={img(r.poster)} alt={r.title} className="w-full rounded-lg shadow-xl ring-1 ring-white/10" />
								<span className="absolute -right-2 -top-2 rounded-full bg-rose-500 px-2.5 py-1 text-[14px] font-extrabold shadow-lg">{r.match}%</span>
							</div>
							<div className="mt-2 truncate text-[15px] font-semibold">{r.title}</div>
							<div className="truncate text-[12px] text-white/50">{r.tags.join(" · ")}</div>
						</motion.div>
					))}
				</motion.div>
			</AnimatePresence>
			<Strip c={c} items={Array.from({ length: pages }, (_, k) => ({ key: `p${k}`, poster: recs[k * 5]?.poster, label: `Page ${k + 1}` }))} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// CH 3 · Scores

function Count({ to, decimals = 0, delay = 0, suffix = "" }: { to: number; decimals?: number; delay?: number; suffix?: string }) {
	const v = useMotionValue(0)
	const text = useTransform(v, (x) => `${x.toFixed(decimals)}${suffix}`)
	useEffect(() => {
		const c = animate(v, to, { duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] })
		return () => c.stop()
	}, [to])
	return <motion.span>{text}</motion.span>
}

const compact = (n: number | null) => (n ? Intl.NumberFormat("en", { notation: "compact" }).format(n) : "")

function Scores({ data }: { data: LRData }) {
	const lean = useContext(Lean)
	const list = data.lineup.filter((t) => t.gw)
	const c = useCycleCtl(list.length, 8000)
	const i = c.i
	const t = list[i]
	if (!t) return null
	const sources = [
		t.imdb && { logo: imdbLogo, name: "IMDb", value: t.imdb, decimals: 1, suffix: "", sub: t.imdbVotes ? `${compact(t.imdbVotes)} votes` : "users" },
		t.metacritic && { logo: metacriticLogo, name: "Metacritic", value: t.metacritic, decimals: 0, suffix: "", sub: "critics" },
		t.rt && { logo: rottenLogo, name: "Rotten Tomatoes", value: t.rt, decimals: 0, suffix: "%", sub: "critics" },
		t.tmdb && { logo: tmdbLogo, name: "TMDB", value: t.tmdb, decimals: 1, suffix: "", sub: "users" },
	].filter(Boolean) as { logo: string; name: string; value: number; decimals: number; suffix: string; sub: string }[]
	const vibe = goodwatchVibeIndex(t.gw!)
	const label = scoreLabels[Math.max(1, Math.min(10, Math.round(t.gw! / 10)))]
	const rowY = (k: number) => 132 + k * 84
	const scoreCenter = { x: 752, y: 262 }
	return (
		<div className="absolute inset-0 overflow-hidden bg-[radial-gradient(90%_90%_at_80%_50%,#0c2418_0%,#06080a_65%)] text-white">
			{!lean && (<div className="absolute left-12 top-9 text-[13px] font-bold uppercase tracking-[0.3em] text-emerald-300/80">Scores</div>)}
			<AnimatePresence mode="wait">
				<motion.div key={t.key} className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.3 } }}>
					<motion.div className="absolute left-12 top-[70px] text-[30px] font-extrabold tracking-tight" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
						{t.title} <span className="text-[20px] font-medium text-white/45">{t.year}</span>
					</motion.div>

					<svg className="absolute inset-0" width={960} height={528} aria-hidden>
						{sources.map((s, k) => (
							<motion.path
								key={s.name}
								d={`M 420 ${rowY(k) + 26} C 540 ${rowY(k) + 26}, 560 ${scoreCenter.y}, ${scoreCenter.x - 110} ${scoreCenter.y}`}
								fill="none"
								stroke="rgba(255,255,255,0.22)"
								strokeWidth={1.5}
								strokeDasharray="3 5"
								initial={{ pathLength: 0 }}
								animate={{ pathLength: 1 }}
								transition={{ duration: 0.6, delay: 0.55 + k * 0.12, ease }}
							/>
						))}
					</svg>

					{sources.map((s, k) => (
						<motion.div
							key={s.name}
							className="absolute left-12 flex w-[360px] items-center gap-4 rounded-2xl bg-white/[0.05] px-4 py-2.5 ring-1 ring-white/10"
							style={{ top: rowY(k) }}
							initial={{ opacity: 0, x: -30 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.5, delay: 0.1 + k * 0.1, ease }}
						>
							<img src={s.logo} alt={s.name} className="h-9 w-9 object-contain" />
							<div className="flex-1">
								<div className="text-[15px] font-semibold">{s.name}</div>
								{!lean && (<div className="text-[12px] text-white/45">{s.sub}</div>)}
							</div>
							<div className="text-[28px] font-bold tabular-nums">
								<Count to={s.value} decimals={s.decimals} suffix={s.suffix} delay={0.2 + k * 0.1} />
							</div>
						</motion.div>
					))}

					{/* The one number, arriving after the sources flow into it. */}
					<motion.div
						className="absolute flex flex-col items-center"
						style={{ left: scoreCenter.x - 110, top: scoreCenter.y - 130, width: 220 }}
						initial={{ opacity: 0, scale: 0.7 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ type: "spring", stiffness: 220, damping: 18, delay: 1.05 }}
					>
						<div className={`relative flex h-[180px] w-[180px] items-center justify-center rounded-full bg-vibe-${vibe} shadow-[0_0_80px_rgba(22,163,74,0.35)]`}>
							<motion.div
								className="absolute inset-[-14px] rounded-full border-2 opacity-40"
								style={{ borderColor: `var(--color-vibe-${vibe})` }}
								animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.1, 0.45] }}
								transition={{ duration: 2.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
							/>
							<div className="flex flex-col items-center">
								<img src={gwLogo} alt="" className="h-8" />
								<span className="mt-1 text-[64px] font-extrabold leading-none tabular-nums">
									<Count to={Math.floor(t.gw!)} delay={1.1} />
								</span>
							</div>
						</div>
						<div className={`mt-4 text-[24px] font-bold text-vibe-${vibe} brightness-150`}>{label}</div>
						<div className="text-[13px] text-white/50">GoodWatch score</div>
					</motion.div>
				</motion.div>
			</AnimatePresence>
			<Strip c={c} items={list.map((x) => ({ key: x.key, poster: x.poster, label: x.title }))} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// CH 4 · Fingerprint

const PILLAR_ORDER: PillarName[] = ["Energy", "Heart", "Humor", "World", "Craft", "Style"]

function Fingerprint({ data }: { data: LRData }) {
	const lean = useContext(Lean)
	const list = data.lineup.filter((t) => t.pillars && t.scores)
	const c = useCycleCtl(list.length, 14000)
	const i = c.i
	const t = list[i]
	const [p, setP] = useState(0)
	// Walk the pillars, strongest first, so each title shows off its character.
	const order = useMemo(
		() => (t?.pillars ? [...PILLAR_ORDER].sort((a, b) => (t.pillars![b] ?? 0) - (t.pillars![a] ?? 0)) : PILLAR_ORDER),
		[t?.key],
	)
	useEffect(() => {
		setP(0)
		const id = setInterval(() => setP((x) => (x + 1) % 6), 2300)
		return () => clearInterval(id)
	}, [t?.key])
	if (!t) return null
	return (
		<div className="absolute inset-0 overflow-hidden bg-[radial-gradient(100%_100%_at_0%_0%,#1d1535_0%,#08070d_60%)] text-white">
			<img src={img(t.backdrop, "w780")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.07] blur-sm" />
			<AnimatePresence mode="wait">
				<motion.div key={t.key} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
					<div className="absolute left-12 right-12 top-9 flex items-start gap-5">
						<img data-pick={t.key} src={img(t.poster, "w185")} alt="" className="w-[64px] rounded-md shadow-lg ring-1 ring-white/10" />
						<div className="min-w-0 flex-1">
							{!lean && (<div className="text-[13px] font-bold uppercase tracking-[0.3em] text-violet-300/80">Fingerprint</div>)}
							<div className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">{t.title}</div>
							{!lean && (<div className="mt-1 line-clamp-1 text-[15px] italic text-white/60">{t.essence}</div>)}
						</div>
					</div>
					<div className="absolute left-10 top-[150px] w-[330px] text-[17px]">
						<Pillars pillars={t.pillars!} selectedPillar={order[p]} onSelect={(name) => setP(order.indexOf(name))} />
					</div>
					<div className="absolute left-[400px] right-12 top-[134px] border-l border-white/10 pl-8 text-[17px]">
						<PillarDetails pillar={order[p]} scores={t.scores!} />
					</div>
				</motion.div>
			</AnimatePresence>
			<Strip c={c} items={list.map((x) => ({ key: x.key, poster: x.poster, label: x.title }))} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// CH 5 · Where to watch

const KIND_LABEL = { stream: "Stream", free: "Free", rent: "Rent", buy: "Buy" } as const

function Where({ data }: { data: LRData }) {
	const lean = useContext(Lean)
	const list = data.lineup.filter((t) => t.services.length)
	const c = useCycleCtl(list.length, 7000)
	const i = c.i
	const t = list[i]
	const country = useMemo(() => {
		try {
			return new Intl.DisplayNames(["en"], { type: "region" }).of(data.country) ?? data.country
		} catch {
			return data.country
		}
	}, [data.country])
	if (!t) {
		return (
			<div className="absolute inset-0 flex items-center justify-center bg-[#050a10] text-[22px] text-white/60">
				No streaming data for {country} yet.
			</div>
		)
	}
	const groups = (["stream", "free", "rent", "buy"] as const)
		.map((k) => ({ k, items: t.services.filter((s) => s.kind === k).slice(0, 3) }))
		.filter((g) => g.items.length)
		.slice(0, 3)
	let n = 0
	return (
		<div className="absolute inset-0 overflow-hidden bg-[#050a10] text-white">
			<AnimatePresence initial={false}>
				<motion.img
					key={t.key}
					src={img(t.backdrop, "w780")}
					alt=""
					className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
					initial={{ opacity: 0 }}
					animate={{ opacity: 0.35 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 1 }}
				/>
			</AnimatePresence>
			<div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,16,0.2),rgba(5,10,16,0.85)_45%)]" />
			<AnimatePresence mode="wait">
				<motion.div key={t.key} className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.3 } }}>
					<motion.img
						data-pick={t.key}
						src={img(t.poster)}
						alt={t.title}
						className="absolute left-14 top-[64px] w-[260px] rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
						initial={{ opacity: 0, y: 20, rotateY: -18 }}
						animate={{ opacity: 1, y: 0, rotateY: -6 }}
						transition={{ duration: 0.7, ease }}
						style={{ transformPerspective: 900 }}
					/>
					<div className="absolute left-[372px] right-12 top-10">
						{!lean && (<div className="text-[13px] font-bold uppercase tracking-[0.3em] text-sky-300/80">Where to watch · {country}</div>)}
						<motion.div className="mt-2 text-[34px] font-extrabold leading-tight tracking-tight" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
							{t.title}
						</motion.div>
						<div className="mt-6 space-y-5">
							{groups.map((g) => (
								<div key={g.k}>
									<div className="mb-2 text-[13px] font-semibold uppercase tracking-widest text-white/45">{KIND_LABEL[g.k]}</div>
									<div className="flex flex-wrap gap-3">
										{g.items.map((s) => {
											const d = 0.25 + n++ * 0.07
											return (
												<motion.div
													key={s.id}
													className="flex items-center gap-2.5 rounded-xl bg-white/[0.07] py-1.5 pl-1.5 pr-4 ring-1 ring-white/10"
													initial={{ opacity: 0, y: -28, scale: 0.9 }}
													animate={{ opacity: 1, y: 0, scale: 1 }}
													transition={{ type: "spring", stiffness: 420, damping: 22, delay: d }}
												>
													<ServiceLogo s={s} size={40} />
													<span className="text-[16px] font-medium">{s.name}</span>
												</motion.div>
											)
										})}
									</div>
								</div>
							))}
						</div>
					</div>
				</motion.div>
			</AnimatePresence>
			<Strip c={c} items={list.map((x) => ({ key: x.key, poster: x.poster, label: x.title }))} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// CH 6 · Search

const CHIP: Record<string, string> = {
	want: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30",
	avoid: "bg-rose-500/20 text-rose-200 ring-rose-400/30",
	excluded: "bg-rose-500/20 text-rose-200 ring-rose-400/30",
	attribute: "bg-sky-500/20 text-sky-200 ring-sky-400/30",
	phrase: "bg-white/10 text-white/80 ring-white/20",
}

const searchMemo = new Map<string, Promise<LRSearch>>()
function fetchSearch(q: string) {
	let p = searchMemo.get(q)
	if (!p) {
		p = fetch(`/prototype/start-living-room/search?q=${encodeURIComponent(q)}`).then((r) => {
			if (!r.ok) throw new Error(String(r.status))
			return r.json()
		})
		p.catch(() => searchMemo.delete(q))
		searchMemo.set(q, p)
	}
	return p
}

// With `fixed`, the remote drives it: one query, no cycling.
export function Search({ queries, fixed }: { queries: string[]; fixed?: string }) {
	const lean = useContext(Lean)
	const c = useCycleCtl(fixed ? 1 : queries.length, 11000)
	const q = fixed ?? queries[c.i]
	const [typed, setTyped] = useState(0)
	const [res, setRes] = useState<LRSearch | null>(null)
	const [failed, setFailed] = useState(false)
	useEffect(() => {
		setTyped(0)
		setRes(null)
		setFailed(false)
		let alive = true
		const started = Date.now()
		fetchSearch(q)
			.then((r) => {
				// Hold the results until the typing is done, so they land as the "enter" would.
				const wait = Math.max(0, q.length * 45 + 350 - (Date.now() - started))
				setTimeout(() => alive && setRes(r), wait)
			})
			.catch(() => alive && setFailed(true))
		const id = setInterval(() => setTyped((x) => (x >= q.length ? x : x + 1)), 45)
		return () => {
			alive = false
			clearInterval(id)
		}
	}, [q])
	const done = typed >= q.length
	return (
		<div className="absolute inset-0 overflow-hidden bg-[radial-gradient(100%_80%_at_50%_0%,#0b2a28_0%,#05080a_60%)] text-white">
			{!lean && (<div className="absolute left-12 top-9 text-[13px] font-bold uppercase tracking-[0.3em] text-teal-300/80">Search</div>)}
			<div className="absolute left-12 right-12 top-[66px] flex items-center gap-4 rounded-2xl bg-white/[0.07] px-6 py-4 ring-1 ring-white/15 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
				<svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-teal-300" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
					<circle cx="11" cy="11" r="7" />
					<path d="M20 20l-3.5-3.5" />
				</svg>
				<span className="text-[26px] font-medium">
					{q.slice(0, typed)}
					<span className={`ml-0.5 inline-block h-7 w-[3px] translate-y-1 bg-teal-300 ${done ? "animate-pulse" : ""}`} />
				</span>
			</div>

			<div className="absolute left-12 right-12 top-[150px] flex h-8 flex-wrap gap-2">
				<AnimatePresence>
					{res?.reading.map((c, k) => (
						<motion.span
							key={`${res.q}-${c.text}`}
							className={`rounded-full px-3 py-1 text-[14px] ring-1 ${CHIP[c.kind] ?? CHIP.phrase}`}
							initial={{ opacity: 0, y: 8, scale: 0.9 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0 }}
							transition={{ delay: k * 0.07, duration: 0.35, ease }}
						>
							{c.kind === "avoid" || c.kind === "excluded" ? "no " : ""}
							{c.text}
						</motion.span>
					))}
				</AnimatePresence>
			</div>

			<div className="absolute left-12 right-12 top-[206px] grid grid-cols-6 gap-4">
				{Array.from({ length: 6 }, (_, k) => {
					const r = res?.rows[k]
					return (
						<div key={k} className="relative" style={{ perspective: 800 }}>
							<AnimatePresence mode="wait">
								{r ? (
									<motion.div key={r.key} initial={{ rotateY: -90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, delay: k * 0.07, ease }}>
										<img data-pick={r.key} src={img(r.poster, "w185")} alt={r.title} className="aspect-[2/3] w-full rounded-lg object-cover shadow-xl ring-1 ring-white/10" />
										<div className="mt-2 truncate text-[13px] font-semibold">{r.title}</div>
										<div className="text-[12px] text-white/45">{r.year}</div>
									</motion.div>
								) : (
									<motion.div key="ph" className="aspect-[2/3] w-full rounded-lg bg-white/[0.05] ring-1 ring-white/5" animate={{ opacity: done && !failed ? [0.5, 1, 0.5] : 0.5 }} transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY }} />
								)}
							</AnimatePresence>
						</div>
					)
				})}
			</div>
			{failed && <div className="absolute bottom-8 left-12 text-[14px] text-white/45">Search didn't answer. Try again in a moment.</div>}
			{!fixed && <Strip c={c} items={queries.map((x) => ({ key: x, label: x }))} />}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------

export function renderChannel(ch: number, data: LRData, queries: string[]) {
	switch (CHANNELS[ch]?.id) {
		case "tonight":
			return <Tonight data={data} />
		case "for-you":
			return <ForYou data={data} />
		case "scores":
			return <Scores data={data} />
		case "fingerprint":
			return <Fingerprint data={data} />
		case "where":
			return <Where data={data} />
		case "search":
			return <Search queries={queries} />
		default:
			return null
	}
}
