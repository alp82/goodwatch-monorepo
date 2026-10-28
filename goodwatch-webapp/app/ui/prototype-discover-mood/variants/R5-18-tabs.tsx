// PROTOTYPE - throwaway. Round 5 variant 18: the three tabs with sub-tabs. Mood is the deep tab, a mixer: the picked
// recipe as one line on top (with Movies or shows beside it), sub-tabs Feel, About, Style, Genre, Length, each with
// what a pick would leave. Streaming: Services, Age and content, Made in. Taste: Seen, Scores, Released, Taste match,
// Loved and disliked. Every sub-tab row ends in one field that finds a filter or runs a search.
import { ArrowTurnDownLeftIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useRef } from "react"
import { FilterGroups } from "~/ui/filter-bar"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS, TYPE_LABELS } from "~/ui/filter-bar/labels"
import { Chip, Segmented } from "~/ui/filter-bar/SheetControls"
import { type ProtoDiscover, TAGS, type Tag, short } from "../kit"
import {
	CountryLine,
	GenreControl,
	NicheControl,
	NotSeenControl,
	PRIVATE,
	type Pieces,
	ReleasedControl,
	ScoreControl,
	type SegKey,
	ServiceLogos,
	StreamingModes,
	type SubTab,
	TagChips,
	ValueChip,
	chipsOf,
	clearCard,
	homeOfChip,
	setInSub,
	subTabsFor,
	tagOption,
	useKeepTop,
} from "./R5-18-parts"

const LABEL = "text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400"

// ---------------------------------------------------------------------------------------------------------------
// The sub-tab row and its field

function SubStrip({
	id,
	d,
	pieces,
	tabs,
	sub,
	onSub,
	dim,
	phone,
	field,
}: {
	id: string
	d: ProtoDiscover
	pieces: Pieces
	tabs: SubTab[]
	sub: string
	onSub: (s: string) => void
	dim: boolean
	phone: boolean
	field?: ReactNode
}) {
	return (
		<div
			role="tablist"
			aria-label="Sub-tabs"
			className={`flex shrink-0 items-center gap-1 border-b border-white/[0.07] ${phone ? "-mx-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "px-5"}`}
		>
			{tabs.map((t) => {
				const on = t.id === sub && !dim
				const n = setInSub(d, pieces, t)
				return (
					<button
						key={t.id}
						type="button"
						role="tab"
						aria-selected={on}
						onClick={() => onSub(t.id)}
						className={`relative flex h-12 shrink-0 items-center gap-2 px-3 text-[14px] font-semibold whitespace-nowrap cursor-pointer outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
							on ? "text-white" : "text-gray-400 hover:text-gray-200"
						} ${dim ? "opacity-50" : ""}`}
					>
						{t.label}
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
			{field && !phone && <div className="ml-auto w-[min(360px,36%)] py-1.5 pl-3">{field}</div>}
		</div>
	)
}

/** One field on every tab: it finds a filter, and its first row runs the text as a search. */
export function FindField({ value, onChange, onRun }: { value: string; onChange: (v: string) => void; onRun: (t: string) => void }) {
	return (
		<label className="flex h-10 items-center gap-2.5 rounded-xl bg-white/[0.06] px-3.5 ring-1 ring-white/10 focus-within:ring-amber-500/70">
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" />
			<span className="sr-only">Find a filter or search</span>
			<input
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && value.trim()) {
						e.preventDefault()
						onRun(value.trim())
					}
				}}
				autoComplete="off"
				data-ph-no-capture
				placeholder="Find a filter or search"
				className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${PRIVATE}`}
			/>
			{value && (
				<button type="button" onClick={() => onChange("")} aria-label="Clear" className="text-gray-500 cursor-pointer hover:text-white">
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</label>
	)
}

/** What the field found: "Search: text" first, then matching options of every filter, in columns. */
function FindResults({ pieces, text, phone, onRun }: { pieces: Pieces; text: string; phone: boolean; onRun: (t: string) => void }) {
	const css = phone
		? ""
		: `.find-all-18 > .flex-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 2rem; row-gap: 1.75rem; align-items: start }`
	return (
		<div>
			<button
				type="button"
				onClick={() => onRun(text.trim())}
				className="mb-5 flex h-12 w-full min-w-0 max-w-xl items-center gap-3 rounded-xl bg-amber-400/[0.1] px-4 text-left ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.16] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
				<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search:</span>
				<span className={`min-w-0 flex-1 truncate text-[15px] font-semibold text-white ${PRIVATE}`}>{text.trim()}</span>
				<ArrowTurnDownLeftIcon className="hidden h-4 w-4 shrink-0 text-amber-200/70 sm:block" aria-hidden />
			</button>
			{css && <style dangerouslySetInnerHTML={{ __html: css }} />}
			<FilterGroups data={pieces.groups} query={text} className="find-all-18" />
		</div>
	)
}

export interface TabProps {
	seg: Exclude<SegKey, "search">
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	sub: string
	onSub: (s: string) => void
	find: string
	onFind: (t: string) => void
	onRun: (t: string) => void
}

/** A tab: an optional header line, the sub-tab row with the field, and the open sub-tab (or what the field found). */
function TabShell({ props, head, children }: { props: TabProps; head?: ReactNode; children: ReactNode }) {
	const { seg, d, pieces, phone, sub, onSub, find, onFind, onRun } = props
	const tabs = subTabsFor(pieces, seg)
	const open = tabs.find((t) => t.id === sub) ?? tabs[0]
	const finding = find.trim() !== ""
	const scroller = useRef<HTMLDivElement>(null)
	useKeepTop(scroller, `${seg}|${open.id}|${finding ? "find" : ""}`)
	const field = <FindField value={find} onChange={onFind} onRun={onRun} />
	const strip = (
		<SubStrip
			id={`${phone ? "p" : "d"}18-${seg}`}
			d={d}
			pieces={pieces}
			tabs={tabs}
			sub={open.id}
			onSub={(s) => {
				onFind("")
				onSub(s)
			}}
			dim={finding}
			phone={phone}
			field={field}
		/>
	)
	const body = finding ? (
		<FindResults pieces={pieces} text={find} phone={phone} onRun={onRun} />
	) : (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div key={open.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
				{children}
			</motion.div>
		</AnimatePresence>
	)
	if (phone)
		return (
			<div>
				<div className="mb-3">{field}</div>
				{head && <div className="mb-1">{head}</div>}
				{strip}
				<div className="pt-5">{body}</div>
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			{head && <div className="shrink-0 border-b border-white/[0.06] px-6">{head}</div>}
			<div className="shrink-0 pt-1">{strip}</div>
			<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
				{body}
			</div>
		</div>
	)
}

function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ${className}`}>{children}</div>
}

/** One real sheet card with a title, a hint and Clear. */
function CardColumn({ d, pieces, k, title, hint }: { d: ProtoDiscover; pieces: Pieces; k: CardKey; title: string; hint: string }) {
	const set = chipsOf(pieces, k).length > 0
	return (
		<section aria-label={title} className="min-w-0">
			<header className="mb-3 flex min-h-[38px] items-start gap-2">
				<span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[k].dot}`} />
				<div className="min-w-0 flex-1">
					<h4 className="text-[15px] font-bold leading-tight text-white">{title}</h4>
					<p className="truncate text-[12px] text-gray-500">{hint}</p>
				</div>
				{set && (
					<button
						type="button"
						onClick={() => clearCard(d, pieces, k)}
						className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
			</header>
			<NicheControl d={d} pieces={pieces} k={k} />
		</section>
	)
}

function Columns({ phone, widths, children }: { phone: boolean; widths: number[]; children: ReactNode[] }) {
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

// ---------------------------------------------------------------------------------------------------------------
// Mood: the mixer

const MIX_CARDS: CardKey[] = ["moods", "themes", "styles", "genres", "runtime"]

/** The picked recipe as one line: each piece opens its sub-tab or comes off, joined by plus signs, and the count. */
function Recipe({ d, pieces, onSub, phone }: { d: ProtoDiscover; pieces: Pieces; onSub: (s: string) => void; phone: boolean }) {
	const s = d.filters.state
	const parts = MIX_CARDS.flatMap((k) => chipsOf(pieces, k))
	const c = (o: string) => d.counts?.optionCounts.type?.[o] ?? null
	const typeControl = (
		<div className="flex shrink-0">
			<Segmented
				label="Movies or shows"
				value={s.type}
				onChange={(type) => d.filters.set({ type })}
				options={(["all", "movie", "show"] as const).map((id) => ({
					id,
					label: id === "all" ? "Both" : TYPE_LABELS[id],
					count: c(id),
				}))}
			/>
		</div>
	)
	const line = (
		<div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			<span className={`${LABEL} mr-1 shrink-0`}>Mix</span>
			{parts.length === 0 ? (
				<span className="text-[14px] whitespace-nowrap text-gray-500">Any feel · any topic · any style</span>
			) : (
				parts.map((chip, i) => (
					<span key={chip.key} className="flex shrink-0 items-center gap-1.5">
						{i > 0 && <span className="text-[13px] text-gray-600">+</span>}
						<ValueChip
							chip={chip}
							onOpen={() => {
								const h = homeOfChip(chip)
								if (h.sub) onSub(h.sub)
							}}
							onRemove={() => d.filters.update((x) => chip.remove(x))}
						/>
					</span>
				))
			)}
			{parts.length > 0 && (
				<>
					<span className="ml-1 shrink-0 text-[13px] whitespace-nowrap text-gray-400">
						= <span className="font-semibold text-white">{d.total == null ? "…" : short(d.total)}</span>
					</span>
					<button
						type="button"
						onClick={() => d.filters.update((x) => parts.reduce((acc, p) => p.remove(acc), x))}
						className="shrink-0 rounded-md px-1.5 py-0.5 text-[12px] text-gray-500 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear mix
					</button>
				</>
			)}
		</div>
	)
	if (phone)
		return (
			<div className="flex flex-col gap-3 pb-2">
				<div className="flex h-9 items-center">{line}</div>
				{typeControl}
			</div>
		)
	return (
		<div className="flex h-14 items-center gap-4">
			{line}
			{typeControl}
		</div>
	)
}

/** Tags from other groups that combine with the mix: what each would leave, best first. Groups with picks are left
 * out, since adding to them widens instead. */
function AddToMix({ d }: { d: ProtoDiscover }) {
	const groups = (["themes", "styles"] as const).filter((g) => !d.picked.some((t) => t.group === g))
	const any = d.picked.length > 0
	const rows = groups
		.map((g) => ({
			g,
			tags: TAGS.filter((t) => t.group === g && !d.isOn(t))
				.map((t) => ({ t, n: d.countFor(t) }))
				.filter((x): x is { t: Tag; n: number } => x.n !== null && x.n > 0)
				.sort((a, b) => b.n - a.n)
				.slice(0, 6),
		}))
		.filter((r) => r.tags.length)
	if (!rows.length) return null
	return (
		<div className="flex flex-col gap-5">
			<h4 className="text-[14px] font-semibold text-gray-100">{any ? "Goes with your mix" : "Most titles"}</h4>
			{rows.map(({ g, tags }) => (
				<div key={g}>
					<p className="mb-2 text-[12px] text-gray-500">{g === "themes" ? "About" : "Style"}</p>
					<div className="flex flex-wrap gap-1.5">
						{tags.map(({ t }) => (
							<Chip key={t.key} o={tagOption(d, t)} />
						))}
					</div>
				</div>
			))}
		</div>
	)
}

export function MoodTab(props: TabProps) {
	const { d, pieces, phone, sub, onSub } = props
	const tabs = subTabsFor(pieces, "mood")
	const open = (tabs.find((t) => t.id === sub) ?? tabs[0]).id
	let content: ReactNode
	switch (open) {
		case "feel":
			content = phone ? (
				<div className="flex flex-col gap-7">
					<TagChips d={d} group="moods" big />
					<AddToMix d={d} />
				</div>
			) : (
				<div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-x-8">
					<TagChips d={d} group="moods" big />
					<div className="-ml-4 border-l border-white/[0.06] pl-4">
						<AddToMix d={d} />
					</div>
				</div>
			)
			break
		case "about":
			content = <TagChips d={d} group="themes" />
			break
		case "style":
			content = <TagChips d={d} group="styles" />
			break
		case "genre":
			content = <GenreControl d={d} limit={phone ? 14 : 40} />
			break
		default:
			content = (
				<div className="max-w-2xl">
					<CardColumn d={d} pieces={pieces} k="runtime" title="Length" hint="Short movies, short episodes" />
				</div>
			)
	}
	return (
		<TabShell props={props} head={<Recipe d={d} pieces={pieces} onSub={onSub} phone={phone} />}>
			{content}
		</TabShell>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Streaming

export function StreamingTab(props: TabProps) {
	const { d, pieces, phone, sub } = props
	const tabs = subTabsFor(pieces, "streaming")
	const open = (tabs.find((t) => t.id === sub) ?? tabs[0]).id
	let content: ReactNode
	switch (open) {
		case "services":
			content = (
				<div>
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
						<div className="w-full max-w-md">
							<StreamingModes d={d} pieces={pieces} />
						</div>
						<CountryLine d={d} pieces={pieces} />
					</div>
					<div className="mt-5">
						<ServiceLogos d={d} pieces={pieces} layout="grid" limit={phone ? 12 : 18} />
					</div>
				</div>
			)
			break
		case "age":
			content = (
				<div className="max-w-3xl">
					<CardColumn d={d} pieces={pieces} k="ageLimit" title="Age and content" hint="Age rating, violence, language" />
				</div>
			)
			break
		default:
			content = (
				<div className="max-w-3xl">
					<CardColumn d={d} pieces={pieces} k="productionCountries" title="Production country" hint="Where it was made" />
				</div>
			)
	}
	return <TabShell props={props}>{content}</TabShell>
}

// ---------------------------------------------------------------------------------------------------------------
// Taste

export function TasteTab(props: TabProps) {
	const { d, pieces, phone, sub } = props
	const tabs = subTabsFor(pieces, "taste")
	const open = (tabs.find((t) => t.id === sub) ?? tabs[0]).id
	let content: ReactNode
	switch (open) {
		case "seen":
			content = (
				<Tile className="max-w-md">
					<h4 className="mb-3 text-[14px] font-semibold text-gray-100">Seen</h4>
					<NotSeenControl pieces={pieces} />
				</Tile>
			)
			break
		case "scores":
			content = (
				<Columns phone={phone} widths={[1, 1.2, 1]}>
					<ScoreControl d={d} />
					<CardColumn d={d} pieces={pieces} k="sourceScores" title="Scores by source" hint="IMDb, Rotten Tomatoes, Metacritic" />
					<CardColumn d={d} pieces={pieces} k="scoreGap" title="Critics vs audiences" hint="Where they disagree" />
				</Columns>
			)
			break
		case "released":
			content = (
				<div className="max-w-xl">
					<ReleasedControl d={d} />
				</div>
			)
			break
		case "match":
			content = (
				<div className="max-w-2xl">
					<CardColumn d={d} pieces={pieces} k="minMatch" title="Taste match" hint="How well it fits your taste" />
				</div>
			)
			break
		default:
			content = (
				<Columns phone={phone} widths={[1, 1]}>
					<CardColumn d={d} pieces={pieces} k="loved" title="Loved" hint="Steer toward these" />
					<CardColumn d={d} pieces={pieces} k="disliked" title="Disliked" hint="Steer away from these" />
				</Columns>
			)
	}
	return <TabShell props={props}>{content}</TabShell>
}

