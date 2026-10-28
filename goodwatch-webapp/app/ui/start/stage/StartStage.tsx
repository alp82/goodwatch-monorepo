// The start page's first screen: the room, and over it a column of the search block (the H1, then the search bar and
// the mood button in their slots), a gap that shows the room's sofa, and the card. Every box has its size from
// start.css before anything arrives, so nothing shifts (stage/placement.ts has the numbers).
//
// - `centered`: before a guest asks, the search block waits in the middle of the screen (CSS, from the first paint).
// - `cardHidden`: the card waits out of sight and out of reach (`inert`) until the guest asks.
// - The H1, the slots' contents and the card are marked `data-start-obstacle`: the shelf covers stay out from under
//   them as drawn on screen, where the block and the camera come to rest; a hidden card counts where it arrives
//   (room/obstacles.ts).
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
	camera,
	centered = false,
	cardHidden = false,
	search,
	moods,
	card,
	grade,
}: {
	/** The titles on the room's shelf. */
	shelf: readonly ShelfTitle[]
	/** The room's light and framing (StartRoom). */
	night: number
	camera: number
	centered?: boolean
	cardHidden?: boolean
	/** The search bar, under the H1. */
	search?: ReactNode
	/** The mood button and picks, under the search bar. */
	moods?: ReactNode
	/** The card's content: its box is fixed. */
	card?: ReactNode
	/** Layers that tint the room, between the room and the night. */
	grade?: ReactNode
}) {
	return (
		<section
			aria-labelledby="start-heading"
			className="start-stage"
			style={SCENE_STYLE}
			{...(centered ? { "data-centered": "" } : {})}
		>
			<StartRoom night={night} camera={camera} titles={shelf}>
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
					<div
						id="start-card"
						className="start-card"
						data-start-obstacle=""
						{...(cardHidden ? { "data-hidden": "", inert: "" } : {})}
					>
						{card}
					</div>
				</div>
			</div>
		</section>
	)
}
