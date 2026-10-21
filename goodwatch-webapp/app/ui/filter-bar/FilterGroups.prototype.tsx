// PROTOTYPE - throwaway. Round 3 of the Filters sheet layouts (desktop side sheet and phone sheet), switched with
// ?variant=, the group order with ?order= (What first by default), and a signed-in preview with ?as=member. "now" is
// the live list. A search in the sheet falls back to the live list. Round 1 (A-D) is b877654c, round 2 (E-G) 9eb7afe4.
//
// F  Tiles that open in place: essentials as cards, every other filter a tile that opens under its row.
// H  Every filter a tile: the same treatment for all; tiles with something set, and Movies or shows and Genre, open.
// I  Add filters as you go: only what's set (plus Movies or shows and Genre) shows; "Add a filter" picks the next one.
//
// Shared: cards per filter with Clear, segmented Movies or shows + Anime, threshold bars for score and taste match,
// range sliders for year and length (the legacy minYear/maxYear and minRuntime/maxRuntime filters), merged TMDB TV
// genres, streaming by country (anywhere, my services, all in a country, or some), fast title and people pickers.
import {
	ChevronDownIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useSearchParams } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import {
	type ReactNode,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { ladderStepFor } from "~/domain/age-content"
import { type FilterName, type FilterState, dropFilter } from "~/domain/filter-state"
import { productionCountryName } from "~/domain/production-country"
import { goodwatchVibeIndex } from "~/utils/ratings"
import { type TitleKey, titleKey } from "~/utils/title-key"
import {
	type FilterGroupsData,
	type Group,
	NeedsTaste,
	type Option,
	type Refusal,
} from "./FilterGroups"
import { TitleChipPreview } from "./TitleChipPreview"
import {
	ANIME_LABELS,
	type ActiveChip,
	FILTER_ACCENTS,
	MATCH_LABELS,
	RELEASED_LABELS,
	SCORE_LABELS,
	TYPE_LABELS,
	activeChips,
} from "./labels"
import { TAP } from "./motion"
import {
	type NamedPerson,
	type NamedTitle,
	PROVIDER_LOGO,
	useTitleNames,
} from "./useFilterData"

// ---------------------------------------------------------------- switches

export const FILTER_SHEET_VARIANTS = {
	now: "Live today",
	I: "Popular as chips",
	J: "Popular as tiles",
	K: "Popular as cards",
} as const
export type FilterSheetVariant = keyof typeof FILTER_SHEET_VARIANTS

/** A group of the sheet, plus Length (runtime), which the live sheet doesn't offer. */
type Key = FilterName | "length" | "sources" | "gap"

export const FILTER_SHEET_ORDERS: Record<string, { label: string; keys: Key[] }> = {
	what: {
		label: "What first",
		keys: ["type", "genres", "moods", "minMatch", "minScore", "sources", "gap", "services", "released", "length", "themes", "styles", "people", "ageLimit", "productionCountries", "similarTo", "loved", "disliked"],
	},
	where: {
		label: "Where, what, how good",
		keys: ["services", "type", "genres", "moods", "minScore", "sources", "gap", "released", "length", "minMatch", "themes", "styles", "people", "ageLimit", "productionCountries", "similarTo", "loved", "disliked"],
	},
	quick: {
		label: "Quick controls first",
		keys: ["type", "minScore", "sources", "gap", "services", "genres", "moods", "released", "length", "minMatch", "ageLimit", "themes", "styles", "people", "productionCountries", "similarTo", "loved", "disliked"],
	},
	vibe: {
		label: "Vibe first",
		keys: ["moods", "genres", "type", "minScore", "sources", "gap", "services", "styles", "themes", "minMatch", "released", "length", "people", "ageLimit", "productionCountries", "similarTo", "loved", "disliked"],
	},
}

const ESSENTIALS = new Set<Key>(["services", "type", "genres", "moods", "minScore"])
/** The cards the sheet starts with, before anything is set. */
const OPEN_AT_START = new Set<Key>(["type", "moods", "minMatch", "minScore"])

export function useFilterSheetVariant(): FilterSheetVariant {
	const [params] = useSearchParams()
	const v = params.get("variant")
	return v && v in FILTER_SHEET_VARIANTS ? (v as FilterSheetVariant) : "now"
}

export function useFilterSheetOrder(): Key[] {
	const [params] = useSearchParams()
	return (FILTER_SHEET_ORDERS[params.get("order") ?? ""] ?? FILTER_SHEET_ORDERS.what).keys
}

/** ?as=member: the sheet and bar as a member with services and taste sees them, over this visitor's results. */
export function useMemberPreview(): boolean {
	const [params] = useSearchParams()
	return params.get("as") === "member"
}

/** Netflix, Prime Video, Disney+: the services the member preview pretends are saved. */
export const PREVIEW_SERVICES = [8, 9, 337]

/** The floating switcher: variant, order, and guest or member. Hidden in production. */
export function FilterSheetSwitcher() {
	const [params, setParams] = useSearchParams()
	const keys = Object.keys(FILTER_SHEET_VARIANTS) as FilterSheetVariant[]
	const raw = params.get("variant")
	const current: FilterSheetVariant =
		raw && raw in FILTER_SHEET_VARIANTS ? (raw as FilterSheetVariant) : "now"
	const set = (name: string, value: string) => {
		const p = new URLSearchParams(params)
		p.set(name, value)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const go = (step: number) => {
		const i = Math.max(0, keys.indexOf(current))
		set("variant", keys[(i + step + keys.length) % keys.length])
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return
			if (e.key === "ArrowLeft") go(-1)
			if (e.key === "ArrowRight") go(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null
	const member = params.get("as") === "member"
	return (
		<div className="fixed top-2 left-1/2 z-[2000] flex w-max max-w-[96vw] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-3xl bg-white px-2 py-1.5 text-[13px] font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500 lg:left-4 lg:translate-x-0">
			<span className="flex items-center">
				<button type="button" onClick={() => go(-1)} className="rounded-full px-2 py-0.5 hover:bg-neutral-200" aria-label="Previous variant">
					←
				</button>
				<span className="px-1 text-center whitespace-nowrap">
					{current} — {FILTER_SHEET_VARIANTS[current]}
				</span>
				<button type="button" onClick={() => go(1)} className="rounded-full px-2 py-0.5 hover:bg-neutral-200" aria-label="Next variant">
					→
				</button>
			</span>
			<select
				aria-label="Group order"
				value={params.get("order") ?? "what"}
				onChange={(e) => set("order", e.target.value)}
				className="rounded-full border-0 bg-neutral-100 py-0.5 pr-7 pl-2.5 text-[13px] font-semibold text-black"
			>
				{Object.entries(FILTER_SHEET_ORDERS).map(([k, o]) => (
					<option key={k} value={k}>
						{o.label}
					</option>
				))}
			</select>
			<span className="flex rounded-full bg-neutral-100 p-0.5">
				{(["guest", "member"] as const).map((as) => (
					<button
						key={as}
						type="button"
						onClick={() => set("as", as)}
						className={`rounded-full px-2.5 py-0.5 capitalize ${(as === "member") === member ? "bg-black text-white" : "text-neutral-600"}`}
					>
						{as}
					</button>
				))}
			</span>
		</div>
	)
}

// ---------------------------------------------------------------- data

interface Props {
	variant: Exclude<FilterSheetVariant, "now">
	groups: Group[]
	data: FilterGroupsData
	refusal: Refusal | null
	titles: { byKey: Map<TitleKey, NamedTitle> }
	people: { byId: Map<number, NamedPerson> }
	countries: { code: string; name: string }[]
	className?: string
}

type Ctx = Props & {
	order: Key[]
	summaries: Partial<Record<Key, string>>
	set: (patch: Partial<FilterState>) => void
	replace: (state: FilterState) => void
}

const YEAR_MIN = 1920
const YEAR_MAX = 2026
const LEN_MAX = 240

const num = (v: string | undefined) => (v === undefined || v === "" ? null : Number(v))

function legacyPatch(state: FilterState, patch: Record<string, number | string | null>): Partial<FilterState> {
	const legacy = { ...(state.legacy ?? {}) } as Record<string, string>
	for (const [k, v] of Object.entries(patch)) {
		if (v === null) delete legacy[k]
		else legacy[k] = String(v)
	}
	return { legacy: Object.keys(legacy).length ? (legacy as FilterState["legacy"]) : undefined }
}

const RELEASED_RANGE: Record<FilterState["released"], [number, number]> = {
	any: [YEAR_MIN, YEAR_MAX],
	recent: [YEAR_MAX - 3, YEAR_MAX],
	"2010s": [2010, 2019],
	"2000s": [2000, 2009],
	before2000: [YEAR_MIN, 1999],
}

function yearRange(state: FilterState): [number, number] {
	const lo = num(state.legacy?.minYear)
	const hi = num(state.legacy?.maxYear)
	if (lo !== null || hi !== null) return [lo ?? YEAR_MIN, hi ?? YEAR_MAX]
	return RELEASED_RANGE[state.released]
}

function lengthRange(state: FilterState): [number, number] {
	return [num(state.legacy?.minRuntime) ?? 0, num(state.legacy?.maxRuntime) ?? LEN_MAX]
}

const fmtLen = (m: number) =>
	m >= LEN_MAX ? "4 h+" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`

/**
 * Whether "All services in <country>" is on. The server folds duplicate services into base ones, so the list that
 * comes back is shorter than the one sent; the prototype remembers the choice instead (production would want a real
 * "streaming anywhere in the country" option).
 */
let allServicesOn = false
const allPicked = (data: FilterGroupsData) =>
	allServicesOn && !data.state.onMyServices && (data.state.services?.length ?? 0) > 0

function useSummaries(p: Props): Partial<Record<Key, string>> {
	const { state, ladder } = p.data
	const chips = activeChips(state, {
		service: (id) => p.data.countryProviders.find((x) => x.id === id)?.name,
		title: (key) => p.titles.byKey.get(key)?.title,
		person: (id) => p.people.byId.get(id)?.name,
		ageStep: (age) => (ladder ? ladderStepFor(ladder.steps, age).label : undefined),
	})
	const by: Partial<Record<Key, string[]>> = {}
	for (const chip of chips) {
		const g: Key = chip.group === "content" ? "ageLimit" : chip.group
		by[g] = [...(by[g] ?? []), chip.label]
	}
	const list = (key: Key, none: string) => {
		const l = by[key] ?? []
		if (!l.length) return none
		return l.length > 2 ? `${l.slice(0, 2).join(", ")} +${l.length - 2}` : l.join(", ")
	}
	const [ylo, yhi] = yearRange(state)
	const yearsSet = state.legacy?.minYear || state.legacy?.maxYear
	const [llo, lhi] = lengthRange(state)
	const country = productionCountryName(state.streamingCountry ?? p.data.streamingCountry ?? "US")
	return {
		type:
			state.anime === "any"
				? TYPE_LABELS[state.type]
				: `${TYPE_LABELS[state.type]}, ${ANIME_LABELS[state.anime].toLowerCase()}`,
		minScore: SCORE_LABELS[state.minScore as keyof typeof SCORE_LABELS] ?? `${state.minScore}+`,
		minMatch: MATCH_LABELS[state.minMatch as keyof typeof MATCH_LABELS] ?? `${state.minMatch}%+`,
		released: yearsSet ? `${ylo}–${yhi >= YEAR_MAX ? "now" : yhi}` : RELEASED_LABELS[state.released],
		length: llo === 0 && lhi >= LEN_MAX ? "Any length" : `${fmtLen(llo)} – ${fmtLen(lhi)}`,
		sources:
			SOURCES.filter((src) => state.legacy?.[src.param])
				.map((src) => `${src.name.replace("Rotten Tomatoes", "RT")} ${src.fmt(Number(state.legacy?.[src.param]))}`)
				.join(", ") || "Any",
		gap: GAPS.find((g) => g.id === (state.legacy?.scoreGap ?? ""))?.label ?? "Any",
		services: state.onMyServices
			? "My services"
			: allPicked(p.data)
				? `Streaming in ${country}`
				: list("services", "Anywhere"),
		genres: list("genres", "Any"),
		moods: list("moods", "Any"),
		themes: list("themes", "Any"),
		styles: list("styles", "Any"),
		ageLimit: list("ageLimit", "No limit"),
		productionCountries: list("productionCountries", "Anywhere"),
		similarTo: list("similarTo", "None"),
		people: list("people", "None"),
		loved: list("loved", "None"),
		disliked: list("disliked", "None"),
	}
}

/** Whether a group has something set; Length and the year range read the legacy filters. */
function isSet(ctx: Ctx, k: Key): boolean {
	const s = ctx.data.state
	if (k === "length") return !!(s.legacy?.minRuntime || s.legacy?.maxRuntime)
	if (k === "sources") return SOURCES.some((src) => !!s.legacy?.[src.param])
	if (k === "gap") return !!s.legacy?.scoreGap
	if (k === "released") return s.released !== "any" || !!(s.legacy?.minYear || s.legacy?.maxYear)
	if (k === "type") return s.type !== "all" || s.anime !== "any"
	if (k === "services") return s.onMyServices || !!s.services?.length
	return (ctx.groups.find((g) => g.key === k)?.badge ?? 0) > 0
}

/** The state without this group's choice. */
function cleared(ctx: Ctx, k: Key): FilterState {
	const s = ctx.data.state
	if (k === "length") return { ...s, ...legacyPatch(s, { minRuntime: null, maxRuntime: null }) }
	if (k === "sources") return { ...s, ...legacyPatch(s, Object.fromEntries(SOURCES.map((src) => [src.param, null]))) }
	if (k === "gap") return { ...s, ...legacyPatch(s, { scoreGap: null }) }
	if (k === "released") return { ...s, released: "any", ...legacyPatch(s, { minYear: null, maxYear: null }) }
	if (k === "type") return { ...s, type: "all", anime: "any" }
	if (k === "services") return { ...s, onMyServices: false, services: undefined }
	if (k === "ageLimit") return dropFilter(dropFilter(s, "ageLimit"), "content")
	return dropFilter(s, k)
}

const TITLES: Record<Key, string> = {
	services: "Streaming",
	type: "Movies or shows",
	genres: "Genre",
	moods: "Mood",
	minScore: "Score",
	sources: "Scores by source",
	gap: "Critics vs audiences",
	minMatch: "Taste match",
	released: "Released",
	length: "Length",
	themes: "Theme",
	styles: "Style",
	similarTo: "Similar to",
	people: "Cast and crew",
	ageLimit: "Age & content",
	productionCountries: "Production countries",
	loved: "Loved",
	disliked: "Disliked",
	anime: "Anime",
	notSeenYet: "Not seen yet",
	legacy: "Other",
	content: "Content",
}

/** One line on what a filter does, for the picker in I. */
const HINTS: Partial<Record<Key, string>> = {
	services: "Where you can watch it",
	type: "Movies, shows, anime",
	genres: "Drama, comedy, sci-fi…",
	moods: "Funny, scary, feel-good…",
	minScore: "Only well-rated titles",
	sources: "IMDb, Rotten Tomatoes, Metacritic",
	gap: "Where critics and audiences differ",
	minMatch: "How well it fits your taste",
	released: "A year range or a decade",
	length: "Short movies, short episodes",
	themes: "Crime, family, the future…",
	styles: "Slow burn, fast-paced…",
	similarTo: "Like titles you pick",
	people: "Actors and directors",
	ageLimit: "Age rating and content",
	productionCountries: "Where it was made",
	loved: "Steer toward titles you loved",
	disliked: "Steer away from titles",
}

const accent = (k: Key) =>
	k === "length" ? "bg-sky-400" : k === "sources" ? "bg-yellow-300" : k === "gap" ? "bg-rose-300" : FILTER_ACCENTS[k].dot

/** Score by source: the legacy-style parameter, the 0-100 steps, and how a step reads. */
const SOURCES = [
	{ param: "minImdb", name: "IMDb", color: "bg-yellow-400", steps: [65, 75, 80], fmt: (v: number) => `${(v / 10).toFixed(1)}+` },
	{ param: "minTomatometer", name: "Rotten Tomatoes critics", color: "bg-red-500", steps: [60, 80, 90], fmt: (v: number) => `${v}%+` },
	{ param: "minRtAudience", name: "Rotten Tomatoes audience", color: "bg-orange-400", steps: [70, 85, 90], fmt: (v: number) => `${v}%+` },
	{ param: "minMetacritic", name: "Metacritic", color: "bg-emerald-500", steps: [60, 75, 81], fmt: (v: number) => `${v}+` },
] as const

const GAPS = [
	{ id: "", label: "Any" },
	{ id: "agree", label: "Both agree" },
	{ id: "critics", label: "Critics liked it more" },
	{ id: "audience", label: "Audiences liked it more" },
] as const

// ---------------------------------------------------------------- atoms

const compact = (n: number) =>
	n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n)

/** The calm chip: 32 px, the count quiet, white when on. */
function Chip({ o, img }: { o: Option; img?: string | null }) {
	const dead = o.disabled || (!o.active && o.count === 0)
	return (
		<motion.button
			type="button"
			aria-pressed={o.active}
			aria-disabled={o.disabled || undefined}
			whileTap={o.disabled ? undefined : TAP}
			onClick={() => !o.disabled && o.toggle()}
			className={`flex h-8 items-center gap-1.5 rounded-full text-[13px] whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${img !== undefined ? "pr-3 pl-1" : "px-3"} ${o.disabled ? "cursor-not-allowed" : "cursor-pointer"} ${
				o.active
					? "bg-white font-semibold text-gray-950"
					: dead
						? "bg-white/[0.02] text-gray-600"
						: "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white"
			}`}
		>
			{img !== undefined &&
				(img ? (
					<img src={img} alt="" className="h-6 w-6 rounded-full object-cover" />
				) : (
					<span className="h-6 w-6 rounded-full bg-white/10" />
				))}
			{o.swatch}
			{o.label}
			{!o.active && o.count !== null && (
				<span className="text-[11px] tabular-nums text-gray-500">{compact(o.count)}</span>
			)}
		</motion.button>
	)
}

function More({ hidden, open, onClick, label }: { hidden: number; open: boolean; onClick: () => void; label?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-expanded={open}
			className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			{open ? "Show fewer" : (label ?? `+${hidden} more`)}
		</button>
	)
}

/** Active first, then most titles, then the dead ones. */
const byCount = (options: Option[]) =>
	[...options].sort(
		(a, b) =>
			Number(b.active) - Number(a.active) ||
			Number(b.count !== 0) - Number(a.count !== 0) ||
			(b.count ?? 0) - (a.count ?? 0),
	)

/** Chips trimmed to `limit` (active ones always show) with "+N more". */
function ChipList({ options, limit = 99, sort = false }: { options: Option[]; limit?: number; sort?: boolean }) {
	const [open, setOpen] = useState(false)
	const list = sort ? byCount(options) : [...options].sort((a, b) => Number(b.active) - Number(a.active))
	const keep = Math.max(limit, list.filter((o) => o.active).length)
	const hidden = list.length - keep
	const shown = open || hidden <= 1 ? list : list.slice(0, keep)
	return (
		<div className="flex flex-wrap gap-1.5">
			{shown.map((o) => (
				<Chip key={o.id} o={o} />
			))}
			{hidden > 1 && <More hidden={hidden} open={open} onClick={() => setOpen(!open)} />}
		</div>
	)
}

/** A segmented control: one track, the chosen segment white. */
function Segmented<T extends string>({
	value,
	options,
	onChange,
	small = false,
	label,
}: {
	value: T
	options: { id: T; label: string; count?: number | null }[]
	onChange: (v: T) => void
	small?: boolean
	label: string
}) {
	return (
		<div
			role="radiogroup"
			aria-label={label}
			className={`grid flex-1 auto-cols-fr grid-flow-col rounded-xl bg-white/[0.05] p-0.5 ${small ? "h-8" : "h-10"}`}
		>
			{options.map((o) => {
				const on = o.id === value
				return (
					<button
						key={o.id}
						type="button"
						role="radio"
						aria-checked={on}
						onClick={() => onChange(o.id)}
						className={`relative flex min-w-0 items-center justify-center gap-1.5 rounded-[10px] px-2 whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${small ? "text-xs" : "text-[13px]"} ${on ? "font-semibold text-gray-950" : "text-gray-300 hover:bg-white/[0.05] hover:text-white"}`}
					>
						{on && (
							<motion.span
								layoutId={`seg-${label}`}
								transition={{ type: "spring", stiffness: 500, damping: 40 }}
								className="absolute inset-0 rounded-[10px] bg-white"
							/>
						)}
						<span className="relative truncate">{o.label}</span>
						{!on && o.count != null && (
							<span className="relative text-[11px] tabular-nums text-gray-500">{compact(o.count)}</span>
						)}
					</button>
				)
			})}
		</div>
	)
}

/** "And up" as a bar: every segment from the chosen one to the right lit. */
function ThresholdBar({
	steps,
	value,
	onChange,
	color,
	label,
	disabled,
	counts,
}: {
	steps: { v: number; label: string }[]
	value: number
	onChange: (v: number) => void
	color: (v: number) => string
	label: string
	disabled?: boolean
	counts?: (v: number) => number | null
}) {
	const at = Math.max(
		0,
		steps.findIndex((s) => s.v === value),
	)
	return (
		<div role="radiogroup" aria-label={label} className={`grid auto-cols-fr grid-flow-col gap-1 ${disabled ? "opacity-40" : ""}`}>
			{steps.map((s, i) => {
				const lit = i >= at && value !== 0
				const on = i === at
				const n = counts?.(s.v)
				return (
					<button
						key={s.v}
						type="button"
						role="radio"
						aria-checked={on}
						disabled={disabled && s.v !== 0}
						onClick={() => onChange(s.v)}
						className="group flex flex-col items-stretch gap-1.5 rounded-md py-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed"
					>
						<span className={`h-2 rounded-full transition-colors ${lit ? color(s.v) : on ? "bg-white" : "bg-white/[0.09] group-hover:bg-white/20"}`} />
						<span className={`text-left text-[12px] leading-tight ${on ? "font-semibold text-white" : "text-gray-400 group-hover:text-gray-200"}`}>
							{s.label}
							{!on && n != null && <span className="ml-1 text-[11px] text-gray-600">{compact(n)}</span>}
						</span>
					</button>
				)
			})}
		</div>
	)
}

/** Two thumbs on one track; commits a moment after the last move, so counts don't run on every pixel. */
function RangeSlider({
	min,
	max,
	step,
	value,
	onCommit,
	format,
	label,
}: {
	min: number
	max: number
	step: number
	value: [number, number]
	onCommit: (v: [number, number]) => void
	format: (v: number) => string
	label: string
}) {
	const [v, setV] = useState(value)
	const key = value.join(",")
	// biome-ignore lint/correctness/useExhaustiveDependencies: follow the state when it changes from elsewhere
	useEffect(() => setV(value), [key])
	useEffect(() => {
		if (v.join(",") === key) return
		const id = setTimeout(() => onCommit(v), 350)
		return () => clearTimeout(id)
	})
	const pct = (x: number) => ((x - min) / (max - min)) * 100
	const thumb =
		"pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,.6)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
	const full = v[0] <= min && v[1] >= max
	return (
		<div>
			<div className="mb-1 flex justify-between text-[13px] tabular-nums">
				<span className={full ? "text-gray-500" : "font-semibold text-white"}>{format(v[0])}</span>
				<span className={full ? "text-gray-500" : "font-semibold text-white"}>{format(v[1])}</span>
			</div>
			<div className="relative h-6">
				<div className="absolute inset-x-0 top-[10px] h-1 rounded-full bg-white/10" />
				<div className={`absolute top-[10px] h-1 rounded-full ${full ? "bg-white/25" : "bg-amber-400"}`} style={{ left: `${pct(v[0])}%`, right: `${100 - pct(v[1])}%` }} />
				<input type="range" aria-label={`${label} from`} min={min} max={max} step={step} value={v[0]} onChange={(e) => setV([Math.min(Number(e.target.value), v[1] - step), v[1]])} className={thumb} />
				<input type="range" aria-label={`${label} to`} min={min} max={max} step={step} value={v[1]} onChange={(e) => setV([v[0], Math.max(Number(e.target.value), v[0] + step)])} className={thumb} />
			</div>
		</div>
	)
}

function Spinner() {
	return <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-amber-400 motion-reduce:animate-none" />
}

/** A search field inside a group: icon, a spinner while it looks, and a labeled Clear at the right. */
function SearchField({
	value,
	onChange,
	placeholder,
	loading,
	onFocus,
	inputRef,
	autoFocus,
}: {
	value: string
	onChange: (v: string) => void
	placeholder: string
	loading?: boolean
	onFocus?: () => void
	inputRef?: RefObject<HTMLInputElement>
	autoFocus?: boolean
}) {
	return (
		<label className="flex h-10 items-center gap-2 rounded-xl bg-white/[0.05] pr-1.5 pl-3 ring-1 ring-white/[0.06] focus-within:ring-amber-500/60">
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" />
			<input
				ref={inputRef}
				type="search"
				value={value}
				// biome-ignore lint/a11y/noAutofocus: opened by the person to type
				autoFocus={autoFocus}
				onFocus={onFocus}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				aria-label={placeholder}
				className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
			/>
			{loading && <Spinner />}
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					className="flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] text-gray-400 cursor-pointer hover:bg-white/[0.08] hover:text-white"
				>
					<XMarkIcon className="h-3.5 w-3.5" />
					Clear
				</button>
			)}
		</label>
	)
}

// ---------------------------------------------------------------- controls per group

const toggleIn = <T,>(list: T[] | undefined, value: T) => {
	const next = (list ?? []).includes(value) ? (list ?? []).filter((v) => v !== value) : [...(list ?? []), value]
	return next.length ? next : undefined
}

function TypeControl({ ctx }: { ctx: Ctx }) {
	const { state, counts } = ctx.data
	const c = (g: FilterName, o: string) => counts?.optionCounts[g]?.[o] ?? null
	return (
		<div className="space-y-2">
			<div className="flex">
				<Segmented
					label="Movies or shows"
					value={state.type}
					onChange={(type) => ctx.set({ type })}
					options={(["all", "movie", "show"] as const).map((id) => ({ id, label: id === "all" ? "Both" : TYPE_LABELS[id], count: c("type", id) }))}
				/>
			</div>
			<div className="flex">
				<Segmented
					label="Anime"
					small
					value={state.anime}
					onChange={(anime) => ctx.set({ anime })}
					options={(["any", "only", "none"] as const).map((id) => ({ id, label: id === "any" ? "With anime" : ANIME_LABELS[id], count: c("anime", id) }))}
				/>
			</div>
		</div>
	)
}

/** TMDB gives shows their own combined genres; each folds into the movie genres it names. Genres match any of. */
const GENRE_FOLDS: { label: string; names: string[] }[] = [
	{ label: "Action", names: ["Action", "Action & Adventure"] },
	{ label: "Adventure", names: ["Adventure", "Action & Adventure"] },
	{ label: "Sci-Fi", names: ["Science Fiction", "Sci-Fi & Fantasy"] },
	{ label: "Fantasy", names: ["Fantasy", "Sci-Fi & Fantasy"] },
	{ label: "War", names: ["War", "War & Politics"] },
]
const FOLDED = new Set(GENRE_FOLDS.flatMap((f) => f.names))

function genreOptions(ctx: Ctx): Option[] {
	const { state, counts } = ctx.data
	const all = Object.keys(counts?.optionCounts.genres ?? {})
	for (const g of state.genres) if (!all.includes(g)) all.push(g)
	const c = (n: string) => counts?.optionCounts.genres?.[n] ?? null
	const units = [
		...GENRE_FOLDS.filter((f) => f.names.some((n) => all.includes(n))),
		...all.filter((n) => !FOLDED.has(n)).map((n) => ({ label: n, names: [n] })),
	]
	const isOn = (u: { names: string[] }) => state.genres.includes(u.names[0])
	return units.map((u) => {
		const parts = u.names.map(c).filter((x): x is number => x !== null)
		return {
			id: u.label,
			label: u.label,
			active: isOn(u),
			count: parts.length ? parts.reduce((a, b) => a + b, 0) : null,
			toggle: () => {
				const on = units.filter((x) => (x === u ? !isOn(u) : isOn(x)))
				ctx.set({ genres: [...new Set(on.flatMap((x) => x.names))] })
			},
		}
	})
}

/**
 * Streaming: Anywhere (no streaming filter), My services, or Streaming in a country, where every service of that
 * country is the start and a tap on one narrows to the ones picked.
 */
function ServicesControl({ ctx, limit }: { ctx: Ctx; limit: number }) {
	const { state, myServices, countryProviders } = ctx.data
	const [search, setSearch] = useState("")
	const [open, setOpen] = useState(false)
	const [streaming, setStreaming] = useState(!!state.services?.length)
	const [wantAll, setWantAllState] = useState(allPicked(ctx.data))
	const setWantAll = (on: boolean) => {
		allServicesOn = on
		setWantAllState(on)
	}
	const all = allPicked(ctx.data)
	const allIds = countryProviders.map((p) => p.id)
	const allKey = allIds.join(",")
	// "All" follows the country: a new country's services once they load.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only when the country's list changes
	useEffect(() => {
		if (wantAll && streaming && allIds.length && !state.services?.length) ctx.set({ onMyServices: false, services: allIds })
	}, [allKey, wantAll, streaming])
	const mode = state.onMyServices ? "mine" : streaming || state.services?.length ? "streaming" : "any"
	const chosen = state.onMyServices ? myServices : all ? [] : (state.services ?? [])
	const term = search.trim().toLowerCase()
	const rank = (id: number) => (chosen.includes(id) ? 0 : myServices.includes(id) ? 1 : 2)
	const sorted = countryProviders
		.map((p, i) => ({ p, i }))
		.sort((a, b) => rank(a.p.id) - rank(b.p.id) || a.i - b.i)
		.map(({ p }) => p)
	const matches = term ? sorted.filter((p) => p.name.toLowerCase().includes(term)) : sorted
	const keep = Math.max(limit, chosen.length)
	const shown = term || open ? matches.slice(0, 80) : matches.slice(0, keep)
	const country = state.streamingCountry ?? ctx.data.streamingCountry ?? "US"
	const countryCodes = [...new Set([country, ...ctx.countries.map((c) => c.code)])]
	const pickMode = (m: string) => {
		if (m === "any") {
			setStreaming(false)
			setWantAll(false)
			ctx.set({ onMyServices: false, services: undefined })
		} else if (m === "mine") {
			setStreaming(false)
			ctx.set({ onMyServices: true, services: undefined })
		} else {
			setStreaming(true)
			setWantAll(true)
			ctx.set({ onMyServices: false, services: allIds })
		}
	}
	const pick = (id: number) => {
		setStreaming(true)
		setWantAll(false)
		// From All (or My services), a tap means "just this one"; then taps add and remove.
		const next = all || state.onMyServices ? [id] : toggleIn(state.services, id)
		if (!next) {
			setWantAll(true)
			ctx.set({ onMyServices: false, services: allIds })
		} else ctx.set({ onMyServices: false, services: next })
	}
	return (
		<div className="space-y-3">
			<div className="flex">
				<Segmented
					label="Streaming"
					value={mode}
					onChange={pickMode}
					options={[
						{ id: "any", label: "Anywhere" },
						...(myServices.length ? [{ id: "mine", label: "My services" }] : []),
						{ id: "streaming", label: "Streaming in…" },
					]}
				/>
			</div>
			{mode === "any" && <p className="text-[12px] text-gray-500">Every title, streaming or not.</p>}
			{mode === "mine" && <p className="text-[12px] text-gray-500">Titles on the services in your settings.</p>}
			{mode === "streaming" && (
				<>
					<div className="flex items-center gap-2">
						<select
							aria-label="Streaming country"
							value={country}
							onChange={(e) => ctx.set({ streamingCountry: e.target.value, services: wantAll ? undefined : state.services })}
							className="h-9 min-w-0 flex-1 rounded-xl border-0 bg-white/[0.05] py-0 pr-8 pl-3 text-[13px] text-white ring-1 ring-white/[0.06]"
						>
							{countryCodes
								.map((code) => ({ code, name: productionCountryName(code) }))
								.sort((a, b) => a.name.localeCompare(b.name))
								.map((c) => (
									<option key={c.code} value={c.code}>
										{c.name}
									</option>
								))}
						</select>
						<button
							type="button"
							onClick={() => setOpen(!open)}
							aria-label="Find a service"
							className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl cursor-pointer ring-1 ring-white/[0.06] ${open ? "bg-white/[0.12] text-white" : "bg-white/[0.05] text-gray-400 hover:text-white"}`}
						>
							<MagnifyingGlassIcon className="h-4 w-4" />
						</button>
					</div>
					{open && <SearchField value={search} onChange={setSearch} placeholder={`Find a service in ${productionCountryName(country)}`} autoFocus />}
					<div className="flex flex-wrap gap-1.5">
						{!term && (
							<Chip
								o={{
									id: "all",
									label: `All ${countryProviders.length} services`,
									active: all,
									count: null,
									toggle: () => pickMode("streaming"),
								}}
							/>
						)}
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
						{!term && !open && matches.length > keep && <More hidden={matches.length - keep} open={false} onClick={() => setOpen(true)} />}
						{term && matches.length === 0 && <p className="text-[13px] text-gray-500">No service called “{search}” here.</p>}
					</div>
				</>
			)}
		</div>
	)
}

function YearControl({ ctx }: { ctx: Ctx }) {
	const { state, counts } = ctx.data
	const c = (o: string) => counts?.optionCounts.released?.[o] ?? null
	const range = yearRange(state)
	const yearsSet = !!(state.legacy?.minYear || state.legacy?.maxYear)
	const clearYears = legacyPatch(state, { minYear: null, maxYear: null })
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-1.5">
				{(["any", "recent", "2010s", "2000s", "before2000"] as const).map((r) => (
					<Chip
						key={r}
						o={{
							id: r,
							label: RELEASED_LABELS[r],
							active: !yearsSet && state.released === r,
							count: yearsSet ? null : r === "any" ? null : c(r),
							toggle: () => ctx.set({ released: state.released === r && !yearsSet ? "any" : r, ...clearYears }),
						}}
					/>
				))}
			</div>
			<RangeSlider
				label="Released"
				min={YEAR_MIN}
				max={YEAR_MAX}
				step={1}
				value={range}
				format={(y) => (y <= YEAR_MIN ? "Any year" : y >= YEAR_MAX ? "Now" : String(y))}
				onCommit={([lo, hi]) => {
					const preset = (Object.entries(RELEASED_RANGE) as [FilterState["released"], [number, number]][]).find(([, r]) => r[0] === lo && r[1] === hi)
					if (preset) ctx.set({ released: preset[0], ...clearYears })
					else ctx.set({ released: "any", ...legacyPatch(state, { minYear: lo <= YEAR_MIN ? null : lo, maxYear: hi >= YEAR_MAX ? null : hi }) })
				}}
			/>
		</div>
	)
}

const LENGTH_PRESETS: { label: string; range: [number, number] }[] = [
	{ label: "Any length", range: [0, LEN_MAX] },
	{ label: "Under 90 min", range: [0, 90] },
	{ label: "90 min – 2 h", range: [90, 120] },
	{ label: "Over 2 h", range: [120, LEN_MAX] },
	{ label: "Short episodes", range: [0, 35] },
]

function LengthControl({ ctx }: { ctx: Ctx }) {
	const { state } = ctx.data
	const range = lengthRange(state)
	const commit = ([lo, hi]: [number, number]) => ctx.set(legacyPatch(state, { minRuntime: lo <= 0 ? null : lo, maxRuntime: hi >= LEN_MAX ? null : hi }))
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-1.5">
				{LENGTH_PRESETS.map((p) => {
					const on = range[0] === p.range[0] && range[1] === p.range[1]
					return <Chip key={p.label} o={{ id: p.label, label: p.label, active: on, count: null, toggle: () => commit(on ? [0, LEN_MAX] : p.range) }} />
				})}
			</div>
			<RangeSlider label="Length" min={0} max={LEN_MAX} step={5} value={range} format={(m) => (m <= 0 ? "Any" : fmtLen(m))} onCommit={commit} />
			<p className="text-[12px] text-gray-500">Movie length, or episode length for shows.</p>
		</div>
	)
}

/** Typing waits a moment before it asks. */
function useDebounced<T>(value: T, ms = 220): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms)
		return () => clearTimeout(id)
	}, [value, ms])
	return v
}

interface Found {
	key: TitleKey
	title: string
	year: string
	poster: string | null
}

/** The site's quick title search (the header's typeahead), about a quarter second. */
function useQuickTitles(text: string) {
	const term = useDebounced(text.trim())
	const q = useQuery<{ searchResults: { id: number; media_type: "movie" | "show"; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path?: string | null }[] }>({
		queryKey: ["proto-quick-titles", term],
		queryFn: async () => (await fetch(`/api/search?query=${encodeURIComponent(term)}`)).json(),
		enabled: term.length >= 2,
		staleTime: 60_000,
	})
	const found: Found[] = (term.length >= 2 ? (q.data?.searchResults ?? []) : []).map((r) => ({
		key: titleKey(r.media_type, r.id),
		title: r.title ?? r.name ?? "",
		year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
		poster: r.poster_path ?? null,
	}))
	return { found, loading: text.trim().length >= 2 && (q.isFetching || term !== text.trim()) }
}

const POSTER = "https://image.tmdb.org/t/p/w154"

/** A poster you can pick or take off; the ring says loved (green), disliked (red), or chosen. */
function Poster({
	t,
	active,
	tone,
	onClick,
}: {
	t: Found | undefined
	active: boolean
	tone: "pos" | "neg"
	onClick: () => void
}) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={active}
			aria-label={t ? `${t.title} (${t.year})` : "Loading title"}
			title={t ? `${t.title} (${t.year})` : undefined}
			onClick={onClick}
			className={`group relative w-[4.25rem] shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg`}
		>
			<span className={`block aspect-[2/3] overflow-hidden rounded-lg bg-white/[0.06] ${active ? `ring-2 ring-offset-2 ring-offset-gray-950 ${tone === "pos" ? "ring-emerald-400" : "ring-rose-400"}` : "opacity-80 group-hover:opacity-100"}`}>
				{t ? (
					t.poster ? (
						<img src={`${POSTER}${t.poster}`} alt="" className="h-full w-full object-cover" />
					) : (
						<span className="grid h-full place-items-center p-1 text-[10px] leading-tight text-gray-400">{t.title}</span>
					)
				) : (
					<span className="block h-full w-full animate-pulse bg-white/[0.08] motion-reduce:animate-none" />
				)}
			</span>
			<span className="mt-1 block truncate text-left text-[11px] text-gray-400">{t ? t.title : "…"}</span>
			{active && (
				<span className={`absolute top-1 right-1 grid h-4 w-4 place-items-center rounded-full text-white ${tone === "pos" ? "bg-emerald-500" : "bg-rose-500"}`}>
					<XMarkIcon className="h-3 w-3" />
				</span>
			)}
		</motion.button>
	)
}

/**
 * Similar to, Loved, Disliked: the chosen posters, and a search that shows results while the field has focus; picking
 * one closes the results until the field is tapped again. Eight results, then "More results".
 */
function TitlePicker({ ctx, group }: { ctx: Ctx; group: "similarTo" | "loved" | "disliked" }) {
	const { state } = ctx.data
	const [text, setText] = useState("")
	const [showResults, setShowResults] = useState(false)
	const [more, setMore] = useState(false)
	const input = useRef<HTMLInputElement>(null)
	const chosen = state[group] ?? []
	const names = useTitleNames(chosen, "")
	const { found, loading } = useQuickTitles(text)
	// What a pick already told us, so its poster shows at once.
	const [seen, setSeen] = useState(() => new Map<TitleKey, Found>())
	const known = (key: TitleKey): Found | undefined => {
		const n = names.byKey.get(key)
		return seen.get(key) ?? (n ? { key, title: n.title, year: n.year, poster: n.poster } : undefined)
	}
	const other = group === "loved" ? "disliked" : group === "disliked" ? "loved" : null
	const toggle = (t: Found) => {
		setSeen((m) => new Map(m).set(t.key, t))
		ctx.set({
			[group]: toggleIn(chosen, t.key),
			...(other ? { [other]: state[other]?.filter((k) => k !== t.key) } : {}),
		} as Partial<FilterState>)
		setShowResults(false)
		input.current?.blur()
	}
	const tone = group === "disliked" ? "neg" : "pos"
	const list = more ? found : found.slice(0, 8)
	return (
		<div className="space-y-3">
			{chosen.length > 0 && (
				<div className="flex flex-wrap gap-2.5">
					{chosen.map((k) => {
						const t = known(k)
						return <Poster key={k} t={t} active tone={tone} onClick={() => t && toggle(t)} />
					})}
				</div>
			)}
			<SearchField
				inputRef={input}
				value={text}
				onChange={(v) => {
					setText(v)
					setMore(false)
					setShowResults(true)
				}}
				onFocus={() => setShowResults(true)}
				loading={loading}
				placeholder={group === "similarTo" ? "Add a movie or show" : group === "loved" ? "Add a title you loved" : "Add a title you disliked"}
			/>
			{showResults && text.trim().length >= 2 && (
				<div>
					{found.length === 0 && !loading && <p className="text-[13px] text-gray-500">No title called “{text}”.</p>}
					{found.length === 0 && loading && (
						<div className="flex gap-2.5">
							{[0, 1, 2, 3, 4].map((i) => (
								<Poster key={i} t={undefined} active={false} tone={tone} onClick={() => {}} />
							))}
						</div>
					)}
					<div className="flex flex-wrap gap-2.5">
						{list.map((t) => (
							<Poster key={t.key} t={t} active={chosen.includes(t.key)} tone={tone} onClick={() => toggle(t)} />
						))}
					</div>
					{found.length > 8 && <More hidden={found.length - 8} open={more} onClick={() => setMore(!more)} label={`More results (${found.length - 8})`} />}
				</div>
			)}
		</div>
	)
}

const PROFILE = "https://image.tmdb.org/t/p/w92"

function PeoplePicker({ ctx }: { ctx: Ctx }) {
	const { state } = ctx.data
	const [text, setText] = useState("")
	const [showResults, setShowResults] = useState(false)
	const [more, setMore] = useState(false)
	const input = useRef<HTMLInputElement>(null)
	const chosen = state.people ?? []
	const term = useDebounced(text.trim())
	const q = useQuery<{ castMembers: { tmdb_id: number; name: string; profile_path: string | null; popularity: number | null }[] }>({
		queryKey: ["proto-people", term],
		queryFn: async () => (await fetch(`/api/cast?${new URLSearchParams({ text: term, withCast: "", withoutCast: "" })}`)).json(),
		enabled: term.length >= 2,
		staleTime: 60_000,
	})
	const names = useQuery<{ castMembers: { tmdb_id: number; name: string; profile_path: string | null }[] }>({
		queryKey: ["proto-people-chosen", chosen.join(",")],
		queryFn: async () => (await fetch(`/api/cast?${new URLSearchParams({ text: "", withCast: chosen.join(","), withoutCast: "" })}`)).json(),
		enabled: chosen.length > 0,
		placeholderData: (p) => p,
	})
	const [seen, setSeen] = useState(() => new Map<number, { name: string; profile: string | null }>())
	const nameOf = (id: number) => seen.get(id) ?? (() => {
		const p = names.data?.castMembers.find((m) => m.tmdb_id === id)
		return p ? { name: p.name, profile: p.profile_path } : undefined
	})()
	// The cast search ranks loosely: faces and the better-known first.
	const found = (term.length >= 2 ? (q.data?.castMembers ?? []) : [])
		.slice()
		.sort((a, b) => Number(!!b.profile_path) - Number(!!a.profile_path) || (b.popularity ?? 0) - (a.popularity ?? 0))
	const loading = text.trim().length >= 2 && (q.isFetching || term !== text.trim())
	const pick = (id: number, name: string, profile: string | null) => {
		setSeen((m) => new Map(m).set(id, { name, profile }))
		ctx.set({ people: toggleIn(chosen, id) })
		setShowResults(false)
		input.current?.blur()
	}
	const list = more ? found.slice(0, 40) : found.slice(0, 8)
	return (
		<div className="space-y-3">
			{chosen.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{chosen.map((id) => {
						const p = nameOf(id)
						return (
							<Chip
								key={id}
								img={p?.profile ? `${PROFILE}${p.profile}` : null}
								o={{ id: String(id), label: p?.name ?? "…", active: true, count: null, toggle: () => pick(id, p?.name ?? "", p?.profile ?? null) }}
							/>
						)
					})}
				</div>
			)}
			<SearchField
				inputRef={input}
				value={text}
				onChange={(v) => {
					setText(v)
					setMore(false)
					setShowResults(true)
				}}
				onFocus={() => setShowResults(true)}
				loading={loading}
				placeholder="Add an actor or director"
			/>
			{showResults && text.trim().length >= 2 && (
				<div className="flex flex-wrap gap-1.5">
					{found.length === 0 && !loading && <p className="text-[13px] text-gray-500">No one called “{text}”.</p>}
					{list.map((p) => (
						<Chip
							key={p.tmdb_id}
							img={p.profile_path ? `${PROFILE}${p.profile_path}` : null}
							o={{ id: String(p.tmdb_id), label: p.name, active: chosen.includes(p.tmdb_id), count: null, toggle: () => pick(p.tmdb_id, p.name, p.profile_path) }}
						/>
					))}
					{found.length > 8 && <More hidden={found.length - 8} open={more} onClick={() => setMore(!more)} label={`More people (${Math.min(found.length, 40) - 8})`} />}
				</div>
			)}
		</div>
	)
}

/** One "and up" bar per source; the sources filter together (all must pass). */
function SourcesControl({ ctx }: { ctx: Ctx }) {
	const { state } = ctx.data
	return (
		<div className="space-y-3.5">
			{SOURCES.map((src) => {
				const value = Number(state.legacy?.[src.param] ?? 0)
				return (
					<div key={src.param}>
						<p className="mb-1 text-[12px] text-gray-400">{src.name}</p>
						<ThresholdBar
							label={src.name}
							steps={[{ v: 0, label: "Any" }, ...src.steps.map((v) => ({ v, label: src.fmt(v) }))]}
							value={value}
							onChange={(v) => ctx.set(legacyPatch(state, { [src.param]: v || null }))}
							color={() => src.color}
						/>
					</div>
				)
			})}
		</div>
	)
}

const SCORE_STEPS = [
	{ v: 0, label: "Any" },
	{ v: 60, label: "60+" },
	{ v: 70, label: "70+" },
	{ v: 80, label: "80+" },
]
const MATCH_STEPS = [
	{ v: 0, label: "Any" },
	{ v: 70, label: "70%+" },
	{ v: 80, label: "80%+" },
	{ v: 90, label: "90%+" },
]

/** The control for one group. `trim` is for the essentials: the most-used options with "+N more". */
function Control({ ctx, k, trim }: { ctx: Ctx; k: Key; trim: boolean }) {
	const g = ctx.groups.find((x) => x.key === k)
	const { state, counts } = ctx.data
	switch (k) {
		case "services":
			return <ServicesControl ctx={ctx} limit={trim ? 6 : 14} />
		case "type":
			return <TypeControl ctx={ctx} />
		case "genres":
			return <ChipList options={genreOptions(ctx)} limit={trim ? 8 : 12} sort />
		case "moods":
		case "themes":
		case "styles":
			return g ? (
				<>
					<ChipList options={g.options} limit={trim ? 6 : 8} />
					{ctx.refusal?.group === k && <p className="mt-2 text-xs text-amber-300">{ctx.refusal.text}</p>}
				</>
			) : null
		case "minScore":
			return (
				<ThresholdBar
					label="Score"
					steps={SCORE_STEPS}
					value={state.minScore}
					onChange={(minScore) => ctx.set({ minScore: minScore as FilterState["minScore"] })}
					color={(v) => `bg-vibe-${goodwatchVibeIndex(v)}`}
					counts={(v) => counts?.optionCounts.minScore?.[String(v)] ?? null}
				/>
			)
		case "minMatch":
			return (
				<>
					<ThresholdBar
						label="Taste match"
						steps={MATCH_STEPS}
						value={state.minMatch}
						onChange={(minMatch) => ctx.set({ minMatch: minMatch as FilterState["minMatch"] })}
						color={() => "bg-amber-400"}
						disabled={!!g?.needs}
						counts={g?.needs ? undefined : (v) => counts?.optionCounts.minMatch?.[String(v)] ?? null}
					/>
					{g?.needs && <NeedsTaste needs={g.needs} />}
				</>
			)
		case "sources":
			return <SourcesControl ctx={ctx} />
		case "gap":
			return (
				<div className="space-y-2.5">
					<div className="flex flex-wrap gap-1.5">
						{GAPS.map((g) => (
							<Chip
								key={g.id}
								o={{
									id: g.id || "any",
									label: g.label,
									active: (state.legacy?.scoreGap ?? "") === g.id,
									count: null,
									toggle: () => ctx.set(legacyPatch(state, { scoreGap: g.id || null })),
								}}
							/>
						))}
					</div>
					<p className="text-[12px] text-gray-500">Critics: Rotten Tomatoes critics or Metacritic. Audiences: IMDb or Rotten Tomatoes audience. "Differ" is 15 points or more.</p>
				</div>
			)
		case "released":
			return <YearControl ctx={ctx} />
		case "length":
			return <LengthControl ctx={ctx} />
		case "similarTo":
		case "loved":
		case "disliked":
			return <TitlePicker ctx={ctx} group={k} />
		case "people":
			return <PeoplePicker ctx={ctx} />
		default:
			return g?.body ? <>{g.body}</> : null
	}
}

/** The keys this viewer gets: Age & content only with a ladder. */
const available = (ctx: Ctx, keys: Key[]) =>
	keys.filter((k) => k === "length" || k === "released" || k === "sources" || k === "gap" || ctx.groups.some((g) => g.key === k))

function Label({ k, ctx, fit }: { k: Key; ctx: Ctx; fit?: boolean }) {
	const on = isSet(ctx, k)
	return (
		<span className="flex min-w-0 items-center gap-2">
			<span className={`h-2 w-2 shrink-0 rounded-full ${accent(k)}`} />
			<span className={`${fit ? "truncate" : "shrink-0"} text-[14px] font-semibold text-gray-100`}>{TITLES[k]}</span>
			{on && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
		</span>
	)
}

function ClearButton({ ctx, k }: { ctx: Ctx; k: Key }) {
	if (!isSet(ctx, k)) return null
	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation()
				ctx.replace(cleared(ctx, k))
			}}
			className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer hover:bg-white/[0.08] hover:text-white"
		>
			Clear
		</button>
	)
}

/**
 * A filter as a card: its own surface, so filter types read as separate things. The header carries Clear (once set)
 * and, when given, a fold or remove action.
 */
function Card({
	ctx,
	k,
	trim,
	onFold,
	onRemove,
	highlight,
}: {
	ctx: Ctx
	k: Key
	trim: boolean
	onFold?: () => void
	onRemove?: () => void
	highlight?: boolean
}) {
	const ref = useRef<HTMLElement>(null)
	useLayoutEffect(() => {
		if (!highlight || !ref.current) return
		ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" })
		ref.current.animate([{ boxShadow: "0 0 0 2px rgba(251,191,36,.6)" }, { boxShadow: "0 0 0 2px rgba(251,191,36,0)" }], { duration: 1200 })
	}, [highlight])
	return (
		<motion.section
			ref={ref}
			layout="position"
			initial={false}
			aria-label={TITLES[k]}
			className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]"
		>
			<div className="-mt-1 mb-3 flex min-h-8 items-center gap-2">
				{onFold ? (
					<button type="button" onClick={onFold} aria-expanded className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
						<Label k={k} ctx={ctx} />
					</button>
				) : (
					<span className="flex min-w-0 flex-1">
						<Label k={k} ctx={ctx} />
					</span>
				)}
				<ClearButton ctx={ctx} k={k} />
				{onFold && (
					<button type="button" onClick={onFold} aria-label={`Fold ${TITLES[k]}`} className="grid h-7 w-7 place-items-center rounded-md text-gray-500 cursor-pointer hover:bg-white/[0.08] hover:text-white">
						<ChevronDownIcon className="h-4 w-4 rotate-180" />
					</button>
				)}
				{onRemove && (
					<button type="button" onClick={onRemove} aria-label={`Remove ${TITLES[k]}`} className="grid h-7 w-7 place-items-center rounded-md text-gray-500 cursor-pointer hover:bg-white/[0.08] hover:text-white">
						<XMarkIcon className="h-4 w-4" />
					</button>
				)}
			</div>
			<Control ctx={ctx} k={k} trim={trim} />
		</motion.section>
	)
}

// ---------------------------------------------------------------- popular quick adds

/** A one-tap filter most people look for: it sets the value and brings in its card. */
interface Popular {
	id: string
	label: string
	key: Key
	on: (s: FilterState) => boolean
	apply: (ctx: Ctx) => Partial<FilterState>
	count?: (ctx: Ctx) => number | null
	logo?: (ctx: Ctx) => string | null
}

const addTo = <T,>(list: T[] | undefined, v: T) => [...new Set([...(list ?? []), v])]
const oc = (ctx: Ctx, g: FilterName, o: string) => ctx.data.counts?.optionCounts[g]?.[o] ?? null

const POPULAR: Popular[] = [
	{
		id: "netflix",
		label: "On Netflix",
		key: "services",
		on: (s) => !s.onMyServices && !!s.services?.includes(8),
		apply: () => ({ onMyServices: false, services: [8] }),
		logo: (ctx) => {
			const p = ctx.data.countryProviders.find((x) => x.id === 8)
			return p ? `${PROVIDER_LOGO}${p.logo_path}` : null
		},
	},
	{ id: "comedy", label: "Comedy", key: "genres", on: (s) => s.genres.includes("Comedy"), apply: (ctx) => ({ genres: addTo(ctx.data.state.genres, "Comedy") }), count: (ctx) => oc(ctx, "genres", "Comedy") },
	{ id: "feelgood", label: "Feel-good", key: "moods", on: (s) => s.moods.includes("feelgood"), apply: (ctx) => ({ moods: addTo(ctx.data.state.moods, "feelgood").slice(-3) as FilterState["moods"] }), count: (ctx) => oc(ctx, "moods", "feelgood") },
	{ id: "score80", label: "Score 80+", key: "minScore", on: (s) => s.minScore >= 80, apply: () => ({ minScore: 80 as FilterState["minScore"] }), count: (ctx) => oc(ctx, "minScore", "80") },
	{ id: "recent", label: "Last 3 years", key: "released", on: (s) => s.released === "recent", apply: (ctx) => ({ released: "recent", ...legacyPatch(ctx.data.state, { minYear: null, maxYear: null }) }), count: (ctx) => oc(ctx, "released", "recent") },
	{ id: "short", label: "Under 90 min", key: "length", on: (s) => s.legacy?.maxRuntime === "90", apply: (ctx) => legacyPatch(ctx.data.state, { minRuntime: null, maxRuntime: 90 }) },
	{ id: "agree", label: "Critics and audiences agree", key: "gap", on: (s) => s.legacy?.scoreGap === "agree", apply: (ctx) => legacyPatch(ctx.data.state, { scoreGap: "agree" }) },
	{ id: "mind", label: "Mind-bending", key: "moods", on: (s) => s.moods.includes("mind"), apply: (ctx) => ({ moods: addTo(ctx.data.state.moods, "mind").slice(-3) as FilterState["moods"] }), count: (ctx) => oc(ctx, "moods", "mind") },
	{ id: "imdb8", label: "IMDb 8.0+", key: "sources", on: (s) => Number(s.legacy?.minImdb ?? 0) >= 80, apply: (ctx) => legacyPatch(ctx.data.state, { minImdb: 80 }) },
	{ id: "horror", label: "Horror", key: "genres", on: (s) => s.genres.includes("Horror"), apply: (ctx) => ({ genres: addTo(ctx.data.state.genres, "Horror") }), count: (ctx) => oc(ctx, "genres", "Horror") },
	{ id: "noanime", label: "No anime", key: "type", on: (s) => s.anime === "none", apply: () => ({ anime: "none" }), count: (ctx) => oc(ctx, "anime", "none") },
	{ id: "episodes", label: "Short episodes", key: "length", on: (s) => s.legacy?.maxRuntime === "35", apply: (ctx) => ({ type: "show", ...legacyPatch(ctx.data.state, { minRuntime: null, maxRuntime: 35 }) }) },
]

type QuickStyle = "chips" | "tiles" | "cards"

function PopularPicks({ ctx, style, onPick }: { ctx: Ctx; style: QuickStyle; onPick: (p: Popular) => void }) {
	const picks = POPULAR.filter((p) => !p.on(ctx.data.state) && (!p.logo || p.logo(ctx)))
	if (!picks.length) return null
	const meta = (p: Popular) => {
		const n = p.count?.(ctx)
		return n != null ? `${compact(n)} titles` : TITLES[p.key]
	}
	return (
		<section aria-label="Popular filters" className="mt-1">
			<h3 className="mb-2 text-[13px] font-semibold text-gray-400">Popular</h3>
			{style === "chips" && (
				<div className="flex flex-wrap gap-1.5">
					{picks.map((p) => {
						const logo = p.logo?.(ctx)
						const n = p.count?.(ctx)
						return (
							<motion.button
								key={p.id}
								type="button"
								whileTap={TAP}
								onClick={() => onPick(p)}
								className={`flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] text-[13px] text-gray-200 ring-1 ring-white/[0.06] cursor-pointer outline-none hover:bg-white/[0.11] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${logo ? "pr-3 pl-1" : "pr-3 pl-2"}`}
							>
								{logo ? (
									<img src={logo} alt="" className="h-6 w-6 rounded-full object-cover" />
								) : (
									<PlusIcon className="h-3.5 w-3.5 text-gray-500" />
								)}
								{p.label}
								{n != null && <span className="text-[11px] tabular-nums text-gray-500">{compact(n)}</span>}
							</motion.button>
						)
					})}
				</div>
			)}
			{style === "tiles" && (
				<div className="grid grid-cols-2 gap-1.5">
					{picks.slice(0, 8).map((p) => {
						const logo = p.logo?.(ctx)
						return (
							<motion.button
								key={p.id}
								type="button"
								whileTap={TAP}
								onClick={() => onPick(p)}
								className="flex min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.035] px-3 py-2.5 text-left ring-1 ring-white/[0.06] cursor-pointer outline-none hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								{logo ? (
									<img src={logo} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" />
								) : (
									<span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06]`}>
										<span className={`h-2 w-2 rounded-full ${accent(p.key)}`} />
									</span>
								)}
								<span className="min-w-0">
									<span className="block truncate text-[13px] font-semibold text-gray-100">{p.label}</span>
									<span className="block truncate text-[11px] text-gray-500">{meta(p)}</span>
								</span>
							</motion.button>
						)
					})}
				</div>
			)}
			{style === "cards" && (
				<div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] max-lg:-mx-4 max-lg:px-4">
					{picks.map((p) => {
						const logo = p.logo?.(ctx)
						return (
							<motion.button
								key={p.id}
								type="button"
								whileTap={TAP}
								onClick={() => onPick(p)}
								className="relative flex h-[5.5rem] w-[8.5rem] shrink-0 flex-col justify-between overflow-hidden rounded-2xl bg-white/[0.04] p-3 text-left ring-1 ring-white/[0.07] cursor-pointer outline-none hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span className="flex items-center justify-between">
									{logo ? (
										<img src={logo} alt="" className="h-6 w-6 rounded-md object-cover" />
									) : (
										<span className={`h-2 w-2 rounded-full ${accent(p.key)}`} />
									)}
									<PlusIcon className="h-4 w-4 text-gray-500" />
								</span>
								<span>
									<span className="block text-[13px] leading-tight font-semibold text-gray-100">{p.label}</span>
									<span className="block truncate text-[11px] text-gray-500">{meta(p)}</span>
								</span>
							</motion.button>
						)
					})}
				</div>
			)}
		</section>
	)
}

// ---------------------------------------------------------------- the sheet: add filters as you go

/**
 * Cards for Movies or shows, Mood, Taste match, and Score to start, plus anything set. Popular filters sit above
 * "Add a filter": a tap sets the value and brings in (and points at) its card. "Add a filter" opens a picker of the
 * rest; a card's × clears it and takes it away.
 */
function AddAsYouGo({ ctx, style }: { ctx: Ctx; style: QuickStyle }) {
	const keys = available(ctx, ctx.order)
	const [added, setAdded] = useState<Set<Key>>(() => new Set(keys.filter((k) => OPEN_AT_START.has(k) || isSet(ctx, k))))
	const [picking, setPicking] = useState(false)
	const [fresh, setFresh] = useState<{ k: Key; n: number } | null>(null)
	// Anything set from elsewhere (a chip, a recovery) gets its card too.
	const shown = keys.filter((k) => added.has(k) || isSet(ctx, k))
	const left = keys.filter((k) => !shown.includes(k))
	const add = (k: Key) => {
		setAdded((s) => new Set(s).add(k))
		setFresh((f) => ({ k, n: (f?.n ?? 0) + 1 }))
		setPicking(false)
	}
	const remove = (k: Key) => {
		ctx.replace(cleared(ctx, k))
		setAdded((s) => {
			const n = new Set(s)
			n.delete(k)
			return n
		})
	}
	return (
		<div className="flex flex-col gap-3">
			<AnimatePresence initial={false}>
				{shown.map((k) => (
					<motion.div key={k} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.18 }}>
						<Card key={fresh?.k === k ? `${k}-${fresh.n}` : k} ctx={ctx} k={k} trim={ESSENTIALS.has(k)} onRemove={() => remove(k)} highlight={fresh?.k === k} />
					</motion.div>
				))}
			</AnimatePresence>
			<PopularPicks
				ctx={ctx}
				style={style}
				onPick={(p) => {
					ctx.set(p.apply(ctx))
					add(p.key)
				}}
			/>
			{left.length > 0 && (
				<div className="rounded-2xl ring-1 ring-dashed ring-white/15">
					<button
						type="button"
						onClick={() => setPicking(!picking)}
						aria-expanded={picking}
						className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-gray-200 cursor-pointer outline-none hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<PlusIcon className={`h-4 w-4 transition-transform ${picking ? "rotate-45" : ""}`} />
						{picking ? "Close" : "Add a filter"}
					</button>
					{picking && (
						<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-1.5 px-2 pb-2">
							{left.map((k) => (
								<button
									key={k}
									type="button"
									onClick={() => add(k)}
									className="flex min-w-0 flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left cursor-pointer outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<Label k={k} ctx={ctx} fit />
									<span className="truncate pl-4 text-[12px] text-gray-500">{HINTS[k]}</span>
								</button>
							))}
						</motion.div>
					)}
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------- switch

export function PrototypeFilterGroups(props: Props) {
	const { variant, className = "", data } = props
	const order = useFilterSheetOrder()
	const summaries = useSummaries(props)
	const ctx: Ctx = useMemo(
		() => ({
			...props,
			order,
			summaries,
			set: (patch) => data.onChange({ ...data.state, ...patch }),
			replace: (state) => data.onChange(state),
		}),
		[props, order, summaries, data],
	)
	return (
		<div className={className} data-proto-variant={variant}>
			<p aria-live="polite" className="sr-only">
				{props.refusal?.text ?? ""}
			</p>
			<AddAsYouGo ctx={ctx} style={variant === "J" ? "tiles" : variant === "K" ? "cards" : "chips"} />
		</div>
	)
}

// ---------------------------------------------------------------- bar and header pieces

/**
 * Active filters on one row; what doesn't fit folds into "+N", which shows them all (or, with `onMore`, does that
 * instead, for example opening the sheet).
 */
export function OneRowChips({
	chips,
	state,
	onChange,
	onMore,
	trailing,
	className = "",
}: {
	chips: ActiveChip[]
	state: FilterState
	onChange: (state: FilterState) => void
	onMore?: () => void
	trailing?: ReactNode
	className?: string
}) {
	const list = useRef<HTMLUListElement>(null)
	const [hidden, setHidden] = useState(0)
	const [all, setAll] = useState(false)
	const sig = chips.map((c) => c.key).join("|")
	// biome-ignore lint/correctness/useExhaustiveDependencies: measure again when the chips change
	useLayoutEffect(() => {
		const el = list.current
		if (!el) return
		const measure = () => {
			const items = [...el.children] as HTMLElement[]
			if (!items.length) return setHidden(0)
			const top = items[0].offsetTop
			// A chip that doesn't fit whole (on a later line, or cut at the right) hides and counts in "+N".
			let n = 0
			for (const i of items) {
				const out = !all && (i.offsetTop > top + 4 || i.offsetLeft + i.offsetWidth > el.clientWidth + 1)
				i.style.visibility = out ? "hidden" : ""
				if (out) n++
			}
			setHidden(n)
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [sig, all])
	if (!chips.length) return null
	return (
		<div className={`relative flex min-w-0 items-start gap-1.5 ${className}`}>
			<ul aria-label="Active filters" ref={list} className={`flex min-w-0 flex-1 flex-wrap gap-1.5 ${all ? "" : "max-h-8 overflow-hidden"}`}>
				{chips.map((chip) => (
					<li key={chip.key} className="flex h-8 items-center rounded-full bg-white/[0.06] text-[13px] text-gray-100">
						<TitleChipPreview chip={chip}>
							<span className="flex h-8 items-center gap-1.5 pr-1 pl-3">
								<span className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS[chip.group].dot}`} />
								{chip.label}
							</span>
						</TitleChipPreview>
						<button
							type="button"
							onClick={() => onChange(chip.remove(state))}
							aria-label={`Remove ${chip.label}`}
							className="grid h-8 w-7 place-items-center rounded-r-full text-gray-500 cursor-pointer hover:text-white"
						>
							<XMarkIcon className="h-3.5 w-3.5" />
						</button>
					</li>
				))}
			</ul>
			{/* When none fits, the Filters count says it already. */}
			{(all || (hidden > 0 && hidden < chips.length)) && (
				<button
					type="button"
					onClick={() => (onMore && !all ? onMore() : setAll(!all))}
					className="h-8 shrink-0 rounded-full bg-white/[0.06] px-3 text-[13px] font-semibold text-gray-200 cursor-pointer hover:bg-white/[0.11]"
				>
					{all ? "Less" : `+${hidden}`}
				</button>
			)}
			{trailing}
		</div>
	)
}

