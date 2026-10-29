// PROTOTYPE - throwaway. The Discover lab shell (from round 5 variant 16): its own copy of R4-8-parts with three segments instead of five (Search,
// Mood, Watch), the structure of tabs and sub-tabs as data (lab/layouts.ts: which filters live where), what each segment reads
// (a summary over all its sub-tabs), the bar, the phone bar, the status line and the shared controls.
import { LockClosedIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react"
import { type FilterName, type FilterState, dropFilter } from "~/domain/filter-state"
import { HiddenTitles } from "~/ui/discover/HiddenTitles"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups } from "~/ui/filter-bar"
import { type CardKey, cardOf } from "~/ui/filter-bar/filter-cards"
import { ServiceStack, SortControl } from "~/ui/filter-bar/controls"
import { type ActiveChip, FILTER_ACCENTS, RELEASED_LABELS, TYPE_LABELS, discoverSorts, sortShown } from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { titlePath } from "~/utils/helpers"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { type TitleKey, titleKey } from "~/utils/title-key"
import { ProtoGrid, type ProtoDiscover, TAGS, type Tag, tagId, type useFilterPieces } from "../kit"
import { tagName } from "./sections/mood/parts"
import { mcUsers, setMcUsers } from "./sections/scores/mc-users"
import { clearYou, useYouExtras, youChips } from "./sections/taste/you-extras"
import { clearMore, moreChips, partCount, useMore } from "./sections/more/store"
import { LAYOUT_C, type Layout, type SegKey, type Slot, type Sub, type SubId } from "./layouts"
import type { Viewer } from "./types"

export type Pieces = ReturnType<typeof useFilterPieces>
export type { SegKey, Slot, Sub }
const SEG_ORDER: SegKey[] = ["search", "mood", "watch"]
export const SEG_LABEL: Record<SegKey, string> = { search: "Search", you: "You", mood: "Mood", watch: "Watch" }
export const PRIVATE = "search-private ph-no-capture sentry-mask"
const SEARCH_PLACEHOLDER = "A mood, a title, or like Severance"
const TASTE = "signUp" as const

// ---------------------------------------------------------------------------------------------------------------
// The structure: three tabs (round 15: or four, lab/layouts.ts), each with one row of sub-tabs (Mood has one, so no
// row). A slot is a filter card, the search text, or Not seen yet. A sub-tab's id is the lab section that renders it
// (`lab/registry.ts`).

/** What the counts need besides the filters: the layout and who is looking. */
interface Ctx {
	L: Layout
	viewer: Viewer
}
const CTX_C: Ctx = { L: LAYOUT_C, viewer: "guest" }

/** The sub-tabs this viewer gets (Age and content needs a rating ladder). */
export function subsFor(seg: SegKey, pieces: Pieces, L: Layout = LAYOUT_C): Sub[] {
	const type = pieces.groups.state.type
	// Round 16: Budget shows with movies, Shows with shows, or while one of their choices is set.
	const fits = (s: Sub) => !s.kind || type === "all" || type === s.kind || (s.part && partCount([s.part]) > 0)
	return L.tabs[seg].filter((s) => (pieces.groups.ladder || s.id !== "age") && fits(s))
}

const ALL_SEGS: SegKey[] = ["search", "you", "mood", "watch"]

/** Where a filter lives. */
export function whereIs(slot: Slot, L: Layout = LAYOUT_C): { seg: SegKey; sub: SubId } {
	for (const seg of ALL_SEGS) for (const s of L.tabs[seg]) if (s.slots.includes(slot)) return { seg, sub: s.id }
	return { seg: "watch", sub: "services" }
}

/** The tab a section lives in. */
export function segOf(id: SubId, L: Layout = LAYOUT_C): SegKey {
	for (const seg of ALL_SEGS) if (L.tabs[seg].some((s) => s.id === id)) return seg
	return "search"
}

/** The active chips of one card. */
const chipsOf = (pieces: Pieces, k: CardKey) => pieces.chips.filter((c) => cardOf(c.group) === k)

/** How many values a sub-tab has set. */
export function subCount(d: ProtoDiscover, pieces: Pieces, sub: Sub, ctx: Ctx = CTX_C) {
	// Lab-only values: Scores a's Metacritic user score, You's taste groups, lists and steps (you-extras.ts).
	const you = sub.you ? youChips().filter((c) => sub.you?.includes(c.group)).length : 0
	const extra = sub.id === "scores" ? (mcUsers() ? 1 : 0) : you
	return extra + sub.slots.reduce((n, slot) => {
		if (slot === "q") return n + (d.q ? 1 : 0)
		if (slot === "notSeenYet") return n + (d.filters.state.notSeenYet ? 1 : 0)
		if (slot === "reach" || slot === "money" || slot === "shows") return n + partCount([slot])
		return n + chipsOf(pieces, slot).length
	}, 0)
}

/** The slot a status chip belongs to. */
export const slotOfChip = (chip: ActiveChip): Slot => cardOf(chip.group) ?? "notSeenYet"

const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ") || null
const headPlus = (names: string[]) => (names.length ? (names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ")) : null)

interface SegValue {
	value: string | null
	placeholder: string
	lead?: ReactNode
	badge?: number
	/** Shows the value in the search's large type. */
	big?: boolean
	/** A guest's You (round 15): locked look, still opens. */
	locked?: boolean
}

export function segValues(d: ProtoDiscover, pieces: Pieces, ctx: Ctx = CTX_C): Record<SegKey, SegValue> {
	const { L, viewer } = ctx
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
	/** A tab's labels for the slots it holds, in one fixed order (a's Search summary reads as before). */
	const has = (seg: SegKey, slot: Slot) => L.tabs[seg].some((x) => x.slots.includes(slot))
	const youOf = (seg: SegKey) => {
		const groups = L.tabs[seg].flatMap((x) => x.you ?? [])
		return youChips().filter((c) => groups.includes(c.group))
	}
	const personal = (seg: SegKey, typeToo: boolean) => [
		...(["similarTo", "people", "loved", "disliked", "minMatch"] as const).filter((k) => has(seg, k)).flatMap((k) => labels(k)),
		...(s.notSeenYet && has(seg, "notSeenYet") ? ["Not seen yet"] : []),
		...youOf(seg).map((c) => c.label),
		...(typeToo && s.type !== "all" && has(seg, "type") ? [TYPE_LABELS[s.type]] : []),
	]
	const searchOther = personal("search", true)
	// A segment's badge is the sum of its sub-tabs' badges.
	const badge = (k: SegKey) => subsFor(k, pieces, L).reduce((n, sub) => n + subCount(d, pieces, sub, ctx), 0) || undefined
	const streaming = s.onMyServices
		? "My services"
		: s.services?.length
			? (headPlus(chosen.map((p) => cleanName(p.name))) ?? `${s.services.length} services`)
			: s.anyService
				? "Any service"
				: null
	// You (round 15): "Any match · Not seen yet"; the match step leads, the rest follows.
	const youList = personal("you", false)
	const matchLabel = youList.find((x) => /^Match /.test(x) || /%/.test(x) || x === "Outside your usual")
	const youRest = youList.filter((x) => x !== matchLabel)
	const locked = viewer === "guest"
	const youLead = locked ? (
		<LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/70" aria-hidden />
	) : (
		<FingerPrintIcon className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
	)
	return {
		search: d.q
			? { value: d.q, placeholder: SEARCH_PLACEHOLDER, big: true, badge: badge("search") }
			: { value: headPlus(searchOther), placeholder: SEARCH_PLACEHOLDER, big: false, badge: badge("search") },
		you: {
			value: youList.length ? join([matchLabel ?? "Any match", L.youCap ? (youRest.length ? (youRest.length > 1 ? `${youRest[0]} +${youRest.length - 1}` : youRest[0]) : null) : headPlus(youRest)]) : null,
			placeholder: locked ? "Sign up" : "Any match",
			badge: badge("you"),
			lead: youLead,
			locked,
		},
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
				headPlus(moreChips().map((c) => c.label)),
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
// The bar: three segments (round 15: or four), so Search gets the room.

export function SegmentBar({
	id,
	values,
	active,
	onPick,
	onClearSearch,
	searchInput,
	order = SEG_ORDER,
	flex = LAYOUT_C.flex,
}: {
	id: string
	order?: SegKey[]
	flex?: Record<SegKey, string>
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
			{order.map((k, i) => {
				const v = values[k]
				const on = active === k
				const nextOn = active === order[i + 1]
				const isSearch = k === "search"
				const tight = order.length > 3
				return (
					<div key={k} data-seg={k} className={`relative flex min-w-0 ${flex[k]}`}>
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
									isSearch ? "pr-12 pl-7" : tight ? "px-5" : "px-6"
								} ${on ? "" : "hover:bg-white/[0.05]"}`}
							>
								<SegLabel k={k} badge={v.badge} locked={v.locked} />
								<span className="mt-0.5 flex min-w-0 items-center gap-2">
									{v.lead}
									<span
										className={`truncate ${
											isSearch && (v.big || !v.value)
												? `brand-header text-[21px] leading-tight ${v.value ? "text-white" : "text-gray-500"} ${PRIVATE}`
												: `text-[15px] ${v.value ? "font-semibold text-white" : v.locked ? "font-semibold text-amber-200/80" : "text-gray-500"}`
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
						{i < order.length - 1 && (
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

function SegLabel({ k, badge, locked }: { k: SegKey; badge?: number; locked?: boolean }) {
	return (
		<span
			className={`flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] uppercase ${k === "search" ? "text-amber-300/90" : locked ? "text-gray-500" : "text-gray-400"}`}
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

/** The phone bar: Search full width, then the other tabs side by side. */
export function PhoneBar({
	values,
	onPick,
	onClearSearch,
	order = SEG_ORDER,
	cols = "grid-cols-2",
}: {
	order?: SegKey[]
	/** The grid of the row under Search. */
	cols?: string
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
					data-seg-phone="search"
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
			<div className={`grid border-t border-white/[0.08] ${cols}`}>
				{order.filter((k) => k !== "search").map((k, i) => {
					const s = values[k]
					return (
						<motion.button
							key={k}
							type="button"
							data-seg-phone={k}
							whileTap={TAP}
							onClick={() => onPick(k)}
							className={`flex h-[52px] min-w-0 cursor-pointer flex-col justify-center text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${order.length > 3 ? "px-3" : "px-4"} ${i ? "border-l border-white/[0.08]" : ""}`}
						>
							<SegLabel k={k} badge={s.badge} locked={s.locked} />
							<span className="flex min-w-0 items-center gap-1.5">
								{s.lead}
								<span className={`truncate text-[13px] ${s.value ? "font-semibold text-white" : s.locked ? "font-semibold text-amber-200/80" : "text-gray-500"}`}>
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
		clearYou()
		clearMore()
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

/** You's lab-only choices as chips (taste groups, Outside your usual, Match 60%+, On your wishlist, Seen before). */
export function YouChips({ onOpen }: { onOpen: (slot: Slot) => void }) {
	const x = useYouExtras()
	return (
		<>
			{youChips(x).map((c) => (
				<ValueChip key={c.key} chip={{ key: c.key, group: c.group, label: c.label, remove: (v) => v }} onOpen={() => onOpen(c.group)} onRemove={c.remove} />
			))}
		</>
	)
}

/** Round 16: the lab-only popularity, money and show choices as chips (sections/more/store.ts). */
export function MoreChips({ onOpen }: { onOpen: (slot: Slot) => void }) {
	const x = useMore()
	const accent = { reach: "type", money: "minScore", shows: "runtime" } as const
	return (
		<>
			{moreChips(x).map((c) => (
				<ValueChip key={c.key} chip={{ key: c.key, group: accent[c.part], label: c.label, remove: (v) => v }} onOpen={() => onOpen(c.part)} onRemove={c.remove} />
			))}
		</>
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
	const you = useYouExtras()
	const more = moreChips(useMore()).length
	const any = searching || chips.length > 0 || s.onMyServices || youChips(you).length > 0 || more > 0
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
				<YouChips onOpen={onOpen} />
				{chips.map((chip) => (
					<ValueChip
						key={chip.key}
						chip={chip}
						onOpen={() => onOpen(slotOfChip(chip))}
						onRemove={() => d.filters.update((x) => chip.remove(x))}
					/>
				))}
				<MoreChips onOpen={onOpen} />
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

function HueDots({ tags, size = 12 }: { tags: Tag[]; size?: number }) {
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

// ---------------------------------------------------------------------------------------------------------------
// Streaming

const cleanName = (n: string) => n.replace(/ (Amazon Channel|Apple TV Channel)$/, "")

// ---------------------------------------------------------------------------------------------------------------
// Niche: one card of the real sheet, without its frame. The sheet's cards mount added-as-you-go, so this asks the
// sheet to open at `k` (focusSheetOn) right before mounting, and hides every other card.

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
