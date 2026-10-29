// PROTOTYPE (Discover lab) Length d: a's picks, with a slider each for Movies and Episodes. Round 10: two values,
// movies in the real `runtime`, episodes in the lab-only `eruntime` (two.ts); with both kinds the kit asks for movies
// and shows apart and merges them. The block of a kind that's not in the list dims. Counts are per kind, own range.
import { useQuery } from "@tanstack/react-query"
import { compactCount } from "~/ui/filter-bar/labels"
import { RangeSlider } from "~/ui/filter-bar/SheetControls"
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import { ResetLink, Tile, pad, sameRange } from "../released/parts"
import { EPISODE_PICKS, MOVIE_PICKS } from "./a"
import { LEN_MAX, fmtLen, isAnyLength, runtimeOf } from "./parts"
import { episodeRange } from "./two"

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

const pair = (r: { min?: number; max?: number } | undefined): Range => [r?.min ?? 0, r?.max ?? LEN_MAX]

export function LengthD({ d, phone }: SectionProps) {
	const s = d.filters.state
	const ranges: Record<Kind, Range> = { movie: pair(s.runtime), show: pair(episodeRange(s)) }
	const setKind = (kind: Kind, r: Range) =>
		d.filters.update((x) =>
			kind === "movie"
				? { ...x, runtime: runtimeOf(r), episodeRuntime: episodeRange(x) ?? null }
				: { ...x, episodeRuntime: runtimeOf(r) ?? null },
		)

	const groups: { kind: Kind; label: string; picks: typeof MOVIE_PICKS }[] = [
		{ kind: "movie", label: "Movies", picks: MOVIE_PICKS },
		{ kind: "show", label: "Episodes", picks: EPISODE_PICKS },
	]
	const movieCounts = useKindCounts(d, "movie", [ranges.movie, ...MOVIE_PICKS.map((p) => p.range)])
	const showCounts = useKindCounts(d, "show", [ranges.show, ...EPISODE_PICKS.map((p) => p.range)])
	const countsOf = (k: Kind) => (k === "movie" ? movieCounts : showCounts)

	return (
		<div className={`${pad(phone)} ${phone ? "flex flex-col gap-6" : "grid grid-cols-2 gap-10"}`}>
			{groups.map((g) => {
				const r = ranges[g.kind]
				const off = s.type !== "all" && s.type !== g.kind
				const counts = countsOf(g.kind)
				const total = counts[0]
				return (
					<div key={g.kind} className={`flex min-w-0 flex-col gap-3 transition-opacity ${off ? "opacity-45" : ""}`}>
						<div className="flex h-7 items-center gap-2.5">
							<h4 className="text-[15px] font-semibold text-gray-100">{g.label}</h4>
							<span className="text-[13px] tabular-nums text-gray-400">{total != null ? compactCount(total) : ""}</span>
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
