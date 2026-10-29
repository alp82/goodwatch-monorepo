// The room's color grade (grades.ts has the tables and what lights the room): full-size color layers inside the
// camera box, between the room and the night, that blend with the painting under them. Only opacity changes (0.6 s,
// start.css), so a change of grade is a crossfade.
//
// The resting dim is in the server's HTML and shows while no grade is on. A grade's layers mount the first time it is
// used (at opacity 0, faded in two frames later) and stay, so going back to it is a crossfade too. The layers sit in a
// wrapper that makes no stacking context, so they blend with the room.
import { useEffect, useRef, useState } from "react"
import { type Grade, REST_DIM, layersOf } from "./grades"

/** Grades that share their layers mount once (mystery looks like crime). */
const layerKey = (grade: Exclude<Grade, null>) =>
	grade === "mystery" ? "crime" : grade

export function RoomGrade({
	grade,
}: {
	/** The grade on show; undefined keeps the last one (a search's reading is on its way). */
	grade: Grade | undefined
}) {
	const last = useRef<Grade>(null)
	if (grade !== undefined) last.current = grade
	const wanted = grade === undefined ? last.current : grade
	const target = wanted === null ? null : layerKey(wanted)
	const [mounted, setMounted] = useState<Exclude<Grade, null>[]>([])
	const [on, setOn] = useState<Grade>(null)
	useEffect(() => {
		if (target && !mounted.includes(target)) {
			setMounted((m) => [...m, target])
			// Two frames: the new layers paint at 0 before they fade in.
			let second = 0
			const first = requestAnimationFrame(() => {
				second = requestAnimationFrame(() => setOn(target))
			})
			return () => {
				cancelAnimationFrame(first)
				cancelAnimationFrame(second)
			}
		}
		setOn(target)
	}, [target, mounted])
	return (
		<div aria-hidden className="start-grade" data-grade={on ?? "none"}>
			{REST_DIM.map((layer, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed layers
					key={`rest-${i}`}
					style={{
						background: layer.bg,
						mixBlendMode: layer.blend,
						opacity: on ? 0 : layer.o,
					}}
				/>
			))}
			{mounted.flatMap((g) =>
				layersOf(g).map((layer, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: a grade's layers are fixed
						key={`${g}-${i}`}
						style={{
							background: layer.bg,
							mixBlendMode: layer.blend,
							opacity: on === g ? layer.o : 0,
						}}
					/>
				)),
			)}
		</div>
	)
}
