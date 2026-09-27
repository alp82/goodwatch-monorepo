// PROTOTYPE - throwaway. Five looks for the same selection (#176, round 4): a sentence, chips, a compact
// segmented bar, a mood dial, and ready-made evenings. Each one only edits a `Sel`; the page applies it.
import { AdjustmentsHorizontalIcon, CheckIcon, ChevronDownIcon } from "@heroicons/react/24/solid"
import { motion, useSpring, useTransform } from "framer-motion"
import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { posterUrl } from "~/ui/prototype-rec-watch-next/model"
import type { Mood } from "~/ui/prototype-rec-watch-next-2/model"
import type { Queue } from "~/ui/prototype-rec-watch-next-3/model"
import { DISPLAY } from "./kit4"
import { ANY, type By, KINDS, LENGTHS, MOODS, MOOD_LABEL, ORDERS, type Sel, apply, isDefault, suggestFor, tests } from "./select"

export type SelProps = { q: Queue; sel: Sel; setSel: (s: Sel) => void; genres: string[] }

const set = <K extends keyof Sel>(p: SelProps, k: K, v: Sel[K]) => p.setSel({ ...p.sel, [k]: v })

// ============================================================ 1. Sentence

// One sentence you edit in place. Each underlined phrase is a menu.
const S_KIND: Record<string, string> = { all: "anything", movie: "a film", show: "a show" }
const S_LEN: Record<string, string> = { any: "of any length", short: "that's short", long: "that's long" }
const S_MOOD: Record<string, string> = { "": "in any mood", comfort: "for comfort", thoughtful: "to think about", escape: "for pure escape", binge: "to binge", light: "easy to drop into" }
const S_BY: Record<By, string> = { mine: "in my order", tonight: "best for tonight first", short: "shortest first", leaving: "leaving soon first", match: "best match first", oldest: "oldest wish first" }

function Slot({ value, options, onChange, label, on }: { value: string; options: Record<string, string>; onChange: (v: string) => void; label: string; on: boolean }) {
	return (
		<span className="relative inline-block">
			<select
				aria-label={label}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={`field-sizing-content max-w-full appearance-none rounded-none border-b-[3px] bg-transparent pb-0.5 leading-tight outline-none cursor-pointer focus-visible:bg-white/10 ${on ? "border-amber-400 text-amber-300" : "border-dotted border-white/40 text-white/80 hover:text-white"}`}
			>
				{Object.entries(options).map(([k, l]) => (
					<option key={k} value={k} className="bg-gray-900 text-base font-normal text-white">
						{l}
					</option>
				))}
			</select>
		</span>
	)
}

export function SentenceSel(p: SelProps) {
	const { sel } = p
	const genres = Object.fromEntries([["", "any genre"], ...p.genres.map((g) => [g, g.toLowerCase()])])
	return (
		<div className="max-w-5xl">
			<p className={`${DISPLAY} text-[1.7rem] leading-[1.35] text-white/70 md:text-[2.6rem] md:leading-[1.3]`}>
				Tonight, <Slot label="What" value={sel.kind} options={S_KIND} onChange={(v) => set(p, "kind", v as Sel["kind"])} on={sel.kind !== "all"} />{" "}
				<Slot label="How long" value={sel.length} options={S_LEN} onChange={(v) => set(p, "length", v as Sel["length"])} on={sel.length !== "any"} />{" "}
				<Slot label="Where" value={sel.services ? "mine" : "any"} options={{ any: "anywhere", mine: "on my services" }} onChange={(v) => set(p, "services", v === "mine")} on={sel.services} />,{" "}
				<Slot label="Mood" value={sel.mood ?? ""} options={S_MOOD} onChange={(v) => set(p, "mood", (v || null) as Mood | null)} on={!!sel.mood} />,{" "}
				<Slot label="Genre" value={sel.genre ?? ""} options={genres} onChange={(v) => set(p, "genre", v || null)} on={!!sel.genre} />,{" "}
				<Slot label="Order" value={sel.by} options={S_BY} onChange={(v) => set(p, "by", v as By)} on={sel.by !== "mine"} />.
			</p>
		</div>
	)
}

// ============================================================ 2. Chips

function Chip({ on, onClick, children, className = "" }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={on}
			className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-white ${on ? "bg-white text-black" : "bg-white/10 text-gray-100 hover:bg-white/20"} ${className}`}
		>
			{on && <CheckIcon className="h-4 w-4" />}
			{children}
		</button>
	)
}

const ROW = "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:px-0"

function FilterChips(p: SelProps) {
	const { sel } = p
	return (
		<div className={ROW}>
			<Chip on={sel.services} onClick={() => set(p, "services", !sel.services)}>
				On my services
			</Chip>
			<Chip on={sel.kind === "movie"} onClick={() => set(p, "kind", sel.kind === "movie" ? "all" : "movie")}>
				Films
			</Chip>
			<Chip on={sel.kind === "show"} onClick={() => set(p, "kind", sel.kind === "show" ? "all" : "show")}>
				Shows
			</Chip>
			<Chip on={sel.length === "short"} onClick={() => set(p, "length", sel.length === "short" ? "any" : "short")}>
				Short
			</Chip>
			<Chip on={sel.length === "long"} onClick={() => set(p, "length", sel.length === "long" ? "any" : "long")}>
				Long
			</Chip>
			<span className="mx-1 hidden w-px self-stretch bg-white/10 md:block" />
			{MOODS.map((m) => (
				<Chip key={m} on={sel.mood === m} onClick={() => set(p, "mood", sel.mood === m ? null : m)}>
					{MOOD_LABEL[m]}
				</Chip>
			))}
			<span className="mx-1 hidden w-px self-stretch bg-white/10 md:block" />
			{p.genres.map((g) => (
				<Chip key={g} on={sel.genre === g} onClick={() => set(p, "genre", sel.genre === g ? null : g)}>
					{g}
				</Chip>
			))}
		</div>
	)
}

export function ChipsSel(p: SelProps) {
	const n = tests(p.sel).length
	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
				<h2 className={`${DISPLAY} text-3xl text-white md:text-4xl`}>What's it going to be?</h2>
				{n > 0 && (
					<button type="button" onClick={() => p.setSel({ ...p.sel, ...ANY, by: p.sel.by })} className="self-start text-sm font-semibold text-amber-300 hover:underline cursor-pointer md:self-auto">
						Clear {n} {n === 1 ? "filter" : "filters"}
					</button>
				)}
			</div>
			<div className={ROW} role="radiogroup" aria-label="Order">
				{ORDERS.map((o) => (
					<button
						key={o.key}
						type="button"
						role="radio"
						aria-checked={p.sel.by === o.key}
						onClick={() => set(p, "by", o.key)}
						title={o.note}
						className={`h-10 shrink-0 rounded-full border-2 px-4 text-sm font-bold cursor-pointer ${p.sel.by === o.key ? "border-amber-400 bg-amber-400 text-black" : "border-white/15 text-white hover:border-white/40"}`}
					>
						{o.label}
					</button>
				))}
			</div>
			<FilterChips {...p} />
		</div>
	)
}

// ============================================================ 3. Compact bar

function Pick({ label, value, options, onChange }: { label: string; value: string; options: { key: string; label: string }[]; onChange: (v: string) => void }) {
	const on = value !== options[0].key
	return (
		<span className="relative shrink-0">
			<select
				aria-label={label}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={`field-sizing-content h-9 cursor-pointer appearance-none rounded-lg border pl-3 pr-8 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white ${on ? "border-amber-400 bg-amber-400 text-black" : "border-white/15 bg-gray-900 text-gray-100 hover:border-white/40"}`}
			>
				{options.map((o) => (
					<option key={o.key} value={o.key} className="bg-gray-900 text-white">
						{o.label}
					</option>
				))}
			</select>
			<ChevronDownIcon className={`pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${on ? "text-black" : "text-gray-400"}`} />
		</span>
	)
}

export function BarSel(p: SelProps) {
	const { sel } = p
	return (
		<div className="flex flex-col gap-2 py-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-3">
			<div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
				<div className="inline-flex rounded-lg bg-white/10 p-1" role="radiogroup" aria-label="Order">
					{ORDERS.map((o) => (
						<button
							key={o.key}
							type="button"
							role="radio"
							aria-checked={sel.by === o.key}
							onClick={() => set(p, "by", o.key)}
							title={o.note}
							className={`relative h-8 shrink-0 whitespace-nowrap rounded-md px-2.5 text-sm font-semibold cursor-pointer ${sel.by === o.key ? "text-black" : "text-gray-300 hover:text-white"}`}
						>
							{sel.by === o.key && <motion.span layoutId="bar-seg" className="absolute inset-0 rounded-md bg-white" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
							<span className="relative">{o.label}</span>
						</button>
					))}
				</div>
			</div>
			<div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
				<button
					type="button"
					aria-pressed={sel.services}
					onClick={() => set(p, "services", !sel.services)}
					className={`h-9 shrink-0 rounded-lg border px-3 text-sm font-semibold cursor-pointer ${sel.services ? "border-amber-400 bg-amber-400 text-black" : "border-white/15 text-gray-100 hover:border-white/40"}`}
				>
					On my services
				</button>
				<Pick label="Films or shows" value={sel.kind} options={[{ key: "all", label: "Type" }, ...KINDS.slice(1)]} onChange={(v) => set(p, "kind", v as Sel["kind"])} />
				<Pick label="Length" value={sel.length} options={[{ key: "any", label: "Length" }, ...LENGTHS.slice(1)]} onChange={(v) => set(p, "length", v as Sel["length"])} />
				<Pick label="Mood" value={sel.mood ?? ""} options={[{ key: "", label: "Mood" }, ...MOODS.map((m) => ({ key: m, label: MOOD_LABEL[m] }))]} onChange={(v) => set(p, "mood", (v || null) as Mood | null)} />
				<Pick label="Genre" value={sel.genre ?? ""} options={[{ key: "", label: "Genre" }, ...p.genres.map((g) => ({ key: g, label: g }))]} onChange={(v) => set(p, "genre", v || null)} />
			</div>
		</div>
	)
}

// ============================================================ 4. Mood dial

// A half dial: turn it to a mood. Length, services, and order sit beside it.
const DIAL: (Mood | null)[] = [null, "comfort", "escape", "binge", "thoughtful", "light"]
const DIAL_LABEL = (m: Mood | null) => (m ? MOOD_LABEL[m] : "Any mood")
// Geometry in viewBox units: the pivot sits at the bottom centre.
const VW = 544
const VH = 262
const CX = 272
const CY = 250
const R = 168
const RL = 212
const r2 = (n: number) => Math.round(n * 100) / 100

// The needle swings on a spring; its tip is computed from the angle so it always starts at the pivot.
function Needle({ deg }: { deg: number }) {
	const a = useSpring(deg, { stiffness: 200, damping: 16 })
	useEffect(() => a.set(deg), [deg])
	const x2 = useTransform(a, (d) => r2(CX + Math.cos(((d - 90) * Math.PI) / 180) * (R - 4)))
	const y2 = useTransform(a, (d) => r2(CY + Math.sin(((d - 90) * Math.PI) / 180) * (R - 4)))
	return <motion.line x1={CX} y1={CY} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth="7" strokeLinecap="round" />
}

export function DialSel(p: SelProps) {
	const { sel } = p
	const i = Math.max(0, DIAL.indexOf(sel.mood))
	const angle = (k: number) => -80 + k * 32
	const at = (k: number, r: number) => {
		const a = ((angle(k) - 90) * Math.PI) / 180
		return [r2(CX + Math.cos(a) * r), r2(CY + Math.sin(a) * r)]
	}
	return (
		<div className="flex flex-col items-center gap-4 md:flex-row md:items-end md:gap-10">
			<div className="relative aspect-[544/262] w-[21.5rem] shrink-0 md:w-[31rem]" role="radiogroup" aria-label="Mood">
				<svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
					<path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="30" strokeLinecap="round" />
					<path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="2" />
					{Array.from({ length: 31 }, (_, k) => {
						const a = ((-80 + k * (160 / 30) - 90) * Math.PI) / 180
						const r1 = k % 6 === 0 ? R - 16 : R - 8
						return <line key={k} x1={r2(CX + Math.cos(a) * r1)} y1={r2(CY + Math.sin(a) * r1)} x2={r2(CX + Math.cos(a) * (R + 6))} y2={r2(CY + Math.sin(a) * (R + 6))} stroke={k % 6 === 0 ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.22)"} strokeWidth={k % 6 === 0 ? 3 : 1.5} />
					})}
					<Needle deg={angle(i)} />
					<circle cx={CX} cy={CY} r="14" fill="#fbbf24" stroke="#111827" strokeWidth="6" />
				</svg>
				{DIAL.map((m, k) => {
					const [x, y] = at(k, RL)
					return (
						<button
							key={m ?? "any"}
							type="button"
							role="radio"
							aria-checked={k === i}
							onClick={() => set(p, "mood", m)}
							style={{ left: `${(x / VW) * 100}%`, top: `${(y / VH) * 100}%` }}
							className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold cursor-pointer md:px-3 md:text-sm ${k === i ? "bg-amber-400 text-black" : "bg-black/60 text-white/85 backdrop-blur hover:text-white"}`}
						>
							{DIAL_LABEL(m)}
						</button>
					)
				})}
			</div>
			<div className="flex w-full flex-wrap justify-center gap-2 md:w-auto md:flex-col md:items-start md:justify-start">
				<div className="inline-flex rounded-full bg-black/50 p-1 backdrop-blur" role="radiogroup" aria-label="Length">
					{(
						[
							["any", "Any length"],
							["short", "Short"],
							["long", "Long"],
						] as const
					).map(([k, l]) => (
						<button key={k} type="button" role="radio" aria-checked={sel.length === k} onClick={() => set(p, "length", k)} className={`h-8 rounded-full px-3 text-sm font-semibold cursor-pointer ${sel.length === k ? "bg-white text-black" : "text-gray-200 hover:text-white"}`}>
							{l}
						</button>
					))}
				</div>
				<div className="flex flex-wrap justify-center gap-2">
					<button
						type="button"
						aria-pressed={sel.services}
						onClick={() => set(p, "services", !sel.services)}
						className={`h-10 rounded-full px-4 text-sm font-semibold cursor-pointer ${sel.services ? "bg-white text-black" : "bg-black/50 text-gray-100 backdrop-blur hover:bg-black/70"}`}
					>
						On my services
					</button>
					<select
						aria-label="Order"
						value={sel.by}
						onChange={(e) => set(p, "by", e.target.value as By)}
						className={`field-sizing-content h-10 cursor-pointer appearance-none rounded-full px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white ${sel.by !== "mine" ? "bg-white text-black" : "bg-black/50 text-gray-100 backdrop-blur"}`}
					>
						{ORDERS.map((o) => (
							<option key={o.key} value={o.key} className="bg-gray-900 text-white">
								{o.label}
							</option>
						))}
					</select>
				</div>
			</div>
		</div>
	)
}

// ============================================================ 5. Evenings to pick from

// Ready-made evenings, each a whole selection. Each card shows the title it would put in the hero.
const PRESETS: { key: string; label: string; sel: Sel }[] = [
	{ key: "any", label: "My order", sel: ANY },
	{ key: "quick", label: "A quick one", sel: { ...ANY, by: "short", services: true, length: "short" } },
	{ key: "film", label: "Film night", sel: { ...ANY, by: "match", services: true, kind: "movie" } },
	{ key: "binge", label: "Something to binge", sel: { ...ANY, by: "tonight", kind: "show", mood: "binge" } },
	{ key: "comfort", label: "Comfort", sel: { ...ANY, by: "tonight", mood: "comfort" } },
	{ key: "think", label: "Something to think about", sel: { ...ANY, by: "match", mood: "thoughtful" } },
	{ key: "leaving", label: "Before it leaves", sel: { ...ANY, by: "leaving", services: true } },
	{ key: "oldest", label: "Oldest wishes", sel: { ...ANY, by: "oldest" } },
]

export function PresetsSel(p: SelProps) {
	const [adjust, setAdjust] = useState(false)
	const cards = useMemo(
		() =>
			PRESETS.map((x) => {
				const v = apply(p.q, x.sel, "soft")
				const fits = v.need ? v.keys.filter((k) => v.fit.get(k) === v.need).length : v.keys.length
				return { ...x, top: fits ? p.q.T(v.keys[0]) : suggestFor(p.q, x.sel), fits }
			}),
		[p.q.order],
	)
	const current = cards.find((c) => JSON.stringify(c.sel) === JSON.stringify(p.sel))?.key ?? null
	return (
		<div className="space-y-4">
			<div className="flex items-end justify-between gap-3">
				<h2 className={`${DISPLAY} text-3xl text-white md:text-4xl`}>What kind of evening?</h2>
				<button
					type="button"
					onClick={() => setAdjust(!adjust)}
					aria-expanded={adjust}
					className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold cursor-pointer ${adjust || (!current && !isDefault(p.sel)) ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
				>
					<AdjustmentsHorizontalIcon className="h-4 w-4" />
					Adjust
				</button>
			</div>
			<div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-8 lg:px-0">
				{cards.map((c) => {
					const on = current === c.key
					return (
						<button
							key={c.key}
							type="button"
							aria-pressed={on}
							onClick={() => p.setSel(c.sel)}
							className={`group relative w-32 shrink-0 snap-start overflow-hidden rounded-xl border-4 text-left cursor-pointer lg:w-auto ${on ? "border-amber-400" : "border-gray-800 hover:border-amber-700/50"}`}
						>
							{c.top ? <img src={posterUrl(c.top, "w185")} alt="" className={`aspect-[2/3] w-full object-cover ${c.fits ? "" : "opacity-50 grayscale"}`} /> : <div className="aspect-[2/3] w-full bg-white/5" />}
							<div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
							<div className="absolute inset-x-0 bottom-0 p-2.5">
								<p className="text-sm font-bold leading-tight text-white">{c.label}</p>
								<p className="mt-0.5 text-xs text-gray-300">{c.fits ? `${c.fits} on your Wishlist` : "None on your Wishlist"}</p>
							</div>
						</button>
					)
				})}
			</div>
			{adjust && (
				<motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:p-4">
					<div className={ROW} role="radiogroup" aria-label="Order">
						{ORDERS.map((o) => (
							<Chip key={o.key} on={p.sel.by === o.key} onClick={() => set(p, "by", o.key)}>
								{o.label}
							</Chip>
						))}
					</div>
					<FilterChips {...p} />
				</motion.div>
			)}
		</div>
	)
}
