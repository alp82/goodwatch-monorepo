// PROTOTYPE - throwaway.
// Shared round 4 trio parts (trio2, triostage, triocompact): composed headline, area lines, no-dim band, glow sliders, in-place swap, area details.
// Other round 4 agents may import anything exported here (read-only; copy before changing).
import { Link } from "@remix-run/react"
import { XMarkIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { HEX, type Pillar, PILLARS } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import { GROUPS, TWO_POLE, areaStripes, pickPairs, shade, type Pair } from "./bandsliders-parts"
import { type Scale, reading } from "./slidestrip-parts"
import { AREA_WORD, type Key, areaOf } from "./versus-parts"

// --- Words ---

// Feel adjectives (copied from fingerprintText.ts, which doesn't export them). `strong` is used at 9+.
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
	uncanny: { adj: "eerie", strong: "deeply unsettling" },
	nostalgia: { adj: "nostalgic", strong: "nostalgic" },
	hopefulness: { adj: "hopeful", strong: "uplifting" },
	bleakness: { adj: "bleak", strong: "bleak" },
	slow_burn: { adj: "slow-burning", strong: "slow-burning" },
	fast_pace: { adj: "fast-paced", strong: "breakneck" },
	complexity: { adj: "layered", strong: "intricate" },
	ambiguity: { adj: "ambiguous", strong: "open-ended" },
	surrealism: { adj: "surreal", strong: "dreamlike" },
	eccentricity: { adj: "quirky", strong: "eccentric" },
	philosophical: { adj: "philosophical", strong: "philosophical" },
	spectacle: { adj: "spectacular", strong: "epic" },
	psychedelic: { adj: "trippy", strong: "psychedelic" },
	grotesque: { adj: "grotesque", strong: "grotesque" },
	camp_and_irony: { adj: "campy", strong: "gloriously campy" },
}

// Tone words read as heart in the headline.
const LEAD_AREA: Partial<Record<Key, Pillar>> = { bleakness: "Heart", hopefulness: "Heart" }
const leadArea = (k: Key) => LEAD_AREA[k] ?? areaOf(k)

// Area as a short phrase, by tier (0-4).
export const AREA_PHRASE: Record<Pillar, string[]> = {
	Energy: ["Calm", "Low-key", "Steady energy", "High energy", "Relentless energy"],
	Heart: ["Emotionally cool", "Emotionally reserved", "Some heart", "Big heart", "Deeply emotional"],
	Humor: ["No humor", "A touch of humor", "Light humor", "Funny", "Very funny"],
	World: ["A thin world", "A simple world", "A solid world", "A rich world", "A fully immersive world"],
	Craft: ["Rough craft", "Plain craft", "Solid craft", "Strong craft", "Masterful craft"],
	Style: ["Plain style", "Modest style", "Clean style", "Striking style", "Stunning style"],
}

const GENRE: [string, string][] = [
	["Science Fiction", "sci-fi"],
	["Animation", "animated"],
	["Horror", "horror"],
	["Crime", "crime"],
	["Fantasy", "fantasy"],
	["Thriller", "thriller"],
	["Comedy", "comedy"],
	["Romance", "romance"],
	["War", "war"],
	["Western", "western"],
	["Mystery", "mystery"],
	["Documentary", "documentary"],
	["Family", "family"],
	["Action", "action"],
	["Adventure", "adventure"],
	["Drama", "drama"],
]

function genreNoun(t: F.TitleInput) {
	const hit = GENRE.find(([g]) => t.genres.includes(g))?.[1]
	const kind = t.mediaType === "movie" ? "movie" : "series"
	if (!hit) return kind
	// "A nostalgic, eccentric comedy" reads better than "comedy movie".
	if (["comedy", "drama", "thriller", "western", "documentary"].includes(hit) && t.mediaType === "movie") return hit
	return `${hit} ${kind}`
}

// --- Headline segments ---

export type Seg = { text: string; area?: Pillar; tone?: "muted" | "white" }

const isComedy = (t: F.TitleInput) => t.genres.includes("Comedy") || t.genres.includes("Animation") || t.genres.includes("Family")

function pairSegs(p: Pair, hi: Key, lead: "headline" | "line"): Seg[] {
	const area = areaOf(hi)
	if (lead === "line") {
		return [
			{ text: `${p.a},`, area },
			{ text: ` ${p.conj} ${p.b}.`, tone: p.conj === "not" ? "muted" : "white" },
		]
	}
	const a = p.a.toLowerCase()
	if (p.conj === "not") return [{ text: a, area }, { text: ` but never ${p.b}`, tone: "muted" }]
	return [{ text: a, area }, { text: ` ${p.conj} ${p.b}`, tone: "white" }]
}

// The whole fingerprint in one bold sentence, words colored by area, e.g.
// "A relentless, philosophical sci-fi movie: stunning to look at, thrilling but never gory, only lightly funny."
export function composeHeadline(t: F.TitleInput): Seg[] {
	const s = t.fingerprint.scores
	const tier = t.fingerprint.pillars
	const used = new Set<Key>()
	const touched = new Set<Pillar>()

	// Two lead adjectives: "relentless" when energy is at the top, then the strongest feel words, preferring a new area.
	const lead: Seg[] = []
	if (tier.Energy === 4) {
		lead.push({ text: "relentless", area: "Energy" })
		touched.add("Energy")
	}
	const cands = (Object.keys(FEEL) as Key[])
		.filter((k) => s[k] >= 7 && k !== "spectacle")
		.sort((a, b) => s[b] - s[a] || tier[leadArea(b)] - tier[leadArea(a)])
	const pickLead = (fresh: boolean) => {
		for (const k of cands) {
			if (lead.length >= 2) return
			if (used.has(k) || (fresh && touched.has(leadArea(k)))) continue
			const w = s[k] >= 9 ? FEEL[k]!.strong : FEEL[k]!.adj
			if (lead.some((x) => x.text === w)) continue
			lead.push({ text: w, area: leadArea(k) })
			used.add(k)
			touched.add(leadArea(k))
		}
	}
	pickLead(true)
	pickLead(false)

	const segs: Seg[] = []
	const first = lead[0]?.text ?? genreNoun(t)
	segs.push({ text: /^[aeiou]/i.test(first) ? "An " : "A ", tone: "white" })
	lead.forEach((x, i) => {
		segs.push(x)
		segs.push({ text: i < lead.length - 1 ? ", " : " ", tone: "white" })
	})
	segs.push({ text: genreNoun(t), tone: "white" })

	// Up to three clauses: look, one contrast, then heart or humor.
	const clauses: Seg[][] = []
	const look: Seg[] =
		tier.Style === 4 && tier.Craft === 4
			? [{ text: "stunning", area: "Style" }, { text: " and ", tone: "white" }, { text: "masterfully made", area: "Craft" }]
			: tier.Style === 4
				? [{ text: "stunning to look at", area: "Style" }]
				: tier.Craft === 4
					? [{ text: "masterfully made", area: "Craft" }]
					: tier.Style === 3
						? [{ text: "striking to look at", area: "Style" }]
						: tier.Craft === 3
							? [{ text: "well made", area: "Craft" }]
							: []
	if (look.length) clauses.push(look)

	const pair = pickPairs(s, 12).find(({ p, hi, other }) => !used.has(hi) && !used.has(other) && !p.a.startsWith("A "))
	if (pair) {
		clauses.push(pairSegs(pair.p, pair.hi, "headline"))
		touched.add(areaOf(pair.hi))
		touched.add(areaOf(pair.other))
	}

	const heart: Seg | null =
		tier.Heart <= 1 ? { text: "emotionally reserved", area: "Heart" } : tier.Heart === 3 ? { text: "big-hearted", area: "Heart" } : tier.Heart === 4 ? { text: "deeply moving", area: "Heart" } : null
	const humorWords = isComedy(t)
		? ["with no jokes", "with a touch of humor", "with light humor", "often funny", "very funny"]
		: ["never funny", "rarely funny", "only lightly funny", "often funny", "very funny"]
	const humor: Seg | null =
		t.genres.includes("Comedy") && tier.Humor >= 3
			? null
			: tier.Humor <= 2 && s.dark_humor >= 7
				? { text: "darkly funny at times", area: "Humor" }
				: { text: humorWords[tier.Humor], area: "Humor" }
	const soft = [
		{ p: "Heart" as Pillar, seg: heart },
		{ p: "Humor" as Pillar, seg: humor },
	]
		.filter((x) => x.seg && !touched.has(x.p))
		.sort((a, b) => Math.abs(tier[b.p] - 2) - Math.abs(tier[a.p] - 2) || tier[a.p] - tier[b.p])
	if (soft[0]?.seg) clauses.push([soft[0].seg])

	if (clauses.length) {
		segs.push({ text: ": ", tone: "white" })
		clauses.forEach((c, i) => {
			segs.push(...c)
			if (i < clauses.length - 1) segs.push({ text: ", ", tone: "white" })
		})
	}
	segs.push({ text: ".", tone: "white" })
	return segs
}

// Bold lines for one area: the area phrase, then up to two contrast lines from its traits, else its verdict.
export function areaLines(t: F.TitleInput, p: Pillar, max = 3): Seg[][] {
	const s = t.fingerprint.scores
	const lines: Seg[][] = [[{ text: `${AREA_PHRASE[p][t.fingerprint.pillars[p]]}.`, area: p }]]
	const pairs = pickPairs(s, 12).filter(({ hi }) => areaOf(hi) === p)
	for (const x of pairs.slice(0, max - 1)) lines.push(pairSegs(x.p, x.hi, "line"))
	if (lines.length === 1) {
		const v = F.pillarBrief(t, p).verdict
		// World verdicts are bare theme lists ("Family"), which need a frame to read as a line.
		const text = p === "World" && t.fingerprint.pillars.World >= 1 && !v.startsWith("Kept") ? `Built around ${v.charAt(0).toLowerCase()}${v.slice(1)}` : v
		lines.push([{ text: `${text}.`, tone: "white" }])
	}
	return lines
}

// Sliders that belong to an area.
export const ALL_SCALES: Scale[] = GROUPS.flatMap((g) => g.scales)
export const scalesOf = (p: Pillar) => ALL_SCALES.filter((sc) => sc.area === p)

// --- Selection state: hover highlights, tap selects, tap again / Escape / reset returns to all ---

export function useAreaSelection() {
	const [sel, setSel] = useState<Pillar | null>(null)
	const [hover, setHover] = useState<Pillar | null>(null)
	useEffect(() => {
		if (!sel) return
		const key = (e: KeyboardEvent) => e.key === "Escape" && setSel(null)
		document.addEventListener("keydown", key)
		return () => document.removeEventListener("keydown", key)
	}, [sel])
	return {
		sel,
		hover,
		// What to highlight: the hovered area, else the selected one.
		hot: hover ?? sel,
		setHover,
		pick: (p: Pillar) => setSel((cur) => (cur === p ? null : p)),
		reset: () => setSel(null),
	}
}
export type AreaSelection = ReturnType<typeof useAreaSelection>

const hoverProps = (x: AreaSelection, p: Pillar) => ({
	onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && x.setHover(p),
	onPointerLeave: (e: React.PointerEvent) => e.pointerType === "mouse" && x.setHover(null),
	// Keyboard focus highlights like hover; a tap's focus doesn't, or the highlight would stick after the tap.
	onFocus: (e: React.FocusEvent) => e.currentTarget.matches(":focus-visible") && x.setHover(p),
	onBlur: () => x.setHover(null),
})

// --- In-place swap: every pane sits in the same grid cell, so the cell is always as tall as the tallest pane. ---

export function Swap({ active, panes, className = "" }: { active: string; panes: { id: string; label?: string; node: ReactNode }[]; className?: string }) {
	const ref = useRef<HTMLDivElement>(null)
	// If focus was inside a pane that just hid, move it to the new pane so keyboard users don't land in nothing.
	useEffect(() => {
		const root = ref.current
		const a = document.activeElement
		if (!root || !a || !root.contains(a)) return
		const pane = a.closest("[data-pane]")
		if (pane && pane.getAttribute("data-pane") !== active) root.querySelector<HTMLElement>(`[data-pane="${active}"]`)?.focus({ preventScroll: true })
	}, [active])
	return (
		<div ref={ref} className={`grid ${className}`}>
			{panes.map((x) => {
				const on = x.id === active
				return (
					<div
						key={x.id}
						data-pane={x.id}
						tabIndex={-1}
						role={x.label ? "region" : undefined}
						aria-label={x.label}
						aria-hidden={!on}
						{...(on ? {} : { inert: "" })}
						className={`min-w-0 outline-none [grid-area:1/1] motion-safe:transition-[opacity,transform,visibility] motion-safe:duration-300 motion-safe:ease-out ${
							on ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-1 opacity-0"
						}`}
					>
						{x.node}
					</div>
				)
			})}
		</div>
	)
}

// --- Headline text ---

export function Headline({ segs, x, className = "" }: { segs: Seg[]; x: AreaSelection; className?: string }) {
	return (
		<p className={`font-bold tracking-tight text-pretty ${className}`}>
			{segs.map((g, i) =>
				g.area ? (
					<button
						key={i}
						type="button"
						{...hoverProps(x, g.area)}
						onClick={() => x.pick(g.area!)}
						aria-label={`${g.text}: show ${g.area.toLowerCase()} details`}
						className="inline cursor-pointer rounded-sm text-left decoration-2 underline-offset-[.18em] focus-visible:outline-2 focus-visible:outline-amber-300"
						style={{ color: HEX[g.area], textDecorationLine: x.hover === g.area ? "underline" : "none", textDecorationColor: `color-mix(in srgb, ${HEX[g.area]} 55%, transparent)` }}
					>
						{g.text}
					</button>
				) : (
					<span key={i} className={g.tone === "muted" ? "text-gray-500" : "text-white"}>
						{g.text}
					</span>
				),
			)}
		</p>
	)
}

export function Lines({ lines, x, className = "" }: { lines: Seg[][]; x: AreaSelection; className?: string }) {
	return (
		<div className={className}>
			{lines.map((l, i) => (
				<Headline key={i} segs={l} x={x} />
			))}
		</div>
	)
}

// --- Band: no dimming; hover glows the segment, selection adds a ring, a lift and a colored label. ---

export function TrioBand({
	t,
	x,
	height = "h-4 sm:h-[18px]",
	labels = "names",
}: {
	t: F.TitleInput
	x: AreaSelection
	height?: string
	labels?: "names" | "words" | "none"
}) {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	return (
		<div className="flex gap-[3px]" role="group" aria-label="Fingerprint areas">
			{PILLARS.map((p, i) => {
				const on = x.sel === p
				const hot = x.hover === p
				const round = `${i === 0 ? "rounded-l-full" : "rounded-l-[3px]"} ${i === PILLARS.length - 1 ? "rounded-r-full" : "rounded-r-[3px]"}`
				return (
					<button
						key={p}
						type="button"
						data-fp-area={p}
						aria-pressed={on}
						aria-label={`${p}: ${AREA_WORD[p][tiers[p]].toLowerCase()}. ${on ? "Showing details, press again for all areas" : "Show details"}`}
						{...hoverProps(x, p)}
						onClick={() => x.pick(p)}
						className="group flex min-w-[2.5rem] cursor-pointer flex-col pt-1 text-left focus-visible:outline-none"
						style={{ flex: `${tiers[p] + 1.5} 1 0%` }}
					>
						<span className={`relative block w-full transition-transform duration-200 ease-out ${on ? "-translate-y-[3px]" : hot ? "-translate-y-px" : ""}`}>
							<span aria-hidden="true" className={`relative flex w-full overflow-hidden ${height} ${round}`}>
								{areaStripes(p, s, t.title).map((st) => (
									<span key={st.id} className="h-full" style={{ flex: `${st.w} 1 0%`, background: shade(HEX[p], st.b) }} />
								))}
								<span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.14),transparent_45%,rgba(0,0,0,.25))]" />
								{/* Hover brightens the stripes a touch. */}
								<span
									className={`pointer-events-none absolute inset-0 bg-white/15 mix-blend-overlay transition-opacity duration-200 ${hot || on ? "opacity-100" : "opacity-0"}`}
								/>
							</span>
							{/* Glow and ring. */}
							<span
								aria-hidden="true"
								className={`pointer-events-none absolute -inset-[3px] ${round} transition-opacity duration-200 ${on ? "opacity-100" : hot ? "opacity-70" : "opacity-0"} group-focus-visible:opacity-100`}
								style={{ boxShadow: `0 0 0 1.5px ${on ? "rgba(255,255,255,.85)" : HEX[p]}, 0 0 18px -2px ${HEX[p]}` }}
							/>
						</span>
						{labels !== "none" && (
							<>
								<span
									className={`mt-2 block truncate text-xs transition-colors ${on ? "font-semibold" : ""} ${hot && !on ? "text-white" : on ? "" : "text-gray-400"}`}
									style={on ? { color: HEX[p] } : undefined}
								>
									<span aria-hidden="true" className="max-sm:hidden">
										{PILLAR_CONFIG[p].emoji}{" "}
									</span>
									{p}
								</span>
								{labels === "words" && (
									<span className={`block truncate text-[13px] font-semibold ${on || hot ? "text-white" : "text-gray-300"}`}>{AREA_WORD[p][tiers[p]]}</span>
								)}
							</>
						)}
					</button>
				)
			})}
		</div>
	)
}

// --- Sliders with a related-highlight instead of dimming ---

export function GlowTrack({ sc, v, word, hot }: { sc: Scale; v: number; word: string; hot: boolean }) {
	const c = HEX[sc.area]
	const two = TWO_POLE.has(sc.name)
	const from = two ? 0.5 : 0
	const lo = Math.min(from, v)
	const hi = Math.max(from, v)
	const dir = v >= from ? "90deg" : "270deg"
	const fill = { left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }
	const thumb = `calc(6px + ${v} * (100% - 12px))`
	return (
		<span
			role="img"
			aria-label={`${sc.name}: ${word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`}
			className="relative block h-1.5 rounded-full bg-white/[.07]"
		>
			{two && <span aria-hidden="true" className="absolute -inset-y-0.5 left-1/2 w-px bg-white/20" />}
			<span
				aria-hidden="true"
				className="absolute inset-y-0 rounded-full"
				style={{ ...fill, background: `linear-gradient(${dir}, color-mix(in srgb, ${c} 10%, transparent), color-mix(in srgb, ${c} 55%, transparent))` }}
			/>
			<span
				aria-hidden="true"
				className={`absolute inset-y-0 rounded-full transition-opacity duration-200 ${hot ? "opacity-100" : "opacity-0"}`}
				style={{ ...fill, background: `linear-gradient(${dir}, color-mix(in srgb, ${c} 30%, transparent), ${c})`, boxShadow: `0 0 10px -1px ${c}` }}
			/>
			<span
				aria-hidden="true"
				className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[opacity,transform] duration-200 ${hot ? "scale-[2.4] opacity-100" : "scale-100 opacity-0"}`}
				style={{ left: thumb, background: `color-mix(in srgb, ${c} 28%, transparent)` }}
			/>
			<span
				aria-hidden="true"
				className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-stone-950"
				style={{ left: thumb, background: c }}
			/>
		</span>
	)
}

// One slider. "stack": name and word over the track (trio). "row": name, track and word on one line.
export function TrioSlider({ sc, t, x, layout = "stack", className = "" }: { sc: Scale; t: F.TitleInput; x: AreaSelection; layout?: "stack" | "row"; className?: string }) {
	const r = reading(sc, t)
	const hot = x.hot === sc.area
	const name = <span className={`transition-colors duration-200 ${hot ? "text-white" : "text-gray-400"}`}>{sc.name}</span>
	const word = (
		<span className="font-semibold transition-colors duration-200" style={{ color: hot ? HEX[sc.area] : "#fff" }}>
			{r.word}
		</span>
	)
	return (
		<button
			type="button"
			{...hoverProps(x, sc.area)}
			onClick={() => x.pick(sc.area)}
			aria-pressed={x.sel === sc.area}
			className={`-mx-2 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 text-left transition-colors hover:bg-white/[.035] focus-visible:outline-2 focus-visible:outline-amber-300 ${
				layout === "row" ? "grid grid-cols-[4.75rem_minmax(0,1fr)_6.75rem] items-center gap-x-3 py-[5px] text-[13px]" : "pb-2.5 pt-1.5"
			} ${className}`}
		>
			{layout === "row" ? (
				<>
					{name}
					<GlowTrack sc={sc} v={r.v} word={r.word} hot={hot} />
					<span className="truncate text-right">{word}</span>
				</>
			) : (
				<>
					<span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
						{name}
						<span className="text-sm">{word}</span>
					</span>
					<span className="mt-2 block">
						<GlowTrack sc={sc} v={r.v} word={r.word} hot={hot} />
					</span>
				</>
			)}
		</button>
	)
}

export const GROUP_HEAD = "text-[11px] font-semibold uppercase tracking-[.12em] text-gray-500"

// --- Area details ---

// Own traits strongest first, then up to two strong related traits from outside the formula.
export function areaTraits(t: F.TitleInput, p: Pillar, own = 4, related = 2) {
	const { own: o, related: r } = F.pillarAttributes(t, p)
	return [...o.slice(0, own).map((a) => ({ ...a, own: true })), ...r.filter((a) => a.score >= 7).slice(0, related).map((a) => ({ ...a, own: false }))]
}

export function TraitBars({ t, p, own = 4, related = 2, className = "" }: { t: F.TitleInput; p: Pillar; own?: number; related?: number; className?: string }) {
	return (
		<ul className={`grid gap-x-6 gap-y-2.5 ${className}`}>
			{areaTraits(t, p, own, related).map((a) => (
				<li key={a.key} className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-[13px]">
					<span className="truncate text-gray-200">{getFingerprintMeta(a.key).label}</span>
					<span className="tabular-nums text-xs text-gray-500">{a.score}</span>
					<span className="col-span-2 mt-1 h-1.5 rounded-full bg-white/[.07]">
						<span
							className="block h-1.5 rounded-full"
							style={{ width: `${a.score * 10}%`, background: a.own ? HEX[p] : `color-mix(in srgb, ${HEX[p]} 45%, #57534e)` }}
						/>
					</span>
				</li>
			))}
		</ul>
	)
}

const FILTER_WORD: Record<number, string> = { 1: "low", 2: "medium", 3: "high" }
const cleanMood = (l: string) => l.replace(/\s*\p{Extended_Pictographic}.*$/u, "")

// More-like-this links (same chips as the shipped MoreLinks), capped so the pane height stays predictable.
export function AreaLinks({ t, p, moods = 2, size = "sm" }: { t: F.TitleInput; p: Pillar; moods?: number; size?: "sm" | "xs" }) {
	const tier = t.fingerprint.pillars[p]
	const found = F.moodsForKeys(t, [...F.PILLAR_KEYS[p], ...F.RELATED_KEYS[p]]).slice(0, moods)
	const kind = t.mediaType === "movie" ? "movies" : "shows"
	const minTier = Math.min(3, tier)
	const pad = size === "sm" ? "px-3.5 py-1.5 text-sm" : "px-3 py-1 text-xs"
	return (
		<div className="flex flex-wrap gap-2">
			{tier >= 1 && (
				<Link
					to={`/discover/${kind}?fingerprintPillars=${p}&fingerprintPillarMinTier=${Math.max(1, minTier)}`}
					className={`rounded-full font-semibold text-black hover:brightness-110 ${pad}`}
					style={{ background: HEX[p] }}
				>
					More {kind} with {FILTER_WORD[Math.max(1, minTier)]} {p.toLowerCase()}
				</Link>
			)}
			{found.map((m) => (
				<Link key={m.url} to={m.url} className={`rounded-full border border-white/20 hover:border-white/60 hover:bg-white/5 ${pad}`}>
					{cleanMood(m.label)} {kind}
				</Link>
			))}
		</div>
	)
}

// Label line for a selected area plus the way back to all areas.
export function AreaHeader({ t, p, x, className = "" }: { t: F.TitleInput; p: Pillar; x: AreaSelection; className?: string }) {
	return (
		<div className={`flex items-center justify-between gap-3 ${className}`}>
			<p className="text-xs font-semibold uppercase tracking-[.12em]" style={{ color: HEX[p] }}>
				<span aria-hidden="true">{PILLAR_CONFIG[p].emoji} </span>
				{p} · {AREA_WORD[p][t.fingerprint.pillars[p]]}
			</p>
			<button
				type="button"
				onClick={x.reset}
				className="-my-1 flex cursor-pointer items-center gap-1 rounded-full border border-white/15 py-1 pl-2 pr-3 text-xs text-gray-300 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
			>
				<XMarkIcon className="h-4 w-4" aria-hidden="true" />
				All areas
			</button>
		</div>
	)
}

export function AreaVerdict({ t, p, className = "" }: { t: F.TitleInput; p: Pillar; className?: string }) {
	const b = F.pillarBrief(t, p)
	return (
		<div className={className}>
			<p className="text-base font-semibold leading-snug text-white">{b.verdict}</p>
			{b.note && <p className="mt-0.5 text-sm leading-relaxed text-gray-400">{b.note}</p>}
		</div>
	)
}

