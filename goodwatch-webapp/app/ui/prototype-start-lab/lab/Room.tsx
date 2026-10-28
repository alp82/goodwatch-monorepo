// PROTOTYPE (start page lab): the room any block can place, with the chosen shelf and tv variants wired in.
// Give it a size (className/style). See types.ts for the contract.
// A block that wants the TV hint on a scene without a TV (the round 2 stage scenes) gets the lab's TV scene instead:
// the same room's TV corner (Lab.tvScene).
import { createContext, useCallback, useContext, useRef, useState } from "react"
import { type SceneLayout, SceneStage } from "../scene/SceneStage"
import { type IntroFrom, type RoomProps, type ShelfVariant, type TvVariant, useLab } from "./types"

export const RoomParts = createContext<{ shelf: ShelfVariant; tv: TvVariant } | null>(null)

export function Room({
	className = "",
	style,
	focal,
	zoom,
	posters,
	noTv,
	noOverlay,
	children,
	portraitBelow,
	scene,
	hideSlot,
	place,
}: RoomProps) {
	const lab = useLab()
	const parts = useContext(RoomParts)
	const box = useRef<HTMLDivElement>(null)
	const [layout, setLayout] = useState<SceneLayout | null>(null)
	const cards = posters ?? lab.shelfTitles
	const pair = scene ?? (!noTv && !lab.scene.landscape.tv ? lab.tvScene : lab.scene)

	const onPlay = useCallback(() => {
		const el = box.current
		if (!el || !layout?.tv) return lab.playIntro(null)
		const r = el.getBoundingClientRect()
		const img = el.querySelector("img")
		const tvPoints = layout.tv.points.map(([x, y]) => [x + r.left, y + r.top] as [number, number])
		const from: IntroFrom = {
			tvPoints,
			tvRect: {
				left: layout.tv.rect.left + r.left,
				top: layout.tv.rect.top + r.top,
				width: layout.tv.rect.width,
				height: layout.tv.rect.height,
			},
			roomRect: { left: r.left, top: r.top, width: r.width, height: r.height },
			image: {
				src: img?.currentSrc || img?.src || "",
				left: layout.cover.dx,
				top: layout.cover.dy,
				width: layout.cover.iw * layout.cover.scale,
				height: layout.cover.ih * layout.cover.scale,
			},
		}
		lab.playIntro(from)
	}, [lab, layout])

	if (!parts) return null
	const { shelf, tv } = parts
	const Slot = shelf.Slot
	const Overlay = shelf.Overlay
	const Hint = tv.Hint
	const Near = tv.Near
	return (
		<div ref={box} className={`relative ${className}`} style={style} data-lab-room={pair.id}>
			<SceneStage
				pair={pair}
				// Inline: the stage's own `relative` class would beat an `absolute` class.
				style={{ position: "absolute", inset: 0 }}
				focal={focal}
				zoom={zoom}
				portraitBelow={portraitBelow}
				renderSlot={
					Slot
						? (slot, i, size) => {
								const rect = layout?.slots[i]?.rect
								if (hideSlot && rect && hideSlot(rect, i)) return null
								return <Slot card={cards[i] ?? null} slot={slot} index={i} size={size} />
							}
						: undefined
				}
				renderTv={noTv ? undefined : (size) => <Hint size={size} onPlay={onPlay} />}
				onLayout={setLayout}
				place={place}
			>
				{!noOverlay && Overlay ? <Overlay cards={cards} layout={layout} /> : null}
				{!noTv && Near && layout?.tv ? <Near tvRect={layout.tv.rect} onPlay={onPlay} /> : null}
				{children}
			</SceneStage>
		</div>
	)
}
