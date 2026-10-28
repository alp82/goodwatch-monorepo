// PROTOTYPE - throwaway. Round 5 variant 17, "Sub-tabs in the bar": the four tabs and their sub-tabs (where every
// filter lives), what each tab reads, the desktop bar (the open tab's segment widens and carries its sub-tabs inline,
// the others shrink to labels), the phone bar and sheet header, and the status line (each value opens its own sub-tab).
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { ReactNode, Ref } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { type CardKey, cardOf } from "~/ui/filter-bar/filter-cards"
import { ServiceStack, SortControl } from "~/ui/filter-bar/controls"
import { type ActiveChip, RELEASED_LABELS, TYPE_LABELS, discoverSorts, sortShown } from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import type { ProtoDiscover } from "../kit"
import { HueDots, PRIVATE, type Pieces, SEARCH_PLACEHOLDER, ValueChip, chipsOf, headPlus, useClearAll } from "./R5-17-parts"

const TASTE = "signUp" as const

// ---------------------------------------------------------------------------------------------------------------
// Where everything lives

export type TabKey = "search" | "mood" | "streaming" | "watched"
export const TAB_ORDER: TabKey[] = ["search", "mood", "streaming", "watched"]
export const TAB_LABEL: Record<TabKey, string> = { search: "Search", mood: "Mood", streaming: "Streaming", watched: "Watched" }

export interface Sub {
	id: string
	label: string
	/** The filter cards whose values count toward this sub-tab. */
	cards: CardKey[]
	notSeen?: boolean
	query?: boolean
}

export const TABS: Record<TabKey, Sub[]> = {
	search: [
		{ id: "describe", label: "Describe", cards: [], query: true },
		{ id: "title", label: "Title", cards: [] },
		{ id: "similar", label: "Similar to", cards: ["similarTo"] },
		{ id: "cast", label: "Cast and crew", cards: ["people"] },
		{ id: "find", label: "Find a filter", cards: [] },
	],
	mood: [
		{ id: "mood", label: "Mood", cards: ["moods"] },
		{ id: "about", label: "About", cards: ["themes"] },
		{ id: "style", label: "Style", cards: ["styles"] },
		{ id: "genre", label: "Genre", cards: ["genres", "type"] },
	],
	streaming: [
		{ id: "services", label: "Services", cards: ["services"] },
		{ id: "length", label: "Length", cards: ["runtime"] },
		{ id: "age", label: "Age and content", cards: ["ageLimit"] },
		{ id: "made", label: "Made in", cards: ["productionCountries"] },
	],
	watched: [
		{ id: "seen", label: "Seen", cards: ["loved", "disliked"], notSeen: true },
		{ id: "scores", label: "Scores", cards: ["minScore", "minMatch", "sourceScores", "scoreGap"] },
		{ id: "released", label: "Released", cards: ["released"] },
	],
}

/** The sub-tabs this viewer gets (Age and content needs a rating ladder). */
export const subsFor = (pieces: Pieces, tab: TabKey) => TABS[tab].filter((s) => s.id !== "age" || pieces.groups.ladder)
export const firstSub = (tab: TabKey) => TABS[tab][0].id

export function subCount(d: ProtoDiscover, pieces: Pieces, sub: Sub) {
	return (
		sub.cards.reduce((n, k) => n + chipsOf(pieces, k).length, 0) +
		(sub.notSeen && d.filters.state.notSeenYet ? 1 : 0) +
		(sub.query && d.q ? 1 : 0)
	)
}

/** Where a value chip lives: its tab and sub-tab. */
export function placeOf(chip: ActiveChip): { tab: TabKey; sub: string } {
	const k = cardOf(chip.group)
	for (const tab of TAB_ORDER) for (const s of TABS[tab]) if (k && s.cards.includes(k)) return { tab, sub: s.id }
	return { tab: "watched", sub: "seen" }
}

// ---------------------------------------------------------------------------------------------------------------
// What each tab reads: every sub-tab's values in one line.

export interface TabValue {
	value: string | null
	placeholder: string
	lead?: ReactNode
	/** Values set in sub-tabs other than the first. */
	n: number
}

const cleanName = (n: string) => n.replace(/ (Amazon Channel|Apple TV Channel)$/, "")
const joinAll = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ") || null

export function tabValues(d: ProtoDiscover, pieces: Pieces): Record<TabKey, TabValue> {
	const s = d.filters.state
	const labels = (k: CardKey) => headPlus(chipsOf(pieces, k).map((c) => c.label.replace(/^Produced in /, "Made in ")))
	const tags = d.picked
	const providers = pieces.services.countryProviders
	const chosen = s.onMyServices ? pieces.services.providers : providers.filter((p) => s.services?.includes(p.id))
	const released = s.years
		? `${s.years.min ?? "Any"}–${s.years.max ?? "now"}`
		: s.released !== "any"
			? RELEASED_LABELS[s.released]
			: null
	const total = (tab: TabKey) => subsFor(pieces, tab).reduce((n, sub) => n + subCount(d, pieces, sub), 0)
	return {
		search: {
			value: joinAll([d.q && `“${d.q}”`, labels("similarTo"), labels("people")]),
			placeholder: SEARCH_PLACEHOLDER,
			n: total("search"),
		},
		mood: {
			value: joinAll([headPlus(tags.map((t) => t.name)), s.type !== "all" && TYPE_LABELS[s.type], labels("genres")]),
			placeholder: "Any mood",
			lead: tags.length ? <HueDots tags={tags} size={10} /> : null,
			n: total("mood"),
		},
		streaming: {
			value: joinAll([
				s.onMyServices
					? "My services"
					: s.services?.length
						? (headPlus(chosen.map((p) => cleanName(p.name))) ?? `${s.services.length} services`)
						: s.anyService
							? "Any service"
							: null,
				labels("runtime"),
				labels("ageLimit"),
				labels("productionCountries"),
			]),
			placeholder: "Everywhere",
			lead: chosen.length ? <ServiceStack providers={chosen} on size={16} /> : null,
			n: total("streaming"),
		},
		watched: {
			value: joinAll([
				s.notSeenYet && "Not seen yet",
				labels("loved"),
				labels("disliked"),
				s.minScore > 0 && `Score ${s.minScore}+`,
				labels("minMatch"),
				labels("sourceScores"),
				labels("scoreGap"),
				released,
			]),
			placeholder: "Seen too, any year",
			n: total("watched"),
		},
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Pieces of the bar

const LABEL = "text-[11px] font-bold tracking-[0.08em] uppercase"

function TabLabel({ k, dot }: { k: TabKey; dot?: boolean }) {
	return (
		<span className={`flex items-center gap-1.5 ${LABEL} ${k === "search" ? "text-amber-300/90" : "text-gray-400"}`}>
			{k === "search" && <MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden />}
			{TAB_LABEL[k]}
			{dot && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="set" />}
		</span>
	)
}

function Count({ n, small = false }: { n: number; small?: boolean }) {
	if (!n) return null
	return (
		<span
			className={`grid place-items-center rounded-full bg-amber-500 font-bold text-gray-950 tabular-nums ${small ? "h-4 min-w-4 px-1 text-[10px]" : "h-[18px] min-w-[18px] px-1 text-[11px]"}`}
		>
			{n}
		</span>
	)
}

/** One row of sub-tabs: short labels, a count where values are set. */
export function SubTabs({
	id,
	subs,
	active,
	onSub,
	count,
	size = "bar",
}: {
	id: string
	subs: Sub[]
	active: string
	onSub: (s: string) => void
	count: (s: Sub) => number
	size?: "bar" | "sheet"
}) {
	return (
		<div
			role="tablist"
			aria-label="Sub-tabs"
			className={`flex min-w-0 items-center gap-0.5 ${size === "sheet" ? "overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""}`}
		>
			{subs.map((s) => {
				const on = s.id === active
				const n = count(s)
				return (
					<motion.button
						key={s.id}
						type="button"
						role="tab"
						aria-selected={on}
						whileTap={TAP}
						onClick={() => onSub(s.id)}
						className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
							size === "sheet" ? "h-9 text-[13px]" : "h-10 text-[14px]"
						} ${on ? "text-gray-950" : "text-gray-300 hover:text-white"}`}
					>
						{on && (
							<motion.span
								layoutId={`${id}-sub`}
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-0 rounded-full bg-white"
							/>
						)}
						<span className="relative">{s.label}</span>
						{n > 0 && (
							<span className="relative">
								<Count n={n} small />
							</span>
						)}
					</motion.button>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The desktop bar

const CLOSED_FLEX: Record<TabKey, string> = { search: "flex-[2.3]", mood: "flex-1", streaming: "flex-1", watched: "flex-1" }

/**
 * Closed: four segments, label over value. Open: the open tab's segment takes the room and shows its value (or the
 * search field) with its sub-tabs inline; the other segments shrink to their labels. Search stays a field-looking
 * segment on every tab, so it's one tap from anywhere.
 */
export function Bar({
	id,
	values,
	tab,
	sub,
	subs,
	count,
	onPick,
	onSub,
	onClearSearch,
	searchInput,
	barRef,
}: {
	id: string
	values: Record<TabKey, TabValue>
	tab: TabKey | null
	sub: string
	subs: Sub[]
	count: (s: Sub) => number
	onPick: (k: TabKey) => void
	onSub: (s: string) => void
	onClearSearch: () => void
	searchInput?: ReactNode
	barRef?: Ref<HTMLDivElement>
}) {
	return (
		<div
			ref={barRef}
			data-seg-bar
			className={`relative flex h-[76px] items-stretch rounded-full p-1.5 ring-1 transition-colors duration-200 ${
				tab
					? "bg-gray-900 ring-white/15"
					: "bg-white/[0.045] ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_20px_50px_-30px_rgba(0,0,0,.9)]"
			}`}
		>
			{TAB_ORDER.map((k, i) => {
				const v = values[k]
				const on = tab === k
				const nextOn = tab === TAB_ORDER[i + 1]
				const isSearch = k === "search"
				const flex = !tab ? CLOSED_FLEX[k] : on ? "flex-1" : isSearch ? "w-[240px] flex-none" : "flex-none"
				return (
					<div key={k} data-seg={k} className={`relative flex min-w-0 ${flex}`}>
						{on && (
							<motion.span
								layoutId={`${id}-pill`}
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-0 rounded-full bg-white/[0.08] ring-1 ring-white/15 shadow-[0_10px_30px_-10px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.08)]"
							/>
						)}
						{on ? (
							<motion.div
								key={`open-${k}`}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.16 }}
								className="relative flex min-w-0 flex-1 items-center gap-4 pr-3"
							>
								<div className={`flex min-w-0 flex-col justify-center ${isSearch ? "flex-1 pl-7" : "w-[min(260px,32%)] shrink-0 pl-6"}`}>
									<TabLabel k={k} />
									{isSearch && searchInput ? (
										searchInput
									) : (
										<span className="mt-0.5 flex min-w-0 items-center gap-2">
											{v.lead}
											<span className={`truncate text-[14px] ${v.value ? "font-semibold text-white" : "text-gray-500"}`}>
												{v.value ?? v.placeholder}
											</span>
										</span>
									)}
								</div>
								<span aria-hidden className="h-8 w-px shrink-0 bg-white/10" />
								<div className={isSearch ? "shrink-0" : "min-w-0 flex-1"}>
									<SubTabs id={id} subs={subs} active={sub} onSub={onSub} count={count} />
								</div>
							</motion.div>
						) : (
							<motion.button
								type="button"
								whileTap={{ scale: 0.985 }}
								onClick={() => onPick(k)}
								aria-expanded={false}
								aria-haspopup="dialog"
								className={`relative flex min-w-0 flex-1 cursor-pointer flex-col justify-center rounded-full text-left outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-amber-400 ${
									!tab ? (isSearch ? "pr-12 pl-7" : "px-6") : isSearch ? "pr-4 pl-6" : "px-5"
								}`}
							>
								{tab && !isSearch ? (
									<span className="flex items-center gap-1.5">
										<TabLabel k={k} />
										<Count n={v.n} small />
									</span>
								) : (
									<>
										<TabLabel k={k} />
										<span className="mt-0.5 flex min-w-0 items-center gap-2">
											{!isSearch && v.lead}
											<span
												className={`truncate ${
													isSearch
														? `brand-header leading-tight ${tab ? "text-[16px]" : "text-[21px]"} ${v.value ? "text-white" : "text-gray-500"} ${PRIVATE}`
														: `text-[15px] ${v.value ? "font-semibold text-white" : "text-gray-500"}`
												}`}
											>
												{isSearch && tab ? (v.value ?? "Search") : (v.value ?? v.placeholder)}
											</span>
										</span>
									</>
								)}
							</motion.button>
						)}
						{isSearch && !tab && values.search.value && (
							<button
								type="button"
								onClick={onClearSearch}
								aria-label="Clear the search"
								className="absolute top-1/2 right-3 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-gray-400 cursor-pointer outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<XMarkIcon className="h-4 w-4" />
							</button>
						)}
						{i < TAB_ORDER.length - 1 && (
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

// ---------------------------------------------------------------------------------------------------------------
// Phones

/** The phone bar: Search full width, then Mood, Streaming, Watched in a row. */
export function PhoneBar({
	values,
	onPick,
	onClearSearch,
}: {
	values: Record<TabKey, TabValue>
	onPick: (k: TabKey) => void
	onClearSearch: () => void
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
					<TabLabel k="search" />
					<span className={`brand-header mt-0.5 truncate text-[19px] leading-tight ${v.value ? "text-white" : "text-gray-500"} ${PRIVATE}`}>
						{v.value ?? v.placeholder}
					</span>
				</button>
				{v.value && (
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
			<div className="grid grid-cols-3 border-t border-white/[0.08]">
				{TAB_ORDER.slice(1).map((k, i) => {
					const s = values[k]
					return (
						<motion.button
							key={k}
							type="button"
							whileTap={TAP}
							onClick={() => onPick(k)}
							className={`flex h-[52px] min-w-0 cursor-pointer flex-col justify-center px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${i ? "border-l border-white/[0.08]" : ""}`}
						>
							<span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.06em] text-gray-400 uppercase">
								{TAB_LABEL[k]}
								<Count n={s.n} small />
							</span>
							<span className={`truncate text-[12.5px] ${s.value ? "font-semibold text-white" : "text-gray-500"}`}>
								{s.value ?? (k === "watched" ? "Seen too" : k === "streaming" ? "Everywhere" : s.placeholder)}
							</span>
						</motion.button>
					)
				})}
			</div>
		</div>
	)
}

/** The phone sheet's header: the four tabs, the search field on Search, then the open tab's sub-tabs. */
export function SheetHeader({
	values,
	tab,
	onPick,
	sub,
	subs,
	onSub,
	count,
	searchField,
}: {
	values: Record<TabKey, TabValue>
	tab: TabKey
	onPick: (k: TabKey) => void
	sub: string
	subs: Sub[]
	onSub: (s: string) => void
	count: (s: Sub) => number
	searchField?: ReactNode
}) {
	return (
		<div className="border-b border-white/[0.07] pb-2">
			<div role="tablist" aria-label="Filters" className="flex gap-0.5 px-2 pt-1 pb-2">
				{TAB_ORDER.map((k) => {
					const on = tab === k
					return (
						<motion.button
							key={k}
							type="button"
							role="tab"
							aria-selected={on}
							whileTap={TAP}
							onClick={() => onPick(k)}
							className={`relative flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "text-white" : "text-gray-400"}`}
						>
							{on && (
								<motion.span
									layoutId="v17-tab"
									transition={{ type: "spring", stiffness: 520, damping: 42 }}
									className="absolute inset-0 rounded-full bg-white/[0.1] ring-1 ring-white/20"
								/>
							)}
							<span className="relative flex items-center gap-1.5">
								{TAB_LABEL[k]}
								<Count n={values[k].n} small />
							</span>
						</motion.button>
					)
				})}
			</div>
			{searchField && <div className="px-4 pb-2">{searchField}</div>}
			<SubTabs id="p17" subs={subs} active={sub} onSub={onSub} count={count} size="sheet" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Status line: count, the query and every active value (each opens its own tab and sub-tab), Clear all, sort.

const LINE_FADE = "linear-gradient(to right, black calc(100% - 2.5rem), transparent)"

export function StatusLine({
	d,
	pieces,
	onOpen,
	className = "",
}: { d: ProtoDiscover; pieces: Pieces; onOpen: (tab: TabKey, sub?: string) => void; className?: string }) {
	const clearAll = useClearAll(d)
	const searching = d.q !== null
	const chips = pieces.chips.filter((c) => c.key !== "services")
	const s = d.filters.state
	const any = searching || chips.length > 0 || s.notSeenYet
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
							onClick={() => onOpen("search", "describe")}
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
						onOpen={() => onOpen("watched", "seen")}
						onRemove={() => d.filters.set({ notSeenYet: false })}
					/>
				)}
				{chips.map((chip) => {
					const at = placeOf(chip)
					return (
						<ValueChip
							key={chip.key}
							chip={chip}
							onOpen={() => onOpen(at.tab, at.sub)}
							onRemove={() => d.filters.update((x) => chip.remove(x))}
						/>
					)
				})}
				{any && (
					<button type="button" onClick={clearAll} className="shrink-0 px-1.5 text-sm text-gray-500 cursor-pointer hover:text-white">
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
