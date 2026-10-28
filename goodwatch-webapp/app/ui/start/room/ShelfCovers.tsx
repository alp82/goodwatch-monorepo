// Real posters on the room's bookcase: each face-out case of the painting (scene.ts `slots`) holds a title's cover in a
// drawn Blu-ray case, laid onto the slot in perspective (homography.ts). Each cover links to its title page; hovering or
// focusing it (or a first tap on a phone) lifts it and shows its title and score beside it.
//
// - The covers need the picture's place on screen, so they render after hydration; the room's picture is in the
//   server HTML on its own. The place is read from the picture itself (its CSS box: start.css places it), and the
//   slots that a control covers on screen (`[data-start-obstacle]` in the stage, through the camera's scale and the
//   centered block's shift: obstacles.ts) stay empty.
// - When `titles` change (the results on show), each cover flips to its new title, left to right, once its image has
//   loaded.
// - Only transform and opacity animate. A cover is a layer only while it flips: a resting layer drawn at the element's
//   300 px and scaled down shimmers.
import { Link, useNavigate } from "@remix-run/react"
import {
	type CSSProperties,
	type ReactNode,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { ScorePill } from "~/ui/poster-card/ScorePill"
import { TitleBand } from "~/ui/poster-card/TitleBand"
import { titlePath } from "~/utils/helpers"
import { TMDB_IMAGE_BASE } from "~/utils/tmdb-image"
import { UPRIGHT_PHONE } from "~/utils/upright-phone"
import { HALF_FLIP_MS, useCoverFlip } from "./cover-flip"
import {
	type Quad,
	type Rect,
	elementSize,
	quadBounds,
	quadToBox,
	quadTransform,
} from "./homography"
import {
	coveredSlots,
	layoutRect,
	obstacleBox,
	restingChain,
} from "./obstacles"
import {
	type RoomScene,
	START_ROOM,
	START_ROOM_PHONE,
	type ShelfSlot,
} from "./scene"

/** A title the shelf can show: a start title, or a result's card. */
export type ShelfTitle = Pick<
	StartTitle,
	| "media_type"
	| "tmdb_id"
	| "title"
	| "release_year"
	| "poster_path"
	| "goodwatch_overall_score_normalized_percent"
> & { backdrop_path?: string | null }

const hrefOf = (t: ShelfTitle) => titlePath(t.media_type, t.tmdb_id, t.title)

/** How far a cover reaches past its painted slot, as a share of the slot's width and height. */
const BLEED_X = 0.035
const BLEED_Y = 0.03
/** The blue header band's share of the cover's height. */
const BAND = 0.08
/** How close a control may come to a cover before the slot stays empty (px). */
const OBSTACLE_PAD = 8
const CAPTION_W = 176
const CAPTION_H = 92
/** A finger's least target (px): smaller slots get an invisible button over them on touch screens. */
const MIN_TAP = 44

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

const canHover = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(hover: hover) and (pointer: fine)").matches

type PlacedSlot = { slot: ShelfSlot; points: Quad; rect: Rect; hidden: boolean }
type ShelfLayout = {
	scene: RoomScene
	width: number
	height: number
	slots: PlacedSlot[]
}

/** Where the slots are in the shelf's box (the camera's), and which ones a control covers on screen (obstacles.ts). */
function useShelfLayout(box: RefObject<HTMLDivElement | null>) {
	const [layout, setLayout] = useState<ShelfLayout | null>(null)
	useIsoLayoutEffect(() => {
		const el = box.current
		const camera = el?.parentElement
		const stage = el?.closest<HTMLElement>(".start-stage")
		if (!el || !camera || !stage) return
		const phone = window.matchMedia(UPRIGHT_PHONE)
		const measure = () => {
			const scene = phone.matches ? START_ROOM_PHONE : START_ROOM
			const img = camera.querySelector<HTMLImageElement>(
				phone.matches ? ".start-room-phone img" : ".start-room-landscape img",
			)
			if (!img?.offsetWidth) return
			const placed = {
				scale: img.offsetWidth / scene.width,
				dx: img.offsetLeft,
				dy: img.offsetTop,
			}
			const obstacles = [
				...stage.querySelectorAll<HTMLElement>("[data-start-obstacle]"),
			]
				.map((o) => obstacleBox(o, stage))
				.filter((r) => r.width > 0 && r.height > 0)
			// The slots in the stage's layout px, then on screen through the camera's scale.
			const at = layoutRect(camera, stage)
			const cameraChain = restingChain(camera, stage)
			const placedSlots = scene.slots.map((slot) => {
				const points = quadToBox(placed, scene.width, scene.height, slot.quad)
				return { slot, points, rect: quadBounds(points) }
			})
			const covered = coveredSlots(
				placedSlots.map(({ rect }) => ({
					...rect,
					left: rect.left + at.left,
					top: rect.top + at.top,
				})),
				cameraChain,
				obstacles,
				OBSTACLE_PAD,
			)
			const next = {
				scene,
				width: camera.clientWidth,
				height: camera.clientHeight,
				slots: placedSlots.map((s, i) => ({ ...s, hidden: covered[i] })),
			}
			setLayout((prev) =>
				prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
			)
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(stage)
		const obstacles = stage.querySelectorAll("[data-start-obstacle]")
		for (const o of obstacles) observer.observe(o)
		// The transforms change without a resize: the stage's `data-centered`, the camera's scale (its style), a card's
		// `data-hidden`. The measure reads where each transition ends, so it runs once when one starts; the
		// `transitionend` (not a cover's own flip) is a fallback for browsers without a transition's keyframes.
		const mutations = new MutationObserver(measure)
		mutations.observe(stage, { attributeFilter: ["data-centered"] })
		mutations.observe(camera, { attributeFilter: ["style"] })
		for (const o of obstacles)
			mutations.observe(o, { attributeFilter: ["data-hidden"] })
		const settled = (e: TransitionEvent) => {
			if (e.propertyName === "transform" && !el.contains(e.target as Node))
				measure()
		}
		stage.addEventListener("transitionend", settled)
		phone.addEventListener("change", measure)
		return () => {
			observer.disconnect()
			mutations.disconnect()
			stage.removeEventListener("transitionend", settled)
			phone.removeEventListener("change", measure)
		}
	}, [box])
	return layout
}

type Lift = { index: number | null; pinned: boolean }

/** A cover's pointer and focus handling: a mouse lifts on hover, a finger on the first tap. */
type CoverHandlers = {
	onPointerEnter: (e: React.PointerEvent) => void
	onPointerLeave: (e: React.PointerEvent) => void
	onFocus: () => void
	onBlur: () => void
	onClick: (e: React.MouseEvent) => void
}

/** The covers on the shelf. Put it in the camera box, over the picture. */
export function ShelfCovers({ titles }: { titles: readonly ShelfTitle[] }) {
	const box = useRef<HTMLDivElement>(null)
	const layout = useShelfLayout(box)
	const [lift, setLift] = useState<Lift>({ index: null, pinned: false })
	const liftRef = useRef(lift)
	liftRef.current = lift
	const navigate = useNavigate()

	// A tap elsewhere drops a pinned lift.
	useEffect(() => {
		if (!lift.pinned) return
		const off = (e: PointerEvent) => {
			if (
				(e.target as Element | null)?.closest(
					"[data-shelf-cover],[data-shelf-caption]",
				)
			)
				return
			setLift({ index: null, pinned: false })
		}
		document.addEventListener("pointerdown", off)
		return () => document.removeEventListener("pointerdown", off)
	}, [lift.pinned])

	const handlers = (index: number): CoverHandlers => ({
		onPointerEnter: (e: React.PointerEvent) => {
			if (e.pointerType === "mouse" && !liftRef.current.pinned)
				setLift({ index, pinned: false })
		},
		onPointerLeave: (e: React.PointerEvent) => {
			const now = liftRef.current
			if (e.pointerType === "mouse" && now.index === index && !now.pinned)
				setLift({ index: null, pinned: false })
		},
		onFocus: () => setLift({ index, pinned: false }),
		onBlur: () => {
			const now = liftRef.current
			if (now.index === index && !now.pinned)
				setLift({ index: null, pinned: false })
		},
		// A finger lifts on the first tap and opens on the second.
		onClick: (e: React.MouseEvent) => {
			if (canHover()) return
			const now = liftRef.current
			if (now.index === index && now.pinned) return
			e.preventDefault()
			setLift({ index, pinned: true })
		},
	})

	return (
		<div ref={box} className="start-shelf">
			{layout?.slots.map(({ slot, points, rect, hidden }, i) => {
				const title = hidden ? null : (titles[i] ?? null)
				const size = elementSize(points)
				return (
					<div
						key={`${layout.scene.width}-${i}`}
						className="absolute left-0 top-0 origin-top-left"
						style={{
							width: size.w,
							height: size.h,
							transform: quadTransform(points, size.w, size.h),
						}}
					>
						<CasedCover
							title={title}
							slot={slot}
							size={size}
							screenWidth={rect.width}
							lifted={lift.index === i}
							order={
								(rect.left / Math.max(1, layout.width)) * 0.8 +
								(rect.top / Math.max(1, layout.height)) * 0.2
							}
							handlers={handlers(i)}
						/>
					</div>
				)
			})}
			{layout ? (
				<>
					<TapTargets
						layout={layout}
						titles={titles}
						onTap={(i, title) => {
							const now = liftRef.current
							if (now.index === i && now.pinned) navigate(hrefOf(title))
							else setLift({ index: i, pinned: true })
						}}
					/>
					<LiftCaption layout={layout} titles={titles} lift={lift} />
				</>
			) : null}
		</div>
	)
}

/** One slot's cover: waits for its turn in the sweep and for its image, then flips to a new title (cover-flip.ts). */
function CasedCover({
	title,
	slot,
	size,
	screenWidth,
	lifted,
	order,
	handlers,
}: {
	title: ShelfTitle | null
	slot: ShelfSlot
	size: { w: number; h: number }
	screenWidth: number
	lifted: boolean
	/** 0..1: left to right (mostly), top to bottom: when its flip starts in the sweep. */
	order: number
	handlers: CoverHandlers
}) {
	const { shown, flip, glint } = useCoverFlip(title, order, (t) =>
		t.poster_path ? coverSrc(t.poster_path) : null,
	)

	const rotate =
		flip === "out"
			? "perspective(700px) rotateY(90deg)"
			: flip === "in-start"
				? "perspective(700px) rotateY(-90deg)"
				: "perspective(700px) rotateY(0deg)"
	// Element px per screen px: the element is 300 px wide and drawn at the slot's size.
	const unit = size.w / Math.max(1, screenWidth)
	// The bleed, in element px: a share of the slot, and never under 1 screen px (small slots on phones).
	const bleed = {
		x: Math.max(BLEED_X * size.w, unit),
		y: Math.max(BLEED_Y * size.h, unit),
	}
	// A transparent pad of 2 screen px around the drawn cover: the transformed element's own edge is then transparent,
	// and the cover's edge is filtered inside the texture instead of stair-stepping at the layer's boundary.
	const pad = 2 * unit
	return (
		<div className="relative h-full w-full">
			<div
				className="absolute"
				style={{
					left: -(bleed.x + pad),
					right: -(bleed.x + pad),
					top: -(bleed.y + pad),
					bottom: -(bleed.y + pad),
					padding: pad,
					outline: "1px solid transparent",
					transform: rotate,
					transition:
						flip === "in-start"
							? "none"
							: `transform ${HALF_FLIP_MS}ms ${flip === "out" ? "ease-in" : "ease-out"}`,
					willChange: flip || glint ? "transform" : undefined,
				}}
			>
				{shown?.poster_path ? (
					<Link
						to={hrefOf(shown)}
						prefetch="none"
						data-shelf-cover=""
						aria-label={shown.title}
						draggable={false}
						className="block h-full w-full outline-none [-webkit-tap-highlight-color:transparent]"
						{...handlers}
					>
						<CoverArt
							poster={shown.poster_path}
							slot={slot}
							unit={unit}
							bleed={bleed}
							lifted={lifted}
						>
							<div
								className="absolute inset-0 bg-amber-200 mix-blend-soft-light transition-opacity duration-500"
								style={{ opacity: glint ? 0.45 : 0 }}
							/>
						</CoverArt>
					</Link>
				) : null}
			</div>
		</div>
	)
}

const coverSrc = (path: string) => `${TMDB_IMAGE_BASE}/w185${path}`

/**
 * The printed cover in its case: the poster under the case's blue header band, the room's light over both (the slot's
 * tint, a shade away from the light, a faint sheen), and the clear plastic rim, darker toward the outside.
 */
function CoverArt({
	poster,
	slot,
	unit,
	bleed,
	lifted,
	children,
}: {
	poster: string
	slot: ShelfSlot
	/** Element px per screen px. */
	unit: number
	/** How far this box reaches past the slot on each side, in element px. */
	bleed: { x: number; y: number }
	lifted: boolean
	children?: ReactNode
}) {
	const { tint, shadeAngle, shade } = slot.light
	const fade: CSSProperties = { opacity: lifted ? 0.25 : 1 }
	const hair = Math.max(1, unit)
	const rim = Math.max(bleed.x, bleed.y)
	const bandH = `calc(${bleed.y}px + (100% - ${2 * bleed.y}px) * ${BAND})`
	return (
		<div
			className="relative h-full w-full overflow-hidden transition-transform duration-200 ease-out"
			style={{
				transform: lifted ? "translateY(-2%) scale(1.04)" : "none",
				borderRadius: hair * 1.5,
			}}
		>
			<img
				{...{ fetchpriority: "low" }}
				src={coverSrc(poster)}
				alt=""
				loading="lazy"
				decoding="async"
				draggable={false}
				className="absolute inset-x-0 bottom-0 w-full select-none object-cover"
				// Printed ink, not a screen: a little less contrast and color.
				style={{
					top: bandH,
					height: `calc(100% - ${bandH})`,
					filter: "saturate(0.86) contrast(0.9) brightness(1.02)",
				}}
			/>
			{/* The case's blue header band: no text, no logo. A lit top edge and a dark seam above the art. */}
			<div
				className="absolute inset-x-0 top-0"
				style={{
					height: bandH,
					background:
						"linear-gradient(180deg, #3d8bf0 0%, #1a63d3 38%, #0d47ad 100%)",
					boxShadow: `inset 0 ${hair}px 0 rgba(190,220,255,0.45), 0 ${hair}px 0 rgba(4,14,40,0.55)`,
				}}
			/>
			{/* The room's light and color, over the band too. */}
			<div
				className="absolute inset-0 mix-blend-multiply transition-opacity duration-200"
				style={{ background: tint, ...fade }}
			/>
			<div
				className="absolute inset-0 transition-opacity duration-200"
				style={{
					background: `linear-gradient(${shadeAngle}deg, rgba(10,5,0,0) 18%, rgba(10,5,0,${shade}) 100%)`,
					...fade,
				}}
			/>
			<div
				className="absolute inset-0 mix-blend-screen"
				style={{
					background: `linear-gradient(${shadeAngle + 145}deg, rgba(255,240,220,0) 30%, rgba(255,240,220,0.09) 44%, rgba(255,240,220,0.02) 56%, rgba(255,240,220,0) 66%)`,
				}}
			/>
			{/* The clear plastic rim: a faint light line on the outer edge, a darker band, and a hairline where the insert
			    sits under the plastic. */}
			<div
				className="absolute inset-0"
				style={{
					boxShadow: `inset 0 0 0 ${hair}px rgba(255,248,236,0.1), inset 0 0 0 ${2 * hair}px rgba(12,10,8,0.5), inset 0 0 ${rim * 1.2}px ${rim * 0.45}px rgba(12,8,4,0.5), inset 0 0 0 ${rim}px rgba(255,250,240,0.04)`,
				}}
			/>
			{/* The plastic's highlight: a thin streak along the edge facing the light. */}
			<div
				className="absolute inset-0 mix-blend-screen"
				style={{
					background: `linear-gradient(${shadeAngle + 180}deg, rgba(255,250,240,0.12) 0, rgba(255,250,240,0) ${rim * 1.4}px)`,
				}}
			/>
			{/* Lifted: an amber edge on the cover. */}
			<div
				className="absolute inset-0 transition-opacity duration-200"
				style={{
					opacity: lifted ? 1 : 0,
					boxShadow: `inset 0 0 0 ${2 * hair}px rgba(251,191,36,0.8)`,
				}}
			/>
			{children}
		</div>
	)
}

/** The lifted cover's title and score, flat and readable, below the slot (or above it). A link when pinned by a tap. */
function LiftCaption({
	layout,
	titles,
	lift,
}: { layout: ShelfLayout; titles: readonly ShelfTitle[]; lift: Lift }) {
	const last = useRef<{ index: number; title: ShelfTitle } | null>(null)
	const index = lift.index
	const title =
		index != null && !layout.slots[index]?.hidden
			? (titles[index] ?? null)
			: null
	if (index != null && title) last.current = { index, title }
	const shown = last.current
	const visible = index != null && !!title
	const placed = shown ? layout.slots[shown.index] : null
	if (!shown || !placed) return null
	const { rect } = placed
	const w = Math.min(CAPTION_W, layout.width - 16)
	const left = Math.max(
		8,
		Math.min(layout.width - w - 8, rect.left + rect.width / 2 - w / 2),
	)
	const below = rect.top + rect.height + 8
	const above = rect.top - CAPTION_H - 8
	const fits = (y: number) => y >= 8 && y + CAPTION_H <= layout.height - 8
	const top = fits(below)
		? below
		: fits(above)
			? above
			: Math.max(8, Math.min(layout.height - CAPTION_H - 8, below))
	return (
		<Link
			to={hrefOf(shown.title)}
			prefetch="none"
			data-shelf-caption=""
			tabIndex={-1}
			aria-hidden
			className="@container/card absolute block overflow-hidden rounded-md bg-gray-900 shadow-lg shadow-black/60 ring-1 ring-white/10 transition-[opacity,transform] duration-200 ease-out"
			style={{
				left,
				top,
				width: w,
				height: CAPTION_H,
				zIndex: 20,
				opacity: visible ? 1 : 0,
				transform: visible ? "none" : `translateY(${top === below ? -6 : 6}px)`,
				pointerEvents: visible && lift.pinned ? "auto" : "none",
			}}
		>
			{shown.title.backdrop_path ? (
				<img
					src={`${TMDB_IMAGE_BASE}/w300${shown.title.backdrop_path}`}
					alt=""
					className="absolute inset-0 h-full w-full object-cover opacity-60"
				/>
			) : null}
			<TitleBand
				title={shown.title.title}
				year={shown.title.release_year}
				top={
					<ScorePill
						goodwatch={shown.title.goodwatch_overall_score_normalized_percent}
						score={null}
						mark={null}
						size="M"
						className="mb-1.5"
					/>
				}
			/>
		</Link>
	)
}

/** Finger-sized tap targets over covers too small to hit on a touch screen (unrotated, centered on the slot). */
function TapTargets({
	layout,
	titles,
	onTap,
}: {
	layout: ShelfLayout
	titles: readonly ShelfTitle[]
	onTap: (index: number, title: ShelfTitle) => void
}) {
	if (canHover()) return null
	return (
		<>
			{layout.slots.map(({ rect, hidden }, i) => {
				const title = titles[i]
				if (
					hidden ||
					!title?.poster_path ||
					(rect.width >= MIN_TAP && rect.height >= MIN_TAP)
				)
					return null
				const w = Math.max(MIN_TAP, rect.width)
				const h = Math.max(MIN_TAP, rect.height)
				return (
					<button
						// biome-ignore lint/suspicious/noArrayIndexKey: the slots are fixed per scene
						key={i}
						type="button"
						aria-label={title.title}
						tabIndex={-1}
						data-shelf-cover=""
						className="absolute [-webkit-tap-highlight-color:transparent]"
						style={{
							left: rect.left + rect.width / 2 - w / 2,
							top: rect.top + rect.height / 2 - h / 2,
							width: w,
							height: h,
						}}
						onClick={() => onTap(i, title)}
					/>
				)
			})}
		</>
	)
}
