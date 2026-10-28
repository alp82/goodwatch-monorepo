// PROTOTYPE - throwaway. Round 5 variant 16: the sub-tab row and what each sub-tab shows. Every tab's content is shaped
// for its job: Search keeps 8's lanes and adds people and history pickers; Mood is a tag mixer (moods big, About and
// Style as combinations with counts), then the full tag sets, genre and type, length; Watch puts services and Not seen
// yet first, then scores as sliders side by side, the release years, and origin and age.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useRef } from "react"
import { FilterGroups } from "~/ui/filter-bar"
import { FilterSearchField } from "~/ui/filter-bar/FilterGroups"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { Chip } from "~/ui/filter-bar/SheetControls"
import { type ProtoDiscover, TAGS, type Tag } from "../kit"
import { SearchLanes } from "./R5-16-lanes"
import {
	CountryLine,
	GenreControl,
	NotSeenControl,
	OneCard,
	type Pieces,
	ReleasedControl,
	ScoreControl,
	type SegKey,
	ServiceLogos,
	StreamingModes,
	type Sub,
	TagChips,
	TypeControl,
	chipsOf,
	clearCard,
	subCount,
	tagOption,
	useKeepTop,
} from "./R5-16-parts"

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
	onSub: (id: string) => void
	/** Find a filter is showing results instead. */
	dim: boolean
	phone: boolean
	right?: ReactNode
}) {
	return (
		<div
			role="tablist"
			aria-label="Sections"
			className={`flex shrink-0 items-center gap-1 border-b border-white/[0.07] ${phone ? "overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "px-5"}`}
		>
			{subs.map((s) => {
				const on = s.id === active && !dim
				const n = subCount(d, pieces, s)
				return (
					<button
						key={s.id}
						type="button"
						role="tab"
						aria-selected={on}
						onClick={() => onSub(s.id)}
						className={`relative flex h-12 shrink-0 items-center gap-2 px-3 text-[14px] font-semibold whitespace-nowrap cursor-pointer outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
							on ? "text-white" : "text-gray-400 hover:text-gray-200"
						} ${dim ? "opacity-50" : ""}`}
					>
						{s.label}
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
// Building blocks

const COL_TITLE: Partial<Record<CardKey, { title: string; hint: string }>> = {
	people: { title: "Cast and crew", hint: "Actors and directors" },
	loved: { title: "Loved", hint: "Steer toward these" },
	disliked: { title: "Disliked", hint: "Steer away from these" },
	runtime: { title: "Length", hint: "Short movies, short episodes" },
	minMatch: { title: "Taste match", hint: "How well it fits your taste" },
	sourceScores: { title: "Scores by source", hint: "IMDb, Rotten Tomatoes, Metacritic" },
	scoreGap: { title: "Critics vs audiences", hint: "Where they disagree" },
	productionCountries: { title: "Production country", hint: "Where it was made" },
	ageLimit: { title: "Age and content", hint: "Age rating, violence, language" },
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

/** One real filter card, without its frame, under a title. */
function CardColumn({ d, pieces, k }: { d: ProtoDiscover; pieces: Pieces; k: CardKey }) {
	const head = COL_TITLE[k] ?? { title: k, hint: "" }
	const set = chipsOf(pieces, k).length > 0
	return (
		<section aria-label={head.title} className="min-w-0">
			<header className="mb-3 flex min-h-[38px] items-start gap-2">
				<span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[k].dot}`} />
				<div className="min-w-0 flex-1">
					<h4 className="text-[15px] font-bold leading-tight text-white">{head.title}</h4>
					<p className="truncate text-[12px] text-gray-500">{head.hint}</p>
				</div>
				{set && <ClearLink onClick={() => clearCard(d, pieces, k)} />}
			</header>
			<OneCard key={k} pieces={pieces} k={k} />
		</section>
	)
}

function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`min-w-0 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ${className}`}>{children}</div>
}

/** Columns side by side on desktop, stacked on phones, inside one short scroll area. */
function Columns({ phone, cols, children, keyFor }: { phone: boolean; cols: string; children: ReactNode; keyFor: string }) {
	const ref = useRef<HTMLDivElement>(null)
	useKeepTop(ref, keyFor)
	if (phone) return <div className="flex flex-col gap-7">{children}</div>
	return (
		<div ref={ref} className="h-full min-h-0 overflow-y-auto overscroll-contain px-6 py-5">
			<div className="grid items-start gap-x-8 gap-y-6" style={{ gridTemplateColumns: cols }}>
				{children}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Mood: the mixer

const SUGGEST = 6

function CombineGroup({
	d,
	group,
	label,
	onAll,
}: {
	d: ProtoDiscover
	group: "themes" | "styles"
	label: string
	onAll: () => void
}) {
	const tags = TAGS.filter((t) => t.group === group)
	const picked = tags.filter((t) => d.isOn(t))
	const rest = tags
		.filter((t) => !d.isOn(t) && (d.countFor(t) ?? 1) > 0)
		.sort((a, b) => (d.countFor(b) ?? 0) - (d.countFor(a) ?? 0))
		.slice(0, Math.max(0, SUGGEST - picked.length))
	const shown: Tag[] = [...picked, ...rest]
	return (
		<div>
			<div className="mb-2.5 flex min-h-6 items-center gap-2">
				<h4 className="text-[14px] font-semibold text-gray-100">{label}</h4>
				<span className="text-[12px] text-gray-500">{picked.length ? "Or" : "And"}</span>
				<button
					type="button"
					onClick={onAll}
					className="ml-auto rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					All {tags.length}
				</button>
			</div>
			<div className="flex flex-wrap gap-1.5">
				{shown.map((t) => (
					<Chip key={t.key} o={tagOption(d, t)} />
				))}
			</div>
		</div>
	)
}

function MoodMixer({ d, phone, onSub }: { d: ProtoDiscover; phone: boolean; onSub: (id: string) => void }) {
	if (phone)
		return (
			<div className="flex flex-col gap-7">
				<TagChips d={d} group="moods" big />
				<CombineGroup d={d} group="themes" label="About" onAll={() => onSub("about")} />
				<CombineGroup d={d} group="styles" label="Style" onAll={() => onSub("style")} />
			</div>
		)
	return (
		<div className="grid h-full min-h-0 grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
			<div className="min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-6 py-5">
				<TagChips d={d} group="moods" big />
			</div>
			<div className="flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain px-6 py-5">
				<CombineGroup d={d} group="themes" label="About" onAll={() => onSub("about")} />
				<CombineGroup d={d} group="styles" label="Style" onAll={() => onSub("style")} />
			</div>
		</div>
	)
}

function TagSet({ d, group, phone }: { d: ProtoDiscover; group: "themes" | "styles"; phone: boolean }) {
	return (
		<div className={phone ? "" : "h-full min-h-0 overflow-y-auto overscroll-contain px-6 py-5"}>
			<div className="max-w-4xl">
				<TagChips d={d} group={group} big />
			</div>
		</div>
	)
}

function GenreAndType({ d, phone }: { d: ProtoDiscover; phone: boolean }) {
	return (
		<div className={phone ? "flex flex-col gap-6" : "grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,3fr)]"}>
			<div className={phone ? "" : "border-r border-white/[0.06] px-6 py-5"}>
				<TypeControl d={d} />
			</div>
			<div className={phone ? "" : "min-h-0 overflow-y-auto overscroll-contain px-6 py-5"}>
				<GenreControl d={d} limit={phone ? 12 : 40} />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Watch

function WhereAndSeen({ d, pieces, phone }: { d: ProtoDiscover; pieces: Pieces; phone: boolean }) {
	const seen = (
		<Tile>
			<h4 className="mb-3 text-[14px] font-semibold text-gray-100">Seen</h4>
			<NotSeenControl pieces={pieces} />
		</Tile>
	)
	const services = (
		<div>
			<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
				<div className="w-full max-w-md">
					<StreamingModes d={d} pieces={pieces} />
				</div>
				<CountryLine d={d} pieces={pieces} />
			</div>
			<div className="mt-5">
				<ServiceLogos d={d} pieces={pieces} layout="grid" limit={phone ? 12 : 15} />
			</div>
		</div>
	)
	if (phone)
		return (
			<div className="flex flex-col gap-6">
				{seen}
				{services}
			</div>
		)
	return (
		<div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_260px]">
			<div className="min-h-0 overflow-y-auto overscroll-contain px-6 py-5">{services}</div>
			<div className="border-l border-white/[0.06] px-5 py-5">{seen}</div>
		</div>
	)
}

function Scores({ d, pieces, phone }: { d: ProtoDiscover; pieces: Pieces; phone: boolean }) {
	return (
		<Columns phone={phone} cols="repeat(2, minmax(0, 1fr))" keyFor="scores">
			<Tile>
				<ScoreControl d={d} />
			</Tile>
			<Tile>
				<CardColumn d={d} pieces={pieces} k="minMatch" />
			</Tile>
			<Tile>
				<CardColumn d={d} pieces={pieces} k="sourceScores" />
			</Tile>
			<Tile>
				<CardColumn d={d} pieces={pieces} k="scoreGap" />
			</Tile>
		</Columns>
	)
}

function Released({ d, phone }: { d: ProtoDiscover; phone: boolean }) {
	return (
		<div className={phone ? "" : "h-full min-h-0 overflow-y-auto px-6 py-6"}>
			<div className="max-w-2xl">
				<ReleasedControl d={d} />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The body of one sub-tab

export interface SearchProps {
	text: string
	typing: boolean
	onRun: (t: string) => void
	onFill: (t: string) => void
	input?: ReactNode
}

function SubBody({
	seg,
	sub,
	d,
	pieces,
	phone,
	search,
	onSub,
}: {
	seg: SegKey
	sub: Sub
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	search: SearchProps
	onSub: (id: string) => void
}) {
	const cards = sub.slots.filter((s): s is CardKey => s !== "q" && s !== "notSeenYet")
	switch (`${seg}:${sub.id}`) {
		case "search:find":
			return <SearchLanes d={d} phone={phone} {...search} />
		case "mood:mood":
			return <MoodMixer d={d} phone={phone} onSub={onSub} />
		case "mood:about":
			return <TagSet d={d} group="themes" phone={phone} />
		case "mood:style":
			return <TagSet d={d} group="styles" phone={phone} />
		case "mood:genre":
			return <GenreAndType d={d} phone={phone} />
		case "watch:where":
			return <WhereAndSeen d={d} pieces={pieces} phone={phone} />
		case "watch:scores":
			return <Scores d={d} pieces={pieces} phone={phone} />
		case "watch:released":
			return <Released d={d} phone={phone} />
		default:
			// Cast and crew, Loved and disliked, Length, Origin and age: the real cards, side by side.
			return (
				<Columns
					phone={phone}
					cols={cards.length > 1 ? `repeat(${cards.length}, minmax(0, 1fr))` : "minmax(0, 560px)"}
					keyFor={sub.id}
				>
					{cards.map((k, i) => (
						<div key={k} className={!phone && i ? "-ml-4 border-l border-white/[0.06] pl-4" : ""}>
							<CardColumn d={d} pieces={pieces} k={k} />
						</div>
					))}
				</Columns>
			)
	}
}

/** "Find a filter" results across every filter, laid out in columns so the list stays short. */
function FindAll({ pieces, text, phone }: { pieces: Pieces; text: string; phone: boolean }) {
	const css = phone
		? ""
		: `.find-all-16 > .flex-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 2rem; row-gap: 1.75rem; align-items: start }`
	const body = (
		<>
			{css && <style dangerouslySetInnerHTML={{ __html: css }} />}
			<FilterGroups data={pieces.groups} query={text} className="find-all-16" />
		</>
	)
	if (phone) return body
	return <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-7 py-5">{body}</div>
}

export function FindField({ value, onChange }: { value: string; onChange: (t: string) => void }) {
	return <FilterSearchField value={value} onChange={onChange} className="h-10" />
}

/** A tab: its sub-tab row (with Find a filter on desktop) over the open sub-tab, or Find a filter's results. */
export function TabPanel({
	id,
	seg,
	subs,
	sub,
	onSub,
	d,
	pieces,
	phone,
	search,
	find,
	onFind,
}: {
	id: string
	seg: SegKey
	subs: Sub[]
	sub: string
	onSub: (id: string) => void
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	search: SearchProps
	find: string
	onFind: (t: string) => void
}) {
	const open = subs.find((s) => s.id === sub) ?? subs[0]
	const finding = find.trim() !== ""
	const pickSub = (s: string) => {
		onFind("")
		onSub(s)
	}
	const body = finding ? (
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
			>
				<SubBody seg={seg} sub={open} d={d} pieces={pieces} phone={phone} search={search} onSub={pickSub} />
			</motion.div>
		</AnimatePresence>
	)
	if (phone)
		return (
			<div>
				{seg !== "search" && (
					<div className="mb-5">
						<FindField value={find} onChange={onFind} />
					</div>
				)}
				{body}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			<SubTabs
				id={id}
				d={d}
				pieces={pieces}
				subs={subs}
				active={open.id}
				onSub={pickSub}
				dim={finding}
				phone={false}
				right={seg !== "search" ? <FindField value={find} onChange={onFind} /> : undefined}
			/>
			<div className="relative min-h-0 flex-1">{body}</div>
		</div>
	)
}
