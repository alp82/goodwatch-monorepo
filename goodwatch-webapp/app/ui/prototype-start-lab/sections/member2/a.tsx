// PROTOTYPE (start page lab, round 2): member a "Decide tonight": one candidate at a time (tonight's pick first) as a
// big card on the room, Watch · Not tonight · Later, context chips that re-rank the queue at once, "3 of 15", then
// doors that open each list inline. Ranking: ab-rank.tsx.
import { ClockIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useMemo, useState } from "react"
import { titleHref } from "../../lab/kit"
import type { BlockVariant } from "../../lab/types"
import { DISPLAY, HREF, posterSrc } from "../member/shared"
import { BOX, CHIP, RoomBackdrop, WatchLink, chipLook } from "./ab-card"
import { Deck, type Move } from "./ab-deck"
import { DeepDives } from "./ab-dives"
import { type Ask, type Candidate, ranked, useCandidates } from "./ab-rank"

type Chip = { label: string; set: Partial<Ask>; group: keyof Ask }

const CHIPS: Chip[] = [
	{ label: "Under 30 min", set: { time: "u30" }, group: "time" },
	{ label: "Movie night", set: { time: "night" }, group: "time" },
	{ label: "Keep watching", set: { kind: "keep" }, group: "kind" },
	{ label: "Something new", set: { kind: "new" }, group: "kind" },
	{ label: "Show", set: { type: "show" }, group: "type" },
	{ label: "Movie", set: { type: "movie" }, group: "type" },
]

function DecideTonight() {
	const all = useCandidates()
	const [ask, setAsk] = useState<Ask>({})
	const [passed, setPassed] = useState<Set<number>>(() => new Set())
	const [later, setLater] = useState<Candidate[]>([])
	const [move, setMove] = useState<Move>("skip")

	const queue = useMemo(() => ranked(all, ask), [all, ask])
	const left = queue.filter((c) => !passed.has(c.card.key))
	const cur = left[0] ?? null
	const pos = Math.min(queue.length, queue.length - left.length + 1)
	// The shelves show the queue in its order: a re-rank sweeps them (shelf e), a skip doesn't.
	const posters = useMemo(() => {
		const keys = new Set(queue.map((c) => c.card.key))
		return [...queue, ...all.filter((c) => !keys.has(c.card.key))].map((c) => c.card)
	}, [queue, all])

	const act = (m: "skip" | "later") => {
		if (!cur) return
		setMove(m)
		setPassed((s) => new Set(s).add(cur.card.key))
		if (m === "later") setLater((l) => [cur, ...l.filter((x) => x.card.key !== cur.card.key)])
	}
	const toggle = (chip: Chip) => {
		setMove("rerank")
		setAsk((a) => {
			const on = a[chip.group] === chip.set[chip.group]
			return { ...a, [chip.group]: on ? undefined : chip.set[chip.group] }
		})
	}

	return (
		<div className="pb-28">
			<RoomBackdrop posters={posters} className="pb-6 pt-5 md:pb-10 md:pt-10">
				<div className={BOX}>
					<div className="flex items-end justify-between gap-3">
						<div className="min-w-0">
							<p className="text-xs font-semibold text-gray-300 md:text-sm">Welcome back, Sam</p>
							<h1 className={`${DISPLAY} text-3xl leading-none text-white md:text-4xl`}>Tonight</h1>
						</div>
						<div className="w-24 shrink-0 text-right md:w-32" aria-live="polite">
							<p className="text-sm font-semibold tabular-nums text-white">{queue.length ? `${pos} of ${queue.length}` : "0 of 0"}</p>
							<div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
								<div
									className="h-full origin-left rounded-full bg-amber-400 transition-transform duration-300"
									style={{ transform: `scaleX(${queue.length ? pos / queue.length : 0})` }}
								/>
							</div>
						</div>
					</div>

					<div
						role="group"
						aria-label="What fits tonight"
						className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
					>
						{CHIPS.map((chip, i) => {
							const on = ask[chip.group] === chip.set[chip.group]
							const gap = i > 0 && CHIPS[i - 1].group !== chip.group
							return (
								<button key={chip.label} type="button" aria-pressed={on} onClick={() => toggle(chip)} className={`${CHIP} ${chipLook(on)} ${gap ? "ml-2" : ""}`}>
									{chip.label}
								</button>
							)
						})}
					</div>

					<Deck
						className="mt-4 h-[24rem] md:h-[26rem]"
						cur={cur}
						next={left[1] ?? null}
						after={left.slice(2, 4)}
						move={move}
						onMove={act}
						empty={
							<div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl bg-gray-900/90 p-6 text-center ring-1 ring-white/10">
								<p className={`${DISPLAY} text-2xl text-white md:text-3xl`}>That's all {queue.length} for now</p>
								<p className="max-w-sm text-sm text-gray-400">Change the chips above, or look through your lists below.</p>
								<button
									type="button"
									onClick={() => {
										setMove("rerank")
										setPassed(new Set(later.map((c) => c.card.key)))
									}}
									className="h-11 cursor-pointer rounded-lg bg-white px-5 font-bold text-black hover:bg-gray-200"
								>
									Start over
								</button>
							</div>
						}
					/>

					<div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
						<WatchLink c={cur} short />
						<button
							type="button"
							disabled={!cur}
							onClick={() => act("skip")}
							className="inline-flex h-12 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3.5 font-semibold text-white hover:bg-white/15 disabled:opacity-40 sm:px-5"
						>
							<XMarkIcon className="hidden h-5 w-5 sm:block" aria-hidden />
							Not tonight
						</button>
						<button
							type="button"
							disabled={!cur}
							onClick={() => act("later")}
							className="inline-flex h-12 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3.5 font-semibold text-white hover:bg-white/15 disabled:opacity-40 sm:px-5"
						>
							<ClockIcon className="hidden h-5 w-5 sm:block" aria-hidden />
							Later
						</button>
					</div>

					{/* Always this tall: the tray fills in place. */}
					<div className="mt-3 flex h-10 items-center gap-2 text-sm text-gray-400">
						{later.length ? (
							<>
								<span className="shrink-0 font-semibold text-gray-200">Later</span>
								<ul className="flex min-w-0 gap-1.5 overflow-hidden">
									{later.slice(0, 8).map((c) => (
										<li key={c.card.key} className="shrink-0">
											<Link to={titleHref(c.card)} title={c.card.title}>
												<img src={posterSrc(c.card)} alt={c.card.title} className="aspect-[2/3] w-6 rounded object-cover ring-1 ring-white/10" />
											</Link>
										</li>
									))}
								</ul>
								<Link to={HREF.watchNext} className="ml-auto shrink-0 font-semibold text-amber-400 hover:text-amber-300">
									Watch next →
								</Link>
							</>
						) : (
							<p className="truncate">
								<span className="md:hidden">Swipe the card: left for Not tonight, right for Later.</span>
								<span className="hidden md:inline">Not tonight shows the next one. Later keeps it here for this evening.</span>
							</p>
						)}
					</div>
				</div>
			</RoomBackdrop>

			<DeepDives all={all} />
		</div>
	)
}

export const variant: BlockVariant = { key: "a", name: "Decide tonight", C: DecideTonight }
