// PROTOTYPE - throwaway. Variant "deck": split screen. The form sits on the left; on the right, a 3D deck of posters
// swaps its front card every few seconds (after react-bits Card Swap) while the backdrop of the front title
// cross-fades behind it with a slow zoom. Click the deck to swap now; hovering pauses it.
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { BlurText, STAGE, ScoreBadge, Wordmark } from "./shared"
import { type VariantProps, seededShuffle } from "./types"

const DECK = 12
const VISIBLE = 5
const SWAP_MS = 4200

export function Deck({ titles, form }: VariantProps) {
	const deck = useMemo(() => seededShuffle(titles, 37).slice(0, DECK), [titles])
	const [order, setOrder] = useState(() => deck.map((_, i) => i))
	const [paused, setPaused] = useState(false)
	const lastFront = useRef<number | null>(null)

	const swap = () => {
		setOrder((o) => {
			lastFront.current = o[0]
			return [...o.slice(1), o[0]]
		})
	}
	useEffect(() => {
		if (paused) return
		const id = setInterval(swap, SWAP_MS)
		return () => clearInterval(id)
	}, [paused])

	const front = deck[order[0]]

	return (
		<div className={`${STAGE} flex`}>
			<div className="relative z-10 flex w-full items-center justify-center bg-gray-950 px-4 py-10 lg:w-[44%] lg:shadow-[40px_0_80px_rgba(3,7,18,.9)]">
				<div className="w-full max-w-md">
					<div className="mb-8">
						<Wordmark />
						<h1 className="mt-5 text-4xl font-bold text-white">
							<BlurText text="Welcome back" />
						</h1>
						<p className="mt-2 text-white/50">Pick up where you left off.</p>
					</div>
					{form}
				</div>
			</div>

			<div
				className="relative hidden flex-1 cursor-pointer overflow-hidden lg:block"
				onMouseEnter={() => setPaused(true)}
				onMouseLeave={() => setPaused(false)}
				onClick={swap}
				onKeyDown={(e) => e.key === "Enter" && swap()}
			>
				<AnimatePresence initial={false}>
					<motion.img
						key={front.key}
						src={front.backdrop}
						alt=""
						className="absolute inset-0 h-full w-full object-cover will-change-transform"
						initial={{ opacity: 0, scale: 1.12 }}
						animate={{ opacity: 0.55, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ opacity: { duration: 1.4 }, scale: { duration: 9, ease: "linear" } }}
					/>
				</AnimatePresence>
				<div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/40 to-gray-950/20" />
				<div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-gray-950/60" />

				<div className="absolute left-[38%] top-[48%]" style={{ perspective: 1100 }}>
					<div style={{ transformStyle: "preserve-3d" }}>
						{deck.map((t, idx) => {
							const slot = order.indexOf(idx)
							const shown = Math.min(slot, VISIBLE)
							const dropping = idx === lastFront.current && slot === DECK - 1
							const target = {
								x: shown * 46,
								y: -shown * 38,
								z: -shown * 90,
								rotateY: -14,
								skewY: 3,
								opacity: slot >= VISIBLE ? 0 : 1,
								filter: `brightness(${1 - shown * 0.13})`,
							}
							return (
								<motion.div
									key={t.key}
									className="absolute -left-[130px] -top-[195px] h-[390px] w-[260px] overflow-hidden rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,.9)] ring-1 ring-white/15"
									style={{ zIndex: DECK - slot }}
									initial={false}
									animate={
										dropping
											? { ...target, y: [0, 520, target.y], x: [0, 30, target.x], z: [0, 0, target.z], opacity: [1, 1, 0] }
											: target
									}
									transition={
										dropping ? { duration: 1.6, times: [0, 0.45, 1], ease: [0.65, 0, 0.35, 1] } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }
									}
								>
									<img src={t.poster} alt={t.title} draggable={false} className="h-full w-full object-cover" />
								</motion.div>
							)
						})}
					</div>
				</div>

				<div className="absolute bottom-10 left-10 right-10">
					<AnimatePresence mode="wait">
						<motion.div
							key={front.key}
							initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
							animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
							exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
							transition={{ duration: 0.5 }}
						>
							<div className="text-xs uppercase tracking-[.25em] text-white/40">
								{front.type === "show" ? "Show" : "Movie"} · {front.year}
							</div>
							<div className="mt-1 flex items-center gap-3 text-3xl font-bold text-white">
								{front.title} <ScoreBadge score={front.score} />
							</div>
						</motion.div>
					</AnimatePresence>
					<div className="mt-5 h-0.5 w-48 overflow-hidden rounded-full bg-white/10">
						<motion.div
							key={`${front.key}-${paused}`}
							className="h-full origin-left bg-amber-400"
							initial={{ scaleX: 0 }}
							animate={{ scaleX: paused ? 0 : 1 }}
							transition={{ duration: paused ? 0.2 : SWAP_MS / 1000, ease: "linear" }}
						/>
					</div>
					<div className="mt-3 text-sm text-white/40">Rated, scored, and on a service near you.</div>
				</div>
			</div>
		</div>
	)
}
