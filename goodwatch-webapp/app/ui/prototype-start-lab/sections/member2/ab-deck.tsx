// PROTOTYPE (start page lab, round 2): member a's deck: one candidate at a time in a fixed box, the next one peeking
// behind it. Not tonight throws the card left, Later drops it into the tray below, a re-rank crossfades. On a
// phone the card can be swiped (left: Not tonight, right: Later). Transform and opacity only.
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion"
import { useEffect, useRef } from "react"
import { tmdbImage } from "../../lab/kit"
import { CardFace, ReasonLines } from "./ab-card"
import { type Candidate, reasonOf } from "./ab-rank"

export type Move = "skip" | "later" | "rerank"

const variants = {
	enter: (d: Move) => (d === "rerank" ? { opacity: 0, scale: 0.98, y: 0, x: 0 } : { opacity: 0.5, scale: 0.95, y: 12, x: 0 }),
	center: { opacity: 1, scale: 1, y: 0, x: 0 },
	exit: (d: Move) =>
		d === "skip"
			? { x: -520, opacity: 0, transition: { duration: 0.32, ease: [0.4, 0, 1, 1] } }
			: d === "later"
				? { y: 180, scale: 0.35, opacity: 0, transition: { duration: 0.34, ease: [0.4, 0, 1, 1] } }
				: { opacity: 0, transition: { duration: 0.16 } },
}

export function Deck({
	cur,
	next,
	after,
	move,
	onMove,
	empty,
	className,
}: {
	cur: Candidate | null
	next: Candidate | null
	/** The few after `next`, to warm their images. */
	after: Candidate[]
	move: Move
	onMove: (m: "skip" | "later") => void
	empty: React.ReactNode
	/** The box's size (fixed height). */
	className: string
}) {
	useEffect(() => {
		for (const c of after) {
			const img = new Image()
			img.src = tmdbImage(c.backdrop ?? c.card.poster_path, c.backdrop ? "w1280" : "w780")
		}
	}, [after])

	return (
		<div className={`relative ${className}`}>
			{next ? (
				<div aria-hidden className="pointer-events-none absolute inset-0 translate-y-3 scale-95 opacity-50">
					<CardFace c={next} lines={<ReasonLines c={next} reason={reasonOf(next)} />} />
				</div>
			) : null}
			<AnimatePresence initial={false} custom={move}>
				{cur ? <DeckCard key={cur.card.key} c={cur} move={move} onMove={onMove} /> : null}
			</AnimatePresence>
			{!cur ? <div className="absolute inset-0">{empty}</div> : null}
		</div>
	)
}

function DeckCard({ c, move, onMove }: { c: Candidate; move: Move; onMove: (m: "skip" | "later") => void }) {
	const x = useMotionValue(0)
	const rotate = useTransform(x, [-240, 0, 240], [-7, 0, 7])
	const dragged = useRef(false)
	return (
		<motion.div
			className="absolute inset-0 touch-pan-y"
			custom={move}
			variants={variants}
			initial="enter"
			animate="center"
			exit="exit"
			transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
			style={{ x, rotate }}
			drag="x"
			dragSnapToOrigin
			dragElastic={0.6}
			dragConstraints={{ left: 0, right: 0 }}
			onPointerDown={() => {
				dragged.current = false
			}}
			onDragStart={() => {
				dragged.current = true
			}}
			onDragEnd={(_, info) => {
				if (info.offset.x < -90 || info.velocity.x < -600) onMove("skip")
				else if (info.offset.x > 90 || info.velocity.x > 600) onMove("later")
			}}
		>
			<CardFace
				c={c}
				lines={<ReasonLines c={c} reason={reasonOf(c)} />}
				onTitle={(e) => {
					if (dragged.current) e.preventDefault()
				}}
			/>
		</motion.div>
	)
}
