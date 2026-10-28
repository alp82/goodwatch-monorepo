// PROTOTYPE - throwaway. The "tiers by size" pieces variants Q and U are built from. Common filters are big blocks
// with their control inline (Mood at full width, then Streaming, Not seen yet, Movies or shows, Genre, Score,
// Released); the niche ones are a quiet index of rows (name + current value) that open one at a time, in place, as the
// real filter card. Also the static page title, the mood search as a filter value, and the one status line.
import { ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import type { ReactNode } from "react"
import { type FilterState, RELEASED, dropFilter } from "~/domain/filter-state"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups } from "~/ui/filter-bar"
import { NotSeenSwitch } from "~/ui/filter-bar/controls"
import { type CardKey, cardOf, focusSheetOn } from "~/ui/filter-bar/filter-cards"
import { type ActiveChip, FILTER_ACCENTS, RELEASED_LABELS } from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { Chip, type Option, Segmented, ThresholdBar, byCount } from "~/ui/filter-bar/SheetControls"
import { SERVICES_PATH } from "~/ui/settings/paths"
import { goodwatchVibeIndex } from "~/utils/ratings"
import { type ProtoDiscover, TAGS, type Tag, tagId, type useFilterPieces } from "../kit"

export type Pieces = ReturnType<typeof useFilterPieces>
/** The one filter card open in place, anywhere on the surface. */
export type Open = CardKey | null

export const PRIVATE = "search-private ph-no-capture sentry-mask"
export const MOOD_TAGS = TAGS.filter((t) => t.group === "moods")
const FADE = "linear-gradient(to right, black calc(100% - 2.5rem), transparent)"

// ---------------------------------------------------------------------------------------------------------------
// Small shared bits

export function StaticTitle({ className = "" }: { className?: string }) {
	return (
		<h1 className={`brand-header text-[26px] leading-tight text-white lg:text-[34px] ${className}`}>
			Discover movies and TV shows
		</h1>
	)
}

/** Overlapping hue dots for the picked tags, or the first mood hues dimmed when nothing is picked. */
export function HueDots({ tags, size = 12 }: { tags: Tag[]; size?: number }) {
	const shown = tags.length ? tags.slice(0, 4) : MOOD_TAGS.slice(0, 4)
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			{shown.map((t, i) => (
				<span
					key={tagId(t)}
					className={`rounded-full ring-2 ring-gray-950 ${tags.length ? "" : "opacity-60"}`}
					style={{ width: size, height: size, background: t.color, marginLeft: i ? -size / 3 : 0 }}
				/>
			))}
		</span>
	)
}

/** The picked moods in one line: "Funny + Feel-good", "+1" past two. */
export function moodLabel(d: ProtoDiscover) {
	const moods = d.picked.filter((t) => t.group === "moods")
	if (!moods.length) return null
	const head = moods.slice(0, 2).map((t) => t.name).join(" + ")
	return moods.length > 2 ? `${head} +${moods.length - 2}` : head
}

const tagOption = (d: ProtoDiscover, t: Tag): Option => ({
	id: tagId(t),
	label: t.name,
	active: d.isOn(t),
	count: d.countFor(t),
	toggle: () => d.toggle(t),
	swatch: <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />,
})

/** The active values that belong to one card. */
const chipsOf = (pieces: Pieces, k: CardKey) => pieces.chips.filter((c) => cardOf(c.group) === k)

/** The state without one card's choice (as the card's own Clear does). */
function cleared(state: FilterState, k: CardKey): FilterState {
	if (k === "released") return dropFilter(dropFilter(state, "released"), "years")
	if (k === "type") return dropFilter(dropFilter(state, "type"), "anime")
	if (k === "ageLimit") return dropFilter(dropFilter(state, "ageLimit"), "content")
	return dropFilter(state, k)
}

function ClearLink({ onClick, label }: { onClick: () => void; label: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={`Clear ${label}`}
			className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			Clear
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// One real filter card, alone and without its header: the sheet's cards with every other card hidden.

export function OneCard({ pieces, k }: { pieces: Pieces; k: CardKey }) {
	// Read by the cards' first render: they start with this card shown.
	focusSheetOn(k)
	const css = `.oc-${k} > div > div.flex-col > *:not(:has(> #filter-card-${k})) { display: none }
.oc-${k} #filter-card-${k} { background: transparent; box-shadow: none; padding: 0; border-radius: 0 }
.oc-${k} #filter-card-${k} > div:first-child { display: none }`
	return (
		<div className={`oc-${k}`}>
			<style dangerouslySetInnerHTML={{ __html: css }} />
			<FilterGroups data={pieces.groups} query="" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The common tier: blocks.

function Block({
	title,
	dot,
	k,
	more,
	open,
	setOpen,
	pieces,
	set,
	onClear,
	className = "",
	expandedBody,
	wide = false,
	children,
}: {
	title: string
	dot: string
	k?: CardKey
	/** The label of the step to the full card, for example "All genres". */
	more?: string
	open: Open
	setOpen: (k: Open) => void
	pieces: Pieces
	set: boolean
	onClear?: () => void
	className?: string
	/** In place of the real card when expanded (Genre: every genre). */
	expandedBody?: ReactNode
	/** The expanded card takes the whole row (Streaming, always first in its row, so nothing moves up). */
	wide?: boolean
	children: ReactNode
}) {
	const expanded = !!k && open === k
	return (
		<section
			aria-label={title}
			className={`flex min-w-0 flex-col rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.07] ${expanded && wide ? "col-span-full" : ""} ${className}`}
		>
			<div className="mb-3 flex h-6 items-center gap-2">
				<span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
				<h3 className="truncate text-[15px] font-bold text-white">{title}</h3>
				{set && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-label="set" />}
				<span className="ml-auto flex shrink-0 items-center gap-0.5">
					{set && onClear && <ClearLink onClick={onClear} label={title} />}
					{k && more && (
						<button
							type="button"
							onClick={() => setOpen(expanded ? null : k)}
							aria-expanded={expanded}
							className="flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[12px] font-medium text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							{expanded ? "Less" : more}
							<ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
						</button>
					)}
				</span>
			</div>
			{expanded && k ? (
				<motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>
					{expandedBody ?? <OneCard pieces={pieces} k={k} />}
				</motion.div>
			) : (
				children
			)}
		</section>
	)
}

/** Every mood, with hue dots and what each would leave. */
export function MoodBlock({ d, id }: { d: ProtoDiscover; id?: string }) {
	const picks = d.picked.filter((t) => t.group === "moods")
	return (
		<section
			id={id}
			aria-label="Mood"
			className="col-span-full scroll-mt-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.07]"
		>
			<div className="mb-3 flex h-6 items-center gap-2">
				<HueDots tags={picks} size={12} />
				<h3 className="text-[15px] font-bold text-white">Mood</h3>
				<span className="text-[12px] text-gray-500">{picks.length ? `Any of these · ${picks.length} of 3` : "Up to 3"}</span>
				{picks.length > 0 && (
					<span className="ml-auto">
						<ClearLink
							label="Mood"
							onClick={() => {
								for (const t of picks) d.toggle(t)
							}}
						/>
					</span>
				)}
			</div>
			<div className="flex flex-wrap gap-1.5">
				{MOOD_TAGS.map((t) => (
					<span key={tagId(t)} title={t.description}>
						<Chip o={tagOption(d, t)} />
					</span>
				))}
			</div>
		</section>
	)
}

/** TMDB gives shows their own combined genres; each folds into the movie genre it names (as the Genre card does). */
const GENRE_FOLDS: { label: string; names: string[] }[] = [
	{ label: "Action", names: ["Action", "Action & Adventure"] },
	{ label: "Adventure", names: ["Adventure", "Action & Adventure"] },
	{ label: "Sci-Fi", names: ["Science Fiction", "Sci-Fi & Fantasy"] },
	{ label: "Fantasy", names: ["Fantasy", "Sci-Fi & Fantasy"] },
	{ label: "War", names: ["War", "War & Politics"] },
]
const FOLDED = new Set(GENRE_FOLDS.flatMap((f) => f.names))

function genreOptions(d: ProtoDiscover): Option[] {
	const { state } = d.filters
	const all = Object.keys(d.counts?.optionCounts.genres ?? {})
	for (const g of state.genres) if (!all.includes(g)) all.push(g)
	const c = (n: string) => d.counts?.optionCounts.genres?.[n] ?? null
	const units = [
		...GENRE_FOLDS.filter((f) => f.names.some((n) => all.includes(n))),
		...all.filter((n) => !FOLDED.has(n)).map((n) => ({ label: n, names: [n] })),
	]
	const isOn = (u: { names: string[] }) => state.genres.includes(u.names[0])
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

const SCORE_STEPS = [
	{ v: 0, label: "Any" },
	{ v: 60, label: "60+" },
	{ v: 70, label: "70+" },
	{ v: 80, label: "80+" },
]

/** Two chip lines at most, so a block keeps its height. */
const TWO_LINES = "flex h-[70px] flex-wrap content-start gap-1.5 overflow-hidden"

export function CommonBlocks({
	d,
	pieces,
	open,
	setOpen,
	className = "",
	moodId,
}: {
	d: ProtoDiscover
	pieces: Pieces
	open: Open
	setOpen: (k: Open) => void
	className?: string
	moodId?: string
}) {
	const navigate = useNavigate()
	const { state } = d.filters
	const oc = d.counts?.optionCounts
	const shared = { open, setOpen, pieces }
	const has = (k: CardKey) => chipsOf(pieces, k).length > 0
	const clear = (k: CardKey) => () => d.filters.update((s) => cleared(s, k))
	const genres = byCount(genreOptions(d))
	const genreHead = genres.slice(0, Math.max(7, genres.filter((o) => o.active).length))
	const years = chipsOf(pieces, "released").find((c) => c.group === "years")
	const streaming = state.onMyServices ? "mine" : state.anyService || state.services?.length ? "picked" : "everywhere"
	const picked = state.services?.length ? `${state.services.length} picked` : "Any service"
	return (
		<div className={`grid gap-3 ${className}`}>
			<MoodBlock d={d} id={moodId} />
			<Block
				{...shared}
				title="Streaming"
				dot={FILTER_ACCENTS.services.dot}
				k="services"
				more="Pick services"
				wide
				set={state.onMyServices || !!state.anyService || !!state.services?.length}
			>
				<div className="flex">
					<Segmented
						label="Where to watch"
						value={streaming}
						onChange={(v) =>
							v === "mine"
								? pieces.hasServices
									? pieces.servicesProps.onChange(true)
									: navigate(SERVICES_PATH)
								: v === "everywhere"
									? pieces.servicesProps.onChange(false)
									: setOpen("services")
						}
						options={[
							{ id: "mine" as const, label: pieces.hasServices ? "My services" : "Add mine" },
							{ id: "everywhere" as const, label: "Everywhere" },
							...(streaming === "picked" ? [{ id: "picked" as const, label: picked }] : []),
						]}
					/>
				</div>
			</Block>
			<Block {...shared} title="Not seen yet" dot={FILTER_ACCENTS.notSeenYet.dot} set={state.notSeenYet}>
				<div className="flex">
					<NotSeenSwitch {...pieces.notSeenProps} size="sm" className="w-full" />
				</div>
			</Block>
			<Block
				{...shared}
				title="Movies or shows"
				dot={FILTER_ACCENTS.type.dot}
				k="type"
				more="Anime"
				set={has("type")}
				onClear={clear("type")}
			>
				<div className="flex">
					<Segmented
						label="Movies or shows"
						value={state.type}
						onChange={(type) => d.filters.set({ type })}
						options={(["all", "movie", "show"] as const).map((id) => ({
							id,
							label: id === "all" ? "Both" : id === "movie" ? "Movies" : "Shows",
						}))}
					/>
				</div>
			</Block>
			<Block
				{...shared}
				title="Genre"
				dot={FILTER_ACCENTS.genres.dot}
				k="genres"
				more={`All ${genres.length || ""}`.trim()}
				set={has("genres")}
				onClear={clear("genres")}
				expandedBody={
					<div className="flex flex-wrap gap-1.5">
						{genres.map((o) => (
							<Chip key={o.id} o={o} />
						))}
					</div>
				}
			>
				<div className={TWO_LINES}>
					{genreHead.map((o) => (
						<Chip key={o.id} o={o} />
					))}
				</div>
			</Block>
			<Block
				{...shared}
				title="Score"
				dot={FILTER_ACCENTS.minScore.dot}
				set={has("minScore")}
				onClear={clear("minScore")}
			>
				<ThresholdBar
					label="Score"
					steps={SCORE_STEPS}
					value={state.minScore}
					onChange={(minScore) => d.filters.set({ minScore: minScore as FilterState["minScore"] })}
					color={(v) => `bg-vibe-${goodwatchVibeIndex(v)}`}
					counts={(v) => oc?.minScore?.[String(v)] ?? null}
				/>
			</Block>
			<Block
				{...shared}
				title="Released"
				dot={FILTER_ACCENTS.released.dot}
				k="released"
				more="Years"
				set={has("released")}
				onClear={clear("released")}
			>
				<div className={TWO_LINES}>
					{years && (
						<Chip o={{ id: "years", label: years.label, active: true, count: null, toggle: () => setOpen("released") }} />
					)}
					{RELEASED.filter((r) => r !== "any").map((r) => (
						<Chip
							key={r}
							o={{
								id: r,
								label: RELEASED_LABELS[r],
								active: state.released === r,
								count: oc?.released?.[r] ?? null,
								toggle: () => d.filters.set({ released: state.released === r ? "any" : r }),
							}}
						/>
					))}
				</div>
			</Block>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The niche tier: a compact index.

const NICHE: { k: CardKey; title: string }[] = [
	{ k: "themes", title: "About" },
	{ k: "styles", title: "Style" },
	{ k: "runtime", title: "Length" },
	{ k: "minMatch", title: "Taste match" },
	{ k: "sourceScores", title: "Scores by source" },
	{ k: "scoreGap", title: "Critics vs audiences" },
	{ k: "similarTo", title: "Similar to" },
	{ k: "people", title: "Cast and crew" },
	{ k: "productionCountries", title: "Production country" },
	{ k: "ageLimit", title: "Age and content" },
	{ k: "loved", title: "Loved" },
	{ k: "disliked", title: "Disliked" },
]

/** How many niche filters are set. */
export const nicheCount = (pieces: Pieces) => NICHE.filter((n) => chipsOf(pieces, n.k).length > 0).length

const valueText = (chips: ActiveChip[]) =>
	chips
		.map((c) => c.label.replace(/^(About|Style|Theme|Similar to|Loved|Disliked|With|Produced in) /, ""))
		.join(", ")

function NicheRow({
	d,
	pieces,
	k,
	title,
	open,
	setOpen,
}: {
	d: ProtoDiscover
	pieces: Pieces
	k: CardKey
	title: string
	open: Open
	setOpen: (k: Open) => void
}) {
	const chips = chipsOf(pieces, k)
	const expanded = open === k
	const value = valueText(chips)
	return (
		<div id={`niche-${k}`} className="border-b border-white/[0.06] last:border-b-0">
			<div className="flex h-11 items-center">
				<button
					type="button"
					onClick={() => setOpen(expanded ? null : k)}
					aria-expanded={expanded}
					className="group flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${FILTER_ACCENTS[k].dot} ${value ? "" : "opacity-50"}`} />
					<span className={`shrink-0 text-[14px] ${value || expanded ? "font-semibold text-white" : "text-gray-300 group-hover:text-white"}`}>
						{title}
					</span>
					<span className={`min-w-0 flex-1 truncate text-right text-[13px] ${value ? "text-amber-200/90" : "text-gray-600"}`}>
						{value || "Any"}
					</span>
					<ChevronDownIcon
						className={`h-4 w-4 shrink-0 text-gray-600 transition-transform group-hover:text-gray-300 ${expanded ? "rotate-180" : ""}`}
					/>
				</button>
				{value && (
					<button
						type="button"
						onClick={() => d.filters.update((s) => cleared(s, k))}
						aria-label={`Clear ${title}`}
						className="ml-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md text-gray-500 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
				)}
			</div>
			<AnimatePresence initial={false}>
				{expanded && (
					<motion.div
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.14 }}
						className="px-1 pt-1 pb-4"
					>
						<OneCard pieces={pieces} k={k} />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

/** The niche filters in `columns` columns (filled top to bottom, so opening a row never moves the other column). */
export function NicheIndex({
	d,
	pieces,
	open,
	setOpen,
	columns = 1,
	id,
	title = "More filters",
}: {
	d: ProtoDiscover
	pieces: Pieces
	open: Open
	setOpen: (k: Open) => void
	columns?: 1 | 2
	id?: string
	title?: string
}) {
	const rows = NICHE.filter((n) => n.k !== "ageLimit" || pieces.groups.ladder)
	const split = columns === 2 ? [rows.slice(0, Math.ceil(rows.length / 2)), rows.slice(Math.ceil(rows.length / 2))] : [rows]
	const n = nicheCount(pieces)
	return (
		<section id={id} aria-label={title} className="scroll-mt-4">
			<h3 className="mb-1 flex h-6 items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-gray-500 uppercase">
				{title}
				{n > 0 && (
					<span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] tabular-nums text-gray-950">
						{n}
					</span>
				)}
				<span className="h-px flex-1 bg-white/[0.07]" />
			</h3>
			<div className={columns === 2 ? "grid gap-x-8 sm:grid-cols-2" : ""}>
				{split.map((col, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed columns
					<div key={i} className="min-w-0">
						{col.map((r) => (
							<NicheRow key={r.k} d={d} pieces={pieces} k={r.k} title={r.title} open={open} setOpen={setOpen} />
						))}
					</div>
				))}
			</div>
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The mood search as a filter value, and the status line.

/** The set mood search: its text, how it was read, and × to remove it. */
export function QueryValue({ d, onEdit }: { d: ProtoDiscover; onEdit?: () => void }) {
	if (!d.q) return null
	return (
		<span className="flex shrink-0 items-center gap-2 [&_ul]:flex-nowrap">
			<span className="inline-flex h-9 shrink-0 items-center rounded-full bg-amber-400/[0.12] ring-1 ring-inset ring-amber-400/40">
				<button
					type="button"
					onClick={onEdit}
					className={`flex h-full max-w-[16rem] items-center gap-1.5 pr-1 pl-3 text-sm font-semibold text-amber-100 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-l-full ${PRIVATE}`}
				>
					<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
					<span className="truncate">{d.q}</span>
				</button>
				<button
					type="button"
					onClick={() => d.setQ(null)}
					aria-label="Remove the mood search"
					className="grid h-full w-8 place-items-center rounded-r-full text-amber-300/70 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-3.5 w-3.5" />
				</button>
			</span>
			{d.searchBusy && !d.reading.length ? (
				<span className="text-xs text-gray-500">Reading…</span>
			) : (
				d.reading.length > 0 && (
					<span className="flex shrink-0 items-center gap-1.5">
						<span className="text-xs text-gray-500">Read as</span>
						<ReadAsChips reading={d.reading} />
					</span>
				)
			)}
		</span>
	)
}

const colorOf = (chip: ActiveChip) => {
	const m = chip.key.match(/^(mood|theme|style)-(.+)$/)
	if (!m) return undefined
	const group = m[1] === "mood" ? "moods" : m[1] === "theme" ? "themes" : "styles"
	return TAGS.find((t) => t.group === group && t.key === m[2])?.color
}

/** An active value: its hue (tags) or its filter's dot, and × to take it off. */
export function ValueChip({ chip, onRemove }: { chip: ActiveChip; onRemove: () => void }) {
	const color = colorOf(chip)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onRemove}
			aria-label={`Remove ${chip.label}`}
			className={`group inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full pr-2.5 pl-3 text-sm outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${color ? "font-semibold text-white" : "bg-white/[0.06] text-gray-100 hover:bg-white/10"}`}
			style={color ? { background: `${color}2e`, boxShadow: `inset 0 0 0 1px ${color}99` } : undefined}
		>
			{color ? (
				<span className="h-2 w-2 rounded-full" style={{ background: color }} />
			) : (
				<span className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS[chip.group].dot}`} />
			)}
			{chip.label.replace(/^Produced in /, "Made in ")}
			<XMarkIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-white" aria-hidden />
		</motion.button>
	)
}

/**
 * The one line under the bar: the count, the mood search as a value, every active filter, Clear all. `lead` goes
 * before the values (the phone's essentials), `trail` at the far right (the phone's sort).
 */
export function StatusLine({
	d,
	pieces,
	onEditQuery,
	lead,
	trail,
	className = "",
}: {
	d: ProtoDiscover
	pieces: Pieces
	onEditQuery?: () => void
	lead?: ReactNode
	trail?: ReactNode
	className?: string
}) {
	const values = pieces.chips.filter((c) => c.key !== "services")
	const searching = d.q !== null
	return (
		<div className={`flex h-11 items-center gap-3 ${className}`}>
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
				className="-mr-4 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-8 [scrollbar-width:none] lg:mr-0 [&::-webkit-scrollbar]:hidden"
				style={{ maskImage: FADE, WebkitMaskImage: FADE }}
			>
				{lead}
				{(d.q || values.length > 0) && lead && <span aria-hidden className="h-5 w-px shrink-0 bg-white/10" />}
				<QueryValue d={d} onEdit={onEditQuery} />
				{values.map((chip) => (
					<ValueChip key={chip.key} chip={chip} onRemove={() => d.filters.update((s) => chip.remove(s))} />
				))}
				{values.length > 1 && (
					<button
						type="button"
						onClick={d.filters.clearSecondary}
						className="shrink-0 px-1 text-sm text-gray-500 cursor-pointer hover:text-white"
					>
						Clear all
					</button>
				)}
			</div>
			{trail}
		</div>
	)
}
