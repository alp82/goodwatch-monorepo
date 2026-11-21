// PROTOTYPE - throwaway (prototype/explore-r9). Genres index, variant "Chip row": the genres as one compact row of
// chips that scrolls sideways, with the site's shared Prev / Next arrows. The smallest picker: the genre's card gets
// almost the whole first screen. A chip says the name and the count; the picked chip fills with the genre's color.
import type { MutableRefObject } from "react"
import { useStepRow, RowArrows } from "~/ui/row-arrows"
import { kindLabel, kindNoun } from "../../../../kit/address"
import { FOCUS, wash } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import type { PageViewProps, SlotVariant } from "../../contract"
import type { AtlasData } from "./atlas.server"
import { genreCount } from "./bits"
import { GenreName } from "./pieces"
import { onlyOf } from "./shared"
import { GenreStage, OPEN_NOTE, type PickerProps, tabProps } from "./stage"

/** The row of chips (also the phone picker of "List beside"). */
export function ChipRow(p: PickerProps) {
	const row = useStepRow<HTMLDivElement>([p.genres.length])
	return (
		<div className="flex items-center gap-3">
			<div
				ref={(el) => {
					;(row.ref as MutableRefObject<HTMLDivElement | null>).current = el
					;(p.box as MutableRefObject<HTMLDivElement | null>).current = el
				}}
				onScroll={row.measure}
				role="tablist"
				aria-label="Genres"
				className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0.5"
			>
				{p.genres.map((g) => {
					const on = g.place.slug === p.at
					return (
						<button
							key={g.place.slug}
							{...tabProps(p, g.place.slug)}
							aria-label={`${g.place.label}, ${genreCount(g)} ${kindNoun(p.kind)}`}
							className={`flex shrink-0 items-center gap-2 rounded-full py-2 pr-3.5 pl-3 text-[15px] font-semibold whitespace-nowrap ring-1 ${QUICK_T} ${FOCUS} ${on ? "text-white" : "bg-white/[0.04] text-gray-200 ring-white/10 hover:bg-white/[0.08] hover:text-white"}`}
							style={
								on
									? { background: wash(g.color, 32), boxShadow: `inset 0 0 0 1.5px ${g.color}` }
									: undefined
							}
						>
							<span aria-hidden className="h-2 w-2 rounded-full" style={{ background: g.color }} />
							<GenreName label={g.place.label} only={onlyOf(p.kind, g.place.slug)} />
							<span
								className={`text-[13px] font-medium tabular-nums ${on ? "text-white/70" : "text-gray-500"}`}
							>
								{genreCount(g)}
							</span>
						</button>
					)
				})}
			</div>
			<RowArrows row={row} label="genres" />
		</div>
	)
}

function View(props: PageViewProps<AtlasData>) {
	const kind = props.address.kind
	return (
		<GenreStage
			{...props}
			kicker={`${kindLabel(kind)} by genre`}
			title="Pick a genre"
			lede={`Every genre in one row, with how many ${kindNoun(kind)} it holds. Pick one to see the kinds inside it.`}
			Picker={ChipRow}
		/>
	)
}

export const variant: SlotVariant<AtlasData> = {
	id: "row",
	name: "Chip row",
	what: "The genres as one row of chips with name and count, scrolling sideways with Prev / Next. The smallest picker, so the genre's card fills the first screen.",
	order: 3,
	View,
	notes: () => [OPEN_NOTE],
}
