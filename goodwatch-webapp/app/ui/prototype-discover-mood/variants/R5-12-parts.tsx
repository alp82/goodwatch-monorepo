// PROTOTYPE - throwaway. Round 5 variant 12: its own copy of R4-8-parts (the static title, the segmented bar, the
// common controls, single filter cards, the status line, the quick title search), with the four question tabs
// (Search, Mood, Where, Quality), their sub-tabs (SUB_TABS: where every filter lives) and the sub-tab frame.
import { ArrowTopRightOnSquareIcon, CheckIcon, ChevronRightIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, type Ref, useEffect, useLayoutEffect, useRef, useState } from "react"
import { type FilterState, RELEASED } from "~/domain/filter-state"
import { productionCountryName } from "~/domain/production-country"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups } from "~/ui/filter-bar"
import { FilterSearchField } from "~/ui/filter-bar/FilterGroups"
import { type CardKey, cardOf, focusSheetOn } from "~/ui/filter-bar/filter-cards"
import { NotSeenSwitch, ServiceStack, SortControl } from "~/ui/filter-bar/controls"
import {
	type ActiveChip,
	FILTER_ACCENTS,
	RELEASED_LABELS,
	TYPE_LABELS,
	discoverSorts,
	sortShown,
} from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { Chip, ChipList, type Option, RangeSlider, Segmented, ThresholdBar, byCount } from "~/ui/filter-bar/SheetControls"
import { PROVIDER_LOGO } from "~/ui/filter-bar/useFilterData"
import { SERVICES_PATH } from "~/ui/settings/paths"
import { titlePath } from "~/utils/helpers"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { goodwatchVibeIndex } from "~/utils/ratings"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"
import { ProtoGrid, type ProtoDiscover, TAGS, type Tag, tagId, type useFilterPieces } from "../kit"

export type Pieces = ReturnType<typeof useFilterPieces>
export type SegKey = "search" | "mood" | "where" | "quality"
export const SEG_ORDER: SegKey[] = ["search", "mood", "where", "quality"]
export const SEG_LABEL: Record<SegKey, string> = {
	search: "Search",
	mood: "Mood",
	where: "Where",
	quality: "Quality",
}
export const PRIVATE = "search-private ph-no-capture sentry-mask"
export const SEARCH_PLACEHOLDER = "A mood, a title, or like Severance"
const TASTE = "signUp" as const

export const MOOD_TAGS = TAGS.filter((t) => t.group === "moods")

// ---------------------------------------------------------------------------------------------------------------
// Title

export function PageTitle() {
	return <h1 className="brand-header text-[23px] leading-tight text-white lg:text-[34px]">Discover movies and TV shows</h1>
}

// ---------------------------------------------------------------------------------------------------------------
// What each segment reads

/** Every filter's name and a short hint, for column headers. */
export const CARD_INFO: Record<CardKey, { title: string; hint: string }> = {
	type: { title: "Movies or shows", hint: "" },
	genres: { title: "Genre", hint: "" },
	moods: { title: "Mood", hint: "" },
	themes: { title: "About", hint: "Crime, family, the future" },
	styles: { title: "Style", hint: "Slow burn, fast-paced" },
	services: { title: "Streaming services", hint: "" },
	runtime: { title: "Length", hint: "Short movies, short episodes" },
	ageLimit: { title: "Age and content", hint: "Age rating, violence, language" },
	productionCountries: { title: "Production country", hint: "Where it was made" },
	minScore: { title: "Score", hint: "GoodWatch score" },
	minMatch: { title: "Taste match", hint: "How well it fits your taste" },
	sourceScores: { title: "Scores by source", hint: "IMDb, Rotten Tomatoes, Metacritic" },
	scoreGap: { title: "Critics vs audiences", hint: "Where they disagree" },
	released: { title: "Released", hint: "" },
	similarTo: { title: "Similar to", hint: "Like titles you pick" },
	people: { title: "Cast and crew", hint: "Actors and directors" },
	loved: { title: "Loved", hint: "Steer toward these" },
	disliked: { title: "Disliked", hint: "Steer away from these" },
}

/** A place in the panel: a tab and one of its sub-tabs. */
export interface Spot {
	seg: SegKey
	sub: string
}

export interface SubTab {
	id: string
	label: string
	/** The filters this sub-tab holds (for its count). */
	keys: CardKey[]
	/** Not seen yet lives here too. */
	notSeen?: boolean
}

/**
 * The structure. Search: the text search with its lanes (mood, title, similar to), cast and crew, and the viewer's own
 * history. Mood: what it feels like and what it is. Where: what fits tonight (services, length, age, where it was
 * made). Quality: how good, and when.
 */
export const SUB_TABS: Record<SegKey, SubTab[]> = {
	search: [
		{ id: "search", label: "Search", keys: ["similarTo"] },
		{ id: "people", label: "Cast and crew", keys: ["people"] },
		{ id: "history", label: "Your history", keys: ["loved", "disliked"], notSeen: true },
	],
	mood: [
		{ id: "mood", label: "Mood", keys: ["moods", "type", "genres"] },
		{ id: "about", label: "About", keys: ["themes"] },
		{ id: "style", label: "Style", keys: ["styles"] },
	],
	where: [
		{ id: "services", label: "Services", keys: ["services"] },
		{ id: "length", label: "Length", keys: ["runtime"] },
		{ id: "age", label: "Age and content", keys: ["ageLimit"] },
		{ id: "country", label: "Made in", keys: ["productionCountries"] },
	],
	quality: [
		{ id: "score", label: "Score", keys: ["minScore", "minMatch"] },
		{ id: "sources", label: "By source", keys: ["sourceScores", "scoreGap"] },
		{ id: "released", label: "Released", keys: ["released"] },
	],
}

/** The sub-tabs this viewer gets (Age and content needs a rating ladder). */
export const subTabsFor = (pieces: Pieces, seg: SegKey) =>
	SUB_TABS[seg].filter((t) => t.id !== "age" || pieces.groups.ladder)

export const SPOT_OF_CARD = Object.fromEntries(
	SEG_ORDER.flatMap((seg) => SUB_TABS[seg].flatMap((t) => t.keys.map((k) => [k, { seg, sub: t.id }]))),
) as Record<CardKey, Spot>
export const NOT_SEEN_SPOT: Spot = { seg: "search", sub: "history" }
export const QUERY_SPOT: Spot = { seg: "search", sub: "search" }

/** The active chips of one card. */
export const chipsOf = (pieces: Pieces, k: CardKey) => pieces.chips.filter((c) => cardOf(c.group) === k)

/** Where a chip lives. */
export const spotOfChip = (chip: ActiveChip): Spot => {
	const k = cardOf(chip.group)
	return (k && SPOT_OF_CARD[k]) || QUERY_SPOT
}

/** How many values one sub-tab has set. */
export const subCount = (d: ProtoDiscover, pieces: Pieces, t: SubTab) =>
	t.keys.reduce((a, k) => a + (k === "services" ? 0 : chipsOf(pieces, k).length), 0) +
	(t.keys.includes("services") && (d.filters.state.onMyServices || d.filters.state.services?.length || d.filters.state.anyService) ? 1 : 0) +
	(t.notSeen && d.filters.state.notSeenYet ? 1 : 0)

/** The tab a spot's sub-tab opens at when nothing points elsewhere: the first with something set, else the first. */
export const firstSub = (d: ProtoDiscover, pieces: Pieces, seg: SegKey) => {
	const tabs = subTabsFor(pieces, seg)
	return (seg === "search" ? tabs[0] : tabs.find((t) => subCount(d, pieces, t) > 0) ?? tabs[0]).id
}

const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ") || null
const headPlus = (names: string[]) => (names.length ? (names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ")) : null)

export interface SegValue {
	value: string | null
	placeholder: string
	lead?: ReactNode
	badge?: number
	/** The value isn't the query (plain text in the Search segment). */
	plain?: boolean
}

const labelsOf = (pieces: Pieces, keys: CardKey[]) => keys.flatMap((k) => chipsOf(pieces, k).map((c) => c.label.replace(/^Produced in /, "Made in ")))

export function segValues(d: ProtoDiscover, pieces: Pieces): Record<SegKey, SegValue> {
	const s = d.filters.state
	const tags = d.picked
	const providers = pieces.services.countryProviders
	const chosen = s.onMyServices ? pieces.services.providers : providers.filter((p) => s.services?.includes(p.id))
	const searchExtras = [...(s.notSeenYet ? ["Not seen yet"] : []), ...labelsOf(pieces, ["similarTo", "people", "loved", "disliked"])]
	const services = s.onMyServices
		? "My services"
		: s.services?.length
			? headPlus(chosen.map((p) => p.name.replace(/ (Amazon Channel|Apple TV Channel)$/, ""))) ?? `${s.services.length} services`
			: s.anyService
				? "Any service"
				: null
	return {
		search: d.q
			? { value: d.q, placeholder: SEARCH_PLACEHOLDER, badge: searchExtras.length || undefined }
			: { value: headPlus(searchExtras), placeholder: SEARCH_PLACEHOLDER, plain: searchExtras.length > 0 },
		mood: {
			value: join([
				headPlus(tags.map((t) => t.name)),
				s.type !== "all" && TYPE_LABELS[s.type],
				headPlus(labelsOf(pieces, ["genres"])),
			]),
			placeholder: "Any mood",
			lead: tags.length ? <HueDots tags={tags} size={10} /> : null,
		},
		where: {
			value: join([services, headPlus(labelsOf(pieces, ["runtime", "ageLimit", "productionCountries"]))]),
			placeholder: "Everywhere, any length",
			lead: chosen.length ? <ServiceStack providers={chosen} on size={16} /> : null,
		},
		quality: {
			value: join([headPlus(labelsOf(pieces, ["minScore", "minMatch", "sourceScores", "scoreGap", "released"]))]),
			placeholder: "Any score, any year",
		},
	}
}

// ---------------------------------------------------------------------------------------------------------------
// The bar

const SEG_FLEX: Record<SegKey, string> = {
	search: "flex-[2.2]",
	mood: "flex-1",
	where: "flex-1",
	quality: "flex-1",
}

/**
 * The desktop bar: one rounded bar, a segment per filter, label on top and value below. `active` lifts its segment
 * (a pill that slides between segments); `searchInput` replaces the Mood search segment's value while it's active.
 */
export function SegmentBar({
	id,
	values,
	active,
	onPick,
	onClearSearch,
	searchInput,
	barRef,
	tail,
	flash,
}: {
	id: string
	values: Record<SegKey, SegValue>
	active: SegKey | null
	onPick: (k: SegKey) => void
	onClearSearch: () => void
	searchInput?: ReactNode
	barRef?: Ref<HTMLDivElement>
	/** A last, small segment after More. */
	tail?: ReactNode
	/** Lights a segment briefly; a new `n` lights it again. */
	flash?: { k: SegKey; n: number } | null
}) {
	return (
		<div
			ref={barRef}
			data-seg-bar
			className={`relative flex h-[76px] items-stretch rounded-full p-1.5 ring-1 transition-colors duration-200 ${
				active
					? "bg-gray-900 ring-white/15"
					: "bg-white/[0.045] ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_20px_50px_-30px_rgba(0,0,0,.9)]"
			}`}
		>
			{SEG_ORDER.map((k, i) => {
				const v = values[k]
				const on = active === k
				const nextOn = active === SEG_ORDER[i + 1]
				const isSearch = k === "search"
				return (
					<div key={k} data-seg={k} className={`relative flex min-w-0 ${SEG_FLEX[k]}`}>
						{on && (
							<motion.span
								layoutId={`${id}-pill`}
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-0 rounded-full bg-white/[0.1] ring-1 ring-white/20 shadow-[0_10px_30px_-10px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.08)]"
							/>
						)}
						{isSearch && searchInput ? (
							<div className="relative flex min-w-0 flex-1 flex-col justify-center pr-4 pl-7">
								<SegLabel k={k} />
								{searchInput}
							</div>
						) : (
							<motion.button
								type="button"
								whileTap={{ scale: 0.985 }}
								onClick={() => onPick(k)}
								aria-expanded={on}
								aria-haspopup="dialog"
								className={`relative flex min-w-0 flex-1 cursor-pointer flex-col justify-center rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
									isSearch ? "pr-12 pl-7" : "px-6"
								} ${on ? "" : "hover:bg-white/[0.05]"}`}
							>
								<SegLabel k={k} badge={v.badge} />
								<span className="mt-0.5 flex min-w-0 items-center gap-2">
									{v.lead}
									<span
										className={`truncate ${
											isSearch && !v.plain
												? `brand-header text-[21px] leading-tight ${v.value ? "text-white" : "text-gray-500"} ${PRIVATE}`
												: `text-[15px] ${v.value ? "font-semibold text-white" : "text-gray-500"}`
										}`}
									>
										{v.value ?? v.placeholder}
									</span>
								</span>
							</motion.button>
						)}
						{isSearch && v.value && !v.plain && !searchInput && (
							<button
								type="button"
								onClick={onClearSearch}
								aria-label="Clear the search"
								className="absolute top-1/2 right-3 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-gray-400 cursor-pointer outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<XMarkIcon className="h-4 w-4" />
							</button>
						)}
						{flash?.k === k && (
							<motion.span
								key={flash.n}
								aria-hidden
								initial={{ opacity: 0 }}
								animate={{ opacity: [0, 1, 1, 0] }}
								transition={{ duration: 1.6, times: [0, 0.12, 0.55, 1], ease: "easeOut" }}
								className="pointer-events-none absolute inset-0 rounded-full bg-amber-400/[0.12] ring-2 ring-inset ring-amber-400/80"
							/>
						)}
						{(i < SEG_ORDER.length - 1 || tail) && (
							<span
								aria-hidden
								className={`absolute top-1/2 -right-px h-8 w-px -translate-y-1/2 bg-white/10 transition-opacity ${on || nextOn ? "opacity-0" : ""}`}
							/>
						)}
					</div>
				)
			})}
			{tail}
		</div>
	)
}

export function SegLabel({ k, badge }: { k: SegKey; badge?: number }) {
	return (
		<span
			className={`flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] uppercase ${k === "search" ? "text-amber-300/90" : "text-gray-400"}`}
		>
			{k === "search" && <MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden />}
			{SEG_LABEL[k]}
			{badge ? (
				<span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] tracking-normal text-gray-950 tabular-nums">
					{badge}
				</span>
			) : null}
		</span>
	)
}

/** The phone bar: Mood search full width, then the four other segments in a row. */
export function PhoneBar({
	values,
	active,
	onPick,
	onClearSearch,
	searchInput,
	tail,
}: {
	values: Record<SegKey, SegValue>
	active?: SegKey | null
	onPick: (k: SegKey) => void
	onClearSearch?: () => void
	searchInput?: ReactNode
	/** A narrow last cell in the lower row. */
	tail?: ReactNode
}) {
	const v = values.search
	return (
		<div className="overflow-hidden rounded-[22px] bg-white/[0.045] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
			<div className={`relative ${active === "search" ? "bg-white/[0.07]" : ""}`}>
				{searchInput ? (
					<div className="flex h-[62px] flex-col justify-center px-4">
						<SegLabel k="search" />
						{searchInput}
					</div>
				) : (
					<button
						type="button"
						onClick={() => onPick("search")}
						className="flex h-[62px] w-full cursor-pointer flex-col justify-center px-4 pr-12 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
					>
						<SegLabel k="search" />
						<span className={`mt-0.5 truncate leading-tight ${v.plain ? "text-[15px] font-semibold" : "brand-header text-[19px]"} ${v.value ? "text-white" : "text-gray-500"} ${PRIVATE}`}>
							{v.value ?? v.placeholder}
						</span>
					</button>
				)}
				{v.value && !v.plain && onClearSearch && !searchInput && (
					<button
						type="button"
						onClick={onClearSearch}
						aria-label="Clear the search"
						className="absolute top-1/2 right-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-gray-400 cursor-pointer hover:text-white"
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
				)}
			</div>
			<div className={`grid border-t border-white/[0.08] ${tail ? "grid-cols-[repeat(3,minmax(0,1fr))_48px]" : "grid-cols-3"}`}>
				{SEG_ORDER.slice(1).map((k, i) => {
					const s = values[k]
					const on = active === k
					return (
						<motion.button
							key={k}
							type="button"
							whileTap={TAP}
							onClick={() => onPick(k)}
							className={`flex h-[52px] min-w-0 cursor-pointer flex-col justify-center px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${i ? "border-l border-white/[0.08]" : ""} ${on ? "bg-white/[0.08]" : ""}`}
						>
							<span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.06em] text-gray-400 uppercase">
								{SEG_LABEL[k]}
								{s.badge ? (
									<span className="grid h-3.5 min-w-3.5 place-items-center rounded-full bg-amber-500 px-0.5 text-[9px] tracking-normal text-gray-950">
										{s.badge}
									</span>
								) : null}
							</span>
							<span className={`truncate text-[12.5px] ${s.value ? "font-semibold text-white" : "text-gray-500"}`}>
								{s.value ?? (k === "where" ? "Everywhere" : "Any")}
							</span>
						</motion.button>
					)
				})}
				{tail}
			</div>
		</div>
	)
}

/** The bar's Search segment as a real field. */
export function SearchInput({
	value,
	onChange,
	onEnter,
	onEscape,
	onFocus,
	size = "lg",
	inputRef,
	autoFocus = true,
}: {
	value: string
	onChange: (v: string) => void
	onEnter: () => void
	onEscape?: () => void
	onFocus?: () => void
	size?: "lg" | "md"
	inputRef?: Ref<HTMLInputElement>
	autoFocus?: boolean
}) {
	return (
		<input
			ref={inputRef}
			// biome-ignore lint/a11y/noAutofocus: the segment turns into the field when tapped
			autoFocus={autoFocus}
			data-autofocus={autoFocus || undefined}
			type="search"
			value={value}
			maxLength={200}
			autoComplete="off"
			enterKeyHint="search"
			data-ph-no-capture
			aria-label="Search"
			placeholder={SEARCH_PLACEHOLDER}
			onChange={(e) => onChange(e.target.value)}
			onFocus={onFocus}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault()
					onEnter()
				} else if (e.key === "Escape" && onEscape) {
					e.preventDefault()
					onEscape()
				}
			}}
			className={`brand-header mt-0.5 w-full min-w-0 border-0 bg-transparent p-0 leading-tight text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${PRIVATE} ${size === "lg" ? "text-[21px]" : "text-[19px]"}`}
		/>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Status line: count, the query and every active value (removable), Clear all, sort.

/** Clear all: the search goes first, then the filters, so the two URL writes don't overwrite each other. */
export function useClearAll(d: ProtoDiscover) {
	const [pending, setPending] = useState(false)
	useEffect(() => {
		if (pending && d.q === null) {
			d.filters.clearSecondary()
			setPending(false)
		}
	}, [pending, d.q, d.filters])
	return () => {
		if (d.q !== null) {
			setPending(true)
			d.setQ(null)
		} else d.filters.clearSecondary()
	}
}

const colorOf = (chip: ActiveChip) => {
	const m = chip.key.match(/^(mood|theme|style)-(.+)$/)
	if (!m) return undefined
	const group = m[1] === "mood" ? "moods" : m[1] === "theme" ? "themes" : "styles"
	return TAGS.find((t) => t.group === group && t.key === m[2])?.color
}

export function ValueChip({ chip, onRemove, onOpen }: { chip: ActiveChip; onRemove: () => void; onOpen?: () => void }) {
	const color = colorOf(chip)
	return (
		<span
			className={`inline-flex h-8 shrink-0 items-center rounded-full text-[13px] whitespace-nowrap ${color ? "font-semibold text-white" : "bg-white/[0.06] text-gray-100"}`}
			style={color ? { background: `${color}2e`, boxShadow: `inset 0 0 0 1px ${color}88` } : undefined}
		>
			<button
				type="button"
				onClick={onOpen}
				className="flex h-full items-center gap-1.5 rounded-l-full pl-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				{color ? (
					<span className="h-2 w-2 rounded-full" style={{ background: color }} />
				) : (
					<span className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS[chip.group].dot}`} />
				)}
				{chip.label.replace(/^Produced in /, "Made in ")}
			</button>
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${chip.label}`}
				className="grid h-full w-7 place-items-center rounded-r-full text-gray-500 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</span>
	)
}

const LINE_FADE = "linear-gradient(to right, black calc(100% - 2.5rem), transparent)"

export function StatusLine({
	d,
	pieces,
	onOpen,
	className = "",
}: { d: ProtoDiscover; pieces: Pieces; onOpen: (at: Spot) => void; className?: string }) {
	const clearAll = useClearAll(d)
	const searching = d.q !== null
	const chips = pieces.chips.filter((c) => c.key !== "services")
	const s = d.filters.state
	const any = searching || chips.length > 0
	const sorts = discoverSorts(searching, TASTE)
	const sort = sortShown(d.filters.sort, searching, TASTE)
	return (
		<div className={`flex h-10 items-center gap-3 ${className}`}>
			<span className="shrink-0 text-sm whitespace-nowrap text-gray-400" aria-live="polite">
				{d.total == null ? (
					"Counting…"
				) : (
					<>
						<RollingNumber value={d.total} className="font-bold text-white" />{" "}
						{searching ? (d.total === 1 ? "match" : "matches") : d.total === 1 ? "title" : "titles"}
					</>
				)}
			</span>
			<div
				className="-mr-4 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pr-8 [scrollbar-width:none] lg:mr-0 [&::-webkit-scrollbar]:hidden"
				style={{ maskImage: LINE_FADE, WebkitMaskImage: LINE_FADE }}
			>
				{d.q && (
					<span className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-amber-400/[0.1] pr-1 pl-3 ring-1 ring-inset ring-amber-400/35">
						<button
							type="button"
							onClick={() => onOpen(QUERY_SPOT)}
							className={`flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap text-amber-100 cursor-pointer outline-none ${PRIVATE}`}
						>
							<MagnifyingGlassIcon className="h-3.5 w-3.5 text-amber-300" aria-hidden />“{d.q}”
						</button>
						{d.reading.length > 0 && <ReadAsChips reading={d.reading} className="max-h-6 overflow-hidden" />}
						<button
							type="button"
							onClick={() => d.setQ(null)}
							aria-label="Clear the search"
							className="grid h-6 w-6 place-items-center rounded-full text-amber-200/70 cursor-pointer hover:text-white"
						>
							<XMarkIcon className="h-3.5 w-3.5" />
						</button>
					</span>
				)}
				{s.notSeenYet && (
					<ValueChip
						chip={{ key: "notseen", group: "notSeenYet", label: "Not seen yet", remove: (x) => ({ ...x, notSeenYet: false }) }}
						onOpen={() => onOpen(NOT_SEEN_SPOT)}
						onRemove={() => d.filters.set({ notSeenYet: false })}
					/>
				)}
				{chips.map((chip) => (
					<ValueChip
						key={chip.key}
						chip={chip}
						onOpen={() => onOpen(spotOfChip(chip))}
						onRemove={() => d.filters.update((x) => chip.remove(x))}
					/>
				))}
				{any && (
					<button
						type="button"
						onClick={clearAll}
						className="shrink-0 px-1.5 text-sm text-gray-500 cursor-pointer hover:text-white"
					>
						Clear all
					</button>
				)}
			</div>
			<div className="shrink-0 max-lg:[&_[data-sort-button]>span.text-gray-400]:hidden">
				<SortControl
					options={sorts}
					value={sort}
					onChange={(key) => d.filters.setSort(key as typeof d.filters.sort)}
					size="sm"
					align="right"
					footnote={searching ? undefined : "Relevance joins once you search."}
				/>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Common controls

export function SubHead({ children, note, right }: { children: ReactNode; note?: ReactNode; right?: ReactNode }) {
	return (
		<div className="mb-2.5 flex min-h-6 items-center gap-2">
			<h4 className="text-[14px] font-semibold text-gray-100">{children}</h4>
			{note && <span className="text-[12px] text-gray-500">{note}</span>}
			{right && <span className="ml-auto">{right}</span>}
		</div>
	)
}

export const tagOption = (d: ProtoDiscover, t: Tag): Option => ({
	id: tagId(t),
	label: t.name,
	active: d.isOn(t),
	count: d.countFor(t),
	toggle: () => d.toggle(t),
	swatch: <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />,
})

export function HueDots({ tags, size = 12 }: { tags: Tag[]; size?: number }) {
	const shown = tags.slice(0, 4)
	if (!shown.length) return null
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			{shown.map((t, i) => (
				<span
					key={tagId(t)}
					className="rounded-full ring-2 ring-gray-950"
					style={{ width: size, height: size, background: t.color, marginLeft: i ? -size / 3 : 0 }}
				/>
			))}
		</span>
	)
}

const groupNote = (d: ProtoDiscover, group: Tag["group"]) => {
	const n = d.picked.filter((t) => t.group === group).length
	return n ? `Any of these · ${n} of 3` : "Up to 3"
}

function ClearLink({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			Clear
		</button>
	)
}

/** Mood, Theme or Style chips with hue dots and what each would leave. */
export function TagChips({ d, group, big = false }: { d: ProtoDiscover; group: Tag["group"]; big?: boolean }) {
	const tags = TAGS.filter((t) => t.group === group)
	const picks = d.picked.filter((t) => t.group === group)
	const options = group === "moods" ? tags.map((t) => tagOption(d, t)) : byCount(tags.map((t) => tagOption(d, t)))
	return (
		<div>
			<SubHead
				note={groupNote(d, group)}
				right={
					picks.length > 0 && (
						<ClearLink
							onClick={() => {
								for (const t of picks) d.toggle(t)
							}}
						/>
					)
				}
			>
				{group === "moods" ? "Mood" : group === "themes" ? "About" : "Style"}
			</SubHead>
			<div className={`flex flex-wrap ${big ? "gap-2" : "gap-1.5"}`}>
				{options.map((o) => {
					const t = tags.find((x) => tagId(x) === o.id)
					return (
						<div key={o.id} title={t?.description} className={big ? "[&>button]:h-9 [&>button]:px-3.5 [&>button]:text-[14px]" : ""}>
							<Chip o={o} />
						</div>
					)
				})}
			</div>
		</div>
	)
}

export function TypeControl({ d }: { d: ProtoDiscover }) {
	const s = d.filters.state
	const c = (g: "type" | "anime", o: string) => d.counts?.optionCounts[g]?.[o] ?? null
	return (
		<div>
			<SubHead>Movies or shows</SubHead>
			<div className="flex">
				<Segmented
					label="Movies or shows"
					value={s.type}
					onChange={(type) => d.filters.set({ type })}
					options={(["all", "movie", "show"] as const).map((id) => ({
						id,
						label: id === "all" ? "Both" : TYPE_LABELS[id],
						count: c("type", id),
					}))}
				/>
			</div>
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

function genreOptions(d: ProtoDiscover): Option[] {
	const s = d.filters.state
	const oc = d.counts?.optionCounts.genres
	const all = Object.keys(oc ?? {})
	for (const g of s.genres) if (!all.includes(g)) all.push(g)
	const c = (n: string) => oc?.[n] ?? null
	const units = [
		...GENRE_FOLDS.filter((f) => f.names.some((n) => all.includes(n))),
		...all.filter((n) => !FOLDED.has(n)).map((n) => ({ label: n, names: [n] })),
	]
	const isOn = (u: { names: string[] }) => s.genres.includes(u.names[0])
	return units.map((u) => {
		const parts = u.names.map(c).filter((x): x is number => x !== null)
		return {
			id: u.label,
			label: u.label,
			active: isOn(u),
			count: parts.length ? parts.reduce((a, b) => a + b, 0) : null,
			toggle: () => {
				const on = units.filter((x) => (x === u ? !isOn(u) : isOn(x)))
				d.filters.set({ genres: [...new Set(on.flatMap((x) => x.names))] })
			},
		}
	})
}

export function GenreControl({ d, limit = 10 }: { d: ProtoDiscover; limit?: number }) {
	const s = d.filters.state
	return (
		<div>
			<SubHead note="Any of" right={s.genres.length > 0 && <ClearLink onClick={() => d.filters.set({ genres: [] })} />}>
				Genre
			</SubHead>
			<ChipList options={genreOptions(d)} limit={limit} sort />
		</div>
	)
}

const SCORE_STEPS = [
	{ v: 0, label: "Any" },
	{ v: 60, label: "60+" },
	{ v: 70, label: "70+" },
	{ v: 80, label: "80+" },
]

export function ScoreControl({ d }: { d: ProtoDiscover }) {
	return (
		<div>
			<SubHead note="GoodWatch score">Score</SubHead>
			<ThresholdBar
				label="Score"
				steps={SCORE_STEPS}
				value={d.filters.state.minScore}
				onChange={(minScore) => d.filters.set({ minScore })}
				color={(v) => `bg-vibe-${goodwatchVibeIndex(v)}`}
				counts={(v) => d.counts?.optionCounts.minScore?.[String(v)] ?? null}
			/>
		</div>
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
const yearRange = (s: FilterState): [number, number] =>
	s.years ? [s.years.min ?? YEAR_MIN, s.years.max ?? yearMax()] : releasedRange(s.released)

export function ReleasedControl({ d, slider = true }: { d: ProtoDiscover; slider?: boolean }) {
	const s = d.filters.state
	const c = (o: string) => d.counts?.optionCounts.released?.[o] ?? null
	const now = yearMax()
	return (
		<div>
			<SubHead>Released</SubHead>
			<div className="flex flex-wrap gap-1.5">
				{RELEASED.map((r) => (
					<Chip
						key={r}
						o={{
							id: r,
							label: RELEASED_LABELS[r],
							active: !s.years && s.released === r,
							count: s.years || r === "any" ? null : c(r),
							toggle: () => d.filters.set({ released: s.released === r && !s.years ? "any" : r, years: undefined }),
						}}
					/>
				))}
			</div>
			{slider && (
				<div className="mt-3">
					<RangeSlider
						label="Released"
						min={YEAR_MIN}
						max={now}
						step={1}
						value={yearRange(s)}
						format={(y) => (y <= YEAR_MIN ? "Any year" : y >= now ? "Now" : String(y))}
						onCommit={([lo, hi]) => {
							const preset = (["recent", "2010s", "2000s", "before2000", "any"] as const).find((r) => {
								const [a, b] = releasedRange(r)
								return a === lo && b === hi
							})
							if (preset) d.filters.set({ released: preset, years: undefined })
							else
								d.filters.set({
									released: "any",
									years: { ...(lo > YEAR_MIN ? { min: lo } : {}), ...(hi < now ? { max: hi } : {}) },
								})
						}}
					/>
				</div>
			)}
		</div>
	)
}

export function NotSeenControl({ pieces }: { pieces: Pieces }) {
	return <NotSeenSwitch {...pieces.notSeenProps} />
}

// ---------------------------------------------------------------------------------------------------------------
// Streaming

type StreamMode = "any" | "mine" | "pick"
const streamMode = (s: FilterState): StreamMode =>
	s.onMyServices ? "mine" : s.anyService || s.services?.length ? "pick" : "any"
const cleanName = (n: string) => n.replace(/ (Amazon Channel|Apple TV Channel)$/, "")

export function useStreaming(d: ProtoDiscover, pieces: Pieces) {
	const s = d.filters.state
	const mode = streamMode(s)
	const mine = pieces.services.ids
	const chosen = s.onMyServices ? mine : (s.services ?? [])
	const rank = (id: number) => (chosen.includes(id) ? 0 : mine.includes(id) ? 1 : 2)
	const providers = pieces.services.countryProviders
		.map((p, i) => ({ p, i }))
		.sort((a, b) => rank(a.p.id) - rank(b.p.id) || a.i - b.i)
		.map(({ p }) => p)
	const setMode = (m: StreamMode) =>
		d.filters.set(
			m === "mine"
				? { onMyServices: true, anyService: undefined, services: undefined }
				: m === "pick"
					? { onMyServices: false, anyService: true, services: undefined }
					: { onMyServices: false, anyService: undefined, services: undefined },
		)
	const pick = (id: number) => {
		const base = s.anyService || s.onMyServices ? [] : (s.services ?? [])
		const next = s.anyService || s.onMyServices ? [id] : base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
		d.filters.set(
			next.length
				? { onMyServices: false, anyService: undefined, services: next }
				: { onMyServices: false, anyService: true, services: undefined },
		)
	}
	const country = s.streamingCountry ?? pieces.services.country ?? "US"
	return { mode, chosen, providers, setMode, pick, country, hasMine: mine.length > 0 }
}

export function StreamingModes({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const navigate = useNavigate()
	const st = useStreaming(d, pieces)
	return (
		<div className="flex items-center gap-3">
			<div className="flex min-w-0 flex-1">
				<Segmented
					label="Streaming"
					value={st.mode}
					onChange={st.setMode}
					options={[
						{ id: "any", label: "Everywhere" },
						...(st.hasMine ? [{ id: "mine" as const, label: "My services" }] : []),
						{ id: "pick", label: "Pick services" },
					]}
				/>
			</div>
			{!st.hasMine && (
				<button
					type="button"
					onClick={() => navigate(SERVICES_PATH)}
					className="shrink-0 rounded-md px-2 py-1 text-[13px] font-semibold text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					Save my services
				</button>
			)}
		</div>
	)
}

/** Services as logo chips (compact) or as a grid of logo tiles. A tap narrows to the services picked. */
export function ServiceLogos({
	d,
	pieces,
	layout,
	limit = 18,
}: { d: ProtoDiscover; pieces: Pieces; layout: "chips" | "grid"; limit?: number }) {
	const st = useStreaming(d, pieces)
	const [all, setAll] = useState(false)
	const shown = all ? st.providers.slice(0, 80) : st.providers.slice(0, Math.max(limit, st.chosen.length))
	const rest = st.providers.length - shown.length
	if (!st.providers.length) return <p className="text-[13px] text-gray-500">Loading services…</p>
	const more = rest > 0 && (
		<button
			type="button"
			onClick={() => setAll(true)}
			className="flex h-8 items-center rounded-full px-2.5 text-[13px] font-medium text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			+{rest} more
		</button>
	)
	if (layout === "chips")
		return (
			<div className="flex flex-wrap gap-1.5">
				{shown.map((p) => (
					<Chip
						key={p.id}
						img={`${PROVIDER_LOGO}${p.logo_path}`}
						o={{
							id: String(p.id),
							label: cleanName(p.name),
							active: st.mode !== "any" && st.chosen.includes(p.id),
							count: null,
							toggle: () => st.pick(p.id),
						}}
					/>
				))}
				{more}
			</div>
		)
	return (
		<div>
			<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
				{shown.map((p) => {
					const on = st.mode !== "any" && st.chosen.includes(p.id)
					return (
						<motion.button
							key={p.id}
							type="button"
							whileTap={TAP}
							aria-pressed={on}
							onClick={() => st.pick(p.id)}
							className={`relative flex min-w-0 items-center gap-2.5 rounded-xl p-2 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
								on ? "bg-white/[0.12] ring-1 ring-white/40" : "bg-white/[0.035] ring-1 ring-white/[0.06] hover:bg-white/[0.07]"
							}`}
						>
							<img
								src={`${PROVIDER_LOGO}${p.logo_path}`}
								alt=""
								loading="lazy"
								className={`h-9 w-9 shrink-0 rounded-lg object-cover transition-opacity ${st.mode !== "any" && !on ? "opacity-50" : ""}`}
							/>
							<span className={`min-w-0 truncate text-[13px] ${on ? "font-semibold text-white" : "text-gray-300"}`}>
								{cleanName(p.name)}
							</span>
							{on && (
								<span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-gray-950">
									<CheckIcon className="h-3.5 w-3.5" />
								</span>
							)}
						</motion.button>
					)
				})}
			</div>
			{more && <div className="mt-2">{more}</div>}
		</div>
	)
}

export function CountryLine({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const st = useStreaming(d, pieces)
	return (
		<p className="text-[12px] text-gray-500">
			Streaming in <span className="font-semibold text-gray-300">{productionCountryName(st.country)}</span>
		</p>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Niche: one card of the real sheet, without its frame. The sheet's cards mount added-as-you-go, so this asks the
// sheet to open at `k` (focusSheetOn) right before mounting, and hides every other card.

// The sheet scrolls a card it was asked to open at into view; inside a panel column that's a jump, so the card's
// first layout pass runs without it (child layout effects run before this one's).
const realScroll = typeof window !== "undefined" ? HTMLElement.prototype.scrollIntoView : null
function useNoScrollOnMount() {
	const first = useRef(true)
	if (first.current && realScroll) HTMLElement.prototype.scrollIntoView = () => {}
	useLayoutEffect(() => {
		first.current = false
		if (realScroll) HTMLElement.prototype.scrollIntoView = realScroll
	}, [])
}

export function OneCard({ pieces, k }: { pieces: Pieces; k: CardKey }) {
	focusSheetOn(k)
	useNoScrollOnMount()
	const scope = `one-card-${k}`
	const css = `.${scope} > .flex-col > div:not(:has(> #filter-card-${k})), .${scope} > .flex-col > section, .${scope} > [aria-busy] > div:not(:first-child) { display: none }
.${scope} #filter-card-${k} { background: none !important; padding: 0 !important; box-shadow: none !important }
.${scope} #filter-card-${k} > div:first-child { display: none }`
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: css }} />
			<FilterGroups data={pieces.groups} query="" className={scope} />
		</>
	)
}

export function NicheControl({ d, pieces, k }: { d: ProtoDiscover; pieces: Pieces; k: CardKey }) {
	if (k === "themes" || k === "styles") return <TagChipsBare d={d} group={k} />
	return <OneCard key={k} pieces={pieces} k={k} />
}

function TagChipsBare({ d, group }: { d: ProtoDiscover; group: "themes" | "styles" }) {
	const options = byCount(TAGS.filter((t) => t.group === group).map((t) => tagOption(d, t)))
	return (
		<div>
			<p className="mb-2 text-[12px] text-gray-500">{groupNote(d, group)}</p>
			<div className="flex flex-wrap gap-1.5">
				{options.map((o) => (
					<Chip key={o.id} o={o} />
				))}
			</div>
		</div>
	)
}

/** Clears one niche card. */
export const clearCard = (d: ProtoDiscover, pieces: Pieces, k: CardKey) =>
	d.filters.update((s) => chipsOf(pieces, k).reduce((acc, c) => c.remove(acc), s))

// ---------------------------------------------------------------------------------------------------------------

/** Closes on Escape and on a press outside `inside` (and outside the bar and any menu). */
export function useOutsideClose(open: boolean, onClose: () => void, inside: React.RefObject<HTMLElement>, keep = "[data-seg-bar]") {
	const latest = useRef(onClose)
	latest.current = onClose
	useEffect(() => {
		if (!open) return
		const key = (e: KeyboardEvent) => e.key === "Escape" && latest.current()
		const down = (e: Event) => {
			const t = e.target as HTMLElement
			if (inside.current?.contains(t) || t.closest(keep)) return
			if (t.closest("[role=dialog], [role=menu], [role=listbox], [data-headlessui-portal]")) return
			latest.current()
		}
		document.addEventListener("keydown", key)
		document.addEventListener("pointerdown", down)
		return () => {
			document.removeEventListener("keydown", key)
			document.removeEventListener("pointerdown", down)
		}
	}, [open, inside, keep])
}

/** "/" opens the mood search. */
export function useSlashKey(onOpen: () => void) {
	const latest = useRef(onOpen)
	latest.current = onOpen
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
			const el = e.target as HTMLElement
			if (el.closest("input, textarea, select, [contenteditable=true]")) return
			e.preventDefault()
			e.stopImmediatePropagation()
			latest.current()
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])
}

/** The grid, dimmed while the desktop palette is open. */
export function GridUnder({ d, dim }: { d: ProtoDiscover; dim: boolean }) {
	return (
		<div className="relative mt-2 lg:mt-4">
			<ProtoGrid d={d} />
			<AnimatePresence>
				{dim && (
					<motion.div
						aria-hidden
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.18 }}
						className="absolute inset-0 z-30 hidden bg-gray-950/50 lg:block"
					/>
				)}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Round 4: the quick title search (the header's typeahead, as in FilterPickers), and title rows.

function useDebounced<T>(value: T, ms = 200): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms)
		return () => clearTimeout(id)
	}, [value, ms])
	return v
}

export interface FoundTitle {
	key: TitleKey
	title: string
	year: string
	poster: string | null
	mediaType: "movie" | "show"
	tmdbId: number
}

/** Titles whose name matches `text` (two letters or more), about a quarter second. */
export function useQuickTitles(text: string) {
	const term = useDebounced(text.trim())
	const { locale } = useLocale()
	const q = useQuery<{
		searchResults: {
			id: number
			media_type: "movie" | "show"
			title?: string
			name?: string
			release_date?: string
			first_air_date?: string
			poster_path?: string | null
		}[]
	}>({
		queryKey: ["filter-title-search", term, locale.language],
		queryFn: async () =>
			(await fetch(mediaLanguageUrl(`/api/search?query=${encodeURIComponent(term)}`, locale.language))).json(),
		enabled: term.length >= 2,
		placeholderData: (p) => p,
	})
	const found: FoundTitle[] = (term.length >= 2 ? (q.data?.searchResults ?? []) : [])
		.filter((r) => r.media_type === "movie" || r.media_type === "show")
		.map((r) => ({
			key: titleKey(r.media_type, r.id),
			title: r.title ?? r.name ?? "",
			year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
			poster: r.poster_path ?? null,
			mediaType: r.media_type,
			tmdbId: r.id,
		}))
	return { found, loading: text.trim().length >= 2 && (q.isFetching || term !== text.trim()), term }
}

export const POSTER_SM = "https://image.tmdb.org/t/p/w92"
/** The prototype has no local title pages, so a title opens on the live site. */
export const liveTitleUrl = (t: Pick<FoundTitle, "mediaType" | "tmdbId" | "title">) =>
	`https://goodwatch.app${titlePath(t.mediaType, t.tmdbId, t.title)}`

export function PosterThumb({ poster, title, className = "h-[54px] w-9" }: { poster: string | null; title: string; className?: string }) {
	return (
		<span className={`block shrink-0 overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10 ${className}`}>
			{poster ? (
				<img src={`${POSTER_SM}${poster}`} alt="" loading="lazy" className="h-full w-full object-cover" />
			) : (
				<span className="grid h-full place-items-center p-0.5 text-center text-[8px] leading-tight text-gray-500">{title}</span>
			)}
		</span>
	)
}

/** Similar to, as a toggle: adds or takes off one title. */
export function useSimilar(d: ProtoDiscover) {
	const list = d.filters.state.similarTo ?? []
	const has = (k: TitleKey) => list.includes(k)
	const toggle = (k: TitleKey) => {
		const next = has(k) ? list.filter((x) => x !== k) : [...list, k]
		d.filters.set({ similarTo: next.length ? next : undefined })
	}
	return { list, has, toggle }
}

/** A title match: poster, name, year and kind; open its page, or "Like this" (Similar to). */
export function TitleRow({ t, liked, onLike }: { t: FoundTitle; liked: boolean; onLike: () => void }) {
	return (
		<div className="group flex h-[66px] min-w-0 items-center gap-3 rounded-xl px-2 hover:bg-white/[0.045]">
			<a
				href={liveTitleUrl(t)}
				target="_blank"
				rel="noreferrer"
				className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<PosterThumb poster={t.poster} title={t.title} />
				<span className="min-w-0">
					<span className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-gray-100">
						<span className="truncate">{t.title}</span>
						<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0 text-gray-600 group-hover:text-gray-400" aria-hidden />
					</span>
					<span className="block text-[12px] text-gray-500">
						{[t.year, t.mediaType === "movie" ? "Movie" : "Show"].filter(Boolean).join(" · ")}
					</span>
				</span>
			</a>
			<motion.button
				type="button"
				whileTap={TAP}
				aria-pressed={liked}
				onClick={onLike}
				className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
					liked ? "bg-white text-gray-950" : "bg-white/[0.07] text-gray-200 ring-1 ring-inset ring-white/10 hover:bg-white/[0.12]"
				}`}
			>
				{liked ? <CheckIcon className="h-3.5 w-3.5" aria-hidden /> : <PlusIcon className="h-3.5 w-3.5" aria-hidden />}
				Like this
			</motion.button>
		</div>
	)
}

export function TitleRowsLoading({ n = 4 }: { n?: number }) {
	return (
		<div aria-busy="true">
			{Array.from({ length: n }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
				<div key={i} className="flex h-[66px] items-center gap-3 px-2">
					<span className="h-[54px] w-9 animate-pulse rounded-md bg-white/[0.06] motion-reduce:animate-none" />
					<span className="h-3 w-32 animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none" />
				</div>
			))}
		</div>
	)
}

/** Known example titles, so an example can set Similar to without a search. */
export const EXAMPLE_TITLES: FoundTitle[] = [
	{ key: titleKey("show", 95396), title: "Severance", year: "2022", poster: null, mediaType: "show", tmdbId: 95396 },
	{ key: titleKey("show", 70523), title: "Dark", year: "2017", poster: null, mediaType: "show", tmdbId: 70523 },
	{ key: titleKey("movie", 545611), title: "Everything Everywhere All at Once", year: "2022", poster: null, mediaType: "movie", tmdbId: 545611 },
]
export const keyParts = parseTitleKey

// ---------------------------------------------------------------------------------------------------------------
// Sub-tabs: one calm row inside a tab, a count on each sub-tab with values, and "Find a filter" at its right end.
// Typing there swaps the body for matches from every filter.

/** One filter as a column: name, hint, Clear, and the filter itself. */
export function FilterColumn({ d, pieces, k, children }: { d: ProtoDiscover; pieces: Pieces; k: CardKey; children?: ReactNode }) {
	const set = chipsOf(pieces, k).length > 0
	const info = CARD_INFO[k]
	return (
		<section aria-label={info.title} className="min-w-0">
			<header className="mb-3 flex min-h-[38px] items-start gap-2">
				<span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[k].dot}`} />
				<div className="min-w-0 flex-1">
					<h4 className="text-[15px] font-bold leading-tight text-white">{info.title}</h4>
					{info.hint && <p className="truncate text-[12px] text-gray-500">{info.hint}</p>}
				</div>
				{set && <ClearLink onClick={() => clearCard(d, pieces, k)} />}
			</header>
			{children ?? <NicheControl d={d} pieces={pieces} k={k} />}
		</section>
	)
}

/** Columns side by side on desktop (with hairlines), stacked on phones. */
export function Columns({ phone, widths, children }: { phone: boolean; widths: number[]; children: ReactNode[] }) {
	if (phone) return <div className="flex flex-col gap-7">{children}</div>
	return (
		<div className="grid gap-x-8" style={{ gridTemplateColumns: widths.map((w) => `minmax(0,${w}fr)`).join(" ") }}>
			{children.map((c, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed columns
				<div key={i} className={i ? "-ml-4 border-l border-white/[0.06] pl-4" : ""}>
					{c}
				</div>
			))}
		</div>
	)
}

/** "Find a filter" results across every filter, in columns on desktop so the list stays short. */
export function FindAll({ pieces, text, phone }: { pieces: Pieces; text: string; phone: boolean }) {
	const css = phone
		? ""
		: `.find-all-12 > .flex-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 2rem; row-gap: 1.75rem; align-items: start }`
	return (
		<>
			{css && <style dangerouslySetInnerHTML={{ __html: css }} />}
			<FilterGroups data={pieces.groups} query={text} className="find-all-12" />
		</>
	)
}

function SubTabButton({ id, t, on, n, onClick, dim }: { id: string; t: SubTab; on: boolean; n: number; onClick: () => void; dim: boolean }) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={on}
			onClick={onClick}
			className={`relative flex h-12 shrink-0 items-center gap-1.5 px-3 text-[14px] font-semibold whitespace-nowrap cursor-pointer outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
				on ? "text-white" : "text-gray-400 hover:text-gray-200"
			} ${dim ? "opacity-50" : ""}`}
		>
			{t.label}
			{n > 0 && (
				<span className="grid h-[17px] min-w-[17px] place-items-center rounded-full bg-amber-500 px-1 text-[10.5px] font-bold text-gray-950 tabular-nums">
					{n}
				</span>
			)}
			{on && (
				<motion.span
					layoutId={`${id}-sub`}
					transition={{ type: "spring", stiffness: 520, damping: 42 }}
					className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-amber-400"
				/>
			)}
		</button>
	)
}

/**
 * A tab's frame: the sub-tab row (with Find a filter at its end), then the open sub-tab's body. With find text, the
 * body is the matches from every filter instead. `top` is an optional fixed-height row above the body.
 */
export function SubTabs({
	id,
	d,
	pieces,
	seg,
	sub,
	onSub,
	find,
	onFind,
	phone,
	top,
	bare = false,
	children,
}: {
	id: string
	d: ProtoDiscover
	pieces: Pieces
	seg: SegKey
	sub: string
	onSub: (s: string) => void
	find: string
	onFind: (t: string) => void
	phone: boolean
	top?: ReactNode
	/** Desktop: the body fills the panel edge to edge and scrolls itself. */
	bare?: boolean
	children: ReactNode
}) {
	const tabs = subTabsFor(pieces, seg)
	const finding = find.trim() !== ""
	const [findOpen, setFindOpen] = useState(false)
	const scroller = useRef<HTMLDivElement>(null)
	useKeepTop(scroller, `${seg}|${sub}|${finding ? "find" : ""}`)
	const findField = <FilterSearchField value={find} onChange={onFind} className="h-10" />
	const strip = (
		<div
			role="tablist"
			aria-label={`${SEG_LABEL[seg]} filters`}
			className={`flex shrink-0 items-center gap-0.5 border-b border-white/[0.07] ${phone ? "-mx-5 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "px-4"}`}
		>
			{phone && (findOpen || finding) ? (
				<div className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-1">
					<div className="min-w-0 flex-1 [&_input]:text-base">{findField}</div>
					<button
						type="button"
						onClick={() => {
							onFind("")
							setFindOpen(false)
						}}
						className="shrink-0 rounded-md px-2 py-2 text-[13px] font-semibold text-gray-400 cursor-pointer hover:text-white"
					>
						Close
					</button>
				</div>
			) : (
				<>
					{tabs.map((t) => (
						<SubTabButton
							key={t.id}
							id={id}
							t={t}
							on={t.id === sub && !finding}
							dim={finding}
							n={subCount(d, pieces, t)}
							onClick={() => {
								onFind("")
								onSub(t.id)
							}}
						/>
					))}
					{phone ? (
						<button
							type="button"
							onClick={() => setFindOpen(true)}
							aria-label="Find a filter"
							className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<MagnifyingGlassIcon className="h-4.5 w-4.5" />
						</button>
					) : (
						<div className="ml-auto w-[min(340px,36%)] py-1.5">{findField}</div>
					)}
				</>
			)}
		</div>
	)
	const body = finding ? (
		<FindAll pieces={pieces} text={find} phone={phone} />
	) : (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div key={sub} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
				{children}
			</motion.div>
		</AnimatePresence>
	)
	if (phone)
		return (
			<div>
				{strip}
				{top && !finding && <div className="pt-3">{top}</div>}
				<div className="pt-5">{body}</div>
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="shrink-0 pt-1">{strip}</div>
			{top && !finding && <div className="shrink-0 px-7 pt-3">{top}</div>}
			{bare && !finding ? (
				<div className="min-h-0 flex-1 overflow-hidden">{children}</div>
			) : (
				<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 py-5">
				{body}
				</div>
			)}
		</div>
	)
}

/**
 * The sheet's cards load once, on first use. Several single cards side by side each ask for their own card as they
 * mount, which only works once the cards are loaded, so this mounts them hidden early.
 */
export function WarmCards({ pieces }: { pieces: Pieces }) {
	// After hydration only: a lazy boundary in the server HTML would hydrate under the page's first updates.
	const [ready, setReady] = useState(false)
	useEffect(() => {
		const id = setTimeout(() => setReady(true), 300)
		return () => clearTimeout(id)
	}, [])
	if (!ready) return null
	return (
		<div hidden aria-hidden className="hidden">
			<FilterGroups data={pieces.groups} query="" />
		</div>
	)
}

/** Phones: the sheet keeps its scroll between tabs; a new tab (or a new search) starts at the top. */
export function useScrollTopOn(ref: React.RefObject<HTMLElement>, key: unknown) {
	useEffect(() => {
		const top = () => {
			let el = ref.current?.parentElement ?? null
			while (el) {
				const o = getComputedStyle(el).overflowY
				if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight) {
					el.scrollTop = 0
					return
				}
				el = el.parentElement
			}
		}
		top()
		const id = setTimeout(top, 120)
		return () => clearTimeout(id)
	}, [key, ref])
}

/** Keeps the scroll areas under `ref` (matching `sel`, or `ref` itself) at the top for a moment after `key` changes:
 * the sheet's cards scroll themselves into view as they mount. */
export function useKeepTop(ref: React.RefObject<HTMLElement>, key: unknown, sel?: string) {
	useEffect(() => {
		const top = () => {
			const root = ref.current
			if (!root) return
			const els = sel ? Array.from(root.querySelectorAll<HTMLElement>(sel)) : [root]
			for (const el of els) el.scrollTop = 0
		}
		top()
		const ids = [60, 180, 450].map((ms) => setTimeout(top, ms))
		return () => ids.forEach(clearTimeout)
	}, [key, ref, sel])
}
