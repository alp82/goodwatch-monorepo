// The Filters sheet's content: a search field over every option, then the groups in order (Movies or shows, Anime,
// Mood, Genre, GoodWatch score, Taste match, Released, Streaming services, Similar to, Cast and crew). Each option
// shows what the result would be if tapped; an option that would leave nothing is dimmed. Typing two letters or more
// also finds titles for Similar to and people for Cast and crew. Taste match needs taste: without it the group shows
// dimmed with the way to get it.
import {
	CheckIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { type ReactNode, type RefObject, useEffect, useState } from "react"
import {
	type FilterName,
	type FilterState,
	MIN_MATCHES,
	MIN_SCORES,
	RELEASED,
} from "~/domain/filter-state"
import { MOODS, toggleMood } from "~/domain/moods"
import { ANIME_CHOICES } from "~/domain/title-type"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { goodwatchVibeIndex } from "~/utils/ratings"
import type { TitleKey } from "~/utils/title-key"
import {
	ANIME_LABELS,
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
const MAX_SERVICE_OPTIONS = 12

interface Option {
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

interface Group {
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
}

export interface FilterGroupsData {
	state: FilterState
	counts: FilterBarCounts | null
	onChange: (state: FilterState) => void
	myServices: number[]
	countryProviders: StreamingProvider[]
	/** Whether the viewer has taste, for the Taste match group; ready by default. */
	taste?: TasteState
}

interface Found {
	titles: { byKey: Map<TitleKey, NamedTitle>; matches: NamedTitle[] }
	people: { byId: Map<number, NamedPerson>; matches: NamedPerson[] }
}

const toggleIn = <T,>(list: T[] | undefined, value: T) => {
	const next = (list ?? []).includes(value)
		? (list ?? []).filter((v) => v !== value)
		: [...(list ?? []), value]
	return next.length ? next : undefined
}

function buildGroups(
	data: FilterGroupsData & Found,
	onMoodRefused: (name: string) => void,
): Group[] {
	const { state, counts, onChange, myServices } = data
	const count = (group: FilterName, option: string) =>
		counts?.optionCounts[group]?.[option] ?? null
	const set = (patch: Partial<FilterState>) => onChange({ ...state, ...patch })

	const genreNames = Object.keys(counts?.optionCounts.genres ?? {})
	for (const g of state.genres) if (!genreNames.includes(g)) genreNames.push(g)
	genreNames.sort((a, b) => a.localeCompare(b))

	const serviceCounts = counts?.optionCounts.services ?? {}
	const chosenServices = state.onMyServices
		? myServices
		: (state.services ?? [])
	const providers = data.countryProviders
		.filter(
			(p) =>
				chosenServices.includes(p.id) ||
				counts?.approximate ||
				String(p.id) in serviceCounts,
		)
		.slice(0, Math.max(MAX_SERVICE_OPTIONS, chosenServices.length))

	const similar = state.similarTo ?? []
	const people = state.people ?? []
	const taste = data.taste ?? "ready"

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
					if (refused) onMoodRefused(mood.name)
					else set({ moods })
				},
			})),
		},
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
			title: "GoodWatch score",
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
		{
			key: "services",
			title: "Streaming services",
			kind: "logos",
			note: state.onMyServices
				? "Showing your services. Pick one to look somewhere else."
				: "Only titles on the services you pick",
			badge: !state.onMyServices && state.services?.length ? 1 : 0,
			empty: "Choose a country in your settings to pick services.",
			options: providers.map((p) => ({
				id: String(p.id),
				label: p.name,
				img: `${PROVIDER_LOGO}${p.logo_path}`,
				active: chosenServices.includes(p.id),
				count: count("services", String(p.id)),
				toggle: () =>
					state.onMyServices
						? set({ onMyServices: false, services: [p.id] })
						: set({ services: toggleIn(state.services, p.id) }),
			})),
		},
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

function OptionPoster({ option }: { option: Option }) {
	return (
		<motion.button
			type="button"
			aria-pressed={option.active}
			aria-label={option.label}
			title={option.label}
			whileTap={TAP}
			onClick={option.toggle}
			className={`relative w-14 shrink-0 overflow-hidden rounded-lg bg-white/5 cursor-pointer outline-none transition focus-visible:ring-2 focus-visible:ring-amber-400 ${option.active ? "ring-2 ring-rose-400 ring-offset-2 ring-offset-gray-950" : "opacity-60 hover:opacity-100"}`}
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
				<span className="absolute top-1 right-1 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-white">
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
	const [notice, setNotice] = useState("")
	const titles = useTitleNames(data.state.similarTo ?? [], query)
	const people = usePeopleNames(data.state.people ?? [], query)
	const moods = data.state.moods.join(",")
	// A change of moods ends the refusal notice.
	useEffect(() => {
		setNotice("")
	}, [moods])
	const groups = buildGroups({ ...data, titles, people }, (name) =>
		setNotice(`Three moods is the most. Remove one to add ${name}.`),
	)
	const q = query.trim().toLowerCase()
	const searchable = (g: Group) => g.key === "similarTo" || g.key === "people"
	const shown = groups
		.map((g) => ({
			...g,
			options:
				!q || g.title.toLowerCase().includes(q) || searchable(g)
					? g.options
					: g.options.filter((o) => o.label.toLowerCase().includes(q)),
		}))
		.filter((g) => !q || g.options.length > 0)
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
							{g.options.length === 0 ? (
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
							{g.key === "moods" && notice && (
								<p className="mt-2 text-xs text-amber-300">{notice}</p>
							)}
							{g.needs && <NeedsTaste needs={g.needs} />}
						</section>
					))}
				</div>
			)}
		</div>
	)
}
