// PROTOTYPE - throwaway.
// Shared bits for the trioscrub, triotabs and triorail variants: whole-title headline, area headlines, in-place stack, area details, highlightable sliders.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { Bars, HEX, type Pillar, PILLARS } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import { GROUPS, PairText, SlimTrack, areaStripes, pickPairs, shade } from "./bandsliders-parts"
import { type Scale, reading } from "./slidestrip-parts"
import { cleanMood, goodFor, kindOf } from "./strip-parts"
import { AREA_WORD, type Key, type Scores, areaOf } from "./versus-parts"

export { GROUPS }

// --- The whole-title headline: "A relentless, philosophical sci-fi ride: stunning to look at, tense but never scary, with a dash of wit." ---

export type Bit = { text: string; area?: Pillar }

// Second lead adjective: traits that say something about how a title feels or thinks, with their area.
const LEAD: [Key, string, Pillar][] = [
	["philosophical", "philosophical", "Craft"],
	["intrigue", "gripping", "Craft"],
	["complexity", "intricate", "Craft"],
	["nostalgia", "nostalgic", "Heart"],
	["melancholy", "bittersweet", "Heart"],
	["wholesome", "heartwarming", "Heart"],
	["romance", "romantic", "Heart"],
	["bleakness", "bleak", "Heart"],
	["psychological", "psychological", "World"],
	["surrealism", "dreamlike", "World"],
	["uncanny", "eerie", "Energy"],
	["eccentricity", "quirky", "Humor"],
	["dark_humor", "darkly funny", "Humor"],
	["novelty", "inventive", "World"],
	["wonder", "wondrous", "Heart"],
]

// First lead word: the strongest felt area, in one adjective.
function feltWord(p: Pillar, tier: number, s: Scores): string {
	if (p === "Energy") return tier >= 4 ? "relentless" : s.tension >= 8 ? "tense" : s.adrenaline >= 7 ? "thrilling" : "lively"
	if (p === "Heart") return s.wholesome >= 8 ? "heartwarming" : s.pathos >= 8 ? "deeply moving" : s.romance >= 8 ? "romantic" : tier >= 4 ? "deeply moving" : "warm"
	return s.wit_wordplay >= 8 ? "witty" : tier >= 4 ? "hilarious" : "funny"
}

const MOD: Record<string, string> = {
	Animation: "animated",
	"Science Fiction": "sci-fi",
	"Sci-Fi & Fantasy": "sci-fi",
	Crime: "crime",
	Horror: "horror",
	Fantasy: "fantasy",
	War: "war",
	"War & Politics": "war",
	Mystery: "mystery",
	History: "period",
	Music: "music",
	Family: "family",
	Adventure: "adventure",
	"Action & Adventure": "action",
	Action: "action",
}
const HEAD: Record<string, string> = {
	Comedy: "comedy",
	Drama: "drama",
	Thriller: "thriller",
	Romance: "romance",
	Documentary: "documentary",
	Western: "western",
}
const MOD_ORDER = Object.keys(MOD)

function genreNoun(t: F.TitleInput) {
	const g = t.genres ?? []
	const head = g.map((x) => HEAD[x]).find(Boolean)
	const mod = [...g].filter((x) => MOD[x]).sort((a, b) => MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b))[0]
	const noun = head ?? (t.fingerprint.pillars.Energy >= 4 ? "ride" : t.mediaType === "movie" ? "movie" : "series")
	// "family comedy" reads fine; "adventure ride" doesn't need the modifier.
	const m = mod && !(noun === "ride" && ["action", "adventure"].includes(MOD[mod])) ? MOD[mod] : ""
	return m ? `${m} ${noun}` : noun
}

const HUMOR_KIND: Partial<Record<Key, string>> = {
	situational_comedy: "situational comedy",
	wit_wordplay: "wit",
	physical_comedy: "slapstick",
	absurdist_humor: "absurdity",
	satire_parody: "satire",
	dark_humor: "dark humor",
	cringe_humor: "cringe",
}

function humorClause(t: F.TitleInput): Bit | null {
	const s = t.fingerprint.scores
	const tier = t.fingerprint.pillars.Humor
	const kinds = (Object.keys(HUMOR_KIND) as Key[]).sort((a, b) => s[b] - s[a])
	if (tier === 0) return { text: "never played for laughs", area: "Humor" }
	if (tier === 1) return { text: "rarely funny", area: "Humor" }
	if (tier === 2) return s[kinds[0]] >= 7 ? { text: `with a dash of ${HUMOR_KIND[kinds[0]]}`, area: "Humor" } : { text: "only lightly funny", area: "Humor" }
	return { text: tier >= 4 ? "very funny" : "genuinely funny", area: "Humor" }
}

export function richHeadline(t: F.TitleInput): Bit[] {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	const felt = (["Humor", "Heart", "Energy"] as Pillar[]).sort((a, b) => tiers[b] - tiers[a])[0]
	const used = new Set<Pillar>()
	const lead: Bit[] = []
	if (tiers[felt] >= 3) {
		lead.push({ text: feltWord(felt, tiers[felt], s), area: felt })
		used.add(felt)
	}
	for (const [k, w, p] of [...LEAD].sort((a, b) => s[b[0]] - s[a[0]])) {
		if (lead.length >= 2) break
		if (s[k] < 7 || used.has(p) || lead.some((x) => x.text === w)) continue
		lead.push({ text: w, area: p })
		used.add(p)
	}

	const clauses: { bit: Bit; rank: number }[] = []
	const style = tiers.Style
	if (style >= 3 && !used.has("Style")) clauses.push({ bit: { text: `${style >= 4 ? "stunning" : "striking"} to look at`, area: "Style" }, rank: style })
	if (tiers.Craft >= 3 && !used.has("Craft")) clauses.push({ bit: { text: tiers.Craft >= 4 ? "masterfully made" : "well crafted", area: "Craft" }, rank: tiers.Craft - 0.5 })
	else if (tiers.Craft >= 4) clauses.push({ bit: { text: "masterfully made", area: "Craft" }, rank: 3.4 })
	if (s.tension >= 7) {
		const e = s.scare <= 4 ? "tense but never scary" : s.violence >= 8 ? "tense and violent" : "tense and scary"
		if (!lead.some((x) => x.text === "tense")) clauses.push({ bit: { text: e, area: "Energy" }, rank: 3.6 })
	} else if (tiers.Energy <= 1 && !used.has("Energy")) clauses.push({ bit: { text: "calm and unhurried", area: "Energy" }, rank: 3 })
	if (!used.has("Heart")) {
		if (tiers.Heart >= 3) {
			const h = s.melancholy >= 8 ? "bittersweet" : s.wholesome >= 8 ? "heartwarming" : "full of heart"
			clauses.push({ bit: { text: h, area: "Heart" }, rank: tiers.Heart })
		} else if (tiers.Heart <= 1) clauses.push({ bit: { text: "emotionally cool", area: "Heart" }, rank: 3.2 })
	}
	if (tiers.World >= 4 && !used.has("World")) clauses.push({ bit: { text: "with a world to get lost in", area: "World" }, rank: 3.1 })
	const humor = used.has("Humor") ? null : humorClause(t)
	const picked = clauses
		.sort((a, b) => b.rank - a.rank)
		.slice(0, humor ? 2 : 3)
		.map((c) => c.bit)
	if (humor) picked.push(humor)

	const noun = genreNoun(t)
	const first = lead[0]?.text ?? noun
	const out: Bit[] = [{ text: /^[aeiou]/i.test(first) ? "An " : "A " }]
	lead.forEach((b, i) => {
		out.push(b)
		out.push({ text: i < lead.length - 1 ? ", " : " " })
	})
	out.push({ text: noun })
	picked.forEach((b, i) => {
		out.push({ text: i === 0 ? ": " : i === picked.length - 1 && picked.length === 2 ? " and " : ", " })
		out.push(b)
	})
	out.push({ text: "." })
	return out
}

// Area words in their color; a hovered area gets a soft underline in its color, nothing else changes.
export function Headline({ bits, hot = null }: { bits: Bit[]; hot?: Pillar | null }) {
	return (
		<>
			{bits.map((b, i) =>
				b.area ? (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: static text
						key={i}
						className="underline decoration-2 underline-offset-[6px]"
						style={{ color: HEX[b.area], textDecorationColor: hot === b.area ? `color-mix(in srgb, ${HEX[b.area]} 70%, transparent)` : "transparent" }}
					>
						{b.text}
					</span>
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: static text
					<span key={i} className="text-white">
						{b.text}
					</span>
				),
			)}
		</>
	)
}

// --- Area headline: "Relentless energy." + the verdict + one contrast line from that area ---

export function areaPairs(s: Scores, p: Pillar) {
	return pickPairs(s, 8).filter((x) => areaOf(x.hi) === p)
}

// Same words as the band labels, as a short lead.
export const AREA_LINE: Record<Pillar, string[]> = {
	Energy: ["Calm.", "Low-key energy.", "Steady energy.", "High energy.", "Relentless energy."],
	Heart: ["Emotionally cool.", "Emotionally reserved.", "Warm.", "Moving.", "Profoundly moving."],
	Humor: ["No humor.", "Rarely funny.", "Light humor.", "Funny.", "Hilarious."],
	World: ["A thin world.", "A simple world.", "A solid world.", "A rich world.", "An immersive world."],
	Craft: ["Rough craft.", "Plain craft.", "Solid craft.", "Strong craft.", "Masterful craft."],
	Style: ["Plain style.", "Modest style.", "Clean style.", "Striking style.", "Stunning style."],
}

export function AreaHeadline({ t, p, lines = 2 }: { t: F.TitleInput; p: Pillar; lines?: 1 | 2 }) {
	const s = t.fingerprint.scores
	const b = F.pillarBrief(t, p)
	// Skip a contrast line that repeats the verdict's lead word ("Nostalgic and ..." then "Nostalgic, but fresh.").
	const pair = areaPairs(s, p).find((x) => !b.verdict.toLowerCase().includes(x.p.a.toLowerCase()))
	return (
		<>
			<span className="block">
				<span style={{ color: HEX[p] }}>{AREA_LINE[p][t.fingerprint.pillars[p]]}</span>{" "}
				<span className="text-white">{b.verdict}.</span>
			</span>
			{lines === 2 && pair && (
				<span className="mt-1 block">
					<PairText p={pair.p} color={HEX[p]} />
				</span>
			)}
		</>
	)
}

// --- In-place stack: every view sits in the same grid cell, so the box is as tall as the tallest view and never moves ---

export function Stack({
	active,
	items,
	className = "",
	slide = false,
	ms = 180,
	itemProps,
}: {
	active: string
	items: [string, ReactNode][]
	className?: string
	slide?: boolean
	ms?: number
	itemProps?: (key: string, on: boolean) => Record<string, unknown>
}) {
	return (
		<div className={`grid ${className}`}>
			{items.map(([k, node]) => {
				const on = k === active
				return (
					<div
						key={k}
						aria-hidden={!on}
						{...itemProps?.(k, on)}
						className={`min-w-0 [grid-area:1/1] motion-safe:transition-[opacity,transform,visibility] ${
							on ? "visible opacity-100" : `invisible opacity-0 ${slide ? "motion-safe:translate-y-1" : ""}`
						}`}
						style={{ transitionDuration: `${ms}ms` }}
					>
						{node}
					</div>
				)
			})}
		</div>
	)
}

// --- Band stripes for one area, horizontal (columns of stripes) or vertical (rows of stripes) ---

export function Stripes({ t, p, dir = "row", className = "" }: { t: F.TitleInput; p: Pillar; dir?: "row" | "col"; className?: string }) {
	return (
		<span aria-hidden="true" className={`flex overflow-hidden ${dir === "col" ? "flex-col" : ""} ${className}`}>
			{areaStripes(p, t.fingerprint.scores, t.title).map((x) => (
				<span key={x.id} className={dir === "col" ? "w-full" : "h-full"} style={{ flex: `${x.w} 1 0%`, background: shade(HEX[p], x.b) }} />
			))}
		</span>
	)
}

// Soft glow ring for a highlighted element; toggled by opacity only.
export function Glow({ p, on, strong = false, className = "rounded-md" }: { p: Pillar; on: boolean; strong?: boolean; className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={`pointer-events-none absolute -inset-[3px] transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"} ${className}`}
			style={{
				boxShadow: `0 0 0 ${strong ? 2 : 1.5}px color-mix(in srgb, ${HEX[p]} ${strong ? 85 : 55}%, transparent), 0 0 18px color-mix(in srgb, ${HEX[p]} 35%, transparent)`,
			}}
		/>
	)
}

// --- A slider that highlights (never dims) and selects its area on tap ---

export function SliderButton({
	sc,
	t,
	hot,
	onHover,
	onPick,
	compact = false,
}: {
	sc: Scale
	t: F.TitleInput
	hot: boolean
	onHover: (p: Pillar | null) => void
	onPick: (p: Pillar) => void
	compact?: boolean
}) {
	const r = reading(sc, t)
	return (
		<li className="min-w-0">
			<button
				type="button"
				aria-label={`${sc.name}: ${r.word}. Show ${sc.area.toLowerCase()} in detail`}
				onPointerEnter={(e) => e.pointerType === "mouse" && onHover(sc.area)}
				onPointerLeave={(e) => e.pointerType === "mouse" && onHover(null)}
				onFocus={() => onHover(sc.area)}
				onBlur={() => onHover(null)}
				onClick={() => onPick(sc.area)}
				className={`group relative -mx-2 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 ${compact ? "pb-2 pt-1" : "pb-2.5 pt-1.5"} text-left focus-visible:outline-2 focus-visible:outline-amber-300`}
			>
				<span
					aria-hidden="true"
					className={`pointer-events-none absolute inset-0 rounded-lg transition-opacity duration-200 ${hot ? "opacity-100" : "opacity-0"}`}
					style={{ background: `color-mix(in srgb, ${HEX[sc.area]} 9%, transparent)` }}
				/>
				<span className="relative flex flex-wrap items-baseline justify-between gap-x-3">
					<span className="text-[13px] transition-colors duration-200" style={{ color: hot ? HEX[sc.area] : "#9ca3af" }}>
						{sc.name}
					</span>
					<span className="text-sm font-semibold text-white">{r.word}</span>
				</span>
				<span className="relative mt-2 block">
					<SlimTrack sc={sc} v={r.v} word={r.word} />
				</span>
			</button>
		</li>
	)
}

// The trio's three slider groups. `cols` sets the group layout.
export function SliderGroups({
	t,
	hot,
	onHover,
	onPick,
	layout = "trio",
}: {
	t: F.TitleInput
	hot: Pillar | null
	onHover: (p: Pillar | null) => void
	onPick: (p: Pillar) => void
	layout?: "trio" | "wide"
}) {
	const [feel, story, look] = GROUPS
	const head = "mb-0.5 text-[11px] font-semibold uppercase tracking-[.12em] text-gray-500"
	const mini = (sc: Scale) => <SliderButton key={sc.name} sc={sc} t={t} hot={hot === sc.area} onHover={onHover} onPick={onPick} />
	if (layout === "wide")
		return (
			<div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:gap-x-8 lg:grid-cols-4">
				<section className="col-span-2">
					<h3 className={head}>{feel.name}</h3>
					<ul className="grid grid-cols-2 gap-x-6 sm:gap-x-8">{feel.scales.map(mini)}</ul>
				</section>
				<section className="col-span-1">
					<h3 className={head}>{story.name}</h3>
					<ul>{story.scales.map(mini)}</ul>
				</section>
				<section className="col-span-1">
					<h3 className={head}>{look.name}</h3>
					<ul>{look.scales.map(mini)}</ul>
				</section>
			</div>
		)
	return (
		<div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:gap-x-8">
			<section className="col-span-2 sm:col-span-1">
				<h3 className={head}>{feel.name}</h3>
				<ul className="grid grid-cols-2 gap-x-5 sm:grid-cols-1">{feel.scales.map(mini)}</ul>
			</section>
			<div className="col-span-2 grid grid-cols-2 gap-x-5 gap-y-3 sm:col-span-1 sm:grid-cols-1">
				<section className="col-span-2 sm:col-span-1">
					<h3 className={head}>{story.name}</h3>
					<ul className="grid grid-cols-2 items-end gap-x-5 sm:grid-cols-1">{story.scales.map(mini)}</ul>
				</section>
				<section className="col-span-2 sm:col-span-1">
					<h3 className={head}>{look.name}</h3>
					<ul className="grid grid-cols-2 gap-x-5 sm:grid-cols-1">{look.scales.map(mini)}</ul>
				</section>
			</div>
		</div>
	)
}

// --- One area's details: its own traits as bars, its sliders, related traits, links ---

const scalesOf = (p: Pillar) => GROUPS.flatMap((g) => g.scales).filter((sc) => sc.area === p)

export function AreaDetails({
	t,
	p,
	bars = 5,
	wide = false,
	three = false,
}: { t: F.TitleInput; p: Pillar; bars?: number; wide?: boolean; three?: boolean }) {
	const b = F.pillarBrief(t, p)
	const { own, related } = F.pillarAttributes(t, p)
	const tier = t.fingerprint.pillars[p]
	const intro = (
		<>
			<p className="text-xs font-semibold uppercase tracking-[.12em]" style={{ color: HEX[p] }}>
				<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span> {p} · {AREA_WORD[p][tier]}
			</p>
			<p className="mt-1.5 text-sm leading-relaxed text-gray-400">{b.note || F.pillarSentence(t, p)}</p>
		</>
	)
	const traitBars = (
		<div className="max-sm:[&>ul]:grid max-sm:[&>ul]:grid-cols-2 max-sm:[&>ul]:gap-x-5 max-sm:[&>ul]:gap-y-2.5 max-sm:[&>ul>li]:!mt-0">
			<Bars attributes={own.slice(0, bars)} color={HEX[p]} />
		</div>
	)
	const sliders = (
		<ul className="grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-1">
			{scalesOf(p).map((sc) => {
				const r = reading(sc, t)
				return (
					<li key={sc.name}>
						<span className="flex items-baseline justify-between gap-x-3">
							<span className="text-[13px] text-gray-400">{sc.name}</span>
							<span className="text-sm font-semibold text-white">{r.word}</span>
						</span>
						<span className="mt-2 block">
							<SlimTrack sc={sc} v={r.v} word={r.word} />
						</span>
					</li>
				)
			})}
		</ul>
	)
	const also = related.length > 0 && (
		<p className="text-[13px] leading-relaxed text-gray-400">
			<span className="text-gray-500">Also shaped by</span> {F.list(related.slice(0, 3).map((x) => getFingerprintMeta(x.key).label.toLowerCase()))}
		</p>
	)
	if (three)
		return (
			<div className="grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
				<div className="flex min-w-0 flex-col gap-3 max-lg:sm:col-span-2">
					<div>{intro}</div>
					{also}
					<AreaLinks t={t} p={p} />
				</div>
				<div className="min-w-0">{traitBars}</div>
				<div className="min-w-0">{sliders}</div>
			</div>
		)
	return (
		<div className={`grid gap-x-8 gap-y-4 ${wide ? "sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" : ""}`}>
			<div className="min-w-0">
				{intro}
				<div className="mt-3">{traitBars}</div>
			</div>
			<div className="flex min-w-0 flex-col gap-3">
				{sliders}
				{also}
				<AreaLinks t={t} p={p} />
			</div>
		</div>
	)
}

// --- Selection state helpers ---

export const tierFlex = (t: F.TitleInput, p: Pillar) => t.fingerprint.pillars[p] + 1.5
export const areaLabel = (t: F.TitleInput, p: Pillar) => `${p}: ${AREA_WORD[p][t.fingerprint.pillars[p]].toLowerCase()}`
export const nextArea = (p: Pillar | null, d: 1 | -1) => {
	const i = p ? PILLARS.indexOf(p) : d === 1 ? -1 : PILLARS.length
	return PILLARS[(i + d + PILLARS.length) % PILLARS.length]
}

export function GoodFor({ t, className = "" }: { t: F.TitleInput; className?: string }) {
	const g = goodFor(t, 3)
	if (!g.shown.length) return null
	return (
		<p className={`text-sm text-gray-300 ${className}`}>
			<span className="font-semibold text-emerald-200">Good for</span> {g.shown.join(" · ").toLowerCase()}
		</p>
	)
}

// The discover filter for this area plus at most two mood pages, kept short so every area fits the same box.
const FILTER_WORD: Record<number, string> = { 1: "low", 2: "medium", 3: "high" }
export function AreaLinks({ t, p, n = 2 }: { t: F.TitleInput; p: Pillar; n?: number }) {
	const tier = t.fingerprint.pillars[p]
	const kind = kindOf(t)
	const min = Math.min(3, tier)
	const moods = F.moodsForKeys(t, [...F.PILLAR_KEYS[p], ...F.RELATED_KEYS[p]]).slice(0, tier >= 2 ? n : n + 1)
	return (
		<div className="flex flex-wrap gap-1.5">
			{tier >= 2 && (
				<Link
					to={`/discover/${kind}?fingerprintPillars=${p}&fingerprintPillarMinTier=${min}`}
					className="rounded-full px-3 py-1 text-xs font-semibold text-black hover:brightness-110"
					style={{ background: HEX[p] }}
				>
					More {kind} with {FILTER_WORD[min]} {p.toLowerCase()}
				</Link>
			)}
			{moods.map((m) => (
				<Link key={m.url} to={m.url} className="rounded-full border border-white/20 px-3 py-1 text-xs text-gray-200 hover:border-white/60 hover:bg-white/5">
					{cleanMood(m.label)} {kind}
				</Link>
			))}
		</div>
	)
}
