// PROTOTYPE (start page lab): f "Printed covers": e's live changes, with each poster drawn as the printed cover inside
// the painted Blu-ray case: lit and tinted by the room around it (read from the scene image), darker away from the
// lamp, a faint sleeve sheen, a hairline inner shadow, no frame. Small slots load w185 so they don't shimmer.
import { Link } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import { titleHref, tmdbImage } from "../../lab/kit"
import { type LabCard, type SlotProps, useLab } from "../../lab/types"
import { useSlotLight, useSlotScreenWidth } from "./cover-light"
import { CoverPoster, coverSize } from "./cover-poster"
import { useSlotPointer } from "./lit"

const HALF_MS = 220
const SWEEP_MS = 900

type Flip = "out" | "in-start" | null

export function CoverSlot({ card, slot, index, size }: SlotProps) {
	const { scene } = useLab()
	const pixel = scene.landscape.style === "pixel-art"
	const box = useRef<HTMLDivElement>(null)
	const screenW = useSlotScreenWidth(box)
	const light = useSlotLight(box, slot)
	const { ref, lifted, handlers } = useSlotPointer(index)
	const [shown, setShown] = useState<LabCard | null>(card)
	const [flip, setFlip] = useState<Flip>(null)
	const [glint, setGlint] = useState(false)
	const imgSize = screenW ? coverSize(screenW) : null
	const sizeRef = useRef(imgSize)
	sizeRef.current = imgSize

	// A new title for this slot: wait for its turn in the sweep and for its image, then flip.
	useEffect(() => {
		if ((card?.key ?? null) === (shown?.key ?? null)) return
		let dead = false
		const timers: ReturnType<typeof setTimeout>[] = []
		const delay = 60 + (slot.box[0] * 0.8 + slot.box[1] * 0.2) * SWEEP_MS
		const ready = card?.poster_path
			? (() => {
					const img = new Image()
					img.src = tmdbImage(card.poster_path, pixel ? "w185" : (sizeRef.current ?? "w342"))
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

	// The second half: from edge-on back to flat, after the new cover has painted edge-on.
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

	const rot =
		flip === "out"
			? "perspective(700px) rotateY(90deg)"
			: flip === "in-start"
				? "perspective(700px) rotateY(-90deg)"
				: "perspective(700px) rotateY(0deg)"
	const ease = flip === "out" ? "ease-in" : "ease-out"
	// Element px per screen px, so the case edge stays 1-2 screen px at any slot size.
	const unit = screenW ? size.w / Math.max(1, screenW) : 4
	return (
		<div ref={box} className="h-full w-full">
			<div
				className="h-full w-full"
				style={{
					transform: rot,
					transition: flip === "in-start" ? "none" : `transform ${HALF_MS}ms ${ease}`,
					// A layer only while flipping: a resting layer rasterized at 300 px and scaled down shimmers.
					willChange: flip || glint ? "transform" : undefined,
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
						{/* The image waits for the slot's measured size (before the first paint), so it loads once. */}
						{imgSize ? (
							<CoverPoster card={shown} size={imgSize} light={light} unit={unit} lifted={lifted} pixel={pixel}>
								{/* A warm glint as the new cover lands. */}
								<div
									className="absolute inset-0 bg-amber-200 mix-blend-soft-light transition-opacity duration-500"
									style={{ opacity: glint ? 0.45 : 0 }}
								/>
							</CoverPoster>
						) : null}
					</Link>
				) : null}
			</div>
		</div>
	)
}
