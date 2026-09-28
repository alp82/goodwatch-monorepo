// Discover's grid of title cards. The grid is never replaced: titles in both the old and the new list glide to their
// new places, new ones scale in, leaving ones fade out. After For you flips, each moved card shows how far it moved
// ("↑4", "↓2") for a moment. With reduced motion, only short opacity fades run: MotionConfig alone still let the
// layout glide run, so the grid turns layout animation off itself.
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid"
import {
	AnimatePresence,
	type Transition,
	motion,
	useReducedMotion,
} from "framer-motion"
import type { ReactNode } from "react"
import type { TitleCard } from "~/server/title-cards.server"
import { SPRING } from "~/ui/filter-bar/motion"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import type { TitleKey } from "~/utils/title-key"

export const DISCOVER_GRID =
	"grid grid-cols-2 gap-3 xs:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6"

const EASE_OUT = [0.22, 1, 0.36, 1] as const
// A new order (filters, sort): a quick glide on a slightly overshooting ease.
const GLIDE: Transition = { duration: 0.26, ease: [0.3, 1.35, 0.55, 1] }
// For you reordering the same titles: a softer spring, so the eye can follow a card to its new place.
const FLIP_GLIDE: Transition = { type: "spring", stiffness: 140, damping: 22 }

export function DiscoverGrid({
	cards,
	marks,
	flipping = false,
	children,
}: {
	cards: TitleCard[]
	/** How far each title moved when For you last flipped (positive: up); null when no marks show. */
	marks: Map<TitleKey, number> | null
	/** For you just reordered the list. */
	flipping?: boolean
	/** After the last card, for example the hidden-titles cell. */
	children?: ReactNode
}) {
	const reduce = useReducedMotion() ?? false
	return (
		<div className={DISCOVER_GRID}>
			<AnimatePresence initial={false} mode="popLayout">
				{cards.map((card, index) => {
					const delta = marks?.get(card.key) ?? 0
					return (
						<motion.div
							key={card.key}
							layout={reduce ? false : "position"}
							initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
							animate={{
								opacity: 1,
								scale: 1,
								transition: { duration: 0.18, ease: EASE_OUT },
							}}
							exit={
								reduce
									? { opacity: 0, transition: { duration: 0.1 } }
									: { opacity: 0, scale: 0.96, transition: { duration: 0.1 } }
							}
							transition={flipping ? FLIP_GLIDE : GLIDE}
							className="relative"
						>
							<TitlePosterCard card={card} prefetch={index < 12} />
							<MoveMark delta={delta} reduce={reduce} />
						</motion.div>
					)
				})}
			</AnimatePresence>
			{children}
		</div>
	)
}

// Sits over the card's top left corner, inside the card's resting scale (the card is scale-95 until hovered).
function MoveMark({ delta, reduce }: { delta: number; reduce: boolean }) {
	return (
		<div className="pointer-events-none absolute inset-0 scale-95">
			<AnimatePresence>
				{delta !== 0 && (
					<motion.span
						data-move-mark={delta}
						initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={SPRING}
						className={`absolute top-3 left-3 z-10 flex h-7 items-center gap-0.5 rounded-full px-2 text-[13px] font-black tabular-nums shadow-lg ring-[3px] ring-gray-900 ${delta > 0 ? "bg-amber-400 text-gray-950" : "bg-gray-700 text-gray-200"}`}
					>
						{delta > 0 ? (
							<ArrowUpIcon className="h-3.5 w-3.5" aria-hidden />
						) : (
							<ArrowDownIcon className="h-3.5 w-3.5" aria-hidden />
						)}
						{Math.abs(delta)}
						<span className="sr-only">
							{delta > 0 ? " places up" : " places down"}
						</span>
					</motion.span>
				)}
			</AnimatePresence>
		</div>
	)
}
