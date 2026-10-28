// PROTOTYPE (Discover lab, mood a): the baseline. My movies' shelf shaped for Discover: the Explorer's twelve moods as
// picture tiles, a row of mixes (a guest has no taste groups) that turns into narrowing suggestions after a pick,
// and About, Style and Genre folded in a side column under Movies or shows. No sub-tabs.
import { TypeControl } from "../../shell-parts"
import type { SectionProps } from "../../types"
import { Folds, MixChips, MoodTiles, NarrowChips, PickRow, ROW_FADE, useMixes, useMoods, useWorldArt } from "./parts"

function SuggestRow({ d, m, x, art }: { d: SectionProps["d"]; m: ReturnType<typeof useMoods>; x: ReturnType<typeof useMixes>; art: ReturnType<typeof useWorldArt> }) {
	const narrowing = d.picked.length > 0 || m.words.length > 0
	return (
		<div className="flex h-9 min-w-0 items-center gap-3">
			<span className="w-[4.5rem] shrink-0 text-sm font-semibold text-gray-300">{narrowing ? "Narrow it" : "Mixes"}</span>
			<div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]" style={ROW_FADE}>
				{narrowing ? <NarrowChips d={d} art={art} n={8} /> : <MixChips x={x} art={art} />}
			</div>
		</div>
	)
}

export function MoodA({ d, phone }: SectionProps) {
	const m = useMoods(d)
	const art = useWorldArt()
	const x = useMixes(d)
	const empty = <span className="text-sm font-semibold text-white">Moods</span>
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<PickRow d={d} m={m} art={art} empty={empty} />
				<MoodTiles d={d} m={m} art={art} cols="grid-cols-3" tile="h-[4.75rem]" lines={false} />
				<SuggestRow d={d} m={m} x={x} art={art} />
				<TypeControl d={d} />
				<Folds d={d} keys={["themes", "styles", "genres"]} phone />
			</div>
		)
	return (
		<div className="flex h-full min-h-0">
			<div className="flex min-w-0 flex-1 flex-col gap-3 px-6 py-4">
				<PickRow d={d} m={m} art={art} empty={empty} />
				<MoodTiles d={d} m={m} art={art} />
				<SuggestRow d={d} m={m} x={x} art={art} />
			</div>
			<aside className="flex w-[380px] shrink-0 flex-col gap-4 border-l border-white/[0.06] px-5 py-4">
				<TypeControl d={d} />
				<Folds d={d} keys={["themes", "styles", "genres"]} first="themes" />
			</aside>
		</div>
	)
}
