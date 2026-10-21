// PROTOTYPE - throwaway. Four layouts for the Filters sheet's groups (desktop side sheet and phone sheet), switched
// with ?variant=. "now" is the live list. Every variant reuses the live chips, logos, posters, and bodies; only the
// order, grouping, and disclosure change. A search in the sheet falls back to the live list.
//
// A  Accordion: where → what → how good. Five groups open, the rest one row each with what's set.
// B  Essentials, then "More filters" as tiles; a tile opens its group as a page inside the sheet.
// C  Category tabs: Basics, Vibe, Details, Titles & people.
// D  Trimmed chips: every group visible, options by result count, top few plus "+N more".
import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	PlusIcon,
} from "@heroicons/react/20/solid"
import { useSearchParams } from "@remix-run/react"
import { motion } from "framer-motion"
import { type ReactNode, useLayoutEffect, useRef, useState } from "react"
import { ladderStepFor } from "~/domain/age-content"
import type { FilterName } from "~/domain/filter-state"
import type { TitleKey } from "~/utils/title-key"
import {
	type FilterGroupsData,
	type Group,
	NeedsTaste,
	type Option,
	OptionChip,
	OptionLogo,
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
} from "./useFilterData"

export const FILTER_SHEET_VARIANTS = {
	now: "Live today",
	A: "Accordion",
	B: "Essentials + tiles",
	C: "Category tabs",
	D: "Trimmed chips",
} as const
export type FilterSheetVariant = keyof typeof FILTER_SHEET_VARIANTS

export function useFilterSheetVariant(): FilterSheetVariant {
	const [params] = useSearchParams()
	const v = params.get("variant")
	return v && v in FILTER_SHEET_VARIANTS ? (v as FilterSheetVariant) : "now"
}

interface Props {
	variant: Exclude<FilterSheetVariant, "now">
	groups: Group[]
	data: FilterGroupsData
	refusal: Refusal | null
	titles: { byKey: Map<TitleKey, NamedTitle> }
	people: { byId: Map<number, NamedPerson> }
	className?: string
}

/** What a group is set to, in a few words, for a closed row or a tile. */
type Summaries = Partial<Record<FilterName, string>>

function useSummaries({ data, titles, people }: Props): Summaries {
	const { state, ladder } = data
	const chips = activeChips(state, {
		service: (id) => data.countryProviders.find((p) => p.id === id)?.name,
		title: (key) => titles.byKey.get(key)?.title,
		person: (id) => people.byId.get(id)?.name,
		ageStep: (age) =>
			ladder ? ladderStepFor(ladder.steps, age).label : undefined,
	})
	const by: Partial<Record<FilterName, string[]>> = {}
	for (const chip of chips) {
		const group = chip.group === "content" ? "ageLimit" : chip.group
		by[group] = [...(by[group] ?? []), chip.label]
	}
	const list = (key: FilterName, none: string) => {
		const labels = by[key] ?? []
		if (!labels.length) return none
		return labels.length > 2
			? `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`
			: labels.join(", ")
	}
	return {
		type: TYPE_LABELS[state.type],
		anime: ANIME_LABELS[state.anime],
		minScore: SCORE_LABELS[state.minScore as keyof typeof SCORE_LABELS] ?? `${state.minScore} and up`,
		minMatch: MATCH_LABELS[state.minMatch as keyof typeof MATCH_LABELS] ?? `${state.minMatch}% and up`,
		released: RELEASED_LABELS[state.released],
		services: state.onMyServices ? "My services" : list("services", "Everywhere"),
		genres: list("genres", "Any genre"),
		moods: list("moods", "Any mood"),
		themes: list("themes", "Any theme"),
		styles: list("styles", "Any style"),
		ageLimit: list("ageLimit", "No limit"),
		productionCountries: list("productionCountries", "Anywhere"),
		similarTo: list("similarTo", "None yet"),
		people: list("people", "None yet"),
		loved: list("loved", "None yet"),
		disliked: list("disliked", "None yet"),
	}
}

// ---------------------------------------------------------------- shared parts

const Accent = ({ k, tall = false }: { k: FilterName; tall?: boolean }) => (
	<span
		className={`${tall ? "h-4" : "h-3.5"} w-1 shrink-0 rounded-full ${FILTER_ACCENTS[k].bar}`}
	/>
)

function Badge({ n }: { n: number }) {
	if (!n) return null
	return (
		<span className="rounded-full bg-white/10 px-2 text-xs font-bold tabular-nums text-white">
			{n}
		</span>
	)
}

/** The live section header. */
function GroupHeader({ g, right }: { g: Group; right?: ReactNode }) {
	return (
		<header className="mb-3 flex items-center gap-2.5">
			<Accent k={g.key} />
			<h3
				id={`filter-group-${g.key}`}
				className="text-[15px] font-bold text-white"
			>
				{g.title}
			</h3>
			<Badge n={g.badge} />
			{right ??
				(g.note && (
					<span className="ml-auto truncate text-xs text-gray-500">
						{g.note}
					</span>
				))}
		</header>
	)
}

/** Active first, then most titles, then the ones that would leave nothing. */
const byCount = (options: Option[]) =>
	[...options].sort(
		(a, b) =>
			Number(b.active) - Number(a.active) ||
			Number(b.count !== 0) - Number(a.count !== 0) ||
			(b.count ?? 0) - (a.count ?? 0),
	)

function Chips({ g, options }: { g: Group; options?: Option[] }) {
	const list = options ?? g.options
	return (
		<div className={`flex flex-wrap ${g.kind === "posters" ? "gap-2.5" : "gap-2"}`}>
			{list.map((o) =>
				g.kind === "posters" ? (
					<OptionPoster key={o.id} option={o} />
				) : (
					<OptionChip key={o.id} option={o} />
				),
			)}
		</div>
	)
}

/** A group's live content without its header: body, chips, or the empty line; then refusal and taste notes. */
function GroupContent({
	g,
	refusal,
	options,
	after,
}: {
	g: Group
	refusal: Refusal | null
	options?: Option[]
	after?: ReactNode
}) {
	return (
		<>
			{g.body ? (
				g.body
			) : g.options.length === 0 ? (
				g.empty && <p className="text-sm text-gray-500">{g.empty}</p>
			) : (
				<div className="flex flex-wrap gap-2">
					<Chips g={g} options={options} />
					{after}
				</div>
			)}
			{refusal && g.key === refusal.group && (
				<p className="mt-2 text-xs text-amber-300">{refusal.text}</p>
			)}
			{g.needs && <NeedsTaste needs={g.needs} />}
		</>
	)
}

/** "+12 more" / "Fewer", as a quiet chip at the end of a trimmed row. */
function MoreChip({
	hidden,
	open,
	onClick,
}: {
	hidden: number
	open: boolean
	onClick: () => void
}) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-expanded={open}
			className="flex h-9 items-center gap-1 rounded-full px-3 text-sm text-gray-400 ring-1 ring-dashed ring-white/15 cursor-pointer outline-none hover:text-white hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			{open ? "Fewer" : `+${hidden} more`}
		</motion.button>
	)
}

/** A group trimmed to its first `limit` options (by count), with "+N more". */
function TrimmedGroup({
	g,
	refusal,
	limit,
	sort = true,
}: {
	g: Group
	refusal: Refusal | null
	limit: number
	sort?: boolean
}) {
	const [open, setOpen] = useState(false)
	const sorted = sort ? byCount(g.options) : g.options
	// Active options always show, even past the limit.
	const shownCount = Math.max(limit, sorted.filter((o) => o.active).length)
	const hidden = sorted.length - shownCount
	const options = open || hidden <= 1 ? sorted : sorted.slice(0, shownCount)
	return (
		<GroupContent
			g={g}
			refusal={refusal}
			options={options}
			after={
				hidden > 1 && (
					<MoreChip hidden={hidden} open={open} onClick={() => setOpen(!open)} />
				)
			}
		/>
	)
}

/** Movies or shows with Anime as a second row: they answer the same question. */
function TypeAndAnime({
	type,
	anime,
	refusal,
	header = true,
}: {
	type: Group
	anime?: Group
	refusal: Refusal | null
	header?: boolean
}) {
	return (
		<>
			{header && (
				<GroupHeader
					g={{ ...type, badge: type.badge + (anime?.badge ?? 0) }}
				/>
			)}
			<Chips g={type} />
			{anime && (
				<div className="mt-2.5 flex flex-wrap items-center gap-2">
					<span className="mr-0.5 flex items-center gap-1.5 text-xs text-gray-500">
						<span className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS.anime.dot}`} />
						Anime
					</span>
					{/* Include anime is the default, so only the two changes show; tapping the active one goes back. */}
					<Chips
						g={anime}
						options={anime.options
							.filter((o) => o.id !== "any")
							.map((o) => ({
								...o,
								toggle: o.active
									? (anime.options.find((a) => a.id === "any")?.toggle ?? o.toggle)
									: o.toggle,
							}))}
					/>
				</div>
			)}
			{refusal && refusal.group === "anime" && (
				<p className="mt-2 text-xs text-amber-300">{refusal.text}</p>
			)}
		</>
	)
}

const toggleIn = <T,>(list: T[] | undefined, value: T) => {
	const next = (list ?? []).includes(value)
		? (list ?? []).filter((v) => v !== value)
		: [...(list ?? []), value]
	return next.length ? next : undefined
}

/**
 * Streaming services in one row: My services and Everywhere, then the chosen and saved services first and the
 * country's top ones, then "All" for the live body (country, search, every service).
 */
function CompactServices({
	data,
	onAll,
	allLabel = "All services",
}: {
	data: FilterGroupsData
	onAll: () => void
	allLabel?: string
}) {
	const { state, onChange, myServices } = data
	const chosen = state.onMyServices ? myServices : (state.services ?? [])
	const rank = (id: number) =>
		chosen.includes(id) ? 0 : myServices.includes(id) ? 1 : 2
	const providers = data.countryProviders
		.map((p, i) => ({ p, i }))
		.sort((a, b) => rank(a.p.id) - rank(b.p.id) || a.i - b.i)
		.slice(0, Math.max(10, chosen.length))
		.map(({ p }) => p)
	const everywhere = !state.onMyServices && !state.services?.length
	const seg = (on: boolean) =>
		`flex h-9 items-center rounded-full px-3.5 text-sm whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
			on
				? "bg-white font-bold text-gray-950"
				: "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/10"
		}`
	return (
		<div>
			<div className="flex flex-wrap gap-2">
				{myServices.length > 0 && (
					<motion.button
						type="button"
						whileTap={TAP}
						aria-pressed={!!state.onMyServices}
						onClick={() =>
							onChange({ ...state, onMyServices: true, services: undefined })
						}
						className={seg(!!state.onMyServices)}
					>
						My services
					</motion.button>
				)}
				<motion.button
					type="button"
					whileTap={TAP}
					aria-pressed={everywhere}
					onClick={() =>
						onChange({ ...state, onMyServices: false, services: undefined })
					}
					className={seg(everywhere)}
				>
					Everywhere
				</motion.button>
			</div>
			<div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
				{providers.map((provider) => (
					<div key={provider.id} className="shrink-0">
						<OptionLogo
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
					</div>
				))}
				<button
					type="button"
					onClick={onAll}
					className="group flex w-14 shrink-0 flex-col items-center gap-1 cursor-pointer outline-none"
				>
					<span className="grid h-12 w-12 place-items-center rounded-xl bg-white/[0.04] text-gray-400 ring-1 ring-white/10 group-hover:text-white group-focus-visible:ring-2 group-focus-visible:ring-amber-400">
						<ChevronRightIcon className="h-5 w-5" />
					</span>
					<span className="text-[11px] text-gray-400">{allLabel}</span>
				</button>
			</div>
		</div>
	)
}

/** Services: the compact row, or the live body once "All" is tapped. */
function Services({
	g,
	data,
}: {
	g: Group
	data: FilterGroupsData
}) {
	const [all, setAll] = useState(false)
	return all ? (
		<>
			{g.body}
			<button
				type="button"
				onClick={() => setAll(false)}
				className="mt-3 text-sm text-gray-400 cursor-pointer hover:text-white"
			>
				Fewer services
			</button>
		</>
	) : (
		<CompactServices data={data} onAll={() => setAll(true)} allLabel="All" />
	)
}

const pick = (groups: Group[], keys: FilterName[]) => {
	const by = new Map(groups.map((g) => [g.key, g]))
	return keys.map((k) => by.get(k)).filter((g): g is Group => !!g)
}

// ---------------------------------------------------------------- A: accordion

const A_ORDER: FilterName[] = [
	"services",
	"type",
	"genres",
	"moods",
	"minScore",
	"minMatch",
	"released",
	"themes",
	"styles",
	"similarTo",
	"people",
	"ageLimit",
	"productionCountries",
	"loved",
	"disliked",
]
const A_OPEN: FilterName[] = ["services", "type", "genres", "moods", "minScore"]

function VariantA(props: Props) {
	const { groups, refusal, data } = props
	const summaries = useSummaries(props)
	const anime = groups.find((g) => g.key === "anime")
	const list = pick(groups, A_ORDER)
	const [open, setOpen] = useState<Set<FilterName>>(
		() =>
			new Set([
				...A_OPEN,
				...groups.filter((g) => g.badge > 0).map((g) => g.key),
				...(anime?.badge ? (["type"] as FilterName[]) : []),
			]),
	)
	const toggle = (k: FilterName) =>
		setOpen((s) => {
			const next = new Set(s)
			next.has(k) ? next.delete(k) : next.add(k)
			return next
		})
	return (
		<div className="-mx-1 flex flex-col">
			{list.map((g) => {
				const isOpen = open.has(g.key)
				const badge = g.badge + (g.key === "type" ? (anime?.badge ?? 0) : 0)
				const summary =
					g.key === "type"
						? anime?.badge
							? `${summaries.type}, ${summaries.anime}`
							: summaries.type
						: summaries[g.key]
				return (
					<section
						key={g.key}
						aria-labelledby={`filter-group-${g.key}`}
						className="border-b border-white/[0.06] last:border-b-0"
					>
						<button
							type="button"
							onClick={() => toggle(g.key)}
							aria-expanded={isOpen}
							className="flex min-h-12 w-full items-center gap-2.5 rounded-lg px-1 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<Accent k={g.key} />
							<h3
								id={`filter-group-${g.key}`}
								className="shrink-0 text-[15px] font-bold text-white"
							>
								{g.title}
							</h3>
							<Badge n={badge} />
							<span
								className={`ml-auto min-w-0 truncate text-right text-sm ${badge ? "text-gray-200" : "text-gray-500"} ${isOpen ? "invisible" : ""}`}
							>
								{summary}
							</span>
							<ChevronDownIcon
								className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
							/>
						</button>
						{isOpen && (
							<motion.div
								initial={{ opacity: 0, y: -4 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.18 }}
								className="px-1 pt-1 pb-5"
							>
								{g.key === "type" ? (
									<TypeAndAnime
										type={g}
										anime={anime}
										refusal={refusal}
										header={false}
									/>
								) : g.key === "services" ? (
									<Services g={g} data={data} />
								) : (
									<>
										{g.note && (
											<p className="-mt-1 mb-2.5 text-xs text-gray-500">
												{g.note}
											</p>
										)}
										<GroupContent g={g} refusal={refusal} />
									</>
								)}
							</motion.div>
						)}
					</section>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------- B: essentials + tiles

const B_MORE: FilterName[] = [
	"minMatch",
	"released",
	"themes",
	"styles",
	"similarTo",
	"people",
	"ageLimit",
	"productionCountries",
	"loved",
	"disliked",
]

function VariantB(props: Props) {
	const { groups, refusal, data } = props
	const summaries = useSummaries(props)
	const [page, setPage] = useState<FilterName | null>(null)
	const top = useRef<HTMLDivElement>(null)
	// A page opens at its top, and closing it returns to the tiles.
	useLayoutEffect(() => {
		if (page) top.current?.scrollIntoView({ block: "start" })
	}, [page])
	const by = new Map(groups.map((g) => [g.key, g]))
	const type = by.get("type")
	const anime = by.get("anime")
	const genres = by.get("genres")
	const moods = by.get("moods")
	const score = by.get("minScore")
	const services = by.get("services")
	const more = pick(groups, B_MORE)

	if (page) {
		const g = by.get(page)
		return (
			<div ref={top} className="scroll-mt-4">
				<button
					type="button"
					onClick={() => setPage(null)}
					className="-ml-1 mb-4 flex items-center gap-1 rounded-full py-1 pr-3 pl-1 text-sm text-gray-300 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<ChevronLeftIcon className="h-5 w-5" />
					All filters
				</button>
				{g && (
					<motion.section
						initial={{ opacity: 0, x: 16 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.2 }}
					>
						<GroupHeader g={g} />
						<GroupContent g={g} refusal={refusal} />
					</motion.section>
				)}
			</div>
		)
	}

	return (
		<div ref={top} className="flex flex-col gap-7 scroll-mt-4">
			{type && (
				<section>
					<TypeAndAnime type={type} anime={anime} refusal={refusal} />
				</section>
			)}
			{genres && (
				<section>
					<GroupHeader g={genres} />
					<TrimmedGroup g={genres} refusal={refusal} limit={8} />
				</section>
			)}
			{moods && (
				<section>
					<GroupHeader g={moods} />
					<GroupContent g={moods} refusal={refusal} />
				</section>
			)}
			{services && (
				<section>
					<GroupHeader g={services} />
					<CompactServices data={data} onAll={() => setPage("services")} />
				</section>
			)}
			{score && (
				<section>
					<GroupHeader g={score} />
					<GroupContent g={score} refusal={refusal} />
				</section>
			)}
			<section>
				<header className="mb-3 flex items-center justify-between">
					<h3 className="text-[15px] font-bold text-white">More filters</h3>
					<span className="text-xs text-gray-500">
						{more.reduce((n, g) => n + g.badge, 0) || ""}
					</span>
				</header>
				<div className="grid grid-cols-2 gap-2">
					{more.map((g) => (
						<motion.button
							key={g.key}
							type="button"
							whileTap={TAP}
							onClick={() => setPage(g.key)}
							className={`flex min-h-[4.25rem] flex-col justify-center gap-1 rounded-2xl px-3.5 py-2.5 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${g.badge ? "bg-white/[0.08] ring-1 ring-white/25" : "bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.06]"}`}
						>
							<span className="flex items-center gap-2">
								<Accent k={g.key} />
								<span className="truncate text-sm font-bold text-white">
									{g.title}
								</span>
								<span className="ml-auto">
									<Badge n={g.badge} />
								</span>
							</span>
							<span
								className={`truncate pl-3 text-xs ${g.badge ? "text-gray-200" : "text-gray-500"}`}
							>
								{summaries[g.key]}
							</span>
						</motion.button>
					))}
				</div>
			</section>
		</div>
	)
}

// ---------------------------------------------------------------- C: tabs

const C_TABS: { key: string; label: string; groups: FilterName[] }[] = [
	{
		key: "basics",
		label: "Basics",
		groups: ["services", "type", "genres", "minScore"],
	},
	{ key: "vibe", label: "Vibe", groups: ["moods", "themes", "styles", "anime"] },
	{
		key: "details",
		label: "Details",
		groups: ["released", "minMatch", "ageLimit", "productionCountries"],
	},
	{
		key: "people",
		label: "Titles & people",
		groups: ["similarTo", "people", "loved", "disliked"],
	},
]

function VariantC(props: Props) {
	const { groups, refusal, data } = props
	const [tab, setTab] = useState(C_TABS[0].key)
	const current = C_TABS.find((t) => t.key === tab) ?? C_TABS[0]
	const list = pick(groups, current.groups)
	const badge = (keys: FilterName[]) =>
		pick(groups, keys).reduce((n, g) => n + g.badge, 0)
	return (
		<div>
			<div
				role="tablist"
				aria-label="Filter categories"
				className="sticky top-0 z-10 -mx-1 mb-5 flex gap-1 rounded-2xl bg-gray-950 p-1 ring-1 ring-white/10"
			>
				{C_TABS.map((t) => {
					const on = t.key === tab
					const n = badge(t.groups)
					return (
						<button
							key={t.key}
							type="button"
							role="tab"
							aria-selected={on}
							onClick={() => setTab(t.key)}
							className="relative flex min-h-11 flex-auto flex-col items-center justify-center rounded-xl px-2.5 text-center whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							{on && (
								<motion.span
									layoutId="proto-filter-tab"
									transition={{ type: "spring", stiffness: 500, damping: 40 }}
									className="absolute inset-0 rounded-xl bg-white/[0.1] ring-1 ring-white/30"
								/>
							)}
							<span
								className={`relative text-[13px] leading-tight font-bold ${on ? "text-white" : "text-gray-400"}`}
							>
								{t.label}
							</span>
							{n > 0 && (
								<span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
							)}
						</button>
					)
				})}
			</div>
			<motion.div
				key={tab}
				role="tabpanel"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.15 }}
				className="flex flex-col gap-7"
			>
				{list.map((g) => (
					<section key={g.key} aria-labelledby={`filter-group-${g.key}`}>
						<GroupHeader g={g} />
						{g.key === "services" ? (
							<Services g={g} data={data} />
						) : (
							<GroupContent g={g} refusal={refusal} />
						)}
					</section>
				))}
			</motion.div>
		</div>
	)
}

// ---------------------------------------------------------------- D: trimmed chips

const D_ORDER: FilterName[] = [
	"services",
	"type",
	"genres",
	"moods",
	"minScore",
	"released",
	"minMatch",
	"themes",
	"styles",
	"ageLimit",
	"productionCountries",
]
const D_LIMIT: Partial<Record<FilterName, number>> = {
	genres: 7,
	moods: 6,
	themes: 5,
	styles: 5,
}
const D_PEOPLE: FilterName[] = ["similarTo", "people", "loved", "disliked"]

/** A group with a body, folded to one line until opened. */
function FoldedBody({
	g,
	summary,
	refusal,
}: {
	g: Group
	summary?: string
	refusal: Refusal | null
}) {
	const [open, setOpen] = useState(g.badge > 0)
	return (
		<>
			<GroupHeader
				g={g}
				right={
					<button
						type="button"
						onClick={() => setOpen(!open)}
						aria-expanded={open}
						className="ml-auto flex min-w-0 items-center gap-1 text-sm text-gray-400 cursor-pointer hover:text-white"
					>
						<span className="truncate">{open ? "Close" : summary}</span>
						<ChevronDownIcon
							className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
						/>
					</button>
				}
			/>
			{open && <GroupContent g={g} refusal={refusal} />}
		</>
	)
}

function VariantD(props: Props) {
	const { groups, refusal, data } = props
	const summaries = useSummaries(props)
	const by = new Map(groups.map((g) => [g.key, g]))
	const anime = by.get("anime")
	const list = pick(groups, D_ORDER)
	const people = pick(groups, D_PEOPLE)
	const [person, setPerson] = useState<FilterName | null>(
		() => people.find((g) => g.badge > 0)?.key ?? null,
	)
	const personGroup = person ? by.get(person) : undefined
	return (
		<div className="flex flex-col gap-6">
			{list.map((g) => (
				<section key={g.key} aria-labelledby={`filter-group-${g.key}`}>
					{g.key === "type" ? (
						<TypeAndAnime type={g} anime={anime} refusal={refusal} />
					) : g.key === "services" ? (
						<>
							<GroupHeader g={g} />
							<Services g={g} data={data} />
						</>
					) : g.body ? (
						<FoldedBody g={g} summary={summaries[g.key]} refusal={refusal} />
					) : (
						<>
							<GroupHeader g={g} />
							<TrimmedGroup
								g={g}
								refusal={refusal}
								limit={D_LIMIT[g.key] ?? 99}
								sort={!!D_LIMIT[g.key]}
							/>
						</>
					)}
				</section>
			))}
			<section aria-labelledby="filter-group-titles-people">
				<header className="mb-3 flex items-center gap-2.5">
					<span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-rose-500 to-purple-500" />
					<h3
						id="filter-group-titles-people"
						className="text-[15px] font-bold text-white"
					>
						Titles and people
					</h3>
					<Badge n={people.reduce((n, g) => n + g.badge, 0)} />
				</header>
				<div className="flex flex-wrap gap-2">
					{people.map((g) => {
						const on = person === g.key
						return (
							<motion.button
								key={g.key}
								type="button"
								whileTap={TAP}
								aria-expanded={on}
								onClick={() => setPerson(on ? null : g.key)}
								className={`flex h-9 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-sm cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-white font-bold text-gray-950" : "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/10"}`}
							>
								{g.badge ? (
									<span className={`h-2 w-2 rounded-full ${FILTER_ACCENTS[g.key].dot}`} />
								) : (
									<PlusIcon className="h-4 w-4 opacity-70" />
								)}
								{g.title}
								{g.badge > 0 && (
									<span className="text-xs tabular-nums opacity-60">{g.badge}</span>
								)}
							</motion.button>
						)
					})}
				</div>
				{personGroup && (
					<motion.div
						key={personGroup.key}
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.18 }}
						className="mt-4"
					>
						<GroupContent g={personGroup} refusal={refusal} />
					</motion.div>
				)}
			</section>
		</div>
	)
}

// ---------------------------------------------------------------- switch

export function PrototypeFilterGroups(props: Props) {
	const { variant, className = "" } = props
	return (
		<div className={className} data-proto-variant={variant}>
			<p aria-live="polite" className="sr-only">
				{props.refusal?.text ?? ""}
			</p>
			{variant === "A" && <VariantA {...props} />}
			{variant === "B" && <VariantB {...props} />}
			{variant === "C" && <VariantC {...props} />}
			{variant === "D" && <VariantD {...props} />}
		</div>
	)
}

