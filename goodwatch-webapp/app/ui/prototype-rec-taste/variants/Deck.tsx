// PROTOTYPE - throwaway. Swipe deck (existing components, mobile-first): your next picks as a poster
// stack. Drag left = not interested, right = not seen (keep it), up = seen it. S / N / X / W / U on
// desktop. The "Your picks now" filmstrip re-sorts after every answer.
import { ArrowUturnLeftIcon, BookmarkIcon, CheckIcon, EyeSlashIcon, NoSymbolIcon } from "@heroicons/react/24/outline"
import { AnimatePresence, type PanInfo, motion, useMotionValue, useTransform } from "framer-motion"
import { useState } from "react"
import GenreBadge from "~/ui/badge/GenreBadge"
import Button from "~/ui/button/Button"
import { reasonText } from "../engine"
import { Kbd, MatchText, Moved, PosterCard, ServicesSwitch, VibeBar, layoutSpring, useKeys } from "../kit"
import type { PoolItem, Signal } from "../model"
import type { Taste } from "../useTaste"

type Dir = "left" | "right" | "up"
const THRESHOLD = 90

const DIRS: Record<Dir, { label: string; color: string; signal: Signal }> = {
	left: { label: "Not interested", color: "#57534e", signal: { kind: "no" } },
	right: { label: "Not seen", color: "#0369a1", signal: { kind: "unseen" } },
	up: { label: "Seen it", color: "#15803d", signal: { kind: "seen" } },
}

export default function Deck({ taste }: { taste: Taste }) {
	const deck = taste.triage.slice(0, 3)
	const top = deck[0]
	const [exitDir, setExitDir] = useState<Dir | null>(null)
	const [lastSeen, setLastSeen] = useState<PoolItem | null>(null)

	const answer = (dir: Dir | "want") => {
		if (!top) return
		if (dir === "want") {
			setExitDir("right")
			taste.set(top.item.key, { kind: "want" })
			setLastSeen(null)
			return
		}
		setExitDir(dir)
		taste.set(top.item.key, DIRS[dir].signal)
		setLastSeen(dir === "up" ? top.item : null)
	}

	useKeys({
		s: () => answer("up"),
		n: () => answer("right"),
		x: () => answer("left"),
		w: () => answer("want"),
		u: () => {
			setLastSeen(null)
			taste.undo()
		},
	})

	return (
		<div className="mx-auto max-w-6xl px-4 pb-40 pt-5 md:px-8 md:pb-28">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-3xl font-bold text-white md:text-4xl">Your taste</h1>
					<p className="mt-1 text-sm text-gray-400">
						Seen these? Swipe to clean up your picks.{taste.counts.session ? ` ${taste.counts.session} answers this visit.` : ""}
					</p>
				</div>
				<ServicesSwitch taste={taste} />
			</header>

			<div className="mt-4 flex flex-col gap-8 md:mt-6 md:flex-row md:items-start">
				<section className="mx-auto w-full max-w-sm shrink-0">
					<div className="relative mx-auto aspect-[2/3] w-[54%] max-w-[300px] md:w-full">
						<AnimatePresence initial={false} custom={exitDir}>
							{deck
								.slice()
								.reverse()
								.map((p) => {
									const depth = deck.indexOf(p)
									return depth === 0 ? (
										<TopCard key={p.item.key} item={p.item} taste={taste} onAnswer={answer} />
									) : (
										<motion.div
											key={p.item.key}
											className="absolute inset-0"
											initial={false}
											animate={{ scale: 1 - depth * 0.06, y: depth * 16, opacity: 1 - depth * 0.3 }}
											transition={layoutSpring}
										>
											<PosterCard item={p.item} services={taste.services} showTitle={false} />
										</motion.div>
									)
								})}
						</AnimatePresence>
						{!top && <div className="absolute inset-0 flex items-center justify-center rounded-lg border-4 border-gray-800 text-gray-400">All caught up.</div>}
					</div>

					{top && (
						<div className="mt-5 text-center md:mt-7">
							<h2 className="text-xl font-bold text-white">
								{top.item.title} <span className="font-normal text-gray-400">({top.item.year})</span>
							</h2>
							<div className="mt-1">
								<MatchText match={top.match} />
							</div>
							<p className="mx-auto mt-1 max-w-xs text-sm text-gray-300">{reasonText(top)}</p>
							<div className="mt-3 hidden flex-wrap justify-center gap-1.5 md:flex">
								{top.item.genres.slice(0, 3).map((g) => (
									<GenreBadge key={g} genre={g} size="sm" />
								))}
							</div>
						</div>
					)}

					<div className="mt-5 grid grid-cols-4 gap-2">
						<DeckAction label="Not interested" short="Pass" icon={NoSymbolIcon} k="X" tone="border-stone-500/40 bg-stone-800" onClick={() => answer("left")} />
						<DeckAction label="Seen it" short="Seen" icon={CheckIcon} k="S" tone="border-emerald-400/40 bg-emerald-800" onClick={() => answer("up")} />
						<DeckAction label="Not seen" short="Not seen" icon={EyeSlashIcon} k="N" tone="border-sky-400/40 bg-sky-800" onClick={() => answer("right")} />
						<DeckAction label="Want to See" short="Want" icon={BookmarkIcon} k="W" tone="border-amber-400/40 bg-amber-800" onClick={() => answer("want")} />
					</div>
					<p className="mt-3 hidden items-center justify-center gap-2 text-xs text-gray-500 md:flex">
						Drag the poster, or press the keys. <Kbd>U</Kbd> undo
					</p>

					<AnimatePresence>
						{lastSeen && (
							<motion.div
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: 12 }}
								className="mt-4 rounded-xl border-2 border-gray-700 bg-gray-900 p-3"
							>
								<div className="mb-2 flex items-center justify-between text-sm">
									<span className="text-gray-200">
										How was <strong className="text-white">{lastSeen.title}</strong>?
									</span>
									<button type="button" className="text-gray-400 hover:text-white" onClick={() => setLastSeen(null)}>
										Skip
									</button>
								</div>
								<VibeBar
									compact
									onScore={(s) => {
										taste.set(lastSeen.key, { kind: "score", score: s })
										setLastSeen(null)
									}}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</section>

				<section className="min-w-0 flex-1">
					<div className="flex items-baseline justify-between gap-2">
						<h2 className="text-lg font-bold text-white">Your picks now</h2>
						<Button icon={ArrowUturnLeftIcon} highlight="stone" mode="dark" size="xs" disabled={!taste.history.length} onClick={taste.undo}>
							Undo
						</Button>
					</div>
					<div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-5">
						{taste.picks.slice(0, 10).map((p, i) => (
							<motion.div key={p.item.key} layout transition={layoutSpring} className="w-32 shrink-0 md:w-auto">
								<PosterCard item={p.item} services={taste.services} showTitle={false} />
								<div className="mt-1 flex items-center justify-between gap-1 px-1">
									<MatchText match={p.match} className="truncate" />
									<Moved delta={taste.moved(p.item.key, i)} />
								</div>
								<div className="truncate px-1 text-xs font-semibold text-gray-300">{p.item.title}</div>
							</motion.div>
						))}
					</div>
				</section>
			</div>
		</div>
	)
}

function TopCard({ item, taste, onAnswer }: { item: PoolItem; taste: Taste; onAnswer: (d: Dir) => void }) {
	const x = useMotionValue(0)
	const y = useMotionValue(0)
	const rotate = useTransform(x, [-200, 200], [-12, 12])
	const [dir, setDir] = useState<Dir | null>(null)
	const pick = (dx: number, dy: number): Dir | null => {
		if (dy < -THRESHOLD && Math.abs(dy) > Math.abs(dx)) return "up"
		if (dx > THRESHOLD) return "right"
		if (dx < -THRESHOLD) return "left"
		return null
	}
	const tint = dir ? DIRS[dir].color : "transparent"
	return (
		<motion.div
			className="absolute inset-0 z-10 cursor-grab touch-none active:cursor-grabbing"
			style={{ x, y, rotate }}
			drag
			dragSnapToOrigin
			dragElastic={0.9}
			onDrag={(_, info: PanInfo) => setDir(pick(info.offset.x, info.offset.y))}
			onDragEnd={(_, info: PanInfo) => {
				const d = pick(info.offset.x, info.offset.y)
				setDir(null)
				if (d) onAnswer(d)
			}}
			initial={{ scale: 0.94, y: 16, opacity: 0.7 }}
			animate={{ scale: 1, y: 0, opacity: 1 }}
			variants={{
				gone: (custom: Dir | null) => ({
					x: custom === "left" ? -420 : custom === "right" ? 420 : 0,
					y: custom === "up" ? -520 : 0,
					opacity: 0,
					rotate: custom === "left" ? -18 : custom === "right" ? 18 : 0,
					transition: { duration: 0.28 },
				}),
			}}
			exit="gone"
			transition={layoutSpring}
		>
			<div className="relative">
				<PosterCard item={item} services={taste.services} showTitle={false} />
				<div className="pointer-events-none absolute inset-1 rounded-md transition-colors" style={{ backgroundColor: tint, opacity: dir ? 0.55 : 0 }} />
				{dir && (
					<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
						<span className="rounded-xl border-2 border-white/70 bg-black/60 px-4 py-2 text-xl font-bold text-white">{DIRS[dir].label}</span>
					</div>
				)}
			</div>
		</motion.div>
	)
}

function DeckAction({ label, short, icon: Icon, k, tone, onClick }: { label: string; short: string; icon: typeof CheckIcon; k: string; tone: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={`${label} (${k})`}
			className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 text-xs font-semibold text-white shadow-md shadow-gray-600/30 hover:brightness-125 ${tone}`}
		>
			<Icon className="h-5 w-5" />
			<span className="truncate max-w-full">{short}</span>
		</button>
	)
}

