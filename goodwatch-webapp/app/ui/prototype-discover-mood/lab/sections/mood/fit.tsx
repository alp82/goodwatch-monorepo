// PROTOTYPE (Discover lab, mood e-h): shared helpers for round 7's mood variants. The recipe line (copied from d,
// which keeps it private), c's folding shelf (copied too), one row model for every choice in the tab with its honest
// remaining count, and the tags that would narrow the current picks.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type ReactNode } from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import { type ProtoDiscover, type Tag, tagId } from "../../../kit"
import { MOOD_CHOICES, PickCount, type Moods, STYLE_TAGS, THEME_TAGS, clearAll, genreOptions, islandOfTag, tagName, tagTap } from "./parts"

// ---------------------------------------------------------------------------------------------------------------
// One row model for every choice

export type FitKind = "moods" | "themes" | "styles" | "genres"

export interface FitRow {
	id: string
	kind: FitKind
	name: string
	color: string
	on: boolean
	/** Picking it would leave nothing, or the mood slots are full. */
	dead: boolean
	/** Titles it would leave (everything else unchanged); null for a search mood or while counting. */
	n: number | null
	/** Short count or delta for the row's end. */
	short: string
	search: boolean
	/** Explorer island for its picture. */
	island: string | null
	toggle: () => void
	title?: string
}

const GENRE_GRAY = "#9ca3af"

export function fitRows(d: ProtoDiscover, m: Moods): FitRow[] {
	const moods: FitRow[] = MOOD_CHOICES.map((c) => {
		const tap = m.tap(c)
		const on = m.isOn(c)
		return {
			id: `mood:${c.id}`,
			kind: "moods",
			name: c.name,
			color: c.color,
			on,
			dead: !on && (m.full || tap.none),
			n: c.tag ? d.countFor(c.tag) : null,
			short: tap.short,
			search: tap.search,
			island: `mood:${c.id}`,
			toggle: () => m.toggle(c),
			title: c.alias ? `Discover's ${c.alias} filter` : c.word ? `Adds "${c.word}" to the search` : undefined,
		}
	})
	const tagRow = (t: Tag): FitRow => {
		const tap = tagTap(d, t)
		const on = d.isOn(t)
		return {
			id: tagId(t),
			kind: t.group,
			name: t.name,
			color: t.color,
			on,
			dead: !on && tap.none,
			n: d.countFor(t),
			short: tap.short,
			search: false,
			island: islandOfTag(t),
			toggle: () => d.toggle(t),
		}
	}
	const genres: FitRow[] = genreOptions(d).map((o) => ({
		id: `genre:${o.id}`,
		kind: "genres",
		name: o.label,
		color: GENRE_GRAY,
		on: o.active,
		dead: !o.active && o.count === 0,
		n: o.count,
		short: o.count !== null ? compactCount(o.count) : "",
		search: false,
		island: null,
		toggle: o.toggle,
	}))
	return [...moods, ...THEME_TAGS.map(tagRow), ...STYLE_TAGS.map(tagRow), ...genres]
}

/** Picks first, then what leaves the most, then search moods (no count) last. */
export const byFit = (rows: FitRow[]) =>
	[...rows].sort(
		(a, b) => Number(b.on) - Number(a.on) || Number(a.dead) - Number(b.dead) || (b.n ?? -1) - (a.n ?? -1) || a.name.localeCompare(b.name),
	)

// ---------------------------------------------------------------------------------------------------------------
// The recipe line (copied from d)

function Part({ children, onRemove, color }: { children: ReactNode; onRemove: () => void; color?: string }) {
	return (
		<motion.button
			layout
			type="button"
			onClick={onRemove}
			initial={{ opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			className="group inline-flex cursor-pointer items-baseline gap-1 rounded-md px-1 font-bold text-white decoration-2 underline-offset-4 hover:bg-white/[0.08]"
			style={{ textDecorationColor: color, textDecorationLine: "underline" }}
			aria-label="Remove"
		>
			{children}
			<XMarkIcon className="h-3.5 w-3.5 self-center text-gray-500 group-hover:text-white" aria-hidden />
		</motion.button>
	)
}

export type Within = "or" | "and" | ((group: FitKind) => "or" | "and")

export function RecipeLine({
	d,
	m,
	size = "text-[19px]",
	within = "or",
	total = d.total,
}: {
	d: ProtoDiscover
	m: Moods
	size?: string
	/** How picks of one group join: "or" (Discover today), "and" (mood i), or per group (k, round 13). */
	within?: Within
	/** The count to lead with; Discover's own by default. */
	total?: number | null
}) {
	const s = d.filters.state
	const w = (g: FitKind) => (typeof within === "function" ? within(g) : within)
	const of = (g: Tag["group"]) => d.picked.filter((t) => t.group === g)
	const moods = of("moods")
	const styles = of("styles")
	const themes = of("themes")
	const noun = s.type === "movie" ? "movies" : s.type === "show" ? "shows" : "titles"
	const join = (items: ReactNode[], word: string) =>
		items.flatMap((it, i) => (i === 0 ? [it] : [<span key={`j${i}`} className="text-gray-400"> {word} </span>, it]))
	const tagParts = (tags: Tag[]) =>
		tags.map((t) => (
			<Part key={t.key} onRemove={() => d.toggle(t)} color={t.color}>
				{tagName(t)}
			</Part>
		))
	const groups: ReactNode[] = []
	if (moods.length) groups.push(<span key="moods">{join(tagParts(moods), w("moods"))}</span>)
	if (m.words.length)
		groups.push(
			<span key="words">
				{join(
					m.words.map((c) => (
						<Part key={c.id} onRemove={() => m.toggle(c)} color={c.color}>
							{c.name}
						</Part>
					)),
					"and",
				)}
			</span>,
		)
	if (styles.length) groups.push(<span key="styles">{join(tagParts(styles), w("styles"))}</span>)
	if (themes.length)
		groups.push(
			<span key="about">
				<span className="text-gray-400">about </span>
				{join(
					themes.map((t) => (
						<Part key={t.key} onRemove={() => d.toggle(t)} color={t.color}>
							{t.name.toLowerCase()}
						</Part>
					)),
					w("themes"),
				)}
			</span>,
		)
	if (s.genres.length)
		groups.push(
			<span key="genre">
				<span className="text-gray-400">in </span>
				<Part onRemove={() => d.filters.set({ genres: [] })}>
					{genreOptions(d)
						.filter((o) => o.active)
						.map((o) => o.label)
						.join(` ${w("genres")} `)}
				</Part>
			</span>,
		)
	const genreN = genreOptions(d).filter((o) => o.active).length
	return (
		<div className="flex min-h-10 min-w-0 items-center gap-3">
			<p className={`min-w-0 flex-1 truncate leading-tight text-gray-300 ${size}`}>
				<span className="font-bold tabular-nums text-white">{total === null ? "…" : total.toLocaleString("en")}</span> {noun}
				{groups.length > 0 && (
					<>
						{" "}
						that are{" "}
						{groups.flatMap((g, i) => (i === 0 ? [g] : [<span key={`c${i}`} className="text-gray-400">, </span>, g]))}
					</>
				)}
			</p>
			<PickCount n={d.picked.length + m.words.length + genreN} m={m} />
			{groups.length > 0 && (
				<button
					type="button"
					onClick={() => {
						clearAll(d, m)
						if (s.genres.length) d.filters.set({ genres: [] })
					}}
					className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-sm font-semibold text-gray-200 hover:bg-white/10"
				>
					Clear
				</button>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// c's shelf: Moods, About, Style, Genre folded, one open at a time (copied from c)

// ---------------------------------------------------------------------------------------------------------------
// A bar that shows how much a choice leaves: scaleX only, so changes animate on the compositor

export function LeaveBar({ n, of, color, on }: { n: number | null; of: number; color: string; on: boolean }) {
	if (n === null || of <= 0) return null
	return (
		<span
			className="absolute inset-y-0 left-0 w-full origin-left rounded-md transition-transform duration-300 ease-out motion-reduce:transition-none"
			style={{ transform: `scaleX(${Math.min(1, n / of)})`, background: `${color}${on ? "45" : "24"}` }}
			aria-hidden
		/>
	)
}
