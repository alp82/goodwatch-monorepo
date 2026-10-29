// PROTOTYPE - throwaway. The Discover lab shell (from round 5 variant 16): its own copy of R4-8-parts with three segments instead of five (Search,
// Mood, Watch), the structure of tabs and sub-tabs as data (TABS: which filters live where), what each segment reads
// (a summary over all its sub-tabs), the bar, the phone bar, the status line and the shared controls.
import { ArrowTopRightOnSquareIcon, CheckIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, type Ref, useEffect, useLayoutEffect, useRef, useState } from "react"
import { type FilterName, type FilterState, RELEASED, dropFilter } from "~/domain/filter-state"
import { productionCountryName } from "~/domain/production-country"
import { HiddenTitles } from "~/ui/discover/HiddenTitles"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups } from "~/ui/filter-bar"
import { type CardKey, cardOf, focusSheetOn } from "~/ui/filter-bar/filter-cards"
import { NotSeenSwitch, ServiceStack, SortControl } from "~/ui/filter-bar/controls"
import { type ActiveChip, FILTER_ACCENTS, RELEASED_LABELS, TYPE_LABELS, discoverSorts, sortShown } from "~/ui/filter-bar/labels"
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
import { tagName } from "./sections/mood/parts"
import { mcUsers, setMcUsers } from "./sections/scores/mc-users"
import type { SectionId } from "./types"

export type Pieces = ReturnType<typeof useFilterPieces>
export type SegKey = "search" | "mood" | "watch"
export const SEG_ORDER: SegKey[] = ["search", "mood", "watch"]
export const SEG_LABEL: Record<SegKey, string> = { search: "Search", mood: "Mood", watch: "Watch" }
export const PRIVATE = "search-private ph-no-capture sentry-mask"
export const SEARCH_PLACEHOLDER = "A mood, a title, or like Severance"
const TASTE = "signUp" as const

export const MOOD_TAGS = TAGS.filter((t) => t.group === "moods")

// ---------------------------------------------------------------------------------------------------------------
// The structure: three tabs, each with one row of sub-tabs (Mood has one, so no row). A slot is a filter card, the
// search text, or Not seen yet. A sub-tab's id is the lab section that renders it (`lab/registry.ts`).

export type Slot = CardKey | "q" | "notSeenYet"
export interface Sub {
	id: SectionId
	label: string
	slots: Slot[]
}

export const TABS: Record<SegKey, Sub[]> = {
	search: [
		// Movies or shows sits on the Search row (round 10); it counts with Titles.
		{ id: "titles", label: "Titles", slots: ["q", "similarTo", "type"] },
		{ id: "people", label: "Cast and crew", slots: ["people"] },
		// Round 12: "You", with Not seen yet back from Services.
		{ id: "taste", label: "You", slots: ["loved", "disliked", "minMatch", "notSeenYet"] },
	],
	mood: [{ id: "mood", label: "Mood", slots: ["moods", "themes", "styles", "genres"] }],
	watch: [
		{ id: "services", label: "Services", slots: ["services"] },
		{ id: "scores", label: "Scores", slots: ["minScore", "sourceScores", "scoreGap"] },
		{ id: "origin", label: "Made in", slots: ["productionCountries"] },
		{ id: "released", label: "Released", slots: ["released"] },
		{ id: "length", label: "Length", slots: ["runtime"] },
		{ id: "age", label: "Age and content", slots: ["ageLimit"] },
	],
}

/** The sub-tabs this viewer gets (Age and content needs a rating ladder). */
export function subsFor(seg: SegKey, pieces: Pieces): Sub[] {
	if (pieces.groups.ladder) return TABS[seg]
	return TABS[seg].filter((s) => s.id !== "age")
}

/** Where a filter lives. */
export function whereIs(slot: Slot): { seg: SegKey; sub: SectionId } {
	for (const seg of SEG_ORDER) for (const s of TABS[seg]) if (s.slots.includes(slot)) return { seg, sub: s.id }
	return { seg: "watch", sub: "services" }
}

/** The tab a section lives in. */
export function segOf(id: SectionId): SegKey {
	for (const seg of SEG_ORDER) if (TABS[seg].some((s) => s.id === id)) return seg
	return "search"
}

/** The active chips of one card. */
export const chipsOf = (pieces: Pieces, k: CardKey) => pieces.chips.filter((c) => cardOf(c.group) === k)

/** How many values a sub-tab has set. */
export function subCount(d: ProtoDiscover, pieces: Pieces, sub: Sub) {
	// Scores a's lab-only Metacritic user score counts with Scores.
	const extra = sub.id === "scores" && mcUsers() ? 1 : 0
	return extra + sub.slots.reduce(
		(n, slot) =>
			n + (slot === "q" ? (d.q ? 1 : 0) : slot === "notSeenYet" ? (d.filters.state.notSeenYet ? 1 : 0) : chipsOf(pieces, slot).length),
		0,
	)
}

/** The slot a status chip belongs to. */
export const slotOfChip = (chip: ActiveChip): Slot => cardOf(chip.group) ?? "notSeenYet"

const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ") || null
const headPlus = (names: string[]) => (names.length ? (names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ")) : null)

export interface SegValue {
	value: string | null
	placeholder: string
	lead?: ReactNode
	badge?: number
	/** Shows the value in the search's large type. */
	big?: boolean
}

export function segValues(d: ProtoDiscover, pieces: Pieces): Record<SegKey, SegValue> {
	const s = d.filters.state
	const labels = (...keys: CardKey[]) => keys.flatMap((k) => chipsOf(pieces, k).map((c) => c.label))
	const moods = d.picked.filter((t) => t.group === "moods")
	const providers = pieces.services.countryProviders
	const chosen = s.onMyServices ? pieces.services.providers : providers.filter((p) => s.services?.includes(p.id))
	const released = s.years
		? `${s.years.min ?? "Any"}–${s.years.max ?? "now"}`
		: s.released !== "any"
			? RELEASED_LABELS[s.released]
			: null
	const searchOther = [
		...labels("similarTo", "people", "loved", "disliked", "minMatch"),
		...(s.notSeenYet ? ["Not seen yet"] : []),
		...(s.type !== "all" ? [TYPE_LABELS[s.type]] : []),
	]
	// A segment's badge is the sum of its sub-tabs' badges.
	const badge = (k: SegKey) => subsFor(k, pieces).reduce((n, sub) => n + subCount(d, pieces, sub), 0) || undefined
	const streaming = s.onMyServices
		? "My services"
		: s.services?.length
			? (headPlus(chosen.map((p) => cleanName(p.name))) ?? `${s.services.length} services`)
			: s.anyService
				? "Any service"
				: null
	return {
		search: d.q
			? { value: d.q, placeholder: SEARCH_PLACEHOLDER, big: true, badge: badge("search") }
			: { value: headPlus(searchOther), placeholder: SEARCH_PLACEHOLDER, big: false, badge: badge("search") },
		mood: {
			value: join([
				headPlus(moods.map(tagName)),
				headPlus(labels("themes", "styles")),
				headPlus(labels("genres")),
			]),
			placeholder: "Any mood, any genre",
			badge: badge("mood"),
			lead: moods.length ? <HueDots tags={moods} size={10} /> : null,
		},
		watch: {
			value: join([
				streaming,
				headPlus(labels("productionCountries")),
				labels("runtime").join(" · "),
				s.minScore > 0 && `Score ${s.minScore}+`,
				headPlus([...labels("sourceScores"), ...(mcUsers() ? [`User score ${(mcUsers() / 10).toFixed(1)}+`] : []), ...labels("scoreGap")]),
				released,
				headPlus(labels("ageLimit")),
			]),
			placeholder: "Everywhere",
			badge: badge("watch"),
			lead: chosen.length ? <ServiceStack providers={chosen} on size={16} /> : null,
		},
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Title

export function PageTitle() {
	return <h1 className="brand-header text-[23px] leading-tight text-white lg:text-[34px]">Discover movies and shows</h1>
}

// ---------------------------------------------------------------------------------------------------------------
// The bar: three segments, so Search gets the room.

const SEG_FLEX: Record<SegKey, string> = { search: "flex-[2.6]", mood: "flex-[1.25]", watch: "flex-[1.25]" }

export function SegmentBar({
	id,
	values,
	active,
	onPick,
	onClearSearch,
	searchInput,
}: {
	id: string
	values: Record<SegKey, SegValue>
	active: SegKey | null
	onPick: (k: SegKey) => void
	onClearSearch: () => void
	/** The field, shown in the Search segment while the panel is open on any tab. */
	searchInput?: ReactNode
}) {
	return (
		<div
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
								<SegLabel k={k} badge={v.badge} />
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
											isSearch && (v.big || !v.value)
												? `brand-header text-[21px] leading-tight ${v.value ? "text-white" : "text-gray-500"} ${PRIVATE}`
												: `text-[15px] ${v.value ? "font-semibold text-white" : "text-gray-500"}`
										}`}
									>
										{v.value ?? v.placeholder}
									</span>
								</span>
							</motion.button>
						)}
						{isSearch && v.big && !searchInput && (
							<button
								type="button"
								onClick={onClearSearch}
								aria-label="Clear the search"
								className="absolute top-1/2 right-3 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-gray-400 cursor-pointer outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<XMarkIcon className="h-4 w-4" />
							</button>
						)}
						{i < SEG_ORDER.length - 1 && (
							<span
								aria-hidden
								className={`absolute top-1/2 -right-px h-8 w-px -translate-y-1/2 bg-white/10 transition-opacity ${on || nextOn ? "opacity-0" : ""}`}
							/>
						)}
					</div>
				)
			})}
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

/** The phone bar: Search full width, then Mood and Watch side by side. */
export function PhoneBar({
	values,
	onPick,
	onClearSearch,
}: {
	values: Record<SegKey, SegValue>
	onPick: (k: SegKey) => void
	onClearSearch?: () => void
}) {
	const v = values.search
	return (
		<div className="overflow-hidden rounded-[22px] bg-white/[0.045] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
			<div className="relative">
				<button
					type="button"
					onClick={() => onPick("search")}
					className="flex h-[62px] w-full cursor-pointer flex-col justify-center px-4 pr-12 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
				>
					<SegLabel k="search" badge={v.badge} />
					<span
						className={`mt-0.5 truncate ${
							v.big || !v.value
								? `brand-header text-[19px] leading-tight ${v.value ? "text-white" : "text-gray-500"} ${PRIVATE}`
								: "text-[14px] font-semibold text-white"
						}`}
					>
						{v.value ?? v.placeholder}
					</span>
				</button>
				{v.big && onClearSearch && (
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
			<div className="grid grid-cols-2 border-t border-white/[0.08]">
				{SEG_ORDER.slice(1).map((k, i) => {
					const s = values[k]
					return (
						<motion.button
							key={k}
							type="button"
							whileTap={TAP}
							onClick={() => onPick(k)}
							className={`flex h-[52px] min-w-0 cursor-pointer flex-col justify-center px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${i ? "border-l border-white/[0.08]" : ""}`}
						>
							<SegLabel k={k} badge={s.badge} />
							<span className="flex min-w-0 items-center gap-1.5">
								{s.lead}
								<span className={`truncate text-[13px] ${s.value ? "font-semibold text-white" : "text-gray-500"}`}>
									{s.value ?? s.placeholder}
								</span>
							</span>
						</motion.button>
					)
				})}
			</div>
		</div>
	)
}

/** The field's own action: runs the text and closes the panel. Quiet while the field is empty. */
export function SearchGo({ onClick, empty, small = false, className = "" }: { onClick: () => void; empty: boolean; small?: boolean; className?: string }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			className={`flex shrink-0 items-center gap-2 rounded-full font-bold cursor-pointer ${small ? "h-10 px-3.5 text-[14px]" : "h-12 px-5 text-[15px]"} outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white ${
				empty ? "bg-white/[0.08] text-gray-300 hover:bg-white/[0.12]" : "bg-amber-400 text-gray-950 hover:bg-amber-300"
			} ${className}`}
		>
			<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
			Search
		</motion.button>
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
		setMcUsers(0)
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

/** "On my services" (activeChips has no chip for it); a picked list has its own ("Netflix, Prime Video"). */
export function MyServicesChip({ d, onOpen }: { d: ProtoDiscover; onOpen: (slot: Slot) => void }) {
	const s = d.filters.state
	if (!s.onMyServices || d.filters.defaults.onMyServices) return null
	return (
		<ValueChip
			chip={{ key: "mine", group: "services", label: "On my services", remove: (x) => ({ ...x, onMyServices: false }) }}
			onOpen={() => onOpen("services")}
			onRemove={() => d.filters.set({ onMyServices: false, anyService: undefined, services: undefined })}
		/>
	)
}

const LINE_FADE = "linear-gradient(to right, black calc(100% - 2.5rem), transparent)"

export function StatusLine({
	d,
	pieces,
	onOpen,
	className = "",
}: { d: ProtoDiscover; pieces: Pieces; onOpen: (slot: Slot) => void; className?: string }) {
	const clearAll = useClearAll(d)
	const searching = d.q !== null
	// Round 11b: picked services keep their chip here too.
	const chips = pieces.chips
	const s = d.filters.state
	const any = searching || chips.length > 0 || s.onMyServices
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
			{/* relative: the scroller clips ReadAsChips' sr-only text (absolute), which widened the phone page (11b). */}
			<div
				className="relative -mr-4 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pr-8 [scrollbar-width:none] lg:mr-0 [&::-webkit-scrollbar]:hidden"
				style={{ maskImage: LINE_FADE, WebkitMaskImage: LINE_FADE }}
			>
				{d.q && (
					<span className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-amber-400/[0.1] pr-1 pl-3 ring-1 ring-inset ring-amber-400/35">
						<button
							type="button"
							onClick={() => onOpen("q")}
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
				<MyServicesChip d={d} onOpen={onOpen} />
				{s.notSeenYet && (
					<ValueChip
						chip={{ key: "notseen", group: "notSeenYet", label: "Not seen yet", remove: (x) => ({ ...x, notSeenYet: false }) }}
						onOpen={() => onOpen("notSeenYet")}
						onRemove={() => d.filters.set({ notSeenYet: false })}
					/>
				)}
				{chips.map((chip) => (
					<ValueChip
						key={chip.key}
						chip={chip}
						onOpen={() => onOpen(slotOfChip(chip))}
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
	label: tagName(t),
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

/** A one-tap recovery: drop that filter (Length drops both ranges, round 10). */
export function dropOne(d: ProtoDiscover, f: FilterName) {
	d.filters.update((s) => {
		const out = dropFilter(s, f)
		return f === "runtime" ? ({ ...out, episodeRuntime: undefined } as FilterState) : out
	})
}

/** The grid, dimmed while the desktop palette is open. Empty: production's recoveries (HiddenTitles), round 11b. */
export function GridUnder({ d, dim }: { d: ProtoDiscover; dim: boolean }) {
	const clearAll = useClearAll(d)
	const empty = d.counts && (
		<HiddenTitles counts={d.counts} state={d.filters.state} onDrop={(f) => dropOne(d, f)} onClear={clearAll} canClear searching={d.q !== null} />
	)
	return (
		<div className="relative mt-2 lg:mt-4">
			<ProtoGrid d={d} empty={empty || undefined} />
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
