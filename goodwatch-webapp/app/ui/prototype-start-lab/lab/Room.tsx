// PROTOTYPE (start page lab): the room any block can place, with the chosen shelf and tv variants wired in.
// Give it a size (className/style). See types.ts for the contract.
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
}: RoomProps) {
	const lab = useLab()
	const parts = useContext(RoomParts)
	const box = useRef<HTMLDivElement>(null)
	const [layout, setLayout] = useState<SceneLayout | null>(null)
	const cards = posters ?? lab.shelfTitles

	const onPlay = useCallback(() => {
		const el = box.current
		if (!el || !layout) return lab.playIntro(null)
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
		<div ref={box} className={`relative ${className}`} style={style} data-lab-room={lab.scene.id}>
			<SceneStage
				pair={lab.scene}
				className="absolute inset-0"
				focal={focal}
				zoom={zoom}
				portraitBelow={portraitBelow}
				renderSlot={Slot ? (slot, i, size) => <Slot card={cards[i] ?? null} slot={slot} index={i} size={size} /> : undefined}
				renderTv={noTv ? undefined : (size) => <Hint size={size} onPlay={onPlay} />}
				onLayout={setLayout}
			>
				{!noOverlay && Overlay ? <Overlay cards={cards} layout={layout} /> : null}
				{!noTv && Near && layout ? <Near tvRect={layout.tv.rect} onPlay={onPlay} /> : null}
				{children}
			</SceneStage>
		</div>
	)
}
