// The start page's first screen: the room, and over it a column of the search block (the H1, then the search bar and
// the mood button in their slots), a gap that shows the room's window and sofa, and the card's box, whose bottom stands
// on the floor in front of the sofa. Every box has its size from start.css before anything arrives, so nothing shifts
// (stage/placement.ts has the numbers).
//
// - `open`: the card is open. Until then the search block waits lower, and the card's box shows only the ledge
//   (ledge/StartLedge.tsx); opening lifts the block and grows the card up from the ledge (CSS, from the first paint).
// - The H1, the slots' contents and the card are marked `data-start-obstacle`: the shelf covers stay out from under
//   them as drawn on screen, where the block and the camera come to rest (room/obstacles.ts).
import type { CSSProperties, ReactNode } from "react"
import type { ShelfTitle } from "../room/ShelfCovers"
import { StartRoom } from "../room/StartRoom"
import { START_ROOM, START_ROOM_PHONE } from "../room/scene"
import { sceneStyle } from "./placement"

/** The page's one H1. */
export const START_HEADING = "Find something to watch"

const SCENE_STYLE = sceneStyle(START_ROOM, START_ROOM_PHONE) as CSSProperties

export function StartStage({
	shelf,
	night,
	open,
	search,
	moods,
	card,
	grade,
	opening,
}: {
	/** The titles on the room's shelf. */
	shelf: readonly ShelfTitle[]
	/** The room's light (StartRoom): 0 lit. */
	night: number
	/** The card is open (the ledge has grown into it). */
	open: boolean
	/** The search bar, under the H1. */
	search?: ReactNode
	/** The mood button and picks, under the search bar. */
	moods?: ReactNode
	/** The card's box's content: the ledge and the card (StartLedge). Its box is fixed. */
	card?: ReactNode
	/** Layers that tint the room, between the room and the night. */
	grade?: ReactNode
	/** A guest's opening (opening/OpeningBoot.tsx): first in the stage, so its gate runs before the rest paints. */
	opening?: ReactNode
}) {
	return (
		<section
			aria-labelledby="start-heading"
			className="start-stage"
			style={SCENE_STYLE}
			{...(open ? { "data-open": "" } : {})}
		>
			{opening}
			<StartRoom night={night} camera={1} titles={shelf}>
				{grade}
			</StartRoom>
			<div aria-hidden className="start-veil" />
			<div className="start-content">
				<div className="start-top">
					<div className="start-block">
						<div aria-hidden className="start-pool" />
						<h1
							id="start-heading"
							className="start-heading"
							data-start-obstacle=""
						>
							{START_HEADING}
						</h1>
						<div className="start-search" data-start-obstacle="">
							{search}
						</div>
						<div className="start-moods">
							<div className="mx-auto w-fit max-w-full" data-start-obstacle="">
								{moods}
							</div>
						</div>
					</div>
				</div>
				<div aria-hidden className="start-gap" />
				<div className="start-card-wrap">
					<div id="start-card" className="start-card" data-start-obstacle="">
						{card}
					</div>
				</div>
			</div>
		</section>
	)
}
