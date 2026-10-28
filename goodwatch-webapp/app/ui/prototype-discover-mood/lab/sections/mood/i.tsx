// PROTOTYPE (Discover lab, mood i): g with every choice ANDed, also within a group: Funny and Cozy means titles that
// are both. Discover's filter matches any of a group's picks, so the panel counts the AND itself (and.ts: exact, from
// Discover's own results with every other filter) and shows the AND list's top posters in its own column. The grid
// under the panel still shows Discover's list. Five picks at most.
import { compactCount } from "~/ui/filter-bar/labels"
import type { SectionProps } from "../../types"
import { type AndCounts, type Cond, MAX_AND, picksOf, useAndCounts, useAndPosters } from "./and"
import { ColumnHead, ColumnRows } from "./columns"
import { type FitRow, LeaveBar, RecipeLine, byFit, fitRows } from "./fit"
import { COLUMNS } from "./g"
import { MOOD_CHOICES, type Moods, TypeSwitch, genreUnits, useMoods } from "./parts"
import { Posters } from "./posters"
import type { ProtoDiscover } from "../../../kit"

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

/** The AND list's top posters; at a dead end, each pick with what dropping it brings back. */
function Matches({ d, counts, picks, phone }: { d: ProtoDiscover; counts: AndCounts | null; picks: Cond[]; phone: boolean }) {
	const posters = useAndPosters(d, picks)
	const total = counts?.total ?? null
	const dead = total === 0 && picks.length > 0
	const head = <ColumnHead label="Top titles" picked={0} note={total === null ? undefined : total.toLocaleString("en")} />
	if (dead) {
		const ways: FitRow[] = picks.map((c) => ({
			id: `without:${c.group}:${c.id}`,
			kind: c.group,
			name: `Without ${labelOf(d, c)}`,
			color: "#9ca3af",
			on: false,
			dead: false,
			n: counts?.without(c) ?? null,
			short: compactCount(counts?.without(c) ?? 0),
			search: false,
			island: null,
			toggle: () => dropCond(d, c),
		}))
		const of = Math.max(1, ...ways.map((w) => w.n ?? 0))
		return (
			<div className={`flex min-h-0 flex-col gap-1.5 ${phone ? "" : "w-[264px] shrink-0"}`}>
				{head}
				<div className="flex flex-col gap-0.5">
					{byFit(ways).map((w) => (
						<button
							key={w.id}
							type="button"
							onClick={w.toggle}
							className="relative flex h-[26px] w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 text-left text-[13px] text-gray-200 outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<LeaveBar n={w.n} of={of} color="#9ca3af" on={false} />
							<span className="relative min-w-0 flex-1 truncate">{w.name}</span>
							<span className="relative text-[11px] tabular-nums text-gray-400">{w.short}</span>
						</button>
					))}
				</div>
			</div>
		)
	}
	return (
		<div className={`flex min-h-0 flex-col gap-1.5 ${phone ? "" : "w-[264px] shrink-0"}`}>
			{head}
			<Posters cards={posters.cards} slots={phone ? 5 : 6} className={phone ? "grid-cols-5" : "grid-cols-3"} busy={posters.busy} />
		</div>
	)
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

export function MoodI({ d, phone }: SectionProps) {
	const m = useMoods(d)
	const picks = picksOf(d)
	const { counts } = useAndCounts(d, picks)
	const all = andRows(d, m, counts, picks)
	const columns = COLUMNS.map((c) => {
		const rows = byFit(all.filter((r) => r.kind === c.kind))
		const picked = rows.filter((r) => r.on).length
		const of = Math.max(counts?.total ?? 0, 1)
		return (
			<div key={c.kind} className={`flex min-h-0 min-w-0 flex-col gap-1.5 ${phone ? "" : "flex-1"}`}>
				<ColumnHead kind={c.kind} label={c.label} picked={picked} note={picked > 1 ? "all of" : undefined} />
				<ColumnRows rows={rows} of={of} phone={phone} />
			</div>
		)
	})
	const total = counts?.total ?? null
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<RecipeLine d={d} m={m} size="text-[17px]" within="and" total={total} />
				<Matches d={d} counts={counts} picks={picks} phone />
				<div className="flex">
					<TypeSwitch d={d} count={(o) => counts?.option("type", o) ?? null} />
				</div>
				{columns}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col gap-3 px-6 py-3">
			<div className="flex items-center gap-4">
				<div className="min-w-0 flex-1">
					<RecipeLine d={d} m={m} within="and" total={total} />
				</div>
				<TypeSwitch d={d} count={(o) => counts?.option("type", o) ?? null} />
			</div>
			<div className="flex min-h-0 flex-1 gap-5">
				{columns}
				<span className="w-px shrink-0 bg-white/[0.06]" aria-hidden />
				<Matches d={d} counts={counts} picks={picks} phone={false} />
			</div>
		</div>
	)
}
