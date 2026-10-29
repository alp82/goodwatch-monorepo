import { MOOD_BY_KEY } from "~/domain/moods"
// The Filters sheet as cards, added as you go: Movies or shows, Mood, Taste match, and Score to start, plus every
// filter with something set. Popular filters sit above "Add a filter" as one-tap tiles; "Add a filter" lists the rest.
// Each card has its control (FilterCards' Control), Clear once something is set, and × to take it away. A search in the
// sheet still lists the matching options of every group (FilterGroups).
import {
	ChevronDownIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ladderStepFor } from "~/domain/age-content"
import {
	type FilterName,
	type FilterState,
	SCORE_GAPS,
	type ScoreGap,
	type SourceKey,
	dropFilter,
} from "~/domain/filter-state"
import { GENRE_FOLDS } from "~/domain/genre-fold"
import { productionCountryName } from "~/domain/production-country"
import { goodwatchVibeIndex } from "~/utils/ratings"
import type { TitleKey } from "~/utils/title-key"
import type { FilterGroupsData, Group, Refusal } from "./FilterGroups"
import { PeoplePicker, TitlePicker } from "./FilterPickers"
import { type Popular, popularFor } from "./PopularFilters"
import {
	CARD_ORDER,
	type CardKey,
	START_CARDS,
	TRIMMED,
	askedFocus,
	focusSheetOn,
} from "./filter-cards"
import { SignUpPanel } from "./SignUpPanel"
import {
	Chip,
	ChipList,
	More,
	type Option,
	SearchField,
	Segmented,
	RangeSlider,
	ThresholdBar,
} from "./SheetControls"
import {
	ANIME_LABELS,
	FILTER_ACCENTS,
	MATCH_LABELS,
	RELEASED_LABELS,
	SCORE_LABELS,
	TYPE_LABELS,
	type TasteState,
	activeChips,
	compactCount,
} from "./labels"
import { TAP } from "./motion"
import {
	type NamedPerson,
	type NamedTitle,
	PROVIDER_LOGO,
} from "./useFilterData"

interface Props {
	groups: Group[]
	data: FilterGroupsData
	refusal: Refusal | null
	titles: { byKey: Map<TitleKey, NamedTitle> }
	people: { byId: Map<number, NamedPerson> }
	countries: { code: string; name: string }[]
}

type Ctx = Props & {
	set: (patch: Partial<FilterState>) => void
	replace: (state: FilterState) => void
}

const YEAR_MIN = 1920
const yearMax = () => new Date().getFullYear()
const LEN_MAX = 240

/** What each Released preset spans, for the slider. */
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

function yearRange(state: FilterState): [number, number] {
	if (state.years)
		return [state.years.min ?? YEAR_MIN, state.years.max ?? yearMax()]
	return releasedRange(state.released)
}

function lengthRange(state: FilterState): [number, number] {
	return [state.runtime?.min ?? 0, state.runtime?.max ?? LEN_MAX]
}

const fmtLen = (m: number) =>
	m >= LEN_MAX
		? "4 h+"
		: m < 60
			? `${m} min`
			: `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`

/** The sources of the Scores by source card: the 0-100 steps it offers and how a step reads. */
export const SOURCES: {
	key: SourceKey
	name: string
	short: string
	color: string
	steps: number[]
	fmt: (v: number) => string
}[] = [
	{
		key: "imdb",
		name: "IMDb",
		short: "IMDb",
		color: "bg-yellow-400",
		steps: [65, 75, 80],
		fmt: (v) => `${(v / 10).toFixed(1)}+`,
	},
	{
		key: "rtCritics",
		name: "Rotten Tomatoes critics",
		short: "RT critics",
		color: "bg-red-500",
		steps: [60, 80, 90],
		fmt: (v) => `${v}%+`,
	},
	{
		key: "rtAudience",
		name: "Rotten Tomatoes audience",
		short: "RT audience",
		color: "bg-orange-400",
		steps: [70, 85, 90],
		fmt: (v) => `${v}%+`,
	},
	{
		key: "metacritic",
		name: "Metacritic",
		short: "Metacritic",
		color: "bg-emerald-500",
		steps: [60, 75, 81],
		fmt: (v) => `${v}+`,
	},
]

export const GAP_LABELS: Record<ScoreGap, string> = {
	agree: "Both agree",
	critics: "Critics liked it more",
	audience: "Audiences liked it more",
}

/** Whether a card has something set. */
export function isCardSet(
	state: FilterState,
	groups: Group[],
	k: CardKey,
): boolean {
	if (k === "runtime") return !!state.runtime
	if (k === "sourceScores")
		return SOURCES.some((src) => !!state.sourceScores?.[src.key])
	if (k === "scoreGap") return !!state.scoreGap
	if (k === "released") return state.released !== "any" || !!state.years
	if (k === "type") return state.type !== "all" || state.anime !== "any"
	if (k === "services")
		return state.onMyServices || !!state.anyService || !!state.services?.length
	return (groups.find((g) => g.key === k)?.badge ?? 0) > 0
}
const isSet = (ctx: Ctx, k: CardKey) => isCardSet(ctx.data.state, ctx.groups, k)

/** The state without this card's choice. */
function cleared(ctx: Ctx, k: CardKey): FilterState {
	const s = ctx.data.state
	if (k === "released") return dropFilter(dropFilter(s, "released"), "years")
	if (k === "type") return dropFilter(dropFilter(s, "type"), "anime")
	if (k === "ageLimit") return dropFilter(dropFilter(s, "ageLimit"), "content")
	return dropFilter(s, k)
}

export const CARD_TITLES: Record<CardKey, string> = {
	services: "Streaming",
	type: "Movies or shows",
	genres: "Genre",
	moods: "Mood",
	minScore: "Score",
	sourceScores: "Scores by source",
	scoreGap: "Critics vs audiences",
	minMatch: "Taste match",
	released: "Released",
	runtime: "Length",
	themes: "Theme",
	styles: "Style",
	similarTo: "Similar to",
	people: "Cast and crew",
	ageLimit: "Age & content",
	productionCountries: "Production countries",
	loved: "Loved",
	disliked: "Disliked",
}

/** One line on what a filter does, for "Add a filter". */
const HINTS: Record<CardKey, string> = {
	services: "Where you can watch it",
	type: "Movies, shows, anime",
	genres: "Drama, comedy, sci-fi…",
	moods: `${MOOD_BY_KEY.funny.name}, ${MOOD_BY_KEY.scary.name.toLowerCase()}, ${MOOD_BY_KEY.feelgood.name.toLowerCase()}…`,
	minScore: "Only well-rated titles",
	sourceScores: "IMDb, Rotten Tomatoes, Metacritic",
	scoreGap: "Where critics and audiences differ",
	minMatch: "How well it fits your taste",
	released: "A year range or a decade",
	runtime: "Short movies, short episodes",
	themes: "Crime, family, the future…",
	styles: "Slow burn, fast-paced…",
	similarTo: "Like titles you pick",
	people: "Actors and directors",
	ageLimit: "Age rating and content",
	productionCountries: "Where it was made",
	loved: "Steer toward titles you loved",
	disliked: "Steer away from titles",
}

const accent = (k: CardKey) => FILTER_ACCENTS[k].dot

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

/** Each folded option is one genre unit under all of. */
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
			count: state.allOf?.includes("genres")
				? (parts[0] ?? null)
				: parts.length
					? parts.reduce((a, b) => a + b, 0)
					: null,
			toggle: () => {
				const on = units.filter((x) => (x === u ? !isOn(u) : isOn(x)))
				ctx.set({ genres: [...new Set(on.flatMap((x) => x.names))] })
			},
		}
	})
}

/**
 * Streaming: Anywhere (no streaming filter), My services (members with saved services), or Streaming in a country:
 * any service there to start, and a tap on a service narrows to the ones picked. The country's services are searchable.
 */
function ServicesControl({ ctx, limit }: { ctx: Ctx; limit: number }) {
	const { state, myServices, countryProviders } = ctx.data
	const [search, setSearch] = useState("")
	const [open, setOpen] = useState(false)
	const mode = state.onMyServices
		? "mine"
		: state.anyService || state.services?.length
			? "streaming"
			: "any"
	const chosen = state.onMyServices ? myServices : (state.services ?? [])
	const term = search.trim().toLowerCase()
	const rank = (id: number) =>
		chosen.includes(id) ? 0 : myServices.includes(id) ? 1 : 2
	const sorted = countryProviders
		.map((p, i) => ({ p, i }))
		.sort((a, b) => rank(a.p.id) - rank(b.p.id) || a.i - b.i)
		.map(({ p }) => p)
	const matches = term
		? sorted.filter((p) => p.name.toLowerCase().includes(term))
		: sorted
	const keep = Math.max(limit, chosen.length)
	const shown = term || open ? matches.slice(0, 80) : matches.slice(0, keep)
	const country = state.streamingCountry ?? ctx.data.streamingCountry ?? "US"
	const countryCodes = [
		...new Set([country, ...ctx.countries.map((c) => c.code)]),
	]
	const pickMode = (m: string) =>
		ctx.set(
			m === "mine"
				? { onMyServices: true, anyService: undefined, services: undefined }
				: m === "streaming"
					? { onMyServices: false, anyService: true, services: undefined }
					: { onMyServices: false, anyService: undefined, services: undefined },
		)
	// From any service (or My services), a tap means "just this one"; then taps add and remove. Taking the last one off
	// goes back to any service.
	const pick = (id: number) => {
		const next =
			state.anyService || state.onMyServices
				? [id]
				: toggleIn(state.services, id)
		ctx.set(
			next
				? { onMyServices: false, anyService: undefined, services: next }
				: { onMyServices: false, anyService: true, services: undefined },
		)
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
						...(myServices.length
							? [{ id: "mine", label: "My services" }]
							: []),
						{ id: "streaming", label: "Streaming in…" },
					]}
				/>
			</div>
			{mode === "any" && (
				<p className="text-[12px] text-gray-500">
					Every title, streaming or not.
				</p>
			)}
			{mode === "mine" && (
				<p className="text-[12px] text-gray-500">
					Titles on the services in your settings.
				</p>
			)}
			{mode === "streaming" && (
				<>
					<div className="flex items-center gap-2">
						<select
							aria-label="Streaming country"
							value={country}
							onChange={(e) => ctx.set({ streamingCountry: e.target.value })}
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
							aria-pressed={open}
							className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl cursor-pointer ring-1 ring-white/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${open ? "bg-white/[0.12] text-white" : "bg-white/[0.05] text-gray-400 hover:text-white"}`}
						>
							<MagnifyingGlassIcon className="h-4 w-4" />
						</button>
					</div>
					{open && (
						<SearchField
							value={search}
							onChange={setSearch}
							placeholder={`Find a service in ${productionCountryName(country)}`}
							autoFocus
						/>
					)}
					<div className="flex flex-wrap gap-1.5">
						{!term && (
							<Chip
								o={{
									id: "any",
									label: "Any service",
									active: !!state.anyService,
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
									label: p.name.replace(
										/ (Amazon Channel|Apple TV Channel)$/,
										"",
									),
									active: chosen.includes(p.id),
									count: null,
									toggle: () => pick(p.id),
								}}
							/>
						))}
						{!term && !open && matches.length > keep && (
							<More
								hidden={matches.length - keep}
								open={false}
								onClick={() => setOpen(true)}
							/>
						)}
						{term && matches.length === 0 && (
							<p className="text-[13px] text-gray-500">
								No service called “{search}” here.
							</p>
						)}
					</div>
				</>
			)}
		</div>
	)
}

function YearControl({ ctx }: { ctx: Ctx }) {
	const { state, counts } = ctx.data
	const c = (o: string) => counts?.optionCounts.released?.[o] ?? null
	const now = yearMax()
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-1.5">
				{(["any", "recent", "2010s", "2000s", "before2000"] as const).map(
					(r) => (
						<Chip
							key={r}
							o={{
								id: r,
								label: RELEASED_LABELS[r],
								active: !state.years && state.released === r,
								count: state.years || r === "any" ? null : c(r),
								toggle: () =>
									ctx.set({
										released: state.released === r && !state.years ? "any" : r,
										years: undefined,
									}),
							}}
						/>
					),
				)}
			</div>
			<RangeSlider
				label="Released"
				min={YEAR_MIN}
				max={now}
				step={1}
				value={yearRange(state)}
				format={(y) =>
					y <= YEAR_MIN ? "Any year" : y >= now ? "Now" : String(y)
				}
				onCommit={([lo, hi]) => {
					const preset = (
						["recent", "2010s", "2000s", "before2000", "any"] as const
					).find((r) => {
						const [a, b] = releasedRange(r)
						return a === lo && b === hi
					})
					if (preset) ctx.set({ released: preset, years: undefined })
					else
						ctx.set({
							released: "any",
							years: {
								...(lo > YEAR_MIN ? { min: lo } : {}),
								...(hi < now ? { max: hi } : {}),
							},
						})
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

const runtimeOf = ([lo, hi]: [number, number]): FilterState["runtime"] =>
	lo <= 0 && hi >= LEN_MAX
		? undefined
		: { ...(lo > 0 ? { min: lo } : {}), ...(hi < LEN_MAX ? { max: hi } : {}) }

function LengthControl({ ctx }: { ctx: Ctx }) {
	const range = lengthRange(ctx.data.state)
	const commit = (r: [number, number]) => ctx.set({ runtime: runtimeOf(r) })
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
			<p className="text-[12px] text-gray-500">
				Movie length, or episode length for shows.
			</p>
		</div>
	)
}

/** One "and up" bar per source; the sources filter together (each must pass). */
function SourcesControl({ ctx }: { ctx: Ctx }) {
	const { state, counts } = ctx.data
	return (
		<div className="space-y-3.5">
			{SOURCES.map((src) => (
				<div key={src.key}>
					<p className="mb-1 text-[12px] text-gray-400">{src.name}</p>
					<ThresholdBar
						label={src.name}
						steps={[
							{ v: 0, label: "Any" },
							...src.steps.map((v) => ({ v, label: src.fmt(v) })),
						]}
						value={state.sourceScores?.[src.key] ?? 0}
						onChange={(v) => {
							const next = { ...(state.sourceScores ?? {}) }
							if (v) next[src.key] = v
							else delete next[src.key]
							ctx.set({
								sourceScores: Object.keys(next).length ? next : undefined,
							})
						}}
						color={() => src.color}
						counts={(v) =>
							counts?.optionCounts.sourceScores?.[`${src.key}:${v}`] ?? null
						}
					/>
				</div>
			))}
		</div>
	)
}

function GapControl({ ctx }: { ctx: Ctx }) {
	const { state, counts } = ctx.data
	return (
		<div className="space-y-2.5">
			<div className="flex flex-wrap gap-1.5">
				<Chip
					o={{
						id: "any",
						label: "Any",
						active: !state.scoreGap,
						count: null,
						toggle: () => ctx.set({ scoreGap: undefined }),
					}}
				/>
				{SCORE_GAPS.map((gap) => (
					<Chip
						key={gap}
						o={{
							id: gap,
							label: GAP_LABELS[gap],
							active: state.scoreGap === gap,
							count: counts?.optionCounts.scoreGap?.[gap] ?? null,
							toggle: () =>
								ctx.set({ scoreGap: state.scoreGap === gap ? undefined : gap }),
						}}
					/>
				))}
			</div>
			<p className="text-[12px] text-gray-500">
				Critics: Rotten Tomatoes critics, or Metacritic. Audiences: IMDb, or
				Rotten Tomatoes audience. Liked it more means 15 points apart or more.
			</p>
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

/** The control for one card. `trim` starts long option lists with the most used and "+N more". */
function Control({ ctx, k, trim }: { ctx: Ctx; k: CardKey; trim: boolean }) {
	const g = ctx.groups.find((x) => x.key === k)
	const { state, counts, onChange } = ctx.data
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
					label="Score"
					steps={SCORE_STEPS}
					value={state.minScore}
					onChange={(minScore) => ctx.set({ minScore })}
					color={(v) => `bg-vibe-${goodwatchVibeIndex(v)}`}
					counts={(v) => counts?.optionCounts.minScore?.[String(v)] ?? null}
				/>
			)
		case "minMatch":
			if (g?.needs)
				return (
					<SignUpPanel
						feature="tasteMatch"
						needs={g.needs}
						preview={MATCH_STEPS.map((s) => s.label)}
					/>
				)
			return (
				<ThresholdBar
					label="Taste match"
					steps={MATCH_STEPS}
					value={state.minMatch}
					onChange={(minMatch) =>
						ctx.set({ minMatch: minMatch as FilterState["minMatch"] })
					}
					color={() => "bg-amber-400"}
					counts={(v) => counts?.optionCounts.minMatch?.[String(v)] ?? null}
				/>
			)
		case "sourceScores":
			return <SourcesControl ctx={ctx} />
		case "scoreGap":
			return <GapControl ctx={ctx} />
		case "released":
			return <YearControl ctx={ctx} />
		case "runtime":
			return <LengthControl ctx={ctx} />
		case "similarTo":
		case "loved":
		case "disliked":
			return <TitlePicker group={k} state={state} onChange={onChange} />
		case "people":
			return <PeoplePicker state={state} onChange={onChange} />
		default:
			return g?.body ? <>{g.body}</> : null
	}
}

/** The cards this viewer gets: Age & content only with a rating ladder. */
const NOT_GROUPS = new Set<CardKey>([
	"released",
	"runtime",
	"sourceScores",
	"scoreGap",
])
const available = (ctx: Ctx) =>
	CARD_ORDER.filter(
		(k) => NOT_GROUPS.has(k) || ctx.groups.some((g) => g.key === k),
	)

function Label({ k, ctx, fit }: { k: CardKey; ctx: Ctx; fit?: boolean }) {
	return (
		<span className="flex min-w-0 items-center gap-2">
			<span className={`h-2 w-2 shrink-0 rounded-full ${accent(k)}`} />
			<span
				className={`${fit ? "truncate" : "shrink-0"} text-[14px] font-semibold text-gray-100`}
			>
				{CARD_TITLES[k]}
			</span>
			{isSet(ctx, k) && (
				<span
					className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
					aria-label="set"
				/>
			)}
		</span>
	)
}

/** A filter as a card: its own surface, so filter types read apart. Clear shows once something is set; × removes it. */
function Card({
	ctx,
	k,
	onRemove,
	highlight,
}: {
	ctx: Ctx
	k: CardKey
	onRemove: () => void
	highlight?: boolean
}) {
	const ref = useRef<HTMLElement>(null)
	useLayoutEffect(() => {
		if (!highlight || !ref.current) return
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		ref.current.scrollIntoView({
			block: "nearest",
			behavior: still ? "auto" : "smooth",
		})
		ref.current.animate(
			[
				{ boxShadow: "0 0 0 2px rgba(251,191,36,.6)" },
				{ boxShadow: "0 0 0 2px rgba(251,191,36,0)" },
			],
			{ duration: 1200 },
		)
	}, [highlight])
	return (
		<section
			ref={ref}
			id={`filter-card-${k}`}
			aria-label={CARD_TITLES[k]}
			className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]"
		>
			<div className="-mt-1 mb-3 flex min-h-8 items-center gap-2">
				<span className="flex min-w-0 flex-1">
					<Label k={k} ctx={ctx} />
				</span>
				{isSet(ctx, k) && (
					<button
						type="button"
						onClick={() => ctx.replace(cleared(ctx, k))}
						aria-label={`Clear ${CARD_TITLES[k]}`}
						className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
				<button
					type="button"
					onClick={onRemove}
					aria-label={`Remove ${CARD_TITLES[k]}`}
					className="grid h-7 w-7 place-items-center rounded-md text-gray-500 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			</div>
			<Control ctx={ctx} k={k} trim={TRIMMED.has(k)} />
		</section>
	)
}

// ---------------------------------------------------------------- popular filters

/** The popular filters as tiles in the sheet, two to a row: the filter and how many titles it leaves. */
function PopularTiles({
	data,
	onPick,
}: { data: FilterGroupsData; onPick: (p: Popular) => void }) {
	const picks = popularFor(data).slice(0, 8)
	if (!picks.length) return null
	return (
		<section aria-label="Popular filters" className="mt-1">
			<h3 className="mb-2 text-[13px] font-semibold text-gray-400">Popular</h3>
			<div className="grid grid-cols-2 gap-1.5">
				{picks.map((p) => {
					const logo = p.logo?.(data)
					const n = p.count?.(data)
					return (
						<motion.button
							key={p.id}
							type="button"
							whileTap={TAP}
							onClick={() => onPick(p)}
							className="flex min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.035] px-3 py-2.5 text-left ring-1 ring-white/[0.06] cursor-pointer outline-none hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							{logo ? (
								<img
									src={logo}
									alt=""
									className="h-7 w-7 shrink-0 rounded-lg object-cover"
								/>
							) : (
								<span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
									<span className={`h-2 w-2 rounded-full ${accent(p.key)}`} />
								</span>
							)}
							<span className="min-w-0">
								<span className="block truncate text-[13px] font-semibold text-gray-100">
									{p.label}
								</span>
								<span className="block truncate text-[11px] text-gray-500">
									{n != null ? `${compactCount(n)} titles` : CARD_TITLES[p.key]}
								</span>
							</span>
						</motion.button>
					)
				})}
			</div>
		</section>
	)
}

// ---------------------------------------------------------------- the sheet

/**
 * The cards, added as you go. Movies or shows, Mood, Taste match, and Score start, plus every filter with something
 * set (also from elsewhere: a chip, a recovery). Popular tiles set a value and bring in (and point at) its card;
 * "Add a filter" lists the rest; a card's × clears it and takes it away.
 */
export default function FilterCards(props: Props) {
	const { data } = props
	const ctx: Ctx = useMemo(
		() => ({
			...props,
			set: (patch) => data.onChange({ ...data.state, ...patch }),
			replace: (state) => data.onChange(state),
		}),
		[props, data],
	)
	const keys = available(ctx)
	const [asked] = useState(askedFocus)
	useEffect(() => focusSheetOn(null), [])
	const [added, setAdded] = useState<Set<CardKey>>(
		() =>
			new Set(
				keys.filter((k) => START_CARDS.has(k) || isSet(ctx, k) || k === asked),
			),
	)
	const [picking, setPicking] = useState(false)
	const [fresh, setFresh] = useState<{ k: CardKey; n: number } | null>(
		asked ? { k: asked, n: 1 } : null,
	)
	const shown = keys.filter((k) => added.has(k) || isSet(ctx, k))
	const left = keys.filter((k) => !shown.includes(k))
	const add = (k: CardKey) => {
		setAdded((s) => new Set(s).add(k))
		setFresh((f) => ({ k, n: (f?.n ?? 0) + 1 }))
		setPicking(false)
	}
	const remove = (k: CardKey) => {
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
					<motion.div
						key={k}
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.98 }}
						transition={{ duration: 0.18 }}
					>
						<Card
							key={fresh?.k === k ? `${k}-${fresh.n}` : k}
							ctx={ctx}
							k={k}
							onRemove={() => remove(k)}
							highlight={fresh?.k === k}
						/>
					</motion.div>
				))}
			</AnimatePresence>
			<PopularTiles
				data={data}
				onPick={(p) => {
					ctx.set(p.apply(data))
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
						<PlusIcon
							className={`h-4 w-4 transition-transform ${picking ? "rotate-45" : ""}`}
						/>
						{picking ? "Close" : "Add a filter"}
					</button>
					{picking && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="grid grid-cols-2 gap-1.5 px-2 pb-2"
						>
							{left.map((k) => (
								<button
									key={k}
									type="button"
									onClick={() => add(k)}
									className="flex min-w-0 flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left cursor-pointer outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<Label k={k} ctx={ctx} fit />
									<span className="truncate pl-4 text-[12px] text-gray-500">
										{HINTS[k]}
									</span>
								</button>
							))}
						</motion.div>
					)}
				</div>
			)}
		</div>
	)
}
