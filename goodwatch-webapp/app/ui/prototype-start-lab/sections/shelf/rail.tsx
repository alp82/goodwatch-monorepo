// PROTOTYPE (start page lab): c "Overlay rail": the slots keep a faint poster as decor, and the real poster cards sit
// in a rail docked over the room's foot. Pointing at a card lights its slot (and the other way round).
import { Link } from "@remix-run/react"
import { useRef } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { titleHref, tmdbImage } from "../../lab/kit"
import type { LabCard, SlotProps } from "../../lab/types"
import type { SceneLayout } from "../../scene/SceneStage"
import { setShelf, useRoomEl, useShelf } from "./store"

export function RailSlot({ card, index }: SlotProps) {
	const ref = useRef<HTMLAnchorElement>(null)
	const room = useRoomEl(ref)
	const lit = useShelf(room).lift === index
	if (!card?.poster_path) return null
	return (
		<Link
			ref={ref}
			to={titleHref(card)}
			prefetch="none"
			tabIndex={-1}
			aria-hidden
			draggable={false}
			className="relative block h-full w-full [-webkit-tap-highlight-color:transparent]"
			onPointerEnter={(e) => e.pointerType === "mouse" && setShelf(room, { lift: index })}
			onPointerLeave={(e) => e.pointerType === "mouse" && setShelf(room, { lift: null })}
		>
			<img
				src={tmdbImage(card.poster_path, "w185")}
				alt=""
				draggable={false}
				className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
				style={{ opacity: lit ? 1 : 0.32 }}
			/>
			<div
				className="absolute inset-0 shadow-[0_0_0_8px_rgba(251,191,36,0.8)] transition-opacity duration-200"
				style={{ opacity: lit ? 1 : 0 }}
			/>
		</Link>
	)
}

export function RailOverlay({ cards, layout }: { cards: LabCard[]; layout: SceneLayout | null }) {
	const ref = useRef<HTMLDivElement>(null)
	const room = useRoomEl(ref)
	const lift = useShelf(room).lift
	const count = layout ? Math.min(cards.length, Math.max(layout.slots.length, 1)) : 0
	const ch = layout?.cover.ch ?? 400
	// About a third of the room's height, never too small to read or too big for a short room.
	const cardW = Math.round(Math.max(72, Math.min(128, (ch * 0.34) / 1.5)))
	// The rail docks at the foot, or at the top when the TV sits low in the crop (coffee table), so it never hides the TV.
	const tv = layout?.tv.rect
	const top = !!tv && tv.top + tv.height / 2 > ch * 0.55
	return (
		<div ref={ref} className="pointer-events-none absolute inset-0">
			{count > 0 ? (
				<div
					className={`absolute inset-x-0 from-gray-950/95 via-gray-950/70 to-transparent ${top ? "top-0 bg-gradient-to-b pb-10" : "bottom-0 bg-gradient-to-t pt-10"}`}
				>
					<div
						className={`pointer-events-auto flex snap-x gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:gap-3 ${top ? "pt-3" : "pb-3"}`}
					>
						{cards.slice(0, count).map((card, i) => (
							<div
								key={card.key}
								className="shrink-0 snap-start transition-transform duration-200 ease-out"
								style={{ width: cardW, transform: lift === i ? "translateY(-6px)" : "none" }}
								onPointerEnter={(e) => e.pointerType === "mouse" && setShelf(room, { lift: i })}
								onPointerLeave={(e) => e.pointerType === "mouse" && setShelf(room, { lift: null })}
								onFocus={() => setShelf(room, { lift: i })}
								onBlur={() => setShelf(room, { lift: null })}
							>
								<TitlePosterCard card={card} actions={false} />
							</div>
						))}
					</div>
				</div>
			) : null}
		</div>
	)
}
