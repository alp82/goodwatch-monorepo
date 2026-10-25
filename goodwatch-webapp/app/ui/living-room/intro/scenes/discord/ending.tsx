// The chapter's ending: the /watch card lifts out of the Discord window (the window's own card fades in the same
// frames, so only one card is seen) and settles big and tilted beside it, its service button pressed and the
// friends' reactions popping on its corner. On the phone picture it is the compact card (backdrop, name, score,
// service) with bigger words.
import type { CSSProperties } from "react"
import type { SceneProps } from "~/ui/living-room/intro/scene"
import { WatchCard } from "./channel"
import { anim } from "./kit"

/** The thread's card column (em). */
export const CARD_W = 24.05
/** The compact card's column on the phone picture (em). */
export const COMPACT_W = 16.6
/** The burst box's padding (em). */
const PAD = 0.7

/** Where the thread's card sits (cqw) for a window whose top-left is (left, top), drawn at font `font` (cqw), with
 * the server rail. */
export function cardSpot(
	w: { left: number; top: number; font: number },
	lastTo: number,
) {
	return {
		x: w.left + (3.2 + 0.9 + 3.05) * w.font,
		y: w.top + (2.4 + 10.6 + lastTo) * w.font,
		w: CARD_W * w.font,
	}
}

export type BurstBox = {
	left: number
	top: number
	font: number
	compact: boolean
	r: string
}

export function BurstCard({
	data,
	box,
	from,
	at,
	du,
	ez,
	serviceAt,
	reactAt,
}: SceneProps & {
	box: BurstBox
	from: ReturnType<typeof cardSpot>
	at: number
	du: number
	ez: string
	serviceAt: number
	reactAt: number
}) {
	const cardW = box.compact ? COMPACT_W : CARD_W
	const fs = from.w / (cardW * box.font)
	const lift = anim("lift", at, du, {
		"--fx": `${from.x - box.left - PAD * box.font * fs}cqw`,
		"--fy": `${from.y - box.top - PAD * box.font * fs}cqw`,
		"--fs": fs,
		"--r": box.r,
		"--ez": ez,
	})
	const r = (i: number) => anim("pop", reactAt + i * 170, 400)
	return (
		<div
			className={`intro-dc-burst ${box.compact ? "big-react" : ""} ${lift.className}`}
			style={
				{
					...lift.style,
					left: `${box.left}cqw`,
					top: `${box.top}cqw`,
					fontSize: `${box.font}cqw`,
				} as CSSProperties
			}
		>
			<div style={{ width: `${cardW}em` }}>
				<WatchCard
					data={data}
					cardW={cardW}
					serviceAt={serviceAt}
					compact={box.compact}
				/>
			</div>
			<div className="intro-dc-react">
				<span {...r(0)}>🍿 3</span>
				<span {...r(1)}>🔥 2</span>
				<span className={`mine ${r(2).className}`} style={r(2).style}>
					👍 4
				</span>
			</div>
		</div>
	)
}
