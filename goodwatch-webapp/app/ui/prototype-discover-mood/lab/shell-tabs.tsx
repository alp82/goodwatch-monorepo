// PROTOTYPE - throwaway. The Discover lab shell: the sub-tab row, Find a filter, and the content area where the chosen
// variant of each section renders (`pick(useLabChoice(), id).View`). Desktop: one row (sub-tabs, Find a filter or, on
// Search, Movies or shows on the right unless the titles variant has ownType) over a fixed 400 px content area.
// Phones: the sub-tabs sit in the sheet header, sections stack in its body.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ComponentType, type ReactNode, useEffect, useRef } from "react"
import { FilterGroups } from "~/ui/filter-bar"
import { ANIME_LABELS, TYPE_LABELS, compactCount } from "~/ui/filter-bar/labels"
import type { ProtoDiscover } from "../kit"
import { useLabChoice } from "./LabBar"
import { pick } from "./registry"
import { type SubId, layoutFor } from "./layouts"
import { type Pieces, type SegKey, type Sub, subCount, useKeepTop } from "./shell-parts"
import type { SectionId, SectionProps } from "./types"

/** The content area's height on desktop. Sections fill it (`h-full`) and keep their own scroll short. */
export const CONTENT_H = 400

// ---------------------------------------------------------------------------------------------------------------
// The sub-tab row

export function SubTabs({
	id,
	d,
	pieces,
	subs,
	active,
	onSub,
	dim,
	phone,
	right,
}: {
	id: string
	d: ProtoDiscover
	pieces: Pieces
	subs: Sub[]
	active: string
	onSub: (id: SubId) => void
	/** Find a filter is showing results instead. */
	dim: boolean
	phone: boolean
	right?: ReactNode
}) {
	const row = useRef<HTMLDivElement>(null)
	const choice = useLabChoice()
	const ctx = { L: layoutFor(choice), viewer: choice.as }
	// Phones: the row scrolls sideways; keep the open sub-tab in view (a status chip can open the last one).
	useEffect(() => {
		const el = row.current
		if (!phone || !el) return
		const tab = el.querySelector<HTMLElement>(`[data-sub="${active}"]`)
		if (!tab) return
		const left = tab.offsetLeft - 12
		const right = tab.offsetLeft + tab.offsetWidth + 12 - el.clientWidth
		if (el.scrollLeft > left) el.scrollLeft = left
		else if (el.scrollLeft < right) el.scrollLeft = right
	}, [active, phone])
	return (
		<div
			ref={row}
			role="tablist"
			aria-label="Sections"
			className={`flex h-12 shrink-0 items-center gap-1 border-b border-white/[0.07] ${phone ? "overflow-x-auto overscroll-x-contain px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "px-5"}`}
		>
			{subs.map((s) => {
				const on = s.id === active && !dim
				const n = subCount(d, pieces, s, ctx)
				return (
					<button
						key={s.id}
						data-sub={s.id}
						type="button"
						role="tab"
						aria-selected={on}
						onClick={() => onSub(s.id)}
						className={`relative flex h-12 shrink-0 items-center gap-2 px-3 text-[14px] font-semibold whitespace-nowrap cursor-pointer outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
							on ? "text-white" : "text-gray-400 hover:text-gray-200"
						} ${dim ? "opacity-50" : ""}`}
					>
						<SubLabel sub={s} />
						{n > 0 && (
							<span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 tabular-nums">
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
			})}
			{right && <div className="ml-auto w-[min(320px,34%)] shrink-0 py-1.5">{right}</div>}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Find a filter

/** The sheet's Find a filter field, with the lab's own placeholder. */
function FindField({ value, onChange }: { value: string; onChange: (t: string) => void }) {
	return (
		<label className="flex h-10 items-center gap-2.5 rounded-xl bg-white/[0.06] px-3.5 ring-1 ring-white/10 focus-within:ring-amber-500/70">
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" />
			<span className="sr-only">Find a filter</span>
			<input
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Find a filter: thriller, a title, a name"
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

/** Find a filter's results across every filter, laid out in columns so the list stays short. */
function FindAll({ pieces, text, phone }: { pieces: Pieces; text: string; phone: boolean }) {
	const css = phone
		? ""
		: `.lab-find-all > .flex-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 2rem; row-gap: 1.75rem; align-items: start }`
	const body = (
		<>
			{css && <style dangerouslySetInnerHTML={{ __html: css }} />}
			<FilterGroups data={pieces.groups} query={text} className="lab-find-all" />
		</>
	)
	if (phone) return body
	return <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-7 py-5">{body}</div>
}

/** Movies or shows for the whole Discover state, on the Search tab (round 10: no longer on Mood). */
function SearchType({ d }: { d: ProtoDiscover }) {
	const c = (o: string) => d.counts?.optionCounts.type?.[o] ?? null
	return (
		<div className="flex">
			<CountSegmented
				label="Movies or shows"
				pending={!d.countsFresh}
				value={d.filters.state.type}
				onChange={(type) => d.filters.set({ type })}
				options={(["all", "movie", "show"] as const).map((id) => ({ id, label: id === "all" ? "Both" : TYPE_LABELS[id], count: c(id) }))}
			/>
		</div>
	)
}

/** Round 11: Movies or shows with the anime switch under it, as the real sheet's type card has them. */
export function TypeBlock({ d, className = "" }: { d: ProtoDiscover; className?: string }) {
	const c = (o: string) => d.counts?.optionCounts.anime?.[o] ?? null
	return (
		<div className={`flex flex-col gap-2 ${className}`}>
			<SearchType d={d} />
			<div className="flex">
				<CountSegmented
					label="Anime"
					small
					pending={!d.countsFresh}
					value={d.filters.state.anime}
					onChange={(anime) => d.filters.set({ anime })}
					options={(["any", "only", "none"] as const).map((id) => ({ id, label: id === "any" ? "With anime" : ANIME_LABELS[id], count: c(id) }))}
				/>
			</div>
		</div>
	)
}

/**
 * The sheet's Segmented (SheetControls), with one change (round 11b): while the counts are still the previous
 * filters' (`pending`), each count keeps its place but turns invisible, so no stale "0" shows and nothing moves.
 */
function CountSegmented<T extends string>({
	value,
	options,
	onChange,
	small = false,
	label,
	pending,
}: {
	value: T
	options: { id: T; label: string; count?: number | null }[]
	onChange: (v: T) => void
	small?: boolean
	label: string
	pending: boolean
}) {
	return (
		<div role="radiogroup" aria-label={label} className={`grid flex-1 auto-cols-fr grid-flow-col rounded-xl bg-white/[0.05] p-0.5 ${small ? "h-8" : "h-10"}`}>
			{options.map((o) => {
				const on = o.id === value
				return (
					<button
						key={o.id}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a segmented control; the buttons carry the radio role
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
							<span className={`relative text-[11px] tabular-nums text-gray-500 transition-opacity ${pending ? "opacity-0" : ""}`} aria-hidden={pending}>
								{compactCount(o.count)}
							</span>
						)}
					</button>
				)
			})}
		</div>
	)
}

/** The Search row's switch, unless the titles variant places its own (ownType). */
function useRowType() {
	return pick(useLabChoice(), "titles").ownType !== true
}

/** A sub-tab's label: the chosen variant's own label, else the shell's. */
function SubLabel({ sub }: { sub: Sub }) {
	const choice = useLabChoice()
	// The "more" section's parts keep the layout's labels.
	if (sub.part) return <>{sub.label}</>
	return <>{pick(choice, sub.id as SectionId).label ?? sub.label}</>
}

// ---------------------------------------------------------------------------------------------------------------
// A section, mounted as a component so its hooks work. A new variant remounts it.

export type SectionBase = Omit<SectionProps, "phone" | "viewer">

function Section({ id, part, props }: { id: SubId; part?: Sub["part"]; props: Omit<SectionProps, "viewer"> }) {
	// Round 16: the "more" section at one of its parts.
	if (part) return <RegisteredSection id="more" props={{ ...props, morePart: part }} />
	return <RegisteredSection id={id as SectionId} props={props} />
}

function RegisteredSection({ id, props }: { id: SectionId; props: Omit<SectionProps, "viewer"> }) {
	const choice = useLabChoice()
	const variant = pick(choice, id)
	const View = variant.View as ComponentType<SectionProps>
	return <View key={`${id}:${variant.key}:${choice.as}`} {...props} viewer={choice.as} />
}

/** Desktop: the fixed content area. Overflow scrolls as a fallback; the sheet's cards scroll themselves into view as
 * they mount, so it's held at the top for a moment after a section opens. */
function ContentArea({ id, children, height = CONTENT_H }: { id: string; children: ReactNode; height?: number }) {
	const ref = useRef<HTMLDivElement>(null)
	useKeepTop(ref, id)
	return (
		<div ref={ref} className="relative min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain" style={{ height }}>
			{children}
		</div>
	)
}

/** A tab: its sub-tab row (with Find a filter on Mood and Watch) over the open section, or Find a filter's results. */
export function TabPanel({
	id,
	seg,
	subs,
	sub,
	onSub,
	pieces,
	phone,
	section,
	find,
	onFind,
	top,
}: {
	id: string
	seg: SegKey
	subs: Sub[]
	sub: string
	onSub: (id: SubId) => void
	pieces: Pieces
	phone: boolean
	section: SectionBase
	find: string
	onFind: (t: string) => void
	/** Phones: shown above the section (the search field on Search). */
	top?: ReactNode
}) {
	const open = subs.find((s) => s.id === sub) ?? subs[0]
	const canFind = seg !== "search"
	// A variant with ownFind places the field and the results itself (no row of its own here).
	const choice = useLabChoice()
	const own = canFind && !open.part && pick(choice, open.id as SectionId).ownFind === true
	const finding = canFind && find.trim() !== ""
	const rowType = useRowType()
	const pickSub = (s: SubId) => {
		onFind("")
		onSub(s)
	}
	const props: Omit<SectionProps, "viewer"> = own
		? { ...section, phone, find: { field: <FindField value={find} onChange={onFind} />, results: finding ? <FindAll pieces={pieces} text={find} phone={phone} /> : null } }
		: { ...section, phone }
	const body = finding && !own ? (
		<FindAll pieces={pieces} text={find} phone={phone} />
	) : (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={open.id}
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.14 }}
				className={phone ? "" : "h-full min-h-0"}
				data-lab-section={open.id}
			>
				<Section id={open.id} part={open.part} props={props} />
			</motion.div>
		</AnimatePresence>
	)
	if (phone)
		return (
			<div>
				{top}
				{!canFind && rowType && (
					<div className="mb-5">
						<SearchType d={section.d} />
					</div>
				)}
				{canFind && !own && (
					<div className="mb-5">
						<FindField value={find} onChange={onFind} />
					</div>
				)}
				{body}
			</div>
		)
	// Mood and Watch: Find a filter on the right of the row; Search: Movies or shows.
	const field = canFind ? <FindField value={find} onChange={onFind} /> : rowType ? <SearchType d={section.d} /> : null
	return (
		<div className="flex min-h-0 flex-col">
			{own ? null : subs.length > 1 ? (
				<SubTabs id={id} d={section.d} pieces={pieces} subs={subs} active={open.id} onSub={pickSub} dim={finding} phone={false} right={field} />
			) : (
				// One section (Mood): no sub-tabs, the row keeps Find a filter so every tab has the same frame.
				<div className="flex h-12 shrink-0 items-center border-b border-white/[0.07] px-5">
					{field && <div className="ml-auto w-[min(320px,34%)] shrink-0">{field}</div>}
				</div>
			)}
			<ContentArea id={finding && !own ? "find" : open.id} height={own ? CONTENT_H + 48 : CONTENT_H}>
				{body}
			</ContentArea>
		</div>
	)
}
