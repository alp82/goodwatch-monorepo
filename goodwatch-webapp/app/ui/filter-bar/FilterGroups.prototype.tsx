// PROTOTYPE - throwaway. Round 2 of the Filters sheet layouts (desktop side sheet and phone sheet), switched with
// ?variant=, the group order with ?order=, and a signed-in preview with ?as=member. "now" is the live list. A search
// in the sheet falls back to the live list. Round 1 (A-D) is in commit b877654c.
//
// E  Essentials, then everything: five essentials trimmed, one "All filters" opens the rest in place, in full.
// F  Unfolding tiles: essentials, then tiles; a tile opens under its row, in place.
// G  Compact rows: one row per group with hover; small controls sit in the row, big groups fold.
//
// Shared: calmer chips, segmented Movies or shows + Anime, threshold bars for score and taste match, range sliders
// for year and length (the legacy minYear/maxYear and minRuntime/maxRuntime filters, which still apply), merged
// TMDB TV genres, searchable service pills, inline search for Similar to and Cast and crew.
import {
	ChevronDownIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useSearchParams } from "@remix-run/react"
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { ladderStepFor } from "~/domain/age-content"
import type { FilterName, FilterState } from "~/domain/filter-state"
import { productionCountryName } from "~/domain/production-country"
import { goodwatchVibeIndex } from "~/utils/ratings"
import type { TitleKey } from "~/utils/title-key"
import {
	type FilterGroupsData,
	type Group,
	NeedsTaste,
	type Option,
	OptionPoster,
	type Refusal,
} from "./FilterGroups"
import {
	ANIME_LABELS,
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
	usePeopleNames,
	useTitleNames,
} from "./useFilterData"

// ---------------------------------------------------------------- switches

export const FILTER_SHEET_VARIANTS = {
	now: "Live today",
	E: "Essentials, then everything",
	F: "Unfolding tiles",
	G: "Compact rows",
} as const
export type FilterSheetVariant = keyof typeof FILTER_SHEET_VARIANTS

/** A group of the sheet, plus Length (runtime), which the live sheet doesn't offer. */
type Key = FilterName | "length"

export const FILTER_SHEET_ORDERS: Record<string, { label: string; keys: Key[] }> = {
	where: {
		label: "Where, what, how good",
		keys: ["services", "type", "genres", "moods", "minScore", "released", "length", "minMatch", "themes", "styles", "similarTo", "people", "ageLimit", "productionCountries", "loved", "disliked"],
	},
	what: {
		label: "What first",
		keys: ["type", "genres", "moods", "minScore", "services", "released", "length", "themes", "styles", "minMatch", "people", "similarTo", "ageLimit", "productionCountries", "loved", "disliked"],
	},
	quick: {
		label: "Quick controls first",
		keys: ["type", "minScore", "services", "genres", "moods", "released", "length", "minMatch", "ageLimit", "themes", "styles", "similarTo", "people", "productionCountries", "loved", "disliked"],
	},
	vibe: {
		label: "Vibe first",
		keys: ["moods", "genres", "type", "minScore", "services", "styles", "themes", "minMatch", "released", "length", "similarTo", "loved", "disliked", "people", "ageLimit", "productionCountries"],
	},
}

const ESSENTIALS = new Set<Key>(["services", "type", "genres", "moods", "minScore"])

export function useFilterSheetVariant(): FilterSheetVariant {
	const [params] = useSearchParams()
	const v = params.get("variant")
	return v && v in FILTER_SHEET_VARIANTS ? (v as FilterSheetVariant) : "now"
}

export function useFilterSheetOrder(): Key[] {
	const [params] = useSearchParams()
	return (FILTER_SHEET_ORDERS[params.get("order") ?? ""] ?? FILTER_SHEET_ORDERS.where).keys
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
	const current: FilterSheetVariant = raw && raw in FILTER_SHEET_VARIANTS ? (raw as FilterSheetVariant) : "now"
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
		<div className="fixed top-2 left-1/2 z-[2000] flex w-max max-w-[96vw] -translate-x-1/2 lg:left-4 lg:translate-x-0 flex-wrap items-center justify-center gap-1.5 rounded-3xl bg-white px-2 py-1.5 text-[13px] font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500">
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
				value={params.get("order") ?? "where"}
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
}

const YEAR_MIN = 1920
const YEAR_MAX = 2026
const LEN_MAX = 240

const num = (v: string | undefined) => (v === undefined || v === "" ? null : Number(v))

function legacyPatch(state: FilterState, patch: Record<string, number | null>): Partial<FilterState> {
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
	return {
		type:
			state.anime === "any"
				? TYPE_LABELS[state.type]
				: `${TYPE_LABELS[state.type]}, ${ANIME_LABELS[state.anime].toLowerCase()}`,
		minScore: SCORE_LABELS[state.minScore as keyof typeof SCORE_LABELS] ?? `${state.minScore}+`,
		minMatch: MATCH_LABELS[state.minMatch as keyof typeof MATCH_LABELS] ?? `${state.minMatch}%+`,
		released: yearsSet ? `${ylo}–${yhi >= YEAR_MAX ? "now" : yhi}` : RELEASED_LABELS[state.released],
		length: llo === 0 && lhi >= LEN_MAX ? "Any length" : `${fmtLen(llo)} – ${fmtLen(lhi)}`,
		services: state.onMyServices ? "My services" : list("services", "Everywhere"),
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
	if (k === "released") return s.released !== "any" || !!(s.legacy?.minYear || s.legacy?.maxYear)
	if (k === "type") return s.type !== "all" || s.anime !== "any"
	if (k === "services") return s.onMyServices || !!s.services?.length
	return (ctx.groups.find((g) => g.key === k)?.badge ?? 0) > 0
}

const TITLES: Record<Key, string> = {
	services: "Streaming services",
	type: "Movies or shows",
	genres: "Genre",
	moods: "Mood",
	minScore: "GoodWatch score",
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

const accent = (k: Key) => (k === "length" ? "bg-sky-400" : FILTER_ACCENTS[k].dot)

// ---------------------------------------------------------------- atoms

const compact = (n: number) =>
	n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n)

/** The calm chip: 32 px, the count quiet, white when on. */
function Chip({ o }: { o: Option }) {
	const dead = o.disabled || (!o.active && o.count === 0)
	return (
		<motion.button
			type="button"
			aria-pressed={o.active}
			aria-disabled={o.disabled || undefined}
			whileTap={o.disabled ? undefined : TAP}
			onClick={() => !o.disabled && o.toggle()}
			className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${o.disabled ? "cursor-not-allowed" : "cursor-pointer"} ${
				o.active
					? "bg-white font-semibold text-gray-950"
					: dead
						? "bg-white/[0.02] text-gray-600"
						: "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white"
			}`}
		>
			{o.swatch}
			{o.label}
			{!o.active && o.count !== null && (
				<span className="text-[11px] tabular-nums text-gray-500">{compact(o.count)}</span>
			)}
		</motion.button>
	)
}

function More({ hidden, open, onClick }: { hidden: number; open: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-expanded={open}
			className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			{open ? "Show fewer" : `+${hidden} more`}
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
						className={`relative flex items-center justify-center gap-1.5 rounded-[10px] px-2 whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${small ? "text-xs" : "text-[13px]"} ${on ? "font-semibold text-gray-950" : "text-gray-300 hover:bg-white/[0.05] hover:text-white"}`}
					>
						{on && (
							<motion.span
								layoutId={`seg-${label}`}
								transition={{ type: "spring", stiffness: 500, damping: 40 }}
								className="absolute inset-0 rounded-[10px] bg-white"
							/>
						)}
						<span className="relative">{o.label}</span>
						{!on && o.count != null && (
							<span className="relative text-[11px] tabular-nums text-gray-500">{compact(o.count)}</span>
						)}
					</button>
				)
			})}
		</div>
	)
}

/**
 * "And up" as a bar: one segment per step, every segment from the chosen one to the right lit, so the bar reads as
 * the part of the scale that stays in.
 */
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
		<div
			role="radiogroup"
			aria-label={label}
			className={`grid auto-cols-fr grid-flow-col gap-1 ${disabled ? "opacity-40" : ""}`}
		>
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
						<span
							className={`h-2 rounded-full transition-colors ${lit ? color(s.v) : on ? "bg-white" : "bg-white/[0.09] group-hover:bg-white/20"}`}
						/>
						<span
							className={`text-left text-[12px] leading-tight ${on ? "font-semibold text-white" : "text-gray-400 group-hover:text-gray-200"}`}
						>
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
				<div
					className={`absolute top-[10px] h-1 rounded-full ${full ? "bg-white/25" : "bg-amber-400"}`}
					style={{ left: `${pct(v[0])}%`, right: `${100 - pct(v[1])}%` }}
				/>
				<input
					type="range"
					aria-label={`${label} from`}
					min={min}
					max={max}
					step={step}
					value={v[0]}
					onChange={(e) => setV([Math.min(Number(e.target.value), v[1] - step), v[1]])}
					className={thumb}
				/>
				<input
					type="range"
					aria-label={`${label} to`}
					min={min}
					max={max}
					step={step}
					value={v[1]}
					onChange={(e) => setV([v[0], Math.max(Number(e.target.value), v[0] + step)])}
					className={thumb}
				/>
			</div>
		</div>
	)
}

/** A small search field inside a group. */
function MiniSearch({
	value,
	onChange,
	placeholder,
	autoFocus,
}: {
	value: string
	onChange: (v: string) => void
	placeholder: string
	autoFocus?: boolean
}) {
	return (
		<label className="flex h-9 items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 focus-within:ring-1 focus-within:ring-amber-500/60">
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" />
			<input
				type="search"
				value={value}
				// biome-ignore lint/a11y/noAutofocus: opened by the person to type
				autoFocus={autoFocus}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				aria-label={placeholder}
				className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
			/>
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					aria-label="Clear"
					className="text-gray-500 hover:text-white"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</label>
	)
}

// ---------------------------------------------------------------- controls per group

const toggleIn = <T,>(list: T[] | undefined, value: T) => {
	const next = (list ?? []).includes(value)
		? (list ?? []).filter((v) => v !== value)
		: [...(list ?? []), value]
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
					options={(["all", "movie", "show"] as const).map((id) => ({
						id,
						label: id === "all" ? "Both" : TYPE_LABELS[id],
						count: c("type", id),
					}))}
				/>
			</div>
			<div className="flex">
				<Segmented
					label="Anime"
					small
					value={state.anime}
					onChange={(anime) => ctx.set({ anime })}
					options={(["any", "only", "none"] as const).map((id) => ({
						id,
						label: id === "any" ? "With anime" : ANIME_LABELS[id],
						count: c("anime", id),
					}))}
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

function ServicesControl({ ctx, limit }: { ctx: Ctx; limit: number }) {
	const { state, myServices, countryProviders } = ctx.data
	const [search, setSearch] = useState("")
	const [open, setOpen] = useState(false)
	const chosen = state.onMyServices ? myServices : (state.services ?? [])
	const term = search.trim().toLowerCase()
	const rank = (id: number) => (chosen.includes(id) ? 0 : myServices.includes(id) ? 1 : 2)
	const sorted = countryProviders
		.map((p, i) => ({ p, i }))
		.sort((a, b) => rank(a.p.id) - rank(b.p.id) || a.i - b.i)
		.map(({ p }) => p)
	const matches = term ? sorted.filter((p) => p.name.toLowerCase().includes(term)) : sorted
	const keep = Math.max(limit, chosen.length)
	const shown = term || open ? matches.slice(0, 60) : matches.slice(0, keep)
	const everywhere = !state.onMyServices && !state.services?.length
	const country = state.streamingCountry ?? ctx.data.streamingCountry ?? "US"
	const countryCodes = [...new Set([country, ...ctx.countries.map((c) => c.code)])]
	return (
		<div className="space-y-2.5">
			<div className="flex items-center gap-2">
				{myServices.length === 0 ? (
					<p className="flex-1 text-[13px] text-gray-400">
						{everywhere ? "All services. Pick some to narrow." : `${chosen.length} picked`}
					</p>
				) : (
				<Segmented
					label="Where"
					value={state.onMyServices ? "mine" : everywhere ? "all" : "picked"}
					onChange={(v) =>
						v === "mine"
							? ctx.set({ onMyServices: true, services: undefined })
							: v === "all"
								? ctx.set({ onMyServices: false, services: undefined })
								: undefined
					}
					options={[
						...(myServices.length ? [{ id: "mine", label: "My services" }] : []),
						{ id: "all", label: "Everywhere" },
						...(!everywhere && !state.onMyServices
							? [{ id: "picked", label: `${chosen.length} picked` }]
							: []),
					]}
				/>
				)}
				<select
					aria-label="Streaming country"
					value={country}
					onChange={(e) => ctx.set({ streamingCountry: e.target.value })}
					className="h-10 max-w-[10rem] shrink-0 rounded-xl border-0 bg-white/[0.05] py-0 pr-7 pl-2.5 text-[13px] text-gray-300"
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
			</div>
			{(open || term) && (
				<MiniSearch value={search} onChange={setSearch} placeholder="Find a service" autoFocus />
			)}
			<div className="flex flex-wrap gap-1.5">
				{shown.map((p) => {
					const on = chosen.includes(p.id)
					return (
						<motion.button
							key={p.id}
							type="button"
							whileTap={TAP}
							aria-pressed={on}
							onClick={() =>
								ctx.set({
									onMyServices: false,
									services: state.onMyServices ? [p.id] : toggleIn(state.services, p.id),
								})
							}
							className={`flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1 text-[13px] whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-white font-semibold text-gray-950" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11]"}`}
						>
							<img
								src={`${PROVIDER_LOGO}${p.logo_path}`}
								alt=""
								className="h-6 w-6 rounded-full object-cover"
							/>
							{p.name.replace(/ (Amazon Channel|Apple TV Channel)$/, "")}
						</motion.button>
					)
				})}
				{!term && matches.length > keep && (
					<More hidden={matches.length - keep} open={open} onClick={() => setOpen(!open)} />
				)}
				{!open && !term && (
					<button
						type="button"
						onClick={() => setOpen(true)}
						aria-label="Find a service"
						className="grid h-8 w-8 place-items-center rounded-full text-gray-400 cursor-pointer hover:bg-white/[0.08] hover:text-white"
					>
						<MagnifyingGlassIcon className="h-4 w-4" />
					</button>
				)}
				{term && matches.length === 0 && (
					<p className="text-[13px] text-gray-500">No service called “{search}” in this country.</p>
				)}
			</div>
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
				{(["recent", "2010s", "2000s", "before2000"] as const).map((r) => (
					<Chip
						key={r}
						o={{
							id: r,
							label: RELEASED_LABELS[r],
							active: !yearsSet && state.released === r,
							count: c(r),
							toggle: () =>
								ctx.set({
									released: state.released === r && !yearsSet ? "any" : r,
									...clearYears,
								}),
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
					const preset = (
						Object.entries(RELEASED_RANGE) as [FilterState["released"], [number, number]][]
					).find(([, r]) => r[0] === lo && r[1] === hi)
					if (preset) ctx.set({ released: preset[0], ...clearYears })
					else
						ctx.set({
							released: "any",
							...legacyPatch(state, {
								minYear: lo <= YEAR_MIN ? null : lo,
								maxYear: hi >= YEAR_MAX ? null : hi,
							}),
						})
				}}
			/>
		</div>
	)
}

const LENGTH_PRESETS: { label: string; range: [number, number] }[] = [
	{ label: "Under 90 min", range: [0, 90] },
	{ label: "90 min – 2 h", range: [90, 120] },
	{ label: "Over 2 h", range: [120, LEN_MAX] },
	{ label: "Short episodes", range: [0, 35] },
]

function LengthControl({ ctx }: { ctx: Ctx }) {
	const { state } = ctx.data
	const range = lengthRange(state)
	const commit = ([lo, hi]: [number, number]) =>
		ctx.set(
			legacyPatch(state, {
				minRuntime: lo <= 0 ? null : lo,
				maxRuntime: hi >= LEN_MAX ? null : hi,
			}),
		)
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-1.5">
				{LENGTH_PRESETS.map((p) => {
					const on = range[0] === p.range[0] && range[1] === p.range[1]
					return (
						<Chip
							key={p.label}
							o={{
								id: p.label,
								label: p.label,
								active: on,
								count: null,
								toggle: () => commit(on ? [0, LEN_MAX] : p.range),
							}}
						/>
					)
				})}
			</div>
			<RangeSlider
				label="Length"
				min={0}
				max={LEN_MAX}
				step={5}
				value={range}
				format={(m) => (m <= 0 ? "Any" : fmtLen(m))}
				onCommit={commit}
			/>
			<p className="text-[12px] text-gray-500">Movie length, or episode length for shows.</p>
		</div>
	)
}

function SimilarControl({ ctx }: { ctx: Ctx }) {
	const { state } = ctx.data
	const [search, setSearch] = useState("")
	const chosen = state.similarTo ?? []
	const titles = useTitleNames(chosen, search)
	const poster = (t: NamedTitle | undefined, key: TitleKey, active: boolean) => (
		<OptionPoster
			key={key}
			positive
			option={{
				id: String(key),
				label: t ? `${t.title} (${t.year})` : "Title",
				img: t?.poster ? `https://image.tmdb.org/t/p/w154${t.poster}` : null,
				active,
				count: null,
				toggle: () => ctx.set({ similarTo: toggleIn(chosen, key) }),
			}}
		/>
	)
	return (
		<div className="space-y-2.5">
			<MiniSearch value={search} onChange={setSearch} placeholder="Add a movie or show" />
			{(chosen.length > 0 || titles.matches.length > 0) && (
				<div className="flex flex-wrap gap-2">
					{chosen.map((k) => poster(titles.byKey.get(k), k, true))}
					{titles.matches.slice(0, 8).map((t) => poster(t, t.key, false))}
				</div>
			)}
		</div>
	)
}

function PeopleControl({ ctx }: { ctx: Ctx }) {
	const { state } = ctx.data
	const [search, setSearch] = useState("")
	const chosen = state.people ?? []
	const people = usePeopleNames(chosen, search)
	const opt = (id: number, name: string, active: boolean): Option => ({
		id: String(id),
		label: name,
		active,
		count: null,
		toggle: () => {
			ctx.set({ people: toggleIn(chosen, id) })
			setSearch("")
		},
	})
	return (
		<div className="space-y-2.5">
			<MiniSearch value={search} onChange={setSearch} placeholder="Add an actor or director" />
			<div className="flex flex-wrap gap-1.5">
				{chosen.map((id) => (
					<Chip key={id} o={opt(id, people.byId.get(id)?.name ?? "…", true)} />
				))}
				{people.matches.map((p) => (
					<Chip key={p.id} o={opt(p.id, p.name, false)} />
				))}
			</div>
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
			return <ChipList options={genreOptions(ctx)} limit={trim ? 8 : 99} sort />
		case "moods":
		case "themes":
		case "styles":
			return g ? (
				<>
					<ChipList options={g.options} limit={trim ? 6 : 99} />
					{ctx.refusal?.group === k && (
						<p className="mt-2 text-xs text-amber-300">{ctx.refusal.text}</p>
					)}
				</>
			) : null
		case "minScore":
			return (
				<ThresholdBar
					label="GoodWatch score"
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
						counts={
							g?.needs ? undefined : (v) => counts?.optionCounts.minMatch?.[String(v)] ?? null
						}
					/>
					{g?.needs && <NeedsTaste needs={g.needs} />}
				</>
			)
		case "released":
			return <YearControl ctx={ctx} />
		case "length":
			return <LengthControl ctx={ctx} />
		case "similarTo":
			return <SimilarControl ctx={ctx} />
		case "people":
			return <PeopleControl ctx={ctx} />
		default:
			return g?.body ? <>{g.body}</> : null
	}
}

/** The keys this viewer gets: Age & content only with a ladder. */
const available = (ctx: Ctx, keys: Key[]) =>
	keys.filter((k) => k === "length" || k === "released" || ctx.groups.some((g) => g.key === k))

function Label({ k, ctx, right, fit }: { k: Key; ctx: Ctx; right?: ReactNode; fit?: boolean }) {
	const on = isSet(ctx, k)
	return (
		<span className="flex min-w-0 flex-1 items-center gap-2">
			<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent(k)}`} />
			<span className={`${fit ? "truncate" : "shrink-0"} text-[14px] font-semibold text-gray-100`}>{TITLES[k]}</span>
			{on && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
			{right}
		</span>
	)
}

/** A plain section: label, then the control. */
function Section({ ctx, k, trim }: { ctx: Ctx; k: Key; trim: boolean }) {
	return (
		<section aria-label={TITLES[k]}>
			<div className="mb-2.5 flex items-center">
				<Label k={k} ctx={ctx} />
			</div>
			<Control ctx={ctx} k={k} trim={trim} />
		</section>
	)
}

// ---------------------------------------------------------------- E: essentials, then everything

function VariantE({ ctx }: { ctx: Ctx }) {
	const keys = available(ctx, ctx.order)
	const essentials = keys.filter((k) => ESSENTIALS.has(k))
	const rest = keys.filter((k) => !ESSENTIALS.has(k))
	const setInRest = rest.filter((k) => isSet(ctx, k))
	const [all, setAll] = useState(setInRest.length > 0)
	return (
		<div className="flex flex-col gap-7">
			{essentials.map((k) => (
				<Section key={k} ctx={ctx} k={k} trim />
			))}
			<div>
				<button
					type="button"
					onClick={() => setAll(!all)}
					aria-expanded={all}
					className="group flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-left cursor-pointer outline-none hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<span className="min-w-0 flex-1">
						<span className="block text-[14px] font-semibold text-white">
							{all ? "Fewer filters" : `All filters (${rest.length} more)`}
						</span>
						<span className="block truncate text-[12px] text-gray-400">
							{setInRest.length
								? `Set: ${setInRest.map((k) => TITLES[k]).join(", ")}`
								: rest.map((k) => TITLES[k]).join(", ")}
						</span>
					</span>
					<ChevronDownIcon
						className={`h-5 w-5 shrink-0 text-gray-400 transition-transform group-hover:text-white ${all ? "rotate-180" : ""}`}
					/>
				</button>
				{all && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.2 }}
						className="mt-7 flex flex-col gap-7"
					>
						{rest.map((k) => (
							<Section key={k} ctx={ctx} k={k} trim={false} />
						))}
					</motion.div>
				)}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------- F: unfolding tiles

function VariantF({ ctx }: { ctx: Ctx }) {
	const keys = available(ctx, ctx.order)
	const essentials = keys.filter((k) => ESSENTIALS.has(k))
	const rest = keys.filter((k) => !ESSENTIALS.has(k))
	const [open, setOpen] = useState<Key | null>(null)
	const rows: Key[][] = []
	for (let i = 0; i < rest.length; i += 2) rows.push(rest.slice(i, i + 2))
	return (
		<div className="flex flex-col gap-7">
			{essentials.map((k) => (
				<Section key={k} ctx={ctx} k={k} trim />
			))}
			<section aria-label="More filters">
				<h3 className="mb-2.5 text-[14px] font-semibold text-gray-100">More filters</h3>
				<div className="flex flex-col gap-2">
					{rows.map((row) => (
						<div key={row.join()} className="flex flex-col gap-2">
							<div className="grid grid-cols-2 gap-2">
								{row.map((k) => {
									const on = open === k
									const set = isSet(ctx, k)
									return (
										<button
											key={k}
											type="button"
											onClick={() => setOpen(on ? null : k)}
											aria-expanded={on}
											className={`flex min-h-[3.75rem] flex-col justify-center gap-0.5 rounded-2xl px-3.5 py-2 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-white/[0.11] ring-1 ring-white/25" : set ? "bg-white/[0.07] hover:bg-white/[0.1]" : "bg-white/[0.035] hover:bg-white/[0.07]"}`}
										>
											<Label k={k} ctx={ctx} fit />
											<span
												className={`truncate pl-3.5 text-[12px] ${set ? "text-amber-200/90" : "text-gray-500"}`}
											>
												{ctx.summaries[k]}
											</span>
										</button>
									)
								})}
							</div>
							{open && row.includes(open) && (
								<motion.div
									key={open}
									initial={{ opacity: 0, y: -6 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.18 }}
									className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
								>
									<Control ctx={ctx} k={open} trim={false} />
								</motion.div>
							)}
						</div>
					))}
				</div>
			</section>
		</div>
	)
}

// ---------------------------------------------------------------- G: compact rows

/** Groups small enough to sit open in their row, always. */
const INLINE = new Set<Key>(["type", "minScore", "minMatch"])

function VariantG({ ctx }: { ctx: Ctx }) {
	const keys = available(ctx, ctx.order)
	const [open, setOpen] = useState<Set<Key>>(
		() => new Set(keys.filter((k) => ESSENTIALS.has(k) || isSet(ctx, k))),
	)
	const toggle = (k: Key) =>
		setOpen((s) => {
			const n = new Set(s)
			n.has(k) ? n.delete(k) : n.add(k)
			return n
		})
	return (
		<div className="-mx-2 flex flex-col">
			{keys.map((k) => {
				const inline = INLINE.has(k)
				const isOpen = inline || open.has(k)
				return (
					<section key={k} aria-label={TITLES[k]} className="border-b border-white/[0.05] last:border-0">
						{inline ? (
							<div className="flex min-h-12 items-center px-2">
								<Label k={k} ctx={ctx} />
							</div>
						) : (
							<button
								type="button"
								onClick={() => toggle(k)}
								aria-expanded={isOpen}
								className="group flex min-h-12 w-full items-center gap-2 rounded-xl px-2 text-left cursor-pointer outline-none hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<Label
									k={k}
									ctx={ctx}
									right={
										!isOpen && (
											<span
												className={`ml-auto min-w-0 truncate pl-3 text-[13px] ${isSet(ctx, k) ? "text-amber-200/90" : "text-gray-500 group-hover:text-gray-400"}`}
											>
												{ctx.summaries[k]}
											</span>
										)
									}
								/>
								<ChevronDownIcon
									className={`h-4 w-4 shrink-0 text-gray-500 transition-transform group-hover:text-white ${isOpen ? "rotate-180" : ""}`}
								/>
							</button>
						)}
						{isOpen && (
							<motion.div
								initial={inline ? false : { opacity: 0, y: -4 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.16 }}
								className="px-2 pb-4"
							>
								<Control ctx={ctx} k={k} trim={ESSENTIALS.has(k)} />
							</motion.div>
						)}
					</section>
				)
			})}
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
		}),
		[props, order, summaries, data],
	)
	return (
		<div className={className} data-proto-variant={variant}>
			<p aria-live="polite" className="sr-only">
				{props.refusal?.text ?? ""}
			</p>
			{variant === "E" && <VariantE ctx={ctx} />}
			{variant === "F" && <VariantF ctx={ctx} />}
			{variant === "G" && <VariantG ctx={ctx} />}
		</div>
	)
}
