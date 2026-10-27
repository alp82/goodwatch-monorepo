// PROTOTYPE (start page lab, round 2): member c "Tonight first, refined": a slim room strip, a slim search whose
// results take over the hero box, one big pick for tonight that "Not this one" or a tap on five alternatives swaps
// in place (crossfade, fixed size), then doors that open each list inline.
import { ArrowPathIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { EASE } from "~/ui/watch-next/style"
import { titleHref } from "../../lab/kit"
import { type BlockVariant, useLab } from "../../lab/types"
import { DISPLAY, WRAP, greeting, posterSrc } from "../member/shared"
import { Doors } from "./cd-doors"
import { type Candidate, FirstSteps, GHOST, SearchBox, WatchLink, factsLine, useDeck } from "./cd-shared"

function TonightRefined() {
	const { Room } = useLab()
	const { m, deck } = useDeck()
	const { data } = useLab()
	const [cur, setCur] = useState<number | null>(deck[0]?.card.key ?? null)
	const [gone, setGone] = useState<Set<number>>(() => new Set())

	const live = deck.filter((c) => !gone.has(c.card.key))
	const pick = live.find((c) => c.card.key === cur) ?? live[0] ?? null
	const alts = live.filter((c) => c !== pick).slice(0, 5)
	const outOfPicks = live.length <= 1

	const notThis = () => {
		if (!pick) return
		if (outOfPicks) {
			setGone(new Set())
			setCur(deck[0]?.card.key ?? null)
			return
		}
		setGone((g) => new Set(g).add(pick.card.key))
		setCur(alts[0]?.card.key ?? null)
	}

	return (
		<div className="pb-28">
			{/* The room: a slim strip whose shelves hold tonight's candidates (they flip as Sam swaps). */}
			<Room className="h-[76px] w-full sm:h-28 lg:h-32" posters={live.map((c) => c.card)} noTv portraitBelow={0}>
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-full bg-linear-to-t from-gray-950 via-gray-950/40 to-transparent" />
				<div className={`${WRAP} pointer-events-none absolute inset-x-0 bottom-1.5`}>
					<h1 className="text-sm font-semibold text-amber-300 drop-shadow">{greeting(m.name)}</h1>
				</div>
			</Room>

			<div className={WRAP}>
				<SearchBox boxClass="mt-3 h-[452px] sm:h-[500px]">
					{pick ? (
						<Stage pick={pick} alts={alts} onPick={setCur} onNotThis={notThis} outOfPicks={outOfPicks} />
					) : (
						// A member with nothing yet gets the same first steps as d.
						<FirstSteps ratings={data.member?.ratings ?? 0} />
					)}
				</SearchBox>
			</div>

			<Doors m={m} className="mt-8" />
		</div>
	)
}

function Stage({
	pick,
	alts,
	onPick,
	onNotThis,
	outOfPicks,
}: {
	pick: Candidate
	alts: Candidate[]
	onPick: (key: number) => void
	onNotThis: () => void
	outOfPicks: boolean
}) {
	const long = pick.card.title.length > 22
	return (
		<section aria-label="Tonight" className="relative -mx-4 h-full overflow-hidden bg-gray-900 sm:mx-0 sm:rounded-2xl">
			{/* The picture crossfades; nothing here changes size. */}
			<AnimatePresence initial={false}>
				<motion.img
					key={pick.card.key}
					src={pick.art}
					alt=""
					className={`absolute inset-0 h-full w-full object-cover ${pick.artIsPoster ? "object-[center_22%] lg:left-auto lg:w-[55%]" : "object-[center_20%]"}`}
					initial={{ opacity: 0, scale: 1.03 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.45, ease: EASE }}
				/>
			</AnimatePresence>
			<div className="absolute inset-0 bg-linear-to-t from-gray-950 via-gray-950/75 to-gray-950/0 lg:bg-linear-to-r lg:via-gray-950/70 lg:to-gray-950/10" />
			<div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-gray-950 to-transparent" />

			<div className="absolute inset-0 flex flex-col justify-end gap-4 p-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:p-8">
				<div className="min-w-0 lg:max-w-xl lg:flex-1">
					{/* The words crossfade inside a fixed box, bottom-aligned. */}
					<div className="relative h-[156px] lg:h-[200px]">
						<AnimatePresence initial={false}>
							<motion.div
								key={pick.card.key}
								className="absolute inset-0 flex flex-col justify-end"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -4 }}
								transition={{ duration: 0.3, ease: EASE }}
							>
								<p className="text-sm font-semibold text-amber-300">Tonight · {pick.why}</p>
								<Link to={titleHref(pick.card)} className="mt-1 block">
									<h2 className={`${DISPLAY} line-clamp-2 leading-[0.92] text-white ${long ? "text-4xl lg:text-5xl" : "text-[2.75rem] lg:text-7xl"}`}>
										{pick.card.title}
									</h2>
								</Link>
								<p className="mt-2 h-6 truncate text-base font-semibold text-white lg:text-lg">{pick.episode ?? ""}</p>
								<p className="h-5 truncate text-sm text-gray-400">{factsLine(pick.card)}</p>
							</motion.div>
						</AnimatePresence>
					</div>
					<div className="mt-4 flex items-center gap-2">
						<WatchLink c={pick} className="min-w-0 flex-1 lg:w-[15rem] lg:flex-none" />
						<button type="button" onClick={onNotThis} className={GHOST}>
							{outOfPicks ? (
								<>
									<ArrowPathIcon className="h-4 w-4" aria-hidden /> Start over
								</>
							) : (
								"Not this one"
							)}
						</button>
					</div>
				</div>

				{/* Five alternatives: tap one to swap it in. */}
				<div className="shrink-0">
					<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Or one of these</p>
					<ul className="grid h-[88px] grid-cols-5 gap-2 lg:flex lg:h-[150px] lg:gap-3">
						<AnimatePresence initial={false} mode="popLayout">
							{alts.map((a) => (
								<motion.li
									key={a.card.key}
									layout
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.9 }}
									transition={{ duration: 0.25, ease: EASE }}
									className="min-w-0"
								>
									<button
										type="button"
										onClick={() => onPick(a.card.key)}
										title={`${a.card.title} · ${a.why}`}
										aria-label={`Swap in ${a.card.title}`}
										className="block h-[88px] w-full cursor-pointer overflow-hidden rounded-md border-2 border-gray-800 bg-gray-900 hover:border-amber-500/70 lg:h-[150px] lg:w-[100px]"
									>
										<img src={posterSrc(a.card, "w185")} alt="" className="h-full w-full object-cover" />
									</button>
								</motion.li>
							))}
						</AnimatePresence>
					</ul>
				</div>
			</div>
		</section>
	)
}

export const variant: BlockVariant = { key: "c", name: "Tonight first, refined", C: TonightRefined }
