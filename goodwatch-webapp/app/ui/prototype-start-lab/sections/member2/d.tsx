// PROTOTYPE (start page lab, round 2): member d "This or that from your lists": two titles from Sam's own lists
// side by side over the room; tap the one you'd rather watch, the winner stays and a challenger from another list
// takes the other side; three taps give tonight's pick. "Neither" deals a new pair, Start over reshuffles.
// Search sits above with its results in the same fixed box; the doors open each list inline below.
import { ArrowPathIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"
import { EASE } from "~/ui/watch-next/style"
import { titleHref } from "../../lab/kit"
import { type BlockVariant, useLab } from "../../lab/types"
import { DISPLAY, HREF, WRAP, greeting, posterSrc } from "../member/shared"
import { Doors } from "./cd-doors"
import { type Candidate, GHOST, SOURCE_LABEL, SearchBox, type Source, WatchLink, factsLine, useDeck } from "./cd-shared"

const ROUNDS = 3

type Duel = {
	/** Rotates the deck on Start over, so a new run deals different titles. */
	epoch: number
	left: number | null
	right: number | null
	seen: number[]
	taps: number
	/** The side Sam just chose (for its little nod), and the finished pick. */
	chose: "left" | "right" | null
	done: number | null
	runnerUp: number | null
}

/** The next title nobody has seen in this run, from another list than `avoid` when there is one. */
function next(order: Candidate[], seen: Set<number>, avoid?: Source): Candidate | null {
	const fresh = order.filter((c) => !seen.has(c.card.key))
	return fresh.find((c) => c.source !== avoid) ?? fresh[0] ?? null
}

function deal(order: Candidate[], epoch: number, seenBefore: number[] = []): Duel {
	const seen = new Set(seenBefore)
	const a = next(order, seen)
	if (a) seen.add(a.card.key)
	const b = next(order, seen, a?.source)
	if (b) seen.add(b.card.key)
	return { epoch, left: a?.card.key ?? null, right: b?.card.key ?? null, seen: [...seen], taps: 0, chose: null, done: null, runnerUp: null }
}

function ThisOrThat() {
	const { Room } = useLab()
	const { m, deck } = useDeck()
	const [duel, setDuel] = useState<Duel>(() => deal(deck, 0))
	// Each run starts four titles further down the deck (Tonight's pick leads the first run).
	const order = useMemo(() => {
		const n = deck.length
		const k = n ? (duel.epoch * 4) % n : 0
		return [...deck.slice(k), ...deck.slice(0, k)]
	}, [deck, duel.epoch])
	const byKey = useMemo(() => new Map(deck.map((c) => [c.card.key, c])), [deck])
	const left = duel.left != null ? (byKey.get(duel.left) ?? null) : null
	const right = duel.right != null ? (byKey.get(duel.right) ?? null) : null
	const done = duel.done != null ? (byKey.get(duel.done) ?? null) : null
	const runnerUp = duel.runnerUp != null ? (byKey.get(duel.runnerUp) ?? null) : null

	const choose = (side: "left" | "right") => {
		const win = side === "left" ? left : right
		const lose = side === "left" ? right : left
		if (!win) return
		const taps = duel.taps + 1
		const seen = new Set(duel.seen)
		const challenger = taps < ROUNDS ? next(order, seen, win.source) : null
		if (!challenger) {
			setDuel({ ...duel, taps, chose: side, done: win.card.key, runnerUp: lose?.card.key ?? null })
			return
		}
		seen.add(challenger.card.key)
		setDuel({
			...duel,
			taps,
			chose: side,
			seen: [...seen],
			left: side === "left" ? win.card.key : challenger.card.key,
			right: side === "right" ? win.card.key : challenger.card.key,
		})
	}
	const neither = () => {
		const d = deal(order, duel.epoch, duel.seen)
		setDuel(d.left != null && d.right != null ? { ...d, taps: duel.taps } : deal(order, duel.epoch))
	}
	const restart = () => {
		const epoch = duel.epoch + 1
		const n = deck.length
		const k = n ? (epoch * 4) % n : 0
		setDuel(deal([...deck.slice(k), ...deck.slice(0, k)], epoch))
	}

	return (
		<div className="pb-28">
			<section className="relative isolate overflow-hidden" aria-label="Tonight">
				{/* The room behind it all, dimmed; its shelves hold the titles still in the running. */}
				<Room
					style={{ position: "absolute", inset: 0, zIndex: -1 }}
					posters={order.filter((c) => !duel.seen.includes(c.card.key) || c.card.key === duel.left || c.card.key === duel.right).map((c) => c.card)}
					noTv
					noOverlay
				>
					<div className="pointer-events-none absolute inset-0 bg-gray-950/75" />
					<div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-gray-950 to-transparent" />
				</Room>

				<div className={`${WRAP} pt-4 pb-2 lg:pt-8`}>
					<h1 className="text-sm font-semibold text-amber-300">{greeting(m.name)}</h1>
					<SearchBox boxClass="mt-3 h-[452px] sm:h-[500px] lg:h-[540px]">
						<div className="relative h-full">
							<AnimatePresence initial={false}>
								<motion.div
									key={done ? `done:${done.card.key}` : `duel:${duel.epoch}`}
									className="absolute inset-0"
									initial={{ opacity: 0, scale: 0.98 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.3, ease: EASE }}
								>
									{done ? (
										<Result pick={done} runnerUp={runnerUp} onAgain={restart} />
									) : (
										<Pair
											left={left}
											right={right}
											taps={duel.taps}
											chose={duel.chose}
											onChoose={choose}
											onNeither={neither}
											onRestart={restart}
										/>
									)}
								</motion.div>
							</AnimatePresence>
						</div>
					</SearchBox>
				</div>
			</section>

			<Doors m={m} className="mt-8" />
		</div>
	)
}

function Pair({
	left,
	right,
	taps,
	chose,
	onChoose,
	onNeither,
	onRestart,
}: {
	left: Candidate | null
	right: Candidate | null
	taps: number
	chose: "left" | "right" | null
	onChoose: (side: "left" | "right") => void
	onNeither: () => void
	onRestart: () => void
}) {
	return (
		<div className="flex h-full flex-col pt-3">
			<div className="flex h-10 items-center gap-3">
				<h2 className="min-w-0 flex-1 truncate text-base font-bold text-white lg:text-lg">
					This or that?
					<span className="ml-2 text-sm font-semibold text-gray-400">
						{Math.min(taps + 1, ROUNDS)} of {ROUNDS}
					</span>
				</h2>
				<span className="flex gap-1" aria-hidden>
					{Array.from({ length: ROUNDS }, (_, i) => (
						<span key={i} className={`h-1.5 w-5 rounded-full transition-colors ${i < taps ? "bg-amber-400" : i === taps ? "bg-amber-400/40" : "bg-white/15"}`} />
					))}
				</span>
				<button
					type="button"
					onClick={onRestart}
					aria-label="Start over"
					title="Start over"
					className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-300 hover:bg-white/10 hover:text-white"
				>
					<ArrowPathIcon className="h-4 w-4" />
				</button>
			</div>

			<div className="mt-2 grid grid-cols-2 gap-3 lg:gap-6">
				<Side c={left} side="left" nod={chose === "left"} onChoose={onChoose} />
				<Side c={right} side="right" nod={chose === "right"} onChoose={onChoose} />
			</div>

			<div className="mt-3 flex items-center justify-between gap-3">
				<p className="text-xs text-gray-400 sm:text-sm">Tap the one you'd rather watch.</p>
				<button type="button" onClick={onNeither} className={`${GHOST} !h-9 !text-sm`}>
					Neither
				</button>
			</div>
		</div>
	)
}

/** One side of the pair. A new title crossfades into the same grid cell, so the side never changes size. */
function Side({ c, side, nod, onChoose }: { c: Candidate | null; side: "left" | "right"; nod: boolean; onChoose: (s: "left" | "right") => void }) {
	return (
		<div className="grid min-w-0 [&>*]:[grid-area:1/1]">
			<AnimatePresence initial={false}>
				{c ? (
					<motion.button
						key={c.card.key}
						type="button"
						onClick={() => onChoose(side)}
						className="group block min-w-0 cursor-pointer text-left outline-none"
						initial={{ opacity: 0, x: side === "left" ? -16 : 16 }}
						animate={nod ? { opacity: 1, x: 0, scale: [1, 1.03, 1] } : { opacity: 1, x: 0, scale: 1 }}
						exit={{ opacity: 0, scale: 0.94 }}
						transition={{ duration: 0.3, ease: EASE }}
					>
						<div className="relative overflow-hidden rounded-lg border-2 border-gray-800 bg-gray-900 transition-colors group-hover:border-amber-500/70 group-focus-visible:border-amber-400">
							<img src={posterSrc(c.card, "w342")} alt="" className="aspect-[2/3] w-full object-cover sm:hidden" />
							<img
								src={c.art}
								alt=""
								className={`hidden aspect-video w-full object-cover sm:block ${c.artIsPoster ? "object-[center_25%]" : ""}`}
							/>
							<span className="absolute left-1.5 top-1.5 rounded-md bg-gray-950/85 px-2 py-0.5 text-xs font-semibold text-gray-100 lg:left-2.5 lg:top-2.5 lg:text-sm">
								{SOURCE_LABEL[c.source]}
							</span>
						</div>
						<div className="mt-2 h-[64px] min-w-0 lg:h-[72px]">
							<p className="truncate text-base font-bold text-white lg:text-xl">{c.card.title}</p>
							<p className="truncate text-xs font-semibold text-amber-300 lg:text-sm">{c.episode ?? c.why}</p>
							<p className="truncate text-xs text-gray-400 lg:text-sm">{factsLine(c.card)}</p>
						</div>
					</motion.button>
				) : (
					<div key="empty" className="aspect-[2/3] rounded-lg border-2 border-dashed border-gray-800 sm:aspect-video" />
				)}
			</AnimatePresence>
		</div>
	)
}

function Result({ pick, runnerUp, onAgain }: { pick: Candidate; runnerUp: Candidate | null; onAgain: () => void }) {
	return (
		<div className="flex h-full flex-col pt-3">
			<div className="relative -mx-4 min-h-0 flex-1 overflow-hidden bg-gray-900 sm:mx-0 sm:rounded-2xl">
				<img
					src={pick.art}
					alt=""
					className={`absolute inset-0 h-full w-full object-cover ${pick.artIsPoster ? "object-[center_22%] lg:left-auto lg:w-[55%]" : "object-[center_20%]"}`}
				/>
				<div className="absolute inset-0 bg-linear-to-t from-gray-950 via-gray-950/70 to-transparent lg:bg-linear-to-r lg:via-gray-950/70 lg:to-gray-950/10" />
				<div className="absolute inset-x-0 bottom-0 p-4 lg:max-w-2xl lg:p-8">
					<p className="text-sm font-semibold text-amber-300">Tonight's pick · {pick.why}</p>
					<Link to={titleHref(pick.card)} className="mt-1 block">
						<h2 className={`${DISPLAY} line-clamp-2 leading-[0.92] text-white ${pick.card.title.length > 22 ? "text-4xl lg:text-5xl" : "text-[2.75rem] lg:text-7xl"}`}>
							{pick.card.title}
						</h2>
					</Link>
					<p className="mt-2 h-6 truncate text-base font-semibold text-white lg:text-lg">{pick.episode ?? ""}</p>
					<p className="h-5 truncate text-sm text-gray-400">{factsLine(pick.card)}</p>
					<div className="mt-4 flex items-center gap-2">
						<WatchLink c={pick} className="min-w-0 flex-1 lg:w-[15rem] lg:flex-none" />
						<button type="button" onClick={onAgain} className={GHOST}>
							<ArrowPathIcon className="h-4 w-4" aria-hidden /> Again
						</button>
					</div>
				</div>
			</div>
			<p className="mt-3 h-5 truncate text-sm text-gray-400">
				{runnerUp ? (
					<>
						Runner-up:{" "}
						<Link to={titleHref(runnerUp.card)} className="font-semibold text-gray-200 hover:text-white">
							{runnerUp.card.title}
						</Link>
						{" · "}
					</>
				) : null}
				<Link to={HREF.watchNext} className="font-semibold text-amber-400 hover:text-amber-300">
					More in Watch next →
				</Link>
			</p>
		</div>
	)
}

export const variant: BlockVariant = { key: "d", name: "This or that from your lists", C: ThisOrThat }
