// PROTOTYPE - throwaway (prototype/explore-r9). Genres index, variant "Tiles": every genre as a clean tile in one grid,
// all in view at once. A tile reads in one glance: the name, how many titles (as people read counts), the word that
// sets the genre apart in its color, and three posters stacked at its side. The picked tile takes the genre's color
// as its ground and edge; the genre opens under the grid. Round 9: the owner called the cinema pickers "too artsy, not
// functional enough", so this one is plain on purpose.
import { Link } from "@remix-run/react"
import { familyPage, kindLabel, kindNoun } from "../../../../kit/address"
import { FOCUS, wash } from "../../../../kit/ui"
import { GLIDE_T } from "../../../../kit/ui/motion"
import type { PageViewProps, SlotVariant } from "../../contract"
import type { AtlasData, AtlasGenre } from "./atlas.server"
import { Stack, genreCount } from "./bits"
import { GenreName } from "./pieces"
import { ChipRow } from "./row"
import { onlyOf } from "./shared"
import { GenreStage, OPEN_NOTE, type PickerProps, tabProps, tellingWord } from "./stage"

function GenreTile({ g, p }: { g: AtlasGenre; p: PickerProps }) {
	const on = g.place.slug === p.at
	const w = tellingWord(g)
	return (
		<button
			{...tabProps(p, g.place.slug)}
			aria-label={`${g.place.label}, ${genreCount(g)} ${kindNoun(p.kind)}`}
			className={`group/t relative flex min-h-[5.2rem] min-w-0 items-center gap-3 overflow-hidden rounded-xl py-3 pr-3 pl-4 text-left ring-1 ${GLIDE_T} ${FOCUS} ${on ? "" : "bg-white/[0.03] ring-white/[0.08] hover:bg-white/[0.06] hover:ring-white/15"}`}
			style={
				on
					? { background: wash(g.color, 20), boxShadow: `inset 0 0 0 1.5px ${g.color}` }
					: undefined
			}
		>
			{/* The genre's color as a thin edge, full height when picked. */}
			<span
				aria-hidden
				className={`absolute top-1/2 left-0 w-[3px] -translate-y-1/2 rounded-r ${GLIDE_T} ${on ? "h-full" : "h-6 opacity-70 group-hover/t:h-9"}`}
				style={{ background: g.color }}
			/>
			<span className="min-w-0 flex-1">
				<span className="flex items-baseline gap-2">
					<span
						className={`truncate text-[17px] leading-tight font-bold ${GLIDE_T} ${on ? "text-white" : "text-gray-100"}`}
					>
						<GenreName label={g.place.label} only={onlyOf(p.kind, g.place.slug)} />
					</span>
					<span className="shrink-0 text-[13px] font-medium text-gray-500 tabular-nums">
						{genreCount(g)}
					</span>
				</span>
				{w && (
					<span
						className="mt-1 block truncate text-[13px] font-semibold"
						style={{ color: w.color }}
					>
						{w.word}
					</span>
				)}
			</span>
			<Stack g={g} on={on} />
		</button>
	)
}

function Grid(p: PickerProps) {
	return (
		<>
			{/* A phone: a column of twenty tiles would push the genre far down, so it gets the chip row. */}
			<div className="sm:hidden">
				<ChipRow {...p} />
			</div>
			<div
				role="tablist"
				aria-label="Genres"
				className="hidden gap-2.5 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
			>
				{p.genres.map((g) => (
					<GenreTile key={g.place.slug} g={g} p={p} />
				))}
				{/* On a laptop the grid has four columns; a short last row ends in a way out instead of a hole. */}
				{p.genres.length % 4 !== 0 && (
					<Link
						to={p.to(familyPage(p.kind, "mood"))}
						prefetch="intent"
						className={`group/m hidden min-h-[5.2rem] flex-col justify-center rounded-xl border border-dashed border-white/15 px-4 py-3 text-left hover:border-white/30 hover:bg-white/[0.03] lg:flex ${GLIDE_T} ${FOCUS}`}
						style={{ gridColumn: `span ${4 - (p.genres.length % 4)}` }}
					>
						<span className="text-[15px] font-bold text-gray-100">Not sure which genre?</span>
						<span className="mt-1 text-[13px] text-gray-400">
							Pick by how it should feel instead{" "}
							<span
								aria-hidden
								className={`inline-block text-amber-300 ${GLIDE_T} group-hover/m:translate-x-0.5`}
							>
								›
							</span>
						</span>
					</Link>
				)}
			</div>
		</>
	)
}

function View(props: PageViewProps<AtlasData>) {
	const kind = props.address.kind
	return (
		<GenreStage
			{...props}
			kicker={`${kindLabel(kind)} by genre`}
			title="Pick a genre"
			lede={`Every genre with how many ${kindNoun(kind)} it holds and what sets it apart. Pick one to see the kinds inside it.`}
			Picker={Grid}
		/>
	)
}

export const variant: SlotVariant<AtlasData> = {
	id: "tiles",
	name: "Tiles",
	what: "Every genre as a plain tile in one grid, all in view: name, count, the word that sets it apart, three posters. The picked one takes its color; the genre opens under the grid.",
	order: 1,
	View,
	notes: () => [OPEN_NOTE],
}
