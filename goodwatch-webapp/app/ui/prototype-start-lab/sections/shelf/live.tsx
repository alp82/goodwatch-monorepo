// PROTOTYPE (start page lab): e "Live changes": the lit posters of b, and when the shelf titles change (a search,
// picks) each slot flips to its new poster in turn, sweeping across the room from left to right.
import { Link } from "@remix-run/react"
import { useEffect, useState } from "react"
import { titleHref, tmdbImage } from "../../lab/kit"
import type { LabCard, SlotProps } from "../../lab/types"
import { LitPoster, useSlotPointer } from "./lit"

const HALF_MS = 220
const SWEEP_MS = 900

type Flip = "out" | "in-start" | null

export function LiveSlot({ card, slot, index }: SlotProps) {
	const { ref, lifted, handlers } = useSlotPointer(index)
	const [shown, setShown] = useState<LabCard | null>(card)
	const [flip, setFlip] = useState<Flip>(null)
	const [glint, setGlint] = useState(false)

	// A new title for this slot: wait for its turn in the sweep and for its image, then flip.
	useEffect(() => {
		if ((card?.key ?? null) === (shown?.key ?? null)) return
		let dead = false
		const timers: ReturnType<typeof setTimeout>[] = []
		const delay = 60 + (slot.box[0] * 0.8 + slot.box[1] * 0.2) * SWEEP_MS
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

	// The second half: from edge-on back to flat, after the new poster has painted edge-on.
	useEffect(() => {
		if (flip !== "in-start") return
		let raf = requestAnimationFrame(() => {
			raf = requestAnimationFrame(() => {
				setFlip(null)
				setGlint(true)
			})
		})
		return () => cancelAnimationFrame(raf)
	}, [flip])

	useEffect(() => {
		if (!glint) return
		const t = setTimeout(() => setGlint(false), 450)
		return () => clearTimeout(t)
	}, [glint])

	const rot = flip === "out" ? "perspective(700px) rotateY(90deg)" : flip === "in-start" ? "perspective(700px) rotateY(-90deg)" : "perspective(700px) rotateY(0deg)"
	const ease = flip === "out" ? "ease-in" : "ease-out"
	return (
		<div
			className="h-full w-full will-change-transform"
			style={{
				transform: rot,
				transition: flip === "in-start" ? "none" : `transform ${HALF_MS}ms ${ease}`,
			}}
		>
			{shown?.poster_path ? (
				<Link
					ref={ref}
					to={titleHref(shown)}
					prefetch="none"
					data-shelf-slot=""
					aria-label={shown.title}
					draggable={false}
					className="block h-full w-full outline-none [-webkit-tap-highlight-color:transparent]"
					{...handlers}
				>
					<LitPoster card={shown} kind={slot.kind} lifted={lifted}>
						{/* A warm glint as the new poster lands. */}
						<div
							className="absolute inset-0 bg-amber-200 mix-blend-soft-light transition-opacity duration-500"
							style={{ opacity: glint ? 0.55 : 0 }}
						/>
					</LitPoster>
				</Link>
			) : null}
		</div>
	)
}
