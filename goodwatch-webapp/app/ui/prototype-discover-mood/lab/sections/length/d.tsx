// PROTOTYPE (Discover lab) Length d: a's picks, with a slider each for Movies and Episodes. Production has one
// runtime range, applied per title as a movie's length or a show's usual episode length, so this sends what it can:
// Movies only sends the movie range, Shows only the episode range, and with both it sends the range moved last
// (it then holds for both kinds, and the other slider is marked as not used). Counts are per kind, with that kind's
// own range. Two ranges at once need a second field in production (e.g. episodeRuntime).
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import { RangeSlider } from "~/ui/filter-bar/SheetControls"
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import { ResetLink, Tile, pad, sameRange } from "../released/parts"
import { EPISODE_PICKS, MOVIE_PICKS } from "./a"
import { LEN_MAX, fmtLen, isAnyLength, lengthRange, runtimeOf, setLength } from "./parts"

type Kind = "movie" | "show"
type Range = [number, number]
const ANY: Range = [0, LEN_MAX]

const rangeParam = (r: Range) => {
	const rt = runtimeOf(r)
	return rt ? `${rt.min ?? ""}-${rt.max ?? ""}` : null
}

/** Titles of one kind each range would leave, everything else as set. Null while loading or while searching. */
function useKindCounts(d: ProtoDiscover, kind: Kind, ranges: Range[]): (number | null)[] {
	const base = new URLSearchParams(d.filters.query)
	for (const p of ["runtime", "minRuntime", "maxRuntime", "type", "page"]) base.delete(p)
	base.set("type", kind)
	const baseQuery = base.toString()
	const keys = ranges.map(rangeParam)
	const q = useQuery<(number | null)[]>({
		queryKey: ["lab-length-kind", baseQuery, keys.join("|")],
		enabled: d.q === null,
		staleTime: 5 * 60_000,
		placeholderData: (previous) => previous,
		queryFn: async ({ signal }) =>
			Promise.all(
				keys.map(async (k) => {
					const p = new URLSearchParams(baseQuery)
					if (k) p.set("runtime", k)
					p.set("page", "1")
					const r = await fetch(`/api/discover/results?${p}`, { signal })
					if (!r.ok) return null
					const j = (await r.json()) as { total?: number }
					return typeof j.total === "number" ? j.total : null
				}),
			),
	})
	if (d.q !== null) return ranges.map(() => null)
	return q.data ?? ranges.map(() => null)
}

function Tag({ children, tone }: { children: string; tone: "on" | "off" }) {
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone === "on" ? "bg-amber-400/15 text-amber-200" : "bg-white/[0.06] text-gray-400"}`}
		>
			{children}
		</span>
	)
}

export function LengthD({ d, phone }: SectionProps) {
	const type = d.filters.state.type as Kind | undefined
	const start = lengthRange(d.filters.state)
	const [ranges, setRanges] = useState<Record<Kind, Range>>({ movie: start, show: start })
	const [last, setLast] = useState<Kind>(type === "show" ? "show" : "movie")

	// The kind whose range goes to the filter.
	const sent: Kind = type === "movie" ? "movie" : type === "show" ? "show" : last
	const both = !type
	const differ = !sameRange(ranges.movie, ranges.show)

	const apply = (next: Record<Kind, Range>, kind: Kind) => {
		setRanges(next)
		setLast(kind)
		const to: Kind = type === "movie" ? "movie" : type === "show" ? "show" : kind
		const cur = lengthRange(d.filters.state)
		if (!sameRange(cur, next[to])) setLength(d, next[to])
	}
	const setKind = (kind: Kind, r: Range) => apply({ ...ranges, [kind]: r }, kind)

	// Movies or shows changed elsewhere: send the range of the kind that's left.
	useEffect(() => {
		const r = ranges[sent]
		if (!sameRange(lengthRange(d.filters.state), r)) setLength(d, r)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [type])

	const groups: { kind: Kind; label: string; picks: typeof MOVIE_PICKS; other: string }[] = [
		{ kind: "movie", label: "Movies", picks: MOVIE_PICKS, other: "episodes" },
		{ kind: "show", label: "Episodes", picks: EPISODE_PICKS, other: "movies" },
	]
	const movieCounts = useKindCounts(d, "movie", [ranges.movie, ...MOVIE_PICKS.map((p) => p.range)])
	const showCounts = useKindCounts(d, "show", [ranges.show, ...EPISODE_PICKS.map((p) => p.range)])
	const countsOf = (k: Kind) => (k === "movie" ? movieCounts : showCounts)

	return (
		<div className={`${pad(phone)} ${phone ? "flex flex-col gap-6" : "grid grid-cols-2 gap-10"}`}>
			{groups.map((g) => {
				const r = ranges[g.kind]
				const used = g.kind === sent
				const off = (type && type !== g.kind) || (both && differ && !used)
				const counts = countsOf(g.kind)
				const total = counts[0]
				const tag = off ? (
					<Tag tone="off">Not used</Tag>
				) : both && differ ? (
					<Tag tone="on">{`Also used for ${g.other}`}</Tag>
				) : null
				return (
					<div key={g.kind} className={`flex min-w-0 flex-col gap-3 transition-opacity ${off ? "opacity-55" : ""}`}>
						<div className="flex h-7 items-center gap-2.5">
							<h4 className="text-[15px] font-semibold text-gray-100">{g.label}</h4>
							<span className="text-[13px] tabular-nums text-gray-400">{total != null ? compactCount(total) : ""}</span>
							{tag}
							<span className="ml-auto">
								<ResetLink show={!isAnyLength(r)} onClick={() => setKind(g.kind, ANY)} />
							</span>
						</div>
						<div className={`grid gap-2 ${phone ? "grid-cols-2" : "grid-cols-4"}`}>
							{g.picks.map((p, i) => (
								<Tile
									key={p.label}
									label={p.label}
									sub={p.sub}
									count={counts[1 + i]}
									active={sameRange(r, p.range)}
									onClick={() => setKind(g.kind, sameRange(r, p.range) ? ANY : p.range)}
								/>
							))}
						</div>
						<RangeSlider
							label={`${g.label} length`}
							min={0}
							max={LEN_MAX}
							step={5}
							value={r}
							format={fmtLen}
							onCommit={(v) => setKind(g.kind, v)}
						/>
					</div>
				)
			})}
		</div>
	)
}
