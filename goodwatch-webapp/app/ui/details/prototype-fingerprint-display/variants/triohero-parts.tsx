// PROTOTYPE - throwaway.
// Shared bits for triohero, triosplit and triocinema: area selection, composed headlines, reserved-height swaps, highlighted sliders, detail panes.
import { type ReactNode, useState } from "react"
import { Link } from "@remix-run/react"
import { DriverBars, HEX, type Pillar, PILLARS } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { GROUPS, type Pair, TWO_POLE, pickPairs } from "./bandsliders-parts"
import { AREA_SCALES, type Scale, reading } from "./slidestrip-parts"
import { TraitChip, goodFor, topTraits } from "./strip-parts"
import { type Key, type Scores, areaOf } from "./versus-parts"

export type Media = MovieResult | ShowResult

// One word per area and tier, the same words the area sliders use, so band, sliders and details agree.
// Heart's "Light" would read the same as Humor's "Light", so it says "Reserved".
export const areaWord = (p: Pillar, tier: number) => (p === "Heart" && tier === 1 ? "Reserved" : AREA_SCALES[p].words[tier])
const SHORT: Record<string, string> = { "High energy": "High", "Deeply emotional": "Deep", "Fully immersive": "Vivid", "Big heart": "Big heart", "A touch": "A touch" }
const PHONE: Record<string, string> = { Relentless: "Intense", Masterful: "Superb", "Some heart": "Some", "Big heart": "Big", Background: "Faint", "Very funny": "Riotous", Immersive: "Rich" }
// Shorter words for the band, and shorter still for phones.
export const bandWord = (p: Pillar, tier: number) => SHORT[areaWord(p, tier)] ?? areaWord(p, tier)
export const phoneWord = (p: Pillar, tier: number) => PHONE[areaWord(p, tier)] ?? bandWord(p, tier)

// --- Selection: one area or none; tap again, Escape or "All" clears ---

export function useArea() {
	const [sel, setSel] = useState<Pillar | null>(null)
	const [hover, setHover] = useState<Pillar | null>(null)
	return {
		sel,
		hover,
		focus: sel ?? hover,
		setHover,
		pick: (p: Pillar) => setSel((cur) => (cur === p ? null : p)),
		clear: () => setSel(null),
		onKeyDown: (e: React.KeyboardEvent) => {
			if (e.key === "Escape" && sel) {
				e.stopPropagation()
				setSel(null)
			}
		},
	}
}
export type AreaState = ReturnType<typeof useArea>

// Mouse-only hover handlers, so a tap on a phone doesn't leave a sticky hover behind.
export const hoverProps = (a: AreaState, p: Pillar) => ({
	onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && a.setHover(p),
	onPointerLeave: (e: React.PointerEvent) => e.pointerType === "mouse" && a.setHover(null),
	onFocus: () => a.setHover(p),
	onBlur: () => a.setHover(null),
})

// --- Words ---

const FEEL: Partial<Record<Key, { adj: string; strong: string }>> = {
	adrenaline: { adj: "thrilling", strong: "pulse-pounding" },
	tension: { adj: "tense", strong: "nerve-racking" },
	scare: { adj: "scary", strong: "terrifying" },
	violence: { adj: "violent", strong: "brutal" },
	romance: { adj: "romantic", strong: "deeply romantic" },
	wholesome: { adj: "wholesome", strong: "heartwarming" },
	wonder: { adj: "wondrous", strong: "awe-inspiring" },
	pathos: { adj: "moving", strong: "deeply moving" },
	melancholy: { adj: "melancholic", strong: "bittersweet" },
	uncanny: { adj: "eerie", strong: "unsettling" },
	nostalgia: { adj: "nostalgic", strong: "nostalgic" },
	hopefulness: { adj: "hopeful", strong: "uplifting" },
	bleakness: { adj: "bleak", strong: "bleak" },
	slow_burn: { adj: "slow-burning", strong: "slow-burning" },
	fast_pace: { adj: "fast-paced", strong: "breakneck" },
	intrigue: { adj: "intriguing", strong: "gripping" },
	complexity: { adj: "layered", strong: "intricate" },
	ambiguity: { adj: "ambiguous", strong: "open-ended" },
	surrealism: { adj: "surreal", strong: "dreamlike" },
	eccentricity: { adj: "quirky", strong: "eccentric" },
	philosophical: { adj: "philosophical", strong: "philosophical" },
	psychedelic: { adj: "trippy", strong: "psychedelic" },
	camp_and_irony: { adj: "campy", strong: "campy" },
	psychological: { adj: "psychological", strong: "psychological" },
	dark_humor: { adj: "darkly funny", strong: "pitch-black funny" },
	wit_wordplay: { adj: "witty", strong: "witty" },
	absurdist_humor: { adj: "absurd", strong: "absurd" },
	satire_parody: { adj: "satirical", strong: "satirical" },
}
// Common to most good titles, so they say little in a headline.
const GENERIC = new Set<Key>(["intrigue", "complexity", "ambiguity", "fast_pace", "wonder"])
// Where a word's color comes from when the trait's own area would mislead.
const COLOR_OF: Partial<Record<Key, Pillar>> = { bleakness: "Heart", psychological: "World", philosophical: "Craft" }
export const colorArea = (k: Key): Pillar => COLOR_OF[k] ?? areaOf(k)

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// A plain phrase per area and tier, for the area headline.
export const AREA_PHRASE: Record<Pillar, string[]> = {
	Energy: ["Calm", "Low-key energy", "Steady energy", "High energy", "Relentless energy"],
	Heart: ["Emotionally cool", "Emotionally reserved", "Some heart", "A big heart", "Deeply emotional"],
	Humor: ["Serious", "A touch of humor", "Lightly funny", "Funny", "Very funny"],
	World: ["A background world", "A simple world", "A solid world", "An immersive world", "A fully immersive world"],
	Craft: ["Rough craft", "Plain craft", "Solid craft", "Strong craft", "Masterful craft"],
	Style: ["A plain look", "A modest look", "A clean look", "A striking look", "A stunning look"],
}

// Genres that work as a noun on their own, in order of how much they say.
const GENRE_NOUN: [string, string][] = [
	["Horror", "horror movie"],
	["Western", "western"],
	["Documentary", "documentary"],
	["Comedy", "comedy"],
	["Thriller", "thriller"],
	["Drama", "drama"],
]
const GENRE_ADJ: [string, string][] = [
	["Science Fiction", "sci-fi"],
	["Sci-Fi & Fantasy", "sci-fi"],
	["Crime", "crime"],
	["Fantasy", "fantasy"],
	["Mystery", "mystery"],
	["War", "war"],
	["Romance", "romantic"],
	["Music", "music"],
	["Action", "action"],
	["Adventure", "adventure"],
	["Family", "family"],
]

function genrePhrase(t: F.TitleInput) {
	const g = t.genres
	const show = t.mediaType === "show"
	const anim = g.includes("Animation")
	const adj = GENRE_ADJ.find(([x]) => g.includes(x))?.[1]
	const nounG = GENRE_NOUN.find(([x]) => g.includes(x))?.[1]
	const base = show ? "series" : t.fingerprint.pillars.Energy >= 4 && !anim ? "ride" : "movie"
	if (anim) return `animated ${nounG && !show ? nounG : base}`
	if (adj) return `${adj} ${base}`
	if (nounG) return show ? `${nounG.replace(" movie", "")} series` : nounG
	return base
}

export type Seg = { text: string; area?: Pillar; muted?: boolean }

const pairWords = (p: Pair): Seg[] => {
	const a = p.a.charAt(0) === "A" && p.a.charAt(1) === " " ? p.a : p.a.toLowerCase()
	if (p.conj === "not") return [{ text: a }, { text: p.b.startsWith("a ") ? ` but not ${p.b}` : ` but never ${p.b}`, muted: true }]
	return [{ text: a }, { text: ` ${p.conj} ${p.b}` }]
}

// The whole fingerprint in one sentence, words colored by area. For example
// "A relentless, philosophical sci-fi ride: stunning to look at, tense but never scary, only lightly funny."
export function wholeHeadline(t: F.TitleInput, media: Media): Seg[] {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	const hl = ((media.fingerprint as { highlightKeys?: string[] } | null)?.highlightKeys ?? []) as Key[]
	const [pair] = pickPairs(s, 4).filter((x) => !(x.p.a === "Feel-good" && tiers.Heart < 3))
	const pairKeys = pair ? [pair.hi, pair.other] : []

	// Lead: up to two adjectives from different areas, with relentless energy first.
	const lead: { text: string; area: Pillar }[] = []
	if (tiers.Energy >= 4) lead.push({ text: "relentless", area: "Energy" })
	const cands = (Object.keys(FEEL) as Key[])
		.filter((k) => s[k] >= 7 && !pairKeys.includes(k) && !(lead.length && k === "fast_pace"))
		.map((k) => ({ k, w: s[k] + (hl.includes(k) ? 1 : 0) - (GENERIC.has(k) ? 1.5 : 0) }))
		.sort((a, b) => b.w - a.w)
	const add = (sameOk: boolean) => {
		for (const { k } of cands) {
			if (lead.length >= 2) return
			const area = colorArea(k)
			const text = s[k] >= 9 ? FEEL[k]!.strong : FEEL[k]!.adj
			if (lead.some((x) => x.text === text || text.includes(x.text))) continue
			if (!sameOk && lead.some((x) => x.area === area)) continue
			lead.push({ text, area })
		}
	}
	add(false)
	add(true)

	const out: Seg[] = []
	const g = genrePhrase(t)
	const first = lead[0]?.text ?? g
	out.push({ text: /^[aeiou]/i.test(first) ? "An " : "A " })
	lead.forEach((x, i) => {
		out.push(x)
		out.push({ text: i < lead.length - 1 ? ", " : " " })
	})
	out.push({ text: g })

	// Clauses: the look, one contrast, and the most telling of heart or humor.
	const clauses: Seg[][] = []
	const look = tiers.Style >= tiers.Craft ? "Style" : "Craft"
	if (tiers[look] >= 3) {
		const text =
			look === "Style" ? (tiers.Style >= 4 ? "stunning to look at" : "striking to look at") : tiers.Craft >= 4 ? "masterfully made" : "well made"
		clauses.push([{ text, area: look }])
	}
	if (pair) clauses.push(pairWords(pair.p).map((x, i) => (i === 0 ? { ...x, area: areaOf(pair.hi) } : x)))
	const heartWord = ["emotionally cool", "emotionally reserved", "", "warm-hearted", "deeply moving"][tiers.Heart]
	const humorWord = ["never played for laughs", "rarely funny", "only lightly funny", "often funny", "very funny"][tiers.Humor]
	const used = new Set(clauses.flat().map((x) => x.area).concat(lead.map((x) => x.area)))
	const heartFirst = (tiers.Heart <= 1 || tiers.Heart >= 4) && !(tiers.Humor >= 4 || tiers.Humor === 0)
	const tone: Seg[] = []
	if (heartFirst && heartWord) tone.push({ text: heartWord, area: "Heart" })
	else if (!used.has("Humor") || tiers.Humor >= 3) tone.push({ text: humorWord, area: "Humor" })
	else if (heartWord) tone.push({ text: heartWord, area: "Heart" })
	if (tone.length) clauses.push(tone)

	if (clauses.length) {
		out.push({ text: ": " })
		clauses.forEach((c, i) => {
			out.push(...c)
			if (i < clauses.length - 1) out.push({ text: i === clauses.length - 2 && clauses.length > 2 ? ", and " : clauses.length === 2 ? " and " : ", " })
		})
	}
	out.push({ text: "." })
	return out
}

// Lowercase the first letter only, so names in a verdict keep their capitals.
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const FALLBACK = new Set(["Calm and low-key", "Emotionally reserved", "Serious throughout", "Kept in the background", "Solid, not remarkable", "Functional look and sound"])

// Bold lines for one area: its verdict, then a contrast from its traits when there is one.
export function areaHeadline(t: F.TitleInput, p: Pillar): { lead: Seg[]; pair: { p: Pair; hi: Key } | null } {
	const tier = t.fingerprint.pillars[p]
	const b = F.pillarBrief(t, p)
	const phrase = AREA_PHRASE[p][tier]
	const lead: Seg[] = [{ text: phrase, area: p }]
	if (!FALLBACK.has(b.verdict)) {
		const v = lower(b.verdict)
		// A low tier with strong traits reads as a contrast: "Emotionally reserved, yet cathartic and moving."
		lead.push({ text: p === "World" ? ` built around ${v}.` : tier <= 1 ? `, yet ${v}.` : `: ${v}.` })
	} else lead.push({ text: "." })
	// Skip a contrast that repeats a word the first line already says ("Funny: ... Funny, but bittersweet.").
	const said = lead.map((x) => x.text).join(" ").toLowerCase()
	const pair = pickPairs(t.fingerprint.scores, 12).find((x) => areaOf(x.hi) === p && !said.includes(x.p.a.toLowerCase())) ?? null
	return { lead, pair: pair ? { p: pair.p, hi: pair.hi } : null }
}

export function Segs({ segs, mutedClass = "text-gray-500" }: { segs: Seg[]; mutedClass?: string }) {
	return (
		<>
			{segs.map((x, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static list
				<span key={i} className={x.muted ? mutedClass : x.area ? undefined : "text-white"} style={x.area ? { color: HEX[x.area] } : undefined}>
					{x.text}
				</span>
			))}
		</>
	)
}

// "Tense, not scary." for the second line of an area headline.
export function PairLine({ p, hi, className = "" }: { p: Pair; hi: Key; className?: string }) {
	return (
		<span className={className}>
			<span style={{ color: HEX[areaOf(hi)] }}>{p.a},</span>{" "}
			<span className={p.conj === "not" ? "text-gray-500" : "text-white"}>
				{p.conj} {p.b}.
			</span>
		</span>
	)
}

// --- Reserved-height swap: every pane sits in the same grid cell, so the box is as tall as the tallest one ---

export function Swap({ active, panes, className = "" }: { active: string; panes: { key: string; node: ReactNode }[]; className?: string }) {
	return (
		<div className={`grid ${className}`} aria-live="polite">
			{panes.map(({ key, node }) => {
				const on = key === active
				return (
					<div
						key={key}
						aria-hidden={!on}
						{...(on ? {} : ({ inert: "" } as object))}
						className={`min-w-0 [grid-area:1/1] motion-safe:transition-[opacity,transform] motion-safe:duration-300 motion-safe:ease-out ${
							on ? "opacity-100 [transform:none]" : "pointer-events-none translate-y-1.5 opacity-0"
						}`}
					>
						{node}
					</div>
				)
			})}
		</div>
	)
}

// The headline for nothing selected plus one per area, as panes for Swap.
export function headlinePanes(t: F.TitleInput, media: Media, opts: { lineClass?: string; pairClass?: string } = {}) {
	const whole = wholeHeadline(t, media)
	return [
		{ key: "all", node: <p className={opts.lineClass}><Segs segs={whole} /></p> },
		...PILLARS.map((p) => {
			const h = areaHeadline(t, p)
			return {
				key: p,
				node: (
					<p className={opts.lineClass}>
						<Segs segs={h.lead} />
						{h.pair && (
							<>
								{" "}
								<PairLine p={h.pair.p} hi={h.pair.hi} className={opts.pairClass} />
							</>
						)}
					</p>
				),
			}
		}),
	]
}

// --- Detail panes ---

export function AllDetails({ t, media, hint }: { t: F.TitleInput; media: Media; hint?: string }) {
	const good = goodFor(t, 3).shown
	return (
		<div>
			<p className="max-w-xl text-[15px] leading-relaxed text-gray-300">{F.summary(t)}</p>
			{good.length > 0 && (
				<p className="mt-3 text-sm text-gray-300">
					<span className="font-semibold text-emerald-200">Good for</span> {good.join(" · ").toLowerCase()}
				</p>
			)}
			<div className="mt-4 flex flex-wrap gap-1.5">
				{topTraits(t, media, 5).map((x) => (
					<TraitChip key={x.key} trait={x} size="xs" />
				))}
			</div>
			{hint && <p className="mt-4 text-xs text-gray-500">{hint}</p>}
		</div>
	)
}

export function AreaDetails({ t, p, title = true }: { t: F.TitleInput; p: Pillar; title?: boolean }) {
	const b = F.pillarBrief(t, p)
	const tier = t.fingerprint.pillars[p]
	return (
		<div>
			{title && (
				<p className="text-xs font-semibold uppercase tracking-[.12em]" style={{ color: HEX[p] }}>
					<span aria-hidden="true">{PILLAR_CONFIG[p].emoji} </span>
					{p} · {areaWord(p, tier)}
				</p>
			)}
			{b.note && <p className="mt-1.5 text-[15px] leading-relaxed text-gray-300">{b.note}</p>}
			<div className="mt-3 max-w-md">
				<p className="mb-1.5 text-xs text-gray-500">What drives it, out of 10</p>
				<DriverBars t={t} p={p} compact />
			</div>
			<AreaLinks t={t} p={p} className="mt-4" />
		</div>
	)
}

// "More like this": the Discover filter for the area plus at most two mood pages, so every area's pane stays short.
const FILTER_WORD: Record<number, string> = { 1: "low", 2: "medium", 3: "high" }
const cleanMood = (l: string) => l.replace(/\s*\p{Extended_Pictographic}.*$/u, "")
export function AreaLinks({ t, p, n = 2, className = "" }: { t: F.TitleInput; p: Pillar; n?: number; className?: string }) {
	const tier = t.fingerprint.pillars[p]
	const kind = t.mediaType === "movie" ? "movies" : "shows"
	const minTier = Math.min(3, tier)
	const moods = F.moodsForKeys(t, [...F.PILLAR_KEYS[p]]).slice(0, n)
	return (
		<div className={`flex flex-wrap gap-1.5 ${className}`}>
			{tier >= 2 && (
				<Link
					to={`/discover/${kind}?fingerprintPillars=${p}&fingerprintPillarMinTier=${minTier}`}
					className="rounded-full px-3 py-1 text-xs font-semibold text-black hover:brightness-110"
					style={{ background: HEX[p] }}
				>
					More {kind} with {FILTER_WORD[minTier]} {p.toLowerCase()}
				</Link>
			)}
			{moods.map((m) => (
				<Link key={m.url} to={m.url} className="rounded-full border border-white/20 px-3 py-1 text-xs hover:border-white/60 hover:bg-white/5">
					{cleanMood(m.label)} {kind}
				</Link>
			))}
		</div>
	)
}

export function detailPanes(t: F.TitleInput, media: Media, hint?: string, title = true) {
	return [{ key: "all", node: <AllDetails t={t} media={media} hint={hint} /> }, ...PILLARS.map((p) => ({ key: p, node: <AreaDetails t={t} p={p} title={title} /> }))]
}

// --- Sliders that light up for their area (nothing ever dims) ---

export function HiTrack({ sc, v, word, lit }: { sc: Scale; v: number; word: string; lit: boolean }) {
	const c = HEX[sc.area]
	const two = TWO_POLE.has(sc.name)
	const from = two ? 0.5 : 0
	const lo = Math.min(from, v)
	const hi = Math.max(from, v)
	return (
		<span role="img" aria-label={`${sc.name}: ${word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`} className="relative block h-1.5 rounded-full bg-white/[.07]">
			{two && <span aria-hidden="true" className="absolute -inset-y-0.5 left-1/2 w-px bg-white/20" />}
			<span
				aria-hidden="true"
				className="absolute inset-y-0 rounded-full"
				style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%`, background: `linear-gradient(${v >= from ? "90deg" : "270deg"}, color-mix(in srgb, ${c} 10%, transparent), color-mix(in srgb, ${c} 55%, transparent))` }}
			/>
			{/* Brighter fill when lit, faded in on top. */}
			<span
				aria-hidden="true"
				className={`absolute inset-y-0 rounded-full transition-opacity duration-200 ${lit ? "opacity-100" : "opacity-0"}`}
				style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%`, background: `linear-gradient(${v >= from ? "90deg" : "270deg"}, color-mix(in srgb, ${c} 25%, transparent), ${c})`, boxShadow: `0 0 10px color-mix(in srgb, ${c} 45%, transparent)` }}
			/>
			<span aria-hidden="true" className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2" style={{ left: `calc(7px + ${v} * (100% - 14px))` }}>
				<span className={`absolute -inset-2 rounded-full transition-opacity duration-200 ${lit ? "opacity-100" : "opacity-0"}`} style={{ background: `radial-gradient(circle, color-mix(in srgb, ${c} 55%, transparent), transparent 70%)` }} />
				<span className="absolute inset-0 rounded-full ring-[3px] ring-stone-950" style={{ background: c, boxShadow: `0 0 0 5px color-mix(in srgb, ${c} 18%, transparent)` }} />
			</span>
		</span>
	)
}

export function HiSlider({ sc, t, a, compact = false }: { sc: Scale; t: F.TitleInput; a: AreaState; compact?: boolean }) {
	const r0 = reading(sc, t)
	const r = AREA_SCALES[sc.area] === sc ? { ...r0, word: areaWord(sc.area, t.fingerprint.pillars[sc.area]) } : r0
	const lit = a.focus === sc.area
	const on = a.sel === sc.area
	return (
		<li className="min-w-0">
			<button
				type="button"
				aria-pressed={on}
				data-th-scale={sc.name}
				{...hoverProps(a, sc.area)}
				onClick={() => a.pick(sc.area)}
				className={`relative -mx-2 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 text-left focus-visible:outline-2 focus-visible:outline-amber-300 ${compact ? "pb-2 pt-1" : "pb-2.5 pt-1.5"}`}
			>
				<span
					aria-hidden="true"
					className={`pointer-events-none absolute inset-0 rounded-lg transition-opacity duration-200 ${lit ? "opacity-100" : "opacity-0"}`}
					style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${HEX[sc.area]} 13%, transparent), color-mix(in srgb, ${HEX[sc.area]} 4%, transparent))`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${HEX[sc.area]} ${on ? 45 : 22}%, transparent)` }}
				/>
				<span className="relative flex flex-wrap items-baseline justify-between gap-x-3">
					<span className={`text-[13px] transition-colors duration-200 ${lit ? "text-white" : "text-gray-400"}`}>{sc.name}</span>
					<span className="text-sm font-semibold transition-colors duration-200" style={{ color: lit ? HEX[sc.area] : "#fff" }}>
						{r.word}
					</span>
				</span>
				<span className={`relative block ${compact ? "mt-1.5" : "mt-2"}`}>
					<HiTrack sc={sc} v={r.v} word={r.word} lit={lit} />
				</span>
			</button>
		</li>
	)
}

export const GROUP_HEAD = "mb-0.5 text-[11px] font-semibold uppercase tracking-[.12em] text-gray-500"

// The three slider groups in Trio's arrangement: Feel in one column, Story and Look in the other (phones: two columns of sliders).
export function SliderGroups({ t, a, compact = false, className = "" }: { t: F.TitleInput; a: AreaState; compact?: boolean; className?: string }) {
	const [feel, story, look] = GROUPS
	const mk = (sc: Scale) => <HiSlider key={sc.name} sc={sc} t={t} a={a} compact={compact} />
	return (
		<div className={`grid grid-cols-2 gap-x-6 ${compact ? "gap-y-2" : "gap-y-3"} sm:gap-x-8 ${className}`}>
			<section className="col-span-2 sm:col-span-1">
				<h3 className={GROUP_HEAD}>{feel.name}</h3>
				<ul className="grid grid-cols-2 gap-x-5 sm:grid-cols-1">{feel.scales.map(mk)}</ul>
			</section>
			<div className="col-span-2 grid grid-cols-2 gap-x-5 gap-y-3 sm:col-span-1 sm:grid-cols-1">
				<section className="col-span-2 sm:col-span-1">
					<h3 className={GROUP_HEAD}>{story.name}</h3>
					<ul className="grid grid-cols-2 items-end gap-x-5 sm:grid-cols-1">{story.scales.map(mk)}</ul>
				</section>
				<section className="col-span-2 sm:col-span-1">
					<h3 className={GROUP_HEAD}>{look.name}</h3>
					<ul className="grid grid-cols-2 gap-x-5 sm:grid-cols-1">{look.scales.map(mk)}</ul>
				</section>
			</div>
		</div>
	)
}

// "All" control: pressed when nothing is selected, so it never appears or disappears.
export function AllButton({ a, className = "" }: { a: AreaState; className?: string }) {
	const on = a.sel === null
	return (
		<button
			type="button"
			aria-pressed={on}
			data-th-all
			onClick={a.clear}
			className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
				on ? "border-white/25 bg-white/10 text-white" : "border-white/15 text-gray-400 hover:border-white/40 hover:text-white"
			} ${className}`}
		>
			All areas
		</button>
	)
}

// Band stripes, so the variants can reuse Barcode's texture.
export { areaStripes, shade } from "./bandsliders-parts"
export type { Scores }
