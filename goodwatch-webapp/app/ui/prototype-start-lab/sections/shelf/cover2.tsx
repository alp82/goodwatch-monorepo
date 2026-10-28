// PROTOTYPE (start page lab): g "Covers, clean edges": f's printed covers and flip, with each cover bleeding ~3.5% past
// the painted slot on every side (hiding the slot's magenta fringe), anti-aliased edges (a transparent pad around the
// drawn cover, so the layer's hard edge is transparent), a layer only while flipping, and a soft dark rim.
import { Link } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import { titleHref, tmdbImage } from "../../lab/kit"
import { type LabCard, type SlotProps, useLab } from "../../lab/types"
import { useSlotLight, useSlotScreenWidth } from "./cover-light"
import { coverSize } from "./cover-poster"
import { CleanCoverPoster } from "./cover2-poster"
import { useSlotPointer } from "./lit"

const HALF_MS = 220
const SWEEP_MS = 900
/** How far the cover reaches past the slot, as a share of the slot's width and height. */
const BLEED_X = 0.035
const BLEED_Y = 0.03

type Flip = "out" | "in-start" | null

export function CleanCoverSlot(props: SlotProps) {
	return <CoverSlot2 {...props} cased={false} />
}

export function CoverSlot2({ card, slot, index, size, cased }: SlotProps & { cased: boolean }) {
	const { scene } = useLab()
	const pixel = scene.landscape.style === "pixel-art"
	// Measured from this element's parent (the SceneStage slot box), so this stays its direct child.
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

	// A new title for this slot: wait for its turn in the sweep and for its image, then flip (as f).
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
	const unit = screenW ? size.w / Math.max(1, screenW) : 4
	// The bleed, in element px: a share of the slot, and never under 1 screen px (small slots on phones).
	const bleed = { x: Math.max(BLEED_X * size.w, unit), y: Math.max(BLEED_Y * size.h, unit) }
	// A transparent pad of 2 screen px around the drawn cover: the transformed element's own edge is then transparent,
	// and the cover's visible edge is filtered inside the texture instead of stair-stepping at the layer boundary.
	const pad = 2 * unit
	return (
		<div ref={box} className="relative h-full w-full">
			<div
				className="absolute"
				style={{
					left: -(bleed.x + pad),
					right: -(bleed.x + pad),
					top: -(bleed.y + pad),
					bottom: -(bleed.y + pad),
					padding: pad,
					outline: "1px solid transparent",
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
						{imgSize ? (
							<CleanCoverPoster
								card={shown}
								size={imgSize}
								light={light}
								unit={unit}
								bleed={bleed}
								lifted={lifted}
								pixel={pixel}
								cased={cased}
							>
								<div
									className="absolute inset-0 bg-amber-200 mix-blend-soft-light transition-opacity duration-500"
									style={{ opacity: glint ? 0.45 : 0 }}
								/>
							</CleanCoverPoster>
						) : null}
					</Link>
				) : null}
			</div>
		</div>
	)
}
