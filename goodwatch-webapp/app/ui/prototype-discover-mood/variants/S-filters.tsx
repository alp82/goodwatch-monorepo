// PROTOTYPE - throwaway. The filter controls variants S and W lay out themselves (instead of the sheet's card stack):
// each filter as a bare control bound to the real filter state, plus the tier list (common vs niche), the mood
// search field and value, the status line, and the small poster card. Lifted from FilterCards (controls), M-vibe
// (mood chips, folded About/Style) and L (the line chips), so S and W can place every filter where it belongs.
import { ChevronDownIcon, GlobeAltIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { type FilterState, SCORE_GAPS, type SourceKey } from "~/domain/filter-state"
import { productionCountryName } from "~/domain/production-country"
import { titlePath } from "~/utils/helpers"
import { goodwatchVibeIndex } from "~/utils/ratings"
import type { TitleCard } from "~/server/title-cards.server"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { AgeLimit, ContentChecklist } from "~/ui/filter-bar/AgeContent"
import { PeoplePicker, TitlePicker } from "~/ui/filter-bar/FilterPickers"
import { mergedChips } from "~/ui/filter-bar/ActiveFilters"
import { type ActiveChip, ANIME_LABELS, FILTER_ACCENTS, RELEASED_LABELS, TYPE_LABELS } from "~/ui/filter-bar/labels"
import { ServiceStack } from "~/ui/filter-bar/controls"
import { RollingNumber, SHELL, TAP } from "~/ui/filter-bar/motion"
import { Chip, ChipList, More, type Option, RangeSlider, Segmented, ThresholdBar, byCount } from "~/ui/filter-bar/SheetControls"
import { SignUpPanel } from "~/ui/filter-bar/SignUpPanel"
import { PROVIDER_LOGO } from "~/ui/filter-bar/useFilterData"
import { GROUP_LABEL, type ProtoDiscover, TAGS, type Tag, type TagGroup, tagId, type useFilterPieces } from "../kit"

export type Pieces = ReturnType<typeof useFilterPieces>
export const PRIVATE = "search-private ph-no-capture sentry-mask"
export const LINE_FADE = "linear-gradient(to right, black calc(100% - 2.5rem), transparent)"

const MOOD_TAGS = TAGS.filter((t) => t.group === "moods")
const BY_GROUP: Record<TagGroup, Tag[]> = {
	moods: MOOD_TAGS,
	themes: TAGS.filter((t) => t.group === "themes"),
	styles: TAGS.filter((t) => t.group === "styles"),
}

interface Ctx {
	state: FilterState
	counts: ProtoDiscover["counts"]
	set: (patch: Partial<FilterState>) => void
}
const ctxOf = (d: ProtoDiscover): Ctx => ({
	state: d.filters.state,
	counts: d.counts,
	set: (patch) => d.filters.set(patch),
})

const toggleIn = <T,>(list: T[] | undefined, value: T) => {
	const next = (list ?? []).includes(value) ? (list ?? []).filter((v) => v !== value) : [...(list ?? []), value]
	return next.length ? next : undefined
}

// ---------------------------------------------------------------------------------------------------------------
// Tags (moods, About, Style)

export const tagOption = (d: ProtoDiscover, t: Tag): Option => ({
	id: tagId(t),
	label: t.name,
	active: d.isOn(t),
	count: d.countFor(t),
	toggle: () => d.toggle(t),
	swatch: <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />,
})

/** Overlapping hue dots for the picked tags, or the mood hues dimmed when nothing is picked. */
export function HueDots({ tags, size = 12, idle = false }: { tags: Tag[]; size?: number; idle?: boolean }) {
	const shown = tags.length ? tags.slice(0, 4) : idle ? MOOD_TAGS.slice(0, 4) : []
	if (!shown.length) return null
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			{shown.map((t, i) => (
				<span
					key={tagId(t)}
					className={`rounded-full ring-2 ring-gray-950 ${tags.length ? "" : "opacity-60"}`}
					style={{ width: size, height: size, background: t.color, marginLeft: i ? -size / 3 : 0 }}
				/>
			))}
		</span>
	)
}

/** How the picked moods read in one line: "Funny + Feel-good", "+1" past two. */
export function moodLabel(d: ProtoDiscover) {
	const moods = d.picked.filter((t) => t.group === "moods")
	if (!moods.length) return null
	const head = moods.slice(0, 2).map((t) => t.name).join(" + ")
	return moods.length > 2 ? `${head} +${moods.length - 2}` : head
}

export const groupNote = (d: ProtoDiscover, group: TagGroup) => {
	const n = d.picked.filter((t) => t.group === group).length
	return n ? `Any of these · ${n} of 3` : "Up to 3"
}

/** M's mood filter: every mood with its hue and what it would leave. */
export function MoodChips({ d }: { d: ProtoDiscover }) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{MOOD_TAGS.map((t) => (
				<div key={tagId(t)} title={t.description}>
					<Chip o={tagOption(d, t)} />
				</div>
			))}
		</div>
	)
}

/** About or Style: the picks and the best few by count in one fixed-height line, "All N" to unfold. */
export function FoldedTags({ d, group, few = 5 }: { d: ProtoDiscover; group: "themes" | "styles"; few?: number }) {
	const [open, setOpen] = useState(false)
	const options = byCount(BY_GROUP[group].map((t) => tagOption(d, t)))
	const keep = Math.max(few, options.filter((o) => o.active).length)
	const rest = options.length - keep
	if (open)
		return (
			<div className="flex flex-wrap gap-1.5">
				{options.map((o) => (
					<Chip key={o.id} o={o} />
				))}
				<More hidden={0} open onClick={() => setOpen(false)} />
			</div>
		)
	return (
		<div className="flex flex-wrap gap-1.5">
			{options.slice(0, keep).map((o) => (
				<Chip key={o.id} o={o} />
			))}
			{rest > 0 && <More hidden={rest} open={false} onClick={() => setOpen(true)} label={`All ${options.length}`} />}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The common controls

export function StreamingControl({ d, pieces, limit = 8 }: { d: ProtoDiscover; pieces: Pieces; limit?: number }) {
	const { state, set } = ctxOf(d)
	const [all, setAll] = useState(false)
	const myServices = pieces.services.ids
	const mode = state.onMyServices ? "mine" : state.anyService || state.services?.length ? "streaming" : "any"
	const chosen = state.onMyServices ? myServices : (state.services ?? [])
	const providers = pieces.services.countryProviders
	const keep = Math.max(limit, chosen.length)
	const list = [...providers].sort((a, b) => Number(chosen.includes(b.id)) - Number(chosen.includes(a.id)))
	const shown = all ? list.slice(0, 60) : list.slice(0, keep)
	const pickMode = (m: string) =>
		set(
			m === "mine"
				? { onMyServices: true, anyService: undefined, services: undefined }
				: m === "streaming"
					? { onMyServices: false, anyService: true, services: undefined }
					: { onMyServices: false, anyService: undefined, services: undefined },
		)
	const pick = (id: number) => {
		const next = state.anyService || state.onMyServices ? [id] : toggleIn(state.services, id)
		set(next ? { onMyServices: false, anyService: undefined, services: next } : { onMyServices: false, anyService: true, services: undefined })
	}
	return (
		<div className="space-y-2.5">
			<div className="flex">
				<Segmented
					label="Streaming"
					small
					value={mode}
					onChange={pickMode}
					options={[
						{ id: "any", label: "Everywhere" },
						...(myServices.length ? [{ id: "mine", label: "My services" }] : []),
						{ id: "streaming", label: "Pick services" },
					]}
				/>
			</div>
			{mode === "streaming" && (
				<div className="flex flex-wrap gap-1.5">
					{shown.map((p) => (
						<Chip
							key={p.id}
							img={`${PROVIDER_LOGO}${p.logo_path}`}
							o={{
								id: String(p.id),
								label: p.name.replace(/ (Amazon Channel|Apple TV Channel)$/, ""),
								active: chosen.includes(p.id),
								count: null,
								toggle: () => pick(p.id),
							}}
						/>
					))}
					{list.length > keep && <More hidden={list.length - keep} open={all} onClick={() => setAll(!all)} />}
				</div>
			)}
		</div>
	)
}

export function TypeControl({ d, anime = true, withCounts = true }: { d: ProtoDiscover; anime?: boolean; withCounts?: boolean }) {
	const { state, counts, set } = ctxOf(d)
	const c = (g: "type" | "anime", o: string) => (withCounts ? (counts?.optionCounts[g]?.[o] ?? null) : null)
	return (
		<div className="space-y-1.5">
			<div className="flex">
				<Segmented
					label="Movies or shows"
					small
					value={state.type}
					onChange={(type) => set({ type })}
					options={(["all", "movie", "show"] as const).map((id) => ({
						id,
						label: id === "all" ? "Both" : TYPE_LABELS[id],
						count: c("type", id),
					}))}
				/>
			</div>
			{anime && (
				<div className="flex">
					<Segmented
						label="Anime"
						small
						value={state.anime}
						onChange={(a) => set({ anime: a })}
						options={(["any", "only", "none"] as const).map((id) => ({
							id,
							label: id === "any" ? "With anime" : ANIME_LABELS[id],
							count: c("anime", id),
						}))}
					/>
				</div>
			)}
		</div>
	)
}

const GENRE_FOLDS: { label: string; names: string[] }[] = [
	{ label: "Action", names: ["Action", "Action & Adventure"] },
	{ label: "Adventure", names: ["Adventure", "Action & Adventure"] },
	{ label: "Sci-Fi", names: ["Science Fiction", "Sci-Fi & Fantasy"] },
	{ label: "Fantasy", names: ["Fantasy", "Sci-Fi & Fantasy"] },
	{ label: "War", names: ["War", "War & Politics"] },
]
const FOLDED = new Set(GENRE_FOLDS.flatMap((f) => f.names))

export function GenreControl({ d, limit = 8 }: { d: ProtoDiscover; limit?: number }) {
	const { state, counts, set } = ctxOf(d)
	const all = Object.keys(counts?.optionCounts.genres ?? {})
	for (const g of state.genres) if (!all.includes(g)) all.push(g)
	const c = (n: string) => counts?.optionCounts.genres?.[n] ?? null
	const units = [
		...GENRE_FOLDS.filter((f) => f.names.some((n) => all.includes(n))),
		...all.filter((n) => !FOLDED.has(n)).map((n) => ({ label: n, names: [n] })),
	]
	const isOn = (u: { names: string[] }) => state.genres.includes(u.names[0])
	const options: Option[] = units.map((u) => {
		const parts = u.names.map(c).filter((x): x is number => x !== null)
		return {
			id: u.label,
			label: u.label,
			active: isOn(u),
			count: parts.length ? parts.reduce((a, b) => a + b, 0) : null,
			toggle: () => {
				const on = units.filter((x) => (x === u ? !isOn(u) : isOn(x)))
				set({ genres: [...new Set(on.flatMap((x) => x.names))] })
			},
		}
	})
	if (!options.length) return <p className="h-8 text-[13px] leading-8 text-gray-500">Loading genres…</p>
	return <ChipList options={options} limit={limit} sort />
}

const SCORE_STEPS = [
	{ v: 0, label: "Any" },
	{ v: 60, label: "60+" },
	{ v: 70, label: "70+" },
	{ v: 80, label: "80+" },
]

export function ScoreControl({ d }: { d: ProtoDiscover }) {
	const { state, counts, set } = ctxOf(d)
	return (
		<ThresholdBar
			label="Score"
			steps={SCORE_STEPS}
			value={state.minScore}
			onChange={(minScore) => set({ minScore })}
			color={(v) => `bg-vibe-${goodwatchVibeIndex(v)}`}
			counts={(v) => counts?.optionCounts.minScore?.[String(v)] ?? null}
		/>
	)
}

const YEAR_MIN = 1920
const yearMax = () => new Date().getFullYear()
function releasedRange(released: FilterState["released"]): [number, number] {
	const now = yearMax()
	switch (released) {
		case "recent":
			return [now - 3, now]
		case "2010s":
			return [2010, 2019]
		case "2000s":
			return [2000, 2009]
		case "before2000":
			return [YEAR_MIN, 1999]
		default:
			return [YEAR_MIN, now]
	}
}

export function ReleasedControl({ d, slider = false }: { d: ProtoDiscover; slider?: boolean }) {
	const { state, counts, set } = ctxOf(d)
	const c = (o: string) => counts?.optionCounts.released?.[o] ?? null
	const now = yearMax()
	const range: [number, number] = state.years
		? [state.years.min ?? YEAR_MIN, state.years.max ?? now]
		: releasedRange(state.released)
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-1.5">
				{(["recent", "2010s", "2000s", "before2000"] as const).map((r) => (
					<Chip
						key={r}
						o={{
							id: r,
							label: RELEASED_LABELS[r],
							active: !state.years && state.released === r,
							count: state.years ? null : c(r),
							toggle: () => set({ released: state.released === r && !state.years ? "any" : r, years: undefined }),
						}}
					/>
				))}
				{state.years && (
					<Chip
						o={{
							id: "years",
							label: `${state.years.min ?? "Any"} to ${state.years.max ?? "now"}`,
							active: true,
							count: null,
							toggle: () => set({ released: "any", years: undefined }),
						}}
					/>
				)}
			</div>
			{slider && (
				<RangeSlider
					label="Released"
					min={YEAR_MIN}
					max={now}
					step={1}
					value={range}
					format={(y) => (y <= YEAR_MIN ? "Any year" : y >= now ? "Now" : String(y))}
					onCommit={([lo, hi]) => {
						const preset = (["recent", "2010s", "2000s", "before2000", "any"] as const).find((r) => {
							const [a, b] = releasedRange(r)
							return a === lo && b === hi
						})
						if (preset) set({ released: preset, years: undefined })
						else set({ released: "any", years: { ...(lo > YEAR_MIN ? { min: lo } : {}), ...(hi < now ? { max: hi } : {}) } })
					}}
				/>
			)}
		</div>
	)
}

/**
 * Streaming in the bar, compact so the mood search keeps the width: what's set, and a tap toggles My services for
 * members with services (today's switch); otherwise it opens the panel, where Watch has the full control.
 */
export function StreamingButton({ d, pieces, open, onOpen }: { d: ProtoDiscover; pieces: Pieces; open: boolean; onOpen: () => void }) {
	const { state } = d.filters
	const mine = state.onMyServices
	const picked = state.services?.length ?? 0
	const name = picked === 1 ? pieces.services.countryProviders.find((p) => p.id === state.services?.[0])?.name : undefined
	const label = mine ? "My services" : picked ? (name ?? `${picked} services`) : state.anyService ? "Any service" : "Everywhere"
	const on = mine || picked > 0 || !!state.anyService
	return (
		<motion.button
			type="button"
			data-bar-trigger
			whileTap={TAP}
			onClick={() => (pieces.hasServices && !picked ? pieces.servicesProps.onChange(!mine) : onOpen())}
			aria-haspopup={pieces.hasServices ? undefined : "dialog"}
			aria-expanded={pieces.hasServices ? undefined : open}
			aria-label={`Streaming: ${label}`}
			className={`flex h-12 max-w-[14rem] shrink-0 items-center gap-2 px-4 text-sm font-bold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on ? "rounded-2xl bg-linear-to-b from-emerald-600 to-emerald-800 text-white ring-1 ring-emerald-400/40" : `${SHELL} text-gray-200 hover:ring-white/25`
			}`}
		>
			{mine ? <ServiceStack providers={pieces.services.providers} on size={18} /> : <GlobeAltIcon className="h-4 w-4 shrink-0" aria-hidden />}
			<span className="truncate">{label}</span>
			{!pieces.hasServices && <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />}
		</motion.button>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The niche controls

const LEN_MAX = 240
const fmtLen = (m: number) => (m >= LEN_MAX ? "4 h+" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`)
const LENGTH_PRESETS: { label: string; range: [number, number] }[] = [
	{ label: "Under 90 min", range: [0, 90] },
	{ label: "90 min to 2 h", range: [90, 120] },
	{ label: "Over 2 h", range: [120, LEN_MAX] },
	{ label: "Short episodes", range: [0, 35] },
]

function LengthControl({ d }: { d: ProtoDiscover }) {
	const { state, set } = ctxOf(d)
	const range: [number, number] = [state.runtime?.min ?? 0, state.runtime?.max ?? LEN_MAX]
	const commit = ([lo, hi]: [number, number]) =>
		set({ runtime: lo <= 0 && hi >= LEN_MAX ? undefined : { ...(lo > 0 ? { min: lo } : {}), ...(hi < LEN_MAX ? { max: hi } : {}) } })
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-1.5">
				{LENGTH_PRESETS.map((p) => {
					const on = range[0] === p.range[0] && range[1] === p.range[1]
					return (
						<Chip
							key={p.label}
							o={{ id: p.label, label: p.label, active: on, count: null, toggle: () => commit(on ? [0, LEN_MAX] : p.range) }}
						/>
					)
				})}
			</div>
			<RangeSlider label="Length" min={0} max={LEN_MAX} step={5} value={range} format={(m) => (m <= 0 ? "Any" : fmtLen(m))} onCommit={commit} />
		</div>
	)
}

const SOURCES: { key: SourceKey; name: string; color: string; steps: number[]; fmt: (v: number) => string }[] = [
	{ key: "imdb", name: "IMDb", color: "bg-yellow-400", steps: [65, 75, 80], fmt: (v) => `${(v / 10).toFixed(1)}+` },
	{ key: "rtCritics", name: "Rotten Tomatoes critics", color: "bg-red-500", steps: [60, 80, 90], fmt: (v) => `${v}%+` },
	{ key: "rtAudience", name: "Rotten Tomatoes audience", color: "bg-orange-400", steps: [70, 85, 90], fmt: (v) => `${v}%+` },
	{ key: "metacritic", name: "Metacritic", color: "bg-emerald-500", steps: [60, 75, 81], fmt: (v) => `${v}+` },
]

function SourcesControl({ d }: { d: ProtoDiscover }) {
	const { state, counts, set } = ctxOf(d)
	return (
		<div className="space-y-3">
			{SOURCES.map((src) => (
				<div key={src.key}>
					<p className="mb-1 text-[12px] text-gray-400">{src.name}</p>
					<ThresholdBar
						label={src.name}
						steps={[{ v: 0, label: "Any" }, ...src.steps.map((v) => ({ v, label: src.fmt(v) }))]}
						value={state.sourceScores?.[src.key] ?? 0}
						onChange={(v) => {
							const next = { ...(state.sourceScores ?? {}) }
							if (v) next[src.key] = v
							else delete next[src.key]
							set({ sourceScores: Object.keys(next).length ? next : undefined })
						}}
						color={() => src.color}
						counts={(v) => counts?.optionCounts.sourceScores?.[`${src.key}:${v}`] ?? null}
					/>
				</div>
			))}
		</div>
	)
}

const GAP_LABELS = { agree: "Both agree", critics: "Critics liked it more", audience: "Audiences liked it more" } as const

function GapControl({ d }: { d: ProtoDiscover }) {
	const { state, counts, set } = ctxOf(d)
	return (
		<div className="flex flex-wrap gap-1.5">
			{SCORE_GAPS.map((gap) => (
				<Chip
					key={gap}
					o={{
						id: gap,
						label: GAP_LABELS[gap],
						active: state.scoreGap === gap,
						count: counts?.optionCounts.scoreGap?.[gap] ?? null,
						toggle: () => set({ scoreGap: state.scoreGap === gap ? undefined : gap }),
					}}
				/>
			))}
		</div>
	)
}

const COUNTRY_CODES = ["US", "GB", "CA", "AU", "DE", "FR", "ES", "IT", "JP", "KR", "IN", "NZ", "SE", "DK", "NO", "MX", "BR", "CN", "HK", "IE", "BE", "NL", "TR", "PL"]

function CountryControl({ d }: { d: ProtoDiscover }) {
	const { state, set } = ctxOf(d)
	const [all, setAll] = useState(false)
	const chosen = state.productionCountries ?? []
	const codes = [...new Set([...chosen, ...COUNTRY_CODES])]
	const keep = Math.max(10, chosen.length)
	const shown = all ? codes : codes.slice(0, keep)
	return (
		<div className="flex flex-wrap gap-1.5">
			{shown.map((code) => (
				<Chip
					key={code}
					o={{
						id: code,
						label: productionCountryName(code),
						active: chosen.includes(code),
						count: null,
						toggle: () => set({ productionCountries: toggleIn(chosen, code) }),
					}}
				/>
			))}
			{codes.length > keep && <More hidden={codes.length - keep} open={all} onClick={() => setAll(!all)} />}
		</div>
	)
}

function AgeControl({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const ladder = pieces.groups.ladder
	if (!ladder) return <p className="text-[13px] text-gray-500">Loading the age ratings…</p>
	return (
		<div className="flex flex-col gap-4">
			<AgeLimit state={d.filters.state} ladder={ladder} counts={d.counts} onChange={pieces.onChange} />
			<ContentChecklist state={d.filters.state} counts={d.counts} onChange={pieces.onChange} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The tiers

export type FilterKey =
	| "moodSearch"
	| "moods"
	| "services"
	| "notSeenYet"
	| "type"
	| "genres"
	| "minScore"
	| "released"
	| "themes"
	| "styles"
	| "runtime"
	| "minMatch"
	| "sourceScores"
	| "scoreGap"
	| "similarTo"
	| "people"
	| "productionCountries"
	| "ageLimit"
	| "loved"
	| "disliked"

export interface NicheFilter {
	key: Exclude<FilterKey, "moodSearch" | "moods" | "services" | "notSeenYet" | "type" | "genres" | "minScore" | "released">
	label: string
	/** What it does, while nothing is set. */
	hint: string
	/** What is set, or null. */
	value: (d: ProtoDiscover) => string | null
	render: (d: ProtoDiscover, pieces: Pieces) => ReactNode
}

const names = (d: ProtoDiscover, group: TagGroup) => {
	const p = d.picked.filter((t) => t.group === group).map((t) => t.name)
	return p.length ? p.join(", ") : null
}
const many = (n: number | undefined, one: string, more: string) => (n ? (n === 1 ? one : `${n} ${more}`) : null)

export const NICHE: Record<NicheFilter["key"], NicheFilter> = {
	themes: {
		key: "themes",
		label: "About",
		hint: "Crime, family, the future",
		value: (d) => names(d, "themes"),
		render: (d) => <FoldedTags d={d} group="themes" />,
	},
	styles: {
		key: "styles",
		label: "Style",
		hint: "Slow burn, fast-paced",
		value: (d) => names(d, "styles"),
		render: (d) => <FoldedTags d={d} group="styles" />,
	},
	runtime: {
		key: "runtime",
		label: "Length",
		hint: "Short movies, short episodes",
		value: (d) => {
			const r = d.filters.state.runtime
			return r ? `${r.min ? fmtLen(r.min) : "Any"} to ${r.max ? fmtLen(r.max) : "any"}` : null
		},
		render: (d) => <LengthControl d={d} />,
	},
	minMatch: {
		key: "minMatch",
		label: "Taste match",
		hint: "How well it fits your taste",
		value: (d) => (d.filters.state.minMatch ? `${d.filters.state.minMatch}%+` : null),
		render: () => <SignUpPanel feature="tasteMatch" needs="signUp" preview={["Any", "70%+", "80%+", "90%+"]} />,
	},
	sourceScores: {
		key: "sourceScores",
		label: "Scores by source",
		hint: "IMDb, Rotten Tomatoes, Metacritic",
		value: (d) => many(Object.keys(d.filters.state.sourceScores ?? {}).length, "1 source", "sources"),
		render: (d) => <SourcesControl d={d} />,
	},
	scoreGap: {
		key: "scoreGap",
		label: "Critics vs audiences",
		hint: "Where they disagree",
		value: (d) => (d.filters.state.scoreGap ? GAP_LABELS[d.filters.state.scoreGap] : null),
		render: (d) => <GapControl d={d} />,
	},
	similarTo: {
		key: "similarTo",
		label: "Similar to",
		hint: "Like titles you pick",
		value: (d) => many(d.filters.state.similarTo?.length, "1 title", "titles"),
		render: (d, p) => <TitlePicker group="similarTo" state={d.filters.state} onChange={p.onChange} />,
	},
	people: {
		key: "people",
		label: "Cast and crew",
		hint: "Actors and directors",
		value: (d) => many(d.filters.state.people?.length, "1 person", "people"),
		render: (d, p) => <PeoplePicker state={d.filters.state} onChange={p.onChange} />,
	},
	productionCountries: {
		key: "productionCountries",
		label: "Production country",
		hint: "Where it was made",
		value: (d) => {
			const c = d.filters.state.productionCountries ?? []
			return c.length ? c.map(productionCountryName).join(", ") : null
		},
		render: (d) => <CountryControl d={d} />,
	},
	ageLimit: {
		key: "ageLimit",
		label: "Age and content",
		hint: "Age rating and content",
		value: (d) => (d.filters.state.ageLimit !== undefined || d.filters.state.content ? "On" : null),
		render: (d, p) => <AgeControl d={d} pieces={p} />,
	},
	loved: {
		key: "loved",
		label: "Loved",
		hint: "Steer toward titles you loved",
		value: (d) => many(d.filters.state.loved?.length, "1 title", "titles"),
		render: (d, p) => <TitlePicker group="loved" state={d.filters.state} onChange={p.onChange} />,
	},
	disliked: {
		key: "disliked",
		label: "Disliked",
		hint: "Steer away from titles",
		value: (d) => many(d.filters.state.disliked?.length, "1 title", "titles"),
		render: (d, p) => <TitlePicker group="disliked" state={d.filters.state} onChange={p.onChange} />,
	},
}

/** A niche filter as a quiet link row; a tap expands its control in place. */
export function NicheLink({
	f,
	d,
	pieces,
	open,
	onToggle,
	small = false,
}: {
	f: NicheFilter
	d: ProtoDiscover
	pieces: Pieces
	open: boolean
	onToggle: () => void
	small?: boolean
}) {
	const value = f.value(d)
	return (
		<div className={open ? "pb-3" : ""}>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={open}
				className={`group flex w-full min-w-0 items-center gap-2 rounded-lg text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${small ? "h-9" : "h-10"}`}
			>
				<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${value ? "bg-amber-400" : FILTER_ACCENTS[f.key].dot} ${value ? "" : "opacity-60"}`} />
				<span className={`shrink-0 ${small ? "text-[13px]" : "text-[14px]"} ${value || open ? "font-semibold text-white" : "text-gray-300 group-hover:text-white"}`}>
					{f.label}
				</span>
				<span className={`min-w-0 flex-1 truncate text-[12px] ${value ? "text-amber-300/90" : "text-gray-600 group-hover:text-gray-500"}`}>
					{value ?? (small ? "" : f.hint)}
				</span>
				<ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-600 transition-transform group-hover:text-gray-300 ${open ? "rotate-180" : ""}`} />
			</button>
			<AnimatePresence initial={false}>
				{open && (
					<motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="pt-1 pl-3.5">
						{f.render(d, pieces)}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

/** The open niche rows: the set ones start open, so what's active is in view. */
export function useOpenRows(d: ProtoDiscover, keys: NicheFilter["key"][]) {
	const [open, setOpen] = useState<Set<string>>(() => new Set(keys.filter((k) => NICHE[k].value(d))))
	return {
		isOpen: (k: string) => open.has(k),
		toggle: (k: string) =>
			setOpen((s) => {
				const n = new Set(s)
				if (n.has(k)) n.delete(k)
				else n.add(k)
				return n
			}),
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Headings, chips, the status line

export function SectionHead({
	label,
	accent,
	note,
	onClear,
	size = "md",
}: {
	label: string
	accent?: string
	note?: string
	onClear?: () => void
	size?: "md" | "sm"
}) {
	return (
		<div className="mb-2 flex h-6 items-center gap-2">
			{accent && <span className={`h-3.5 w-1 shrink-0 rounded-full ${accent}`} />}
			<h3 className={size === "md" ? "text-[14px] font-bold text-white" : "text-[13px] font-semibold text-gray-100"}>{label}</h3>
			{note && <span className="text-[12px] text-gray-500">{note}</span>}
			{onClear && (
				<button
					type="button"
					onClick={onClear}
					className="ml-auto rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					Clear
				</button>
			)}
		</div>
	)
}

export const colorOf = (chip: ActiveChip) => {
	const m = chip.key.match(/^(mood|theme|style)-(.+)$/)
	if (!m) return undefined
	const group = m[1] === "mood" ? "moods" : m[1] === "theme" ? "themes" : "styles"
	return TAGS.find((t) => t.group === group && t.key === m[2])?.color
}

/** An active value: its hue (or its filter's dot) and × to take it off. */
export function ValueChip({ chip, onRemove }: { chip: ActiveChip; onRemove: () => void }) {
	const color = colorOf(chip)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onRemove}
			aria-label={`Remove ${chip.label}`}
			className={`group inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full pr-2 pl-2.5 text-[13px] outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${color ? "font-semibold text-white" : "bg-white/[0.06] text-gray-100 hover:bg-white/10"}`}
			style={color ? { background: `${color}2e`, boxShadow: `inset 0 0 0 1px ${color}99` } : undefined}
		>
			{color ? (
				<span className="h-2 w-2 rounded-full" style={{ background: color }} />
			) : (
				<span className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS[chip.group].dot}`} />
			)}
			{chip.label.replace(/^Produced in /, "Made in ")}
			<XMarkIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-white" aria-hidden />
		</motion.button>
	)
}

/** The mood search as a value: the text, how it was read, and × to take it off. */
export function QueryValue({ d, onEdit }: { d: ProtoDiscover; onEdit?: () => void }) {
	if (!d.q) return null
	return (
		<span className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-amber-400/[0.12] pr-1 pl-3 ring-1 ring-inset ring-amber-400/40">
			<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
			<button
				type="button"
				onClick={onEdit}
				className={`max-w-[16rem] truncate text-[13px] font-semibold text-amber-50 outline-none ${onEdit ? "cursor-pointer hover:text-white" : "cursor-default"} ${PRIVATE}`}
			>
				“{d.q}”
			</button>
			{d.reading.length > 0 && (
				<span className="hidden shrink-0 items-center [&_*]:whitespace-nowrap sm:flex">
					<ReadAsChips reading={d.reading} />
				</span>
			)}
			<button
				type="button"
				onClick={() => d.setQ(null)}
				aria-label="Remove the mood search"
				className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-amber-200/70 cursor-pointer hover:bg-amber-400/20 hover:text-white"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</span>
	)
}

/** Every active value but the services (the bar shows those). */
export const lineChips = (pieces: Pieces) => mergedChips(pieces.chips.filter((c) => c.key !== "services" && c.group !== "notSeenYet"))

/** The one status line: count, the mood search value, every active value, Clear all. Fixed height, scrolls sideways. */
export function StatusLine({
	d,
	pieces,
	lead,
	onEditQuery,
	className = "",
}: {
	d: ProtoDiscover
	pieces: Pieces
	lead?: ReactNode
	onEditQuery?: () => void
	className?: string
}) {
	const chips = lineChips(pieces)
	const searching = d.q !== null
	const any = chips.length > 0 || searching
	return (
		<div
			className={`-mx-4 flex h-11 min-w-0 items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden ${className}`}
			style={{ maskImage: LINE_FADE, WebkitMaskImage: LINE_FADE }}
		>
			{lead}
			<span className="shrink-0 pr-1 text-sm whitespace-nowrap text-gray-400" aria-live="polite">
				{d.total == null ? (
					"Counting…"
				) : (
					<>
						<RollingNumber value={d.total} className="font-bold text-white" />{" "}
						{searching ? (d.total === 1 ? "match" : "matches") : d.total === 1 ? "title" : "titles"}
					</>
				)}
			</span>
			{any && <span aria-hidden className="h-4 w-px shrink-0 bg-white/10" />}
			<QueryValue d={d} onEdit={onEditQuery} />
			{chips.map((chip) => (
				<ValueChip key={chip.key} chip={chip} onRemove={() => d.filters.update((s) => chip.remove(s))} />
			))}
			{chips.length + (searching ? 1 : 0) > 1 && (
				<button
					type="button"
					onClick={() => {
						d.filters.clearSecondary()
						d.setQ(null)
					}}
					className="shrink-0 px-1 pr-10 text-sm whitespace-nowrap text-gray-500 cursor-pointer hover:text-white"
				>
					Clear all
				</button>
			)}
		</div>
	)
}

/** Clears every filter, the mood search too. */
export const clearAll = (d: ProtoDiscover) => {
	d.filters.clearSecondary()
	d.setQ(null)
}

// ---------------------------------------------------------------------------------------------------------------

const POSTER = "https://image.tmdb.org/t/p/w185"

/** A small poster card for previews: the poster, its score, the title. */
export function MiniPoster({ card, showTitle = true }: { card: TitleCard; showTitle?: boolean }) {
	const score = card.goodwatch_overall_score_normalized_percent
	return (
		<a href={titlePath(card.media_type, card.tmdb_id, card.title)} className="group block min-w-0 outline-none" tabIndex={-1}>
			<div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-white/[0.05] ring-1 ring-white/[0.06]">
				{card.poster_path && (
					<img src={`${POSTER}${card.poster_path}`} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
				)}
				{score != null && (
					<span className={`absolute top-1 right-1 rounded-md bg-vibe-${goodwatchVibeIndex(score)} px-1 text-[10px] font-bold text-white tabular-nums`}>
						{Math.round(score)}
					</span>
				)}
			</div>
			{showTitle && (
				<p className="mt-1 truncate text-[11px] text-gray-400 group-hover:text-gray-200">
					{card.title}
					{card.release_year ? <span className="text-gray-600"> {card.release_year}</span> : null}
				</p>
			)}
		</a>
	)
}

export { GROUP_LABEL }
