import { Link } from "@remix-run/react"
// PROTOTYPE - throwaway. Third-view candidate "What loses you" (existing components): the kinds of story
// you skip or rate 5 or lower far more often than anything else, each with the one you loved anyway.
// Built like Sides: a statement hero between two poster groups, pills to switch, the titles as proof.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import {
	RatedPoster,
	YourScore,
	href,
	itemsOf,
} from "~/ui/prototype-rec-taste-2/kit"
import { cap, noun } from "~/ui/prototype-rec-taste-2/words"
import type { Payload4 } from "../model"
import { Fan, Pill, article } from "../parts"

export default function Dealbreakers({ data }: { data: Payload4 }) {
	const list = data.extra.dealbreakers
	const base = Math.round(data.extra.pannedBase * 100)
	const pct = (x: { met: number; panned: number }) =>
		Math.round((x.panned / x.met) * 100)
	const [key, setKey] = useState(list[0]?.key)
	const d = list.find((x) => x.key === key) ?? list[0]
	const hero = list[0]
	if (!hero || !d)
		return (
			<p className="mx-auto max-w-7xl px-4 py-16 text-lg text-gray-300 md:px-8">
				Nothing reliably loses you yet. Rate the titles you didn't like, too.
			</p>
		)
	const ex = hero.exception ? data.items[hero.exception] : undefined
	const dex = d.exception ? data.items[d.exception] : undefined

	return (
		<div className="pb-32 text-white">
			<section className="relative overflow-hidden border-b border-gray-800 bg-gray-950">
				<div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-10 md:grid-cols-[1fr_1.3fr_1fr] md:gap-8 md:px-8 md:py-16">
					<Fan
						items={itemsOf(data, hero.lost)}
						dir={-1}
						label={`What lost you: ${noun(hero.key)}`}
						onPick={() => setKey(hero.key)}
					/>
					<div className="text-center">
						<p className="text-sm text-gray-400">What loses you</p>
						<h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
							<span className="text-rose-300">{cap(noun(hero.key))}</span>{" "}
							{noun(hero.key) === "horror" ? "loses" : "lose"} you
						</h1>
						{ex && (
							<>
								<p className="my-3 text-xl text-gray-400 md:text-2xl">
									unless it's
								</p>
								<p className="text-3xl font-bold leading-tight md:text-5xl">
									<span className="text-sky-300">{ex.title}</span>
								</p>
							</>
						)}
						<p className="mx-auto mt-5 max-w-md text-gray-400">
							You skipped or rated 5 or lower {hero.panned} of the {hero.met}{" "}
							{noun(hero.key)} you've come across. Across everything else, it's{" "}
							{base}%.
						</p>
					</div>
					{ex ? (
						<Link
							to={href(ex)}
							className="relative mx-auto block w-24 rotate-3 md:w-40"
							aria-label={`The exception: ${ex.title}`}
						>
							<img
								src={ex.poster}
								alt={ex.title}
								className="block w-full rounded-lg border-4 border-gray-800 shadow-2xl"
							/>
							{ex.mine != null && (
								<span className="absolute -right-3 -top-3">
									<YourScore score={ex.mine} />
								</span>
							)}
						</Link>
					) : (
						// No exception: the rest of what lost you, so the hero keeps its two sides.
						<Fan
							items={itemsOf(data, hero.lost.slice(3))}
							dir={1}
							label={`More that lost you: ${noun(hero.key)}`}
							onPick={() => setKey(hero.key)}
						/>
					)}
				</div>
			</section>

			<section className="mx-auto mt-12 max-w-7xl px-4 md:px-8">
				<h2 className="text-2xl font-bold md:text-3xl">Your dealbreakers</h2>
				<p className="mt-1 text-gray-400">
					Kinds of story you skip or rate 5 or lower far more often than the{" "}
					{base}% you pass on overall.
				</p>
				<div className="mt-6 flex flex-wrap gap-2">
					{list.map((x) => (
						<Pill
							key={x.key}
							on={x.key === d.key}
							onClick={() => setKey(x.key)}
						>
							{cap(noun(x.key))}
							<span className="ml-2 tabular-nums text-rose-400">{pct(x)}%</span>
						</Pill>
					))}
				</div>

				<AnimatePresence mode="wait">
					<motion.div
						key={d.key}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.25 }}
						className="mt-8 grid gap-8 md:grid-cols-[2fr_1fr]"
					>
						<div>
							<p className="text-lg text-gray-200">
								You skipped or rated 5 or lower {d.panned} of the {d.met}{" "}
								{noun(d.key)} you've come across.
							</p>
							<h3 className="mb-3 mt-6 text-lg font-bold">What lost you</h3>
							<div className="grid grid-cols-3 gap-2 md:grid-cols-6">
								{itemsOf(data, d.lost).map((t) => (
									<RatedPoster key={t.key} t={t} size="w185" />
								))}
							</div>
						</div>
						{dex && (
							<div>
								<h3 className="mb-3 text-lg font-bold">The exception</h3>
								<div className="grid grid-cols-[7rem_1fr] items-end gap-4 md:grid-cols-[9rem_1fr]">
									<RatedPoster t={dex} size="w342" />
									<p className="pb-1 text-gray-300">
										{dex.title} leans hard into {noun(d.key)}, and you gave it{" "}
										{article(dex.mine ?? 0)} {dex.mine}.
									</p>
								</div>
							</div>
						)}
					</motion.div>
				</AnimatePresence>
			</section>
		</div>
	)
}
