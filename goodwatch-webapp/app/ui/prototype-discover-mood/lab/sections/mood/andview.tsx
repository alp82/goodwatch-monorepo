// PROTOTYPE (Discover lab, mood i, j, k): i's AND pieces, shared. The rows with AND counts, the four columns, the
// recipe row with Find a filter on its right (the shell drops its own row: ownFind), and e's mix cards with AND counts.
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps, Viewer } from "../../types"
import { type AndCounts, type Cond, MAX_AND, picksOf, useAndCounts } from "./and"
import { ColumnHead, ColumnRows } from "./columns"
import { DROP_FROM, MEMBER_MIXES } from "./e"
import { type FitRow, RecipeLine, byFit, fitRows } from "./fit"
import { COLUMNS } from "./g"
import { ArtTile, type DropStep, MIXES, MOOD_CHOICES, type Mix, type Moods, WithoutRow, type WorldArt, genreUnits, mixName, showDrops, useMixes, useMoods } from "./parts"

/** The condition a row stands for; null for a search mood (a word in the search, ANDed by the search itself). */
function condOf(d: ProtoDiscover, r: FitRow): Cond | null {
	if (r.kind === "moods") {
		const t = MOOD_CHOICES.find((c) => `mood:${c.id}` === r.id)?.tag
		return t ? { group: "moods", id: t.key, values: [t.key] } : null
	}
	if (r.kind === "genres") {
		const u = genreUnits(d).find((x) => `genre:${x.label}` === r.id)
		return u ? { group: "genres", id: u.label, values: u.names } : null
	}
	return { group: r.kind, id: r.id.slice(r.id.indexOf(":") + 1), values: [r.id.slice(r.id.indexOf(":") + 1)] }
}

function andRows(d: ProtoDiscover, m: Moods, counts: AndCounts | null, picks: Cond[]): FitRow[] {
	const capped = picks.length >= MAX_AND
	return fitRows(d, m).map((r) => {
		const c = condOf(d, r)
		if (!c) return r
		if (r.on) return { ...r, n: counts?.total ?? null, short: "" }
		const n = counts ? counts.adding(c) : null
		const full = capped || (r.kind === "moods" && m.full)
		return { ...r, n, short: n === null ? "" : compactCount(n), dead: full || n === 0, toggle: full ? () => {} : r.toggle }
	})
}

function labelOf(d: ProtoDiscover, c: Cond) {
	if (c.group === "genres") return c.id
	if (c.group === "moods") return MOOD_CHOICES.find((x) => x.tag?.key === c.id)?.name ?? d.picked.find((t) => t.key === c.id)?.name ?? c.id
	return d.picked.find((t) => t.group === c.group && t.key === c.id)?.name ?? c.id
}

function dropCond(d: ProtoDiscover, c: Cond) {
	if (c.group === "genres") return d.filters.set({ genres: d.filters.state.genres.filter((g) => !c.values.includes(g)) })
	const t = d.picked.find((x) => x.group === c.group && x.key === c.id)
	if (t) d.toggle(t)
}

/** Everything i, j and k read: the moods, the picks, the exact AND counts and the rows with them. */
export function useAnd(d: ProtoDiscover) {
	const m = useMoods(d)
	const picks = picksOf(d)
	const { counts } = useAndCounts(d, picks)
	const rows = andRows(d, m, counts, picks)
	return { m, picks, counts, rows, total: counts?.total ?? null }
}
export type And = ReturnType<typeof useAnd>

/** The recipe line with Find a filter at its right (phones: under it). */
export function RecipeRow({ d, a, find, phone, right }: { d: ProtoDiscover; a: And; find: SectionProps["find"]; phone: boolean; right?: ReactNode }) {
	if (phone)
		return (
			<div className="flex flex-col gap-3">
				<RecipeLine d={d} m={a.m} size="text-[17px]" within="and" total={a.total} />
				{right}
				{find?.field}
			</div>
		)
	return (
		<div className="flex shrink-0 items-center gap-4">
			<div className="min-w-0 flex-1">
				<RecipeLine d={d} m={a.m} within="and" total={a.total} />
			</div>
			{right}
			<div className={`${right ? "w-[260px]" : "w-[300px]"} shrink-0`}>{find?.field}</div>
		</div>
	)
}

/** i's four columns (Feel, About, Style, Genre), or Find a filter's results in their place. */
export function AndColumns({ a, find, phone }: { a: And; find: SectionProps["find"]; phone: boolean }) {
	if (find?.results) return phone ? <div>{find.results}</div> : <div className="-mx-6 min-h-0 flex-1">{find.results}</div>
	const of = Math.max(a.total ?? 0, 1)
	const columns = COLUMNS.map((c) => {
		const rows = byFit(a.rows.filter((r) => r.kind === c.kind))
		const picked = rows.filter((r) => r.on).length
		return (
			<div key={c.kind} className={`flex min-h-0 min-w-0 flex-col gap-1.5 ${phone ? "" : "flex-1"}`}>
				<ColumnHead kind={c.kind} label={c.label} picked={picked} note={picked > 1 ? "all of" : undefined} />
				<ColumnRows rows={rows} of={of} phone={phone} />
			</div>
		)
	})
	if (phone) return <div className="flex flex-col gap-4">{columns}</div>
	return <div className="flex min-h-0 flex-1 gap-5">{columns}</div>
}

// ---------------------------------------------------------------------------------------------------------------
// e's mix cards, with AND counts

interface Card {
	id: string
	name: string
	hues: string[]
	/** Its picture's explorer island; a ready mix brings its own top title's picture. */
	island: string | null
	n: number | null
	/** Share of the list a narrowing card keeps; null for the others. */
	share: number | null
	on: boolean
	line: string | null
	tap: () => void
	/** A ready mix's own picture (its top title's). */
	path?: string | null
}

const readyMixes = (viewer: Viewer): Mix[] => (viewer === "member" ? MEMBER_MIXES : MIXES)

/**
 * Ready mixes while nothing is picked; then "+ X" (the choices that narrow the most, any group, since picks AND),
 * then ready mixes. Only cards with titles. From three picks, when the "+ X" cards leave a full row free, "Without X"
 * (what dropping a pick brings back) comes last as slim removal tiles.
 */
export function useCards(d: ProtoDiscover, a: And, viewer: Viewer, slots: number, cols: number, onMix?: () => void): { cards: Card[]; drops: DropStep[] } {
	const ready = readyMixes(viewer)
	const x = useMixes(d, ready)
	const mixCards = ready.map(
		(mix, i): Card => ({
			id: mix.id,
			name: mixName(mix),
			hues: mix.tags.map((t) => t.color),
			island: null,
			n: x.count(i).total,
			share: null,
			on: x.isOn(mix),
			line: x.count(i).top ? `Like ${x.count(i).top}` : null,
			tap: () => {
				x.toggle(mix)
				if (!x.isOn(mix)) onMix?.()
			},
			path: x.count(i).path,
		}),
	)
	// Cards that lead nowhere go; ready mixes fill what's left without a count (also when nothing leads anywhere).
	const fill = (lead: Card[]) => {
		const shown = new Set(lead.map((c) => c.id))
		// The mix that's on goes last: ticked, a way back.
		const rest = mixCards.filter((c) => !shown.has(c.id)).sort((p, q) => Number(p.on) - Number(q.on))
		return [...lead, ...rest.map((c) => ({ ...c, n: null, line: null }))].slice(0, slots)
	}
	const leads = (c: Card) => (c.n === null ? a.total !== 0 : c.n > 0)
	if (!a.picks.length && !a.m.used) return { cards: fill(mixCards.filter(leads)), drops: [] }
	const total = a.total
	const adds = a.rows
		.filter((r) => r.kind !== "genres" && !r.on && !r.dead && !r.search && r.n !== null && r.n > 0 && (total === null || r.n < total))
		.sort((p, q) => (q.n ?? 0) - (p.n ?? 0))
		.map(
			(r): Card => ({
				id: `add:${r.id}`,
				name: `+ ${r.name}`,
				hues: [r.color, d.picked[0]?.color ?? r.color],
				island: r.island,
				n: r.n,
				share: total ? (r.n ?? 0) / total : null,
				on: false,
				line: null,
				tap: r.toggle,
			}),
		)
	// "Without X" only from three picks (e's DROP_FROM); its count is what it brings back.
	const drops = (a.picks.length + a.m.words.length >= DROP_FROM ? a.picks : [])
		.map(
			(c): DropStep => ({
				id: `drop:${c.group}:${c.id}`,
				name: labelOf(d, c),
				color: c.group === "genres" ? "#9ca3af" : (d.picked.find((t) => t.group === c.group && t.key === c.id)?.color ?? "#9ca3af"),
				n: a.counts && total !== null ? a.counts.without(c) - total : null,
				tap: () => dropCond(d, c),
			}),
		)
		.filter((s) => s.n === null || s.n > 0)
		.sort((p, q) => (q.n ?? 0) - (p.n ?? 0))
	return { cards: fill([...adds, ...mixCards.filter((c) => !c.on)].filter(leads)), drops: showDrops(adds.length, drops.length, slots, cols) ? drops : [] }
}

/**
 * The cards in a grid of `rows` fixed heights. `small`: j's short tiles. With removal tiles the last row holds them
 * (k: compact cards over one slim row of them, so the grid keeps its height).
 */
export function MixCards({
	d,
	cards,
	drops,
	art,
	cols,
	rows,
	slimRows,
	small = false,
}: {
	d: ProtoDiscover
	cards: Card[]
	drops: DropStep[]
	art: WorldArt
	cols: number
	/** grid-template-rows without and with removal tiles. */
	rows: string
	slimRows: string
	small?: boolean
}) {
	const slim = drops.length > 0
	// j's row is already short: the removal tiles take the whole last row there.
	const shown = slim && small ? cards.slice(0, cards.length - cols) : cards
	return (
		<div className={`grid shrink-0 gap-2 ${slim ? slimRows : rows}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
			{shown.map((card, i) => {
				const compact = slim && !small && i >= cards.length - cols
				const bare = compact && cols === 2
				const tiny = small || compact
				const foot =
					card.n === null || bare ? "" : card.share !== null && d.total !== null && !tiny ? `${card.n.toLocaleString("en")} left` : `${card.n.toLocaleString("en")} titles`
				const path = card.path ?? (card.island ? (art.get(card.island)?.path ?? null) : null)
				return (
					<motion.div key={card.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.02 }} className="relative flex min-w-0">
						<ArtTile
							name={card.name}
							line={tiny ? null : card.line}
							hues={card.hues}
							path={path}
							on={card.on}
							foot={foot}
							onClick={card.tap}
							small={tiny}
							className={`h-full w-full ${bare ? "py-1.5" : ""}`}
						/>
						{card.share !== null && !bare && (
							<span className="pointer-events-none absolute inset-x-2.5 bottom-1.5 h-[3px] overflow-hidden rounded-full bg-white/15" aria-hidden>
								<span
									className="block h-full w-full origin-left rounded-full bg-white/80 transition-transform duration-300 motion-reduce:transition-none"
									style={{ transform: `scaleX(${Math.min(1, card.share)})` }}
								/>
							</span>
						)}
					</motion.div>
				)
			})}
			{slim && (
				<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="col-span-full min-w-0">
					<WithoutRow drops={drops} cols={cols} className="h-full" />
				</motion.div>
			)}
		</div>
	)
}
