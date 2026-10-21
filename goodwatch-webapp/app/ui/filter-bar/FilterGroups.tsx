import { useCountries } from "~/routes/api.countries"
import { productionCountryName } from "~/domain/production-country"
// The Filters sheet's content. Without a search it is the cards (FilterCards.tsx). A search lists the groups in order
// (Movies or shows, Anime, Mood, Theme, Style, Genre, Score, Taste match, Released, Age & content, Streaming services,
// Similar to, Cast and crew) with just the options that match.
// Each option shows what the result would be if tapped; an option that would leave nothing is dimmed. Typing two
// letters or more also finds titles for Similar to and people for Cast and crew. Taste match needs taste: without it
// the group shows dimmed with the way to get it. Age & content needs the viewer's rating ladder: without it the group
// doesn't show.
import {
	CheckIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import {
	type ReactNode,
	type RefObject,
	Suspense,
	lazy,
	useEffect,
	useState,
} from "react"
import {
	CONTENT_KINDS,
	type ViewerLadder,
	changedContent,
} from "~/domain/age-content"
import {
	type FilterName,
	type FilterState,
	MIN_MATCHES,
	MIN_SCORES,
	RELEASED,
} from "~/domain/filter-state"
import { MOODS, toggleMood } from "~/domain/moods"
import {
	MAX_STYLES,
	MAX_THEMES,
	STYLES,
	THEMES,
	type TitleRule,
	toggleKey,
} from "~/domain/themes-styles"
import { ANIME_CHOICES } from "~/domain/title-type"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { goodwatchVibeIndex } from "~/utils/ratings"
import type { TitleKey } from "~/utils/title-key"
import { AgeLimit, ContentChecklist } from "./AgeContent"
import { onFirstInteraction } from "~/utils/first-interaction"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import {
	AGE_CONTENT_WORDS,
	ANIME_LABELS,
	CONTENT_LABELS,
	FILTER_ACCENTS,
	MATCH_LABELS,
	RATE_TITLES_PATH,
	RELEASED_LABELS,
	SCORE_LABELS,
	TYPE_LABELS,
	type TasteState,
} from "./labels"
import { TAP } from "./motion"
import type { FilterBarCounts } from "./types"
import {
	type NamedPerson,
	type NamedTitle,
	PROVIDER_LOGO,
	type StreamingProvider,
	usePeopleNames,
	useTitleNames,
} from "./useFilterData"

const POSTER = "https://image.tmdb.org/t/p/w154"

export interface Option {
	id: string
	label: string
	active: boolean
	/** What tapping it would leave; null when unknown. */
	count: number | null
	toggle: () => void
	swatch?: ReactNode
	img?: string | null
	/** Shown dimmed and can't be tapped. */
	disabled?: boolean
}

export interface Group {
	key: FilterName
	title: string
	note?: string
	kind?: "chips" | "logos" | "posters"
	options: Option[]
	/** Shown when the group has no options, for example how to add a title. */
	empty?: string
	/** Active options count toward the header badge, except a default choice. */
	badge: number
	/** Why the group can't be used yet: taste is missing. Shown under its options. */
	needs?: Exclude<TasteState, "ready">
	/** Drawn in place of options, for a group that isn't a set of chips (Age & content). */
	body?: ReactNode
	/** What the search finds a group with a body by, besides its title. Lower case. */
	words?: string
}

export interface FilterGroupsData {
	state: FilterState
	counts: FilterBarCounts | null
	onChange: (state: FilterState) => void
	myServices: number[]
	countryProviders: StreamingProvider[]
	streamingCountry?: string
	/** Whether the viewer has taste, for the Taste match group; ready by default. */
	taste?: TasteState
	/** The viewer's rating ladder, for the Age & content group; without it the group doesn't show. */
	ladder?: ViewerLadder | null
}

interface Found {
	countries: { code: string; name: string }[]
	countryQuery: string
	titles: { byKey: Map<TitleKey, NamedTitle>; matches: NamedTitle[] }
	people: { byId: Map<number, NamedPerson>; matches: NamedPerson[] }
}

const toggleIn = <T,>(list: T[] | undefined, value: T) => {
	const next = (list ?? []).includes(value)
		? (list ?? []).filter((v) => v !== value)
		: [...(list ?? []), value]
	return next.length ? next : undefined
}

/** A pick the group refused because it is full, said under that group. */
export interface Refusal {
	group: FilterName
	text: string
}

function buildGroups(
	data: FilterGroupsData & Found,
	onRefused: (refusal: Refusal) => void,
): Group[] {
	const { state, counts, onChange, myServices } = data
	const count = (group: FilterName, option: string) =>
		counts?.optionCounts[group]?.[option] ?? null
	const set = (patch: Partial<FilterState>) => onChange({ ...state, ...patch })

	const genreNames = Object.keys(counts?.optionCounts.genres ?? {})
	for (const g of state.genres) if (!genreNames.includes(g)) genreNames.push(g)
	genreNames.sort((a, b) => a.localeCompare(b))

	const similar = state.similarTo ?? []
	const people = state.people ?? []
	const taste = data.taste ?? "ready"
	const { ladder } = data

	// Themes and styles: up to three of each, each option with its rule's color.
	const ruleGroup = <K extends string>(
		key: "themes" | "styles",
		title: string,
		rules: readonly TitleRule<K>[],
		chosen: K[],
		max: number,
		pick: (chosen: K[]) => void,
	): Group => ({
		key,
		title,
		note: "Up to three",
		badge: chosen.length,
		options: rules.map((rule) => ({
			id: rule.id,
			label: rule.name,
			active: chosen.includes(rule.id),
			count: count(key, rule.id),
			swatch: (
				<span
					className="h-2.5 w-2.5 rounded-full"
					style={{ background: rule.color }}
				/>
			),
			toggle: () => {
				const next = toggleKey(chosen, rule.id, max)
				if (next.refused)
					onRefused({
						group: key,
						text: `Three ${key} is the most. Remove one to add ${rule.name}.`,
					})
				else pick(next.chosen)
			},
		})),
	})

	return [
		{
			key: "type",
			title: "Movies or shows",
			badge: state.type === "all" ? 0 : 1,
			options: (["all", "movie", "show"] as const).map((type) => ({
				id: type,
				label: TYPE_LABELS[type],
				active: state.type === type,
				count: count("type", type),
				toggle: () => set({ type }),
			})),
		},
		{
			key: "anime",
			title: "Anime",
			badge: state.anime === "any" ? 0 : 1,
			options: ANIME_CHOICES.map((anime) => ({
				id: anime,
				label: ANIME_LABELS[anime],
				active: state.anime === anime,
				count: count("anime", anime),
				toggle: () => set({ anime }),
			})),
		},
		{
			key: "moods",
			title: "Mood",
			note: "Up to three",
			badge: state.moods.length,
			options: MOODS.map((mood) => ({
				id: mood.key,
				label: mood.name,
				active: state.moods.includes(mood.key),
				count: count("moods", mood.key),
				swatch: (
					<span
						className="h-2.5 w-2.5 rounded-full"
						style={{ background: mood.hue }}
					/>
				),
				toggle: () => {
					const { moods, refused } = toggleMood(state.moods, mood.key)
					if (refused)
						onRefused({
							group: "moods",
							text: `Three moods is the most. Remove one to add ${mood.name}.`,
						})
					else set({ moods })
				},
			})),
		},
		ruleGroup("themes", "Theme", THEMES, state.themes, MAX_THEMES, (themes) =>
			set({ themes }),
		),
		ruleGroup("styles", "Style", STYLES, state.styles, MAX_STYLES, (styles) =>
			set({ styles }),
		),
		{
			key: "genres",
			title: "Genre",
			badge: state.genres.length,
			empty: counts ? undefined : "Loading genres…",
			options: genreNames.map((genre) => ({
				id: genre,
				label: genre,
				active: state.genres.includes(genre),
				count: count("genres", genre),
				toggle: () => set({ genres: toggleIn(state.genres, genre) ?? [] }),
			})),
		},
		{
			key: "minScore",
			title: "Score",
			badge: state.minScore ? 1 : 0,
			options: MIN_SCORES.map((score) => ({
				id: String(score),
				label: SCORE_LABELS[score],
				active: state.minScore === score,
				count: count("minScore", String(score)),
				swatch: score ? (
					<span
						className={`h-2 w-2 rounded-full bg-vibe-${goodwatchVibeIndex(score)}`}
					/>
				) : undefined,
				toggle: () => set({ minScore: score }),
			})),
		},
		{
			key: "minMatch",
			title: "Taste match",
			note: taste === "ready" ? "How well a title fits your taste" : undefined,
			badge: state.minMatch ? 1 : 0,
			needs: taste === "ready" ? undefined : taste,
			options: MIN_MATCHES.map((match) => ({
				id: String(match),
				label: MATCH_LABELS[match],
				active: state.minMatch === match,
				// Without taste no title has a match, so the counts would only repeat the total.
				count: taste === "ready" ? count("minMatch", String(match)) : null,
				// Any match stays, so a filter from a shared link can be taken off.
				disabled: taste !== "ready" && match !== 0,
				swatch: match ? (
					<span
						className="h-2 w-2 rounded-full bg-amber-400"
						style={{ opacity: 0.4 + (match - 60) / 50 }}
					/>
				) : undefined,
				toggle: () => set({ minMatch: match }),
			})),
		},
		{
			key: "released",
			title: "Released",
			badge: state.released === "any" ? 0 : 1,
			options: RELEASED.map((released) => ({
				id: released,
				label: RELEASED_LABELS[released],
				active: state.released === released,
				count: count("released", released),
				toggle: () => set({ released }),
			})),
		},
		...(ladder
			? [
					{
						key: "ageLimit" as const,
						title: "Age & content",
						badge:
							(state.ageLimit === undefined ? 0 : 1) +
							Object.keys(changedContent(state.ageLimit, state.content) ?? {})
								.length,
						options: [],
						words: [
							AGE_CONTENT_WORDS,
							ladder.local ? ladder.country : "",
							...ladder.steps.flatMap((step) => [step.label, step.show ?? ""]),
							...CONTENT_KINDS.flatMap((kind) =>
								Object.values(CONTENT_LABELS[kind]),
							),
						]
							.join(" ")
							.toLowerCase(),
						body: (
							<div className="flex flex-col gap-4">
								<AgeLimit
									state={state}
									ladder={ladder}
									counts={counts}
									onChange={onChange}
									roomy
								/>
								<ContentChecklist
									state={state}
									counts={counts}
									onChange={onChange}
									roomy
								/>
							</div>
						),
					},
				]
			: []),
		{
			key: "services",
			title: "Streaming services",
			badge: state.services?.length ?? 0,
			options: [],
			words:
				`streaming services viewing country everywhere ${data.countryProviders.map((p) => p.name).join(" ")}`.toLowerCase(),
			body: (
				<StreamingServices
					data={data}
					countries={data.countries}
					query={data.countryQuery}
				/>
			),
		},
		{
			key: "productionCountries",
			title: "Production countries",
			badge: state.productionCountries?.length ?? 0,
			options: [],
			words: `country countries produced production co-production ${data.countries.map((c) => `${c.code} ${c.name}`).join(" ")}`,
			body: (
				<ProductionCountries
					state={state}
					onChange={onChange}
					countries={data.countries}
					query={data.countryQuery}
				/>
			),
		},
		...(["loved", "disliked"] as const).map(
			(group): Group => ({
				key: group,
				title: group === "loved" ? "Loved" : "Disliked",
				badge: state[group]?.length ?? 0,
				options: [],
				body: (
					<PreferencePicker group={group} state={state} onChange={onChange} />
				),
				words: "movie show title loved disliked",
			}),
		),
		{
			key: "similarTo",
			title: "Similar to",
			kind: "posters",
			badge: similar.length,
			empty: "Search for a title above to add it.",
			options: [
				...similar.map((key) => {
					const t = data.titles.byKey.get(key)
					return {
						id: String(key),
						label: t ? `${t.title} (${t.year})` : "Title",
						img: t?.poster ? `${POSTER}${t.poster}` : null,
						active: true,
						count: count("similarTo", String(key)),
						toggle: () => set({ similarTo: toggleIn(similar, key) }),
					}
				}),
				...data.titles.matches.map((t) => ({
					id: String(t.key),
					label: `${t.title} (${t.year})`,
					img: t.poster ? `${POSTER}${t.poster}` : null,
					active: false,
					count: null,
					toggle: () => set({ similarTo: toggleIn(similar, t.key) }),
				})),
			],
		},
		{
			key: "people",
			title: "Cast and crew",
			badge: people.length,
			empty: "Search for a name above to add someone.",
			options: [
				...people.map((id) => ({
					id: String(id),
					label: data.people.byId.get(id)?.name ?? "Cast or crew",
					active: true,
					count: count("people", String(id)),
					toggle: () => set({ people: toggleIn(people, id) }),
				})),
				...data.people.matches.map((p) => ({
					id: String(p.id),
					label: p.name,
					active: false,
					count: null,
					toggle: () => set({ people: toggleIn(people, p.id) }),
				})),
			],
		},
	]
}

function OptionChip({ option }: { option: Option }) {
	const dead = option.disabled || (!option.active && option.count === 0)
	return (
		<motion.button
			type="button"
			aria-pressed={option.active}
			aria-disabled={option.disabled || undefined}
			aria-label={
				option.count === null
					? option.label
					: `${option.label}, ${option.count.toLocaleString("en")} titles`
			}
			whileTap={option.disabled ? undefined : TAP}
			onClick={() => !option.disabled && option.toggle()}
			className={`flex h-9 items-center gap-2 rounded-full pl-3 pr-2.5 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${option.disabled ? "cursor-not-allowed" : "cursor-pointer"} ${
				option.active
					? "bg-white font-bold text-gray-950 shadow-[0_6px_20px_-6px_rgba(255,255,255,.35)]"
					: dead
						? "bg-white/[0.03] text-gray-600 ring-1 ring-white/5"
						: "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/10"
			}`}
		>
			{option.swatch}
			{option.label}
			<span aria-hidden className="text-xs tabular-nums text-gray-500">
				{option.active ? (
					<CheckIcon className="h-3.5 w-3.5" />
				) : (
					(option.count?.toLocaleString("en") ?? "")
				)}
			</span>
		</motion.button>
	)
}

function OptionLogo({ option }: { option: Option }) {
	const dead = !option.active && option.count === 0
	return (
		<motion.button
			type="button"
			aria-pressed={option.active}
			aria-label={
				option.count === null
					? option.label
					: `${option.label}, ${option.count.toLocaleString("en")} titles`
			}
			title={option.label}
			whileTap={TAP}
			onClick={option.toggle}
			className="group flex w-14 flex-col items-center gap-1 rounded-xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<span
				className={`relative h-12 w-12 overflow-hidden rounded-xl transition ${option.active ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950" : dead ? "opacity-20 grayscale" : "opacity-45 grayscale group-hover:opacity-90 group-hover:grayscale-0"}`}
			>
				{option.img && (
					<img src={option.img} alt="" className="h-full w-full object-cover" />
				)}
			</span>
			<span className="w-full truncate text-center text-[11px] text-gray-400">
				{option.count === null || option.active
					? option.label
					: option.count.toLocaleString("en")}
			</span>
		</motion.button>
	)
}

function StreamingServices({
	data,
	countries,
	query,
}: {
	data: FilterGroupsData
	countries: { code: string; name: string }[]
	query: string
}) {
	const [localSearch, setSearch] = useState<string | null>(null)
	useEffect(() => setSearch(null), [query])
	const search =
		localSearch ??
		(/^(streaming( services?)?|services?|viewing country|country|everywhere)$/i.test(
			query.trim(),
		)
			? ""
			: query)
	const { state, onChange } = data
	const chosen = state.onMyServices ? data.myServices : (state.services ?? [])
	const country = state.streamingCountry ?? data.streamingCountry ?? "US"
	const countryOptions = [
		...new Set([country, ...countries.map((c) => c.code)]),
	]
		.map((code) => ({ code, name: productionCountryName(code) }))
		.sort((a, b) => a.name.localeCompare(b.name))
	const term = search.trim().toLowerCase()
	const selected = data.countryProviders.filter((p) => chosen.includes(p.id))
	const matches = data.countryProviders.filter(
		(p) =>
			!chosen.includes(p.id) && (!term || p.name.toLowerCase().includes(term)),
	)
	const options = [...selected, ...(term ? matches : matches.slice(0, 20))]
	return (
		<div className="space-y-3">
			<label className="block text-xs text-gray-400">
				Streaming country
				<select
					aria-label="Streaming country"
					value={country}
					onChange={(e) =>
						onChange({ ...state, streamingCountry: e.target.value })
					}
					className="mt-1 block w-full rounded-xl border border-white/15 bg-gray-900 px-3 py-2.5 text-sm text-white"
				>
					{countryOptions.map((c) => (
						<option key={c.code} value={c.code}>
							{c.name}
						</option>
					))}
				</select>
			</label>
			<p className="text-xs text-gray-400">
				Pick services to include in this search. Your saved services stay
				unchanged.
			</p>
			<button
				type="button"
				onClick={() =>
					onChange({ ...state, onMyServices: false, services: undefined })
				}
				className="text-sm text-amber-300 hover:text-amber-200"
			>
				Everywhere · clear service selection
			</button>
			<label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/15 focus-within:ring-amber-400">
				<MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
				<input
					type="search"
					aria-label="Find a streaming service"
					placeholder="Find a streaming service…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
				/>
			</label>
			<div
				aria-label="Streaming service choices"
				className="flex flex-wrap gap-3"
			>
				{options.map((provider) => (
					<OptionLogo
						key={provider.id}
						option={{
							id: String(provider.id),
							label: provider.name,
							img: `${PROVIDER_LOGO}${provider.logo_path}`,
							active: chosen.includes(provider.id),
							count: null,
							toggle: () =>
								onChange({
									...state,
									onMyServices: false,
									services: state.onMyServices
										? [provider.id]
										: toggleIn(state.services, provider.id),
								}),
						}}
					/>
				))}
			</div>
			{options.length === 0 && (
				<p className="text-xs text-gray-400">
					No matching service in this country.
				</p>
			)}
			{!term && matches.length > 20 && (
				<p className="text-xs text-gray-400">Search to find more services.</p>
			)}
		</div>
	)
}

function ProductionCountries({
	state,
	onChange,
	countries,
	query,
}: {
	state: FilterState
	onChange: (state: FilterState) => void
	countries: { code: string; name: string }[]
	query: string
}) {
	const [localSearch, setSearch] = useState<string | null>(null)
	useEffect(() => setSearch(null), [query])
	const search =
		localSearch ??
		(/country|countries|production|produced/i.test(query) ? "" : query)
	const chosen = state.productionCountries ?? []
	const common = [
		"US",
		"GB",
		"CA",
		"AU",
		"DE",
		"FR",
		"ES",
		"IT",
		"JP",
		"KR",
		"IN",
		"NZ",
	]
	const available = new Map(
		countries.map((c) => [c.code, productionCountryName(c.code)]),
	)
	for (const code of [...chosen, ...common])
		if (!available.has(code)) available.set(code, productionCountryName(code))
	const term = search.trim().toLowerCase()
	const options = [...available]
		.filter(
			([code, name]) =>
				chosen.includes(code) ||
				(term
					? name.toLowerCase().includes(term) || code.toLowerCase() === term
					: common.includes(code)),
		)
		.sort(
			([a, an], [b, bn]) =>
				Number(chosen.includes(b)) - Number(chosen.includes(a)) ||
				an.localeCompare(bn),
		)
	return (
		<div className="space-y-3">
			<p className="text-xs text-gray-400">
				Include titles produced in any selected country, including
				co-productions. Streaming availability follows your viewing country.
			</p>
			<label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/15 focus-within:ring-amber-400">
				<MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
				<input
					type="search"
					aria-label="Find a production country"
					placeholder="Find a country…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
				/>
			</label>
			<div className="flex flex-wrap gap-2">
				{options.map(([code, name]) => (
					<OptionChip
						key={code}
						option={{
							id: code,
							label: name,
							active: chosen.includes(code),
							count: null,
							toggle: () =>
								onChange({
									...state,
									productionCountries: toggleIn(chosen, code),
								}),
						}}
					/>
				))}
			</div>
			{options.length === 0 && (
				<p className="text-xs text-gray-400">
					{countries.length === 0
						? "Loading countries…"
						: "No matching country."}
				</p>
			)}
		</div>
	)
}

function PreferencePicker({
	group,
	state,
	onChange,
}: {
	group: "loved" | "disliked"
	state: FilterState
	onChange: (state: FilterState) => void
}) {
	const [search, setSearch] = useState("")
	const chosen = state[group] ?? []
	const titles = useTitleNames(chosen, search)
	const other = group === "loved" ? "disliked" : "loved"
	const toggle = (key: TitleKey) =>
		onChange({
			...state,
			[group]: toggleIn(chosen, key),
			[other]: state[other]?.filter((id) => id !== key),
		})
	const poster = (key: TitleKey, active: boolean) => {
		const title = titles.byKey.get(key)
		return (
			<OptionPoster
				key={key}
				positive={group === "loved"}
				option={{
					id: String(key),
					label: title ? `${title.title} (${title.year})` : "Loading title…",
					img: title?.poster ? `${POSTER}${title.poster}` : null,
					active,
					count: null,
					toggle: () => toggle(key),
				}}
			/>
		)
	}
	return (
		<div className="space-y-3">
			<p className="text-xs text-gray-400">
				{group === "loved"
					? "Find more like the titles you loved."
					: "Steer recommendations away from titles you disliked."}
			</p>
			<label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/15 focus-within:ring-amber-400">
				<MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
				<input
					type="search"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					aria-label={`Add a movie or show to ${group === "loved" ? "Loved" : "Disliked"}`}
					placeholder="Add a movie or show…"
					className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
				/>
			</label>
			{search.trim().length >= 2 && (
				<div
					aria-label={`Search results for ${group}`}
					className="flex flex-wrap gap-2.5"
				>
					{titles.matches.map((title) => poster(title.key, false))}
					{titles.matches.length === 0 && (
						<p className="text-xs text-gray-400">No matching titles yet.</p>
					)}
				</div>
			)}
			<div
				aria-label={`${group === "loved" ? "Loved" : "Disliked"} titles`}
				className="flex flex-wrap gap-2.5"
			>
				{chosen.map((key) => poster(key, true))}
			</div>
		</div>
	)
}

function OptionPoster({
	option,
	positive = false,
}: { option: Option; positive?: boolean }) {
	return (
		<motion.button
			type="button"
			aria-pressed={option.active}
			aria-label={option.label}
			title={option.label}
			whileTap={TAP}
			onClick={option.toggle}
			className={`relative w-14 shrink-0 overflow-hidden rounded-lg bg-white/5 cursor-pointer outline-none transition focus-visible:ring-2 focus-visible:ring-amber-400 ${option.active ? `${positive ? "ring-emerald-400" : "ring-rose-400"} ring-2 ring-offset-2 ring-offset-gray-950` : "opacity-60 hover:opacity-100"}`}
		>
			<span className="block aspect-[2/3] w-full">
				{option.img ? (
					<img src={option.img} alt="" className="h-full w-full object-cover" />
				) : (
					<span className="grid h-full place-items-center p-1 text-[10px] leading-tight text-gray-400">
						{option.label}
					</span>
				)}
			</span>
			{option.active && (
				<span
					className={`absolute top-1 right-1 grid h-4 w-4 place-items-center rounded-full ${positive ? "bg-emerald-500" : "bg-rose-500"} text-white`}
				>
					<XMarkIcon className="h-3 w-3" />
				</span>
			)}
		</motion.button>
	)
}

/** Under the Taste match group while the viewer has no taste: how to get it. */
function NeedsTaste({ needs }: { needs: Exclude<TasteState, "ready"> }) {
	if (needs === "signUp")
		return (
			<SignUpPrompt
				feature="tasteMatch"
				stage="learn"
				size="chip"
				className="mt-2.5"
			/>
		)
	return (
		<p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-gray-400">
			Rate a few more titles you love and every title gets a taste match.
			<Link
				to={RATE_TITLES_PATH}
				className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/25"
			>
				Rate titles
			</Link>
		</p>
	)
}

export function FilterSearchField({
	value,
	onChange,
	inputRef,
	className = "",
}: {
	value: string
	onChange: (value: string) => void
	inputRef?: RefObject<HTMLInputElement>
	className?: string
}) {
	return (
		<label
			className={`flex h-11 items-center gap-2.5 rounded-xl bg-white/[0.06] px-3.5 ring-1 ring-white/10 focus-within:ring-amber-500/70 ${className}`}
		>
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" />
			<span className="sr-only">Find a filter</span>
			<input
				ref={inputRef}
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Find a filter: horror, a title, a name"
				className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
			/>
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					aria-label="Clear the filter search"
					className="text-gray-500 cursor-pointer hover:text-white"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</label>
	)
}

// The cards load on first use: fetched at the first interaction with the page, so they are there when the sheet opens,
// and never for a visitor who only reads the page.
const loadCards = reloadOnStaleChunk(() => import("./FilterCards"))
const FilterCards = lazy(loadCards)
if (typeof window !== "undefined")
	onFirstInteraction(() => void loadCards().catch(() => {}))

/** Where the cards go while they load: the starting cards' outlines. */
function CardsLoading() {
	return (
		<div aria-busy="true" className="flex flex-col gap-3">
			{[96, 128, 96, 96].map((h, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
					key={i}
					className="animate-pulse rounded-2xl bg-white/[0.035] ring-1 ring-white/[0.06] motion-reduce:animate-none"
					style={{ height: h }}
				/>
			))}
		</div>
	)
}

/** The groups, narrowed by `query`. */
export function FilterGroups({
	data,
	query,
	className = "",
}: {
	data: FilterGroupsData
	query: string
	className?: string
}) {
	const [refusal, setRefusal] = useState<Refusal | null>(null)
	const notice = refusal?.text ?? ""
	const titles = useTitleNames(
		[
			...(data.state.similarTo ?? []),
			...(data.state.loved ?? []),
			...(data.state.disliked ?? []),
		],
		query,
	)
	const people = usePeopleNames(data.state.people ?? [], query)
	const { moods, themes, styles } = data.state
	const picked = `${moods.join(",")}|${themes.join(",")}|${styles.join(",")}`
	// A change of moods, themes or styles ends the refusal notice.
	useEffect(() => {
		setRefusal(null)
	}, [picked])
	const countries = useCountries()
	const groups = buildGroups(
		{
			...data,
			titles,
			people,
			countries: countries.data ?? [],
			countryQuery: query,
		},
		setRefusal,
	)
	const q = query.trim().toLowerCase()
	// Without a search the sheet is the cards, added as you go; a search lists the matching options of every group.
	if (!q)
		return (
			<div className={className}>
				<p aria-live="polite" className="sr-only">
					{notice}
				</p>
				<Suspense fallback={<CardsLoading />}>
					<FilterCards
						groups={groups}
						data={data}
						refusal={refusal}
						titles={titles}
						people={people}
						countries={countries.data ?? []}
					/>
				</Suspense>
			</div>
		)
	const searchable = (g: Group) =>
		g.key === "loved" ||
		g.key === "disliked" ||
		g.key === "similarTo" ||
		g.key === "people"
	const shown = groups
		.map((g) => ({
			...g,
			options:
				!q || g.title.toLowerCase().includes(q) || searchable(g)
					? g.options
					: g.options.filter((o) => o.label.toLowerCase().includes(q)),
		}))
		// A group with a body is found by its words, from the start of any of them ("viol", "fsk").
		.filter(
			(g) =>
				!q ||
				(g.body
					? g.key === "loved" ||
						g.key === "disliked" ||
						g.title.toLowerCase().includes(q) ||
						(g.key === "productionCountries" || g.key === "services"
							? g.words?.toLowerCase().includes(q)
							: g.words?.split(" ").some((word) => word.startsWith(q)))
					: g.options.length > 0),
		)
	return (
		<div className={className}>
			<p aria-live="polite" className="sr-only">
				{notice}
			</p>
			{shown.length === 0 ? (
				<div className="py-10 text-center">
					<p className="text-base font-bold text-white">
						No filter called “{query}”
					</p>
					<p className="mt-1 text-sm text-gray-400">
						Try a genre, a mood, a service, a title, or a name.
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-7">
					{shown.map((g) => (
						<section key={g.key} aria-labelledby={`filter-group-${g.key}`}>
							<header className="mb-3 flex items-center gap-2.5">
								<span
									className={`h-3.5 w-1 rounded-full ${FILTER_ACCENTS[g.key].bar}`}
								/>
								<h3
									id={`filter-group-${g.key}`}
									className="text-[15px] font-bold text-white"
								>
									{g.title}
								</h3>
								{g.badge > 0 && (
									<span className="rounded-full bg-white/10 px-2 text-xs font-bold tabular-nums text-white">
										{g.badge}
									</span>
								)}
								{g.note && (
									<span className="ml-auto truncate text-xs text-gray-500">
										{g.note}
									</span>
								)}
							</header>
							{g.body ? (
								g.body
							) : g.options.length === 0 ? (
								g.empty && <p className="text-sm text-gray-500">{g.empty}</p>
							) : (
								<div
									className={`flex flex-wrap ${g.kind === "posters" ? "gap-2.5" : "gap-2"}`}
								>
									{g.options.map((o) =>
										g.kind === "logos" ? (
											<OptionLogo key={o.id} option={o} />
										) : g.kind === "posters" ? (
											<OptionPoster key={o.id} option={o} />
										) : (
											<OptionChip key={o.id} option={o} />
										),
									)}
								</div>
							)}
							{refusal && g.key === refusal.group && (
								<p className="mt-2 text-xs text-amber-300">{refusal.text}</p>
							)}
							{g.needs && <NeedsTaste needs={g.needs} />}
						</section>
					))}
				</div>
			)}
		</div>
	)
}
