import { AREA_COLOR } from "./areas"
import { type Segment, segmentText } from "./headline"
import { type AreaSelection, highlightHandlers } from "./selection"

/** Headline segments as one bold paragraph. Words that name an area are buttons in its color that select it. */
export default function HeadlineText({
	segments,
	selection,
	className = "",
}: {
	segments: Segment[]
	selection: AreaSelection
	className?: string
}) {
	return (
		<p className={`font-bold tracking-tight text-pretty ${className}`}>
			{segments.map((seg, i) => {
				// Where the segment starts in the sentence: unique, and stable for a title.
				const key = segmentText(segments.slice(0, i)).length
				const { area } = seg
				if (!area)
					return (
						<span
							key={key}
							className={seg.tone === "muted" ? "text-gray-500" : "text-white"}
						>
							{seg.text}
						</span>
					)
				const color = AREA_COLOR[area]
				return (
					<button
						key={key}
						type="button"
						{...highlightHandlers(selection, area)}
						onClick={() => selection.toggle(area)}
						aria-label={`${seg.text}: show ${area.toLowerCase()} details`}
						className="inline cursor-pointer rounded-sm text-left decoration-2 underline-offset-[.18em] focus-visible:outline-2 focus-visible:outline-amber-300"
						style={{
							color,
							textDecorationLine:
								selection.hovered === area ? "underline" : "none",
							textDecorationColor: `color-mix(in srgb, ${color} 55%, transparent)`,
						}}
					>
						{seg.text}
					</button>
				)
			})}
		</p>
	)
}
