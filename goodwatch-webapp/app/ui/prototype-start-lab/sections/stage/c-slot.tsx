// PROTOTYPE (start page lab, round 2): stage c's poster in a shelf slot or frame, in perspective: the lit poster of
// shelf b, flipping to its new title in a left-to-right sweep when the results or picks change (shelf e's motion),
// with a warm amber edge when loved. Taps and hovers are handled by c's flat overlay, not here.
import { useEffect, useState } from "react"
import { tmdbImage } from "../../lab/kit"
import type { LabCard } from "../../lab/types"
import type { SceneSlot } from "../../scene/types"
import { LitPoster } from "../shelf/lit"

const HALF_MS = 220
const SWEEP_MS = 900

type Flip = "out" | "in-start" | null

export function StageSlot({ card, slot, lifted, loved }: { card: LabCard | null; slot: SceneSlot; lifted: boolean; loved: boolean }) {
	const [shown, setShown] = useState<LabCard | null>(card)
	const [flip, setFlip] = useState<Flip>(null)

	useEffect(() => {
		if ((card?.key ?? null) === (shown?.key ?? null)) return
		let dead = false
		const timers: ReturnType<typeof setTimeout>[] = []
		const delay = 40 + (slot.box[0] * 0.8 + slot.box[1] * 0.2) * SWEEP_MS
		const ready = card?.poster_path
			? (() => {
					const img = new Image()
					img.src = tmdbImage(card.poster_path, "w342")
					return Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 1200))])
				})()
			: Promise.resolve()
		const started = performance.now()
		ready.then(() => {
			if (dead) return
			const wait = Math.max(0, delay - (performance.now() - started))
			timers.push(setTimeout(() => setFlip("out"), wait))
			timers.push(
				setTimeout(() => {
					setShown(card)
					setFlip("in-start")
				}, wait + HALF_MS),
			)
		})
		return () => {
			dead = true
			for (const t of timers) clearTimeout(t)
		}
		// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the title, not the object
	}, [card?.key])

	useEffect(() => {
		if (flip !== "in-start") return
		let raf = requestAnimationFrame(() => {
			raf = requestAnimationFrame(() => setFlip(null))
		})
		return () => cancelAnimationFrame(raf)
	}, [flip])

	const rot =
		flip === "out" ? "perspective(700px) rotateY(90deg)" : flip === "in-start" ? "perspective(700px) rotateY(-90deg)" : "perspective(700px) rotateY(0deg)"
	return (
		<div
			className="pointer-events-none h-full w-full will-change-transform"
			style={{ transform: rot, transition: flip === "in-start" ? "none" : `transform ${HALF_MS}ms ${flip === "out" ? "ease-in" : "ease-out"}` }}
		>
			{shown?.poster_path ? (
				<LitPoster card={shown} kind={slot.kind} lifted={lifted}>
					<div
						className="absolute inset-0 shadow-[inset_0_0_0_10px_rgba(251,191,36,0.9)] transition-opacity duration-200"
						style={{ opacity: loved && !lifted ? 1 : 0 }}
					/>
				</LitPoster>
			) : null}
		</div>
	)
}
