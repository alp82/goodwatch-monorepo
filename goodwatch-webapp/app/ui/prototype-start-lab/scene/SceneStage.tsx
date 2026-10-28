// PROTOTYPE (start page lab, 2026-10-27): a generated living room scene that fills its box like object-fit: cover,
// with things laid onto its TV screen and poster slots in perspective (homography.ts).
//
// - The box sizes the stage (give it a height, or an aspect ratio). The image is cropped around `focal`, which is
//   the TV's center unless given.
// - On a box taller than wide (aspect < `portraitBelow`), the scene's phone version is used when it has one.
// - renderSlot(slot, i) and renderTv() return what goes into a slot or onto the screen. It is drawn in an element of
//   the slot's own proportions (300 px wide) and transformed onto the quad, so text and images sit in perspective.
// - place(size, meta), when given, replaces the cover crop: it returns the image's scale and offset in the box, or null
//   while it can't tell yet (the image then waits, invisible, and fades in once placed).
// - onLayout reports the layout in the box's pixels whenever it changes, for transitions that start at the TV.
// Overlays appear after the first measure in the browser; the server renders the image alone.
import { type CSSProperties, type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react"
import { type Cover, coverFit, quadBounds, quadToBox, quadTransform } from "./homography"
import { type SceneMeta, type ScenePair, type SceneSlot, sceneImage } from "./types"

type Point = [number, number]

export type SceneLayout = {
	meta: SceneMeta
	cover: Cover
	tv: { points: [Point, Point, Point, Point]; rect: { left: number; top: number; width: number; height: number } } | null
	slots: { slot: SceneSlot; points: [Point, Point, Point, Point]; rect: ReturnType<typeof quadBounds> }[]
}

const useIsoLayoutEffect = typeof window === "undefined" ? () => {} : useLayoutEffect

const BASE_W = 300

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** The element size whose proportions match the quad (mean of opposite edges). */
function elementSize(points: [Point, Point, Point, Point]) {
	const [tl, tr, br, bl] = points
	const w = (dist(tl, tr) + dist(bl, br)) / 2
	const h = (dist(tl, bl) + dist(tr, br)) / 2
	return { w: BASE_W, h: Math.max(1, Math.round((BASE_W * h) / Math.max(1, w))) }
}

/** A placement of the image in the box: its scale and its top-left corner, in the box's px. */
export type ScenePlace = (size: { w: number; h: number }, meta: SceneMeta) => { scale: number; dx: number; dy: number } | null

export function pickMeta(pair: ScenePair, aspect: number, portraitBelow = 0.8): SceneMeta {
	return aspect < portraitBelow && pair.portrait ? pair.portrait : pair.landscape
}

export function SceneStage({
	pair,
	focal,
	zoom = 1,
	portraitBelow = 0.8,
	renderSlot,
	renderTv,
	onLayout,
	className = "",
	style,
	imgClassName = "",
	children,
	slotClassName = "",
	tvClassName = "",
	place,
}: {
	pair: ScenePair
	focal?: Point
	/** Above 1 crops closer around the focal point (for a TV close-up). */
	zoom?: number
	portraitBelow?: number
	renderSlot?: (slot: SceneSlot, index: number, size: { w: number; h: number }) => ReactNode
	renderTv?: (size: { w: number; h: number }) => ReactNode
	onLayout?: (layout: SceneLayout) => void
	className?: string
	style?: CSSProperties
	imgClassName?: string
	slotClassName?: string
	tvClassName?: string
	/** Drawn over the scene, filling the box. */
	children?: ReactNode
	/** Places the image instead of the cover crop around `focal` (see the top). */
	place?: ScenePlace
}) {
	const box = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState<{ w: number; h: number } | null>(null)

	useIsoLayoutEffect(() => {
		const el = box.current
		if (!el) return
		const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	const meta = size ? pickMeta(pair, size.w / Math.max(1, size.h), portraitBelow) : pair.landscape
	const fx = focal?.[0] ?? (meta.tv ? meta.tv.box[0] + meta.tv.box[2] / 2 : 0.5)
	const fy = focal?.[1] ?? (meta.tv ? meta.tv.box[1] + meta.tv.box[3] / 2 : 0.5)

	const layout = useMemo<SceneLayout | null>(() => {
		if (!size) return null
		const placed = place ? place(size, meta) : null
		if (place && !placed) return null
		const cover = placed
			? { ...placed, cw: size.w, ch: size.h, iw: meta.width, ih: meta.height }
			: coverFit(size.w, size.h, meta.width, meta.height, fx, fy, zoom)
		const tvPoints = meta.tv ? quadToBox(cover, meta.tv.quad) : null
		return {
			meta,
			cover,
			tv: tvPoints ? { points: tvPoints, rect: quadBounds(tvPoints) } : null,
			slots: meta.slots.map((slot) => {
				const points = quadToBox(cover, slot.quad)
				return { slot, points, rect: quadBounds(points) }
			}),
		}
	}, [size, meta, fx, fy, zoom, place])

	const reported = useRef<SceneLayout | null>(null)
	useIsoLayoutEffect(() => {
		if (layout && layout !== reported.current) {
			reported.current = layout
			onLayout?.(layout)
		}
	})

	return (
		<div ref={box} className={`relative overflow-hidden ${className}`} style={style}>
			{/* The picture always matches the measured layout: the phone version swaps in after the first measure. */}
			<picture key={meta.id}>
				<source srcSet={sceneImage(meta.id, "avif")} type="image/avif" />
				<img
					src={sceneImage(meta.id, "webp")}
					alt=""
					draggable={false}
					className={`absolute select-none ${layout ? "max-w-none" : "inset-0 h-full w-full object-cover"} ${imgClassName}`}
					style={
						layout
							? {
									left: layout.cover.dx,
									top: layout.cover.dy,
									width: layout.cover.iw * layout.cover.scale,
									height: layout.cover.ih * layout.cover.scale,
									...(place ? { opacity: 1, transition: "opacity .4s ease-out" } : null),
								}
							: { objectPosition: `${fx * 100}% ${fy * 100}%`, ...(place ? { opacity: 0 } : null) }
					}
				/>
			</picture>
			{layout && renderSlot
				? layout.slots.map(({ slot, points }, i) => {
						const el = elementSize(points)
						return (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: slots are fixed per scene
								key={`${meta.id}-${i}`}
								className={`absolute left-0 top-0 origin-top-left ${slotClassName}`}
								style={{ width: el.w, height: el.h, transform: quadTransform(points, el.w, el.h) }}
							>
								{renderSlot(slot, i, el)}
							</div>
						)
					})
				: null}
			{layout?.tv && renderTv
				? (() => {
						const tv = layout.tv as NonNullable<SceneLayout["tv"]>
						const el = elementSize(tv.points)
						return (
							<div
								className={`absolute left-0 top-0 origin-top-left ${tvClassName}`}
								style={{ width: el.w, height: el.h, transform: quadTransform(tv.points, el.w, el.h) }}
							>
								{renderTv(el)}
							</div>
						)
					})()
				: null}
			{children}
		</div>
	)
}
