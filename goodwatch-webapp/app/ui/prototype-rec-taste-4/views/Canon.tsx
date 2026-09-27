// PROTOTYPE - throwaway. Third-view candidate "Your canon" (existing components): the handful of titles
// that define you, and why. The hero is the shelf itself; pick one to see what part of your taste it
// carries and what to watch in its vein.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import {
	PickRow,
	ServicesSwitch,
	YourScore,
	attrOf,
	backdrop,
	list,
	poster,
	useOnMine,
} from "~/ui/prototype-rec-taste-2/kit"
import type { Payload4 } from "../model"
import { NUMBER_WORDS } from "../parts"

export default function Canon({ data }: { data: Payload4 }) {
	const canon = data.report.canon.filter((c) => data.items[c.key])
	const [key, setKey] = useState(canon[0]?.key)
	const services = useOnMine(data)
	const entry = canon.find((c) => c.key === key) ?? canon[0]
	if (!entry)
		return (
			<p className="mx-auto max-w-7xl px-4 py-16 text-lg text-gray-300 md:px-8">
				Rate a few titles 9 or 10 to see your canon.
			</p>
		)
	const t = data.items[entry.key]
	const why = entry.why.map((k) => attrOf(data, k))

	return (
		<div className="pb-32 text-white">
			<section className="border-b border-gray-800 bg-gray-950">
				<div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
					<p className="text-sm text-gray-400">Your canon</p>
					<h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
						{NUMBER_WORDS[canon.length] ?? canon.length} titles that are{" "}
						<span className="text-amber-300">unmistakably you</span>
					</h1>
					<p className="mt-4 max-w-2xl text-gray-400">
						Picked from your favorites and top ratings for how close each one
						sits to everything else you love.
					</p>
					<div
						className="mt-8 grid grid-cols-4 gap-2 md:grid-cols-8 md:gap-3"
						role="tablist"
					>
						{canon.map((c) => {
							const it = data.items[c.key]
							const on = c.key === entry.key
							return (
								<button
									key={c.key}
									type="button"
									role="tab"
									aria-selected={on}
									onClick={() => setKey(c.key)}
									className={`block overflow-hidden rounded-lg border-4 shadow-2xl transition ${on ? "border-amber-500" : "border-gray-800 opacity-70 hover:opacity-100"}`}
								>
									<img
										src={poster(it, "w342")}
										alt={it.title}
										className="block aspect-[2/3] w-full object-cover"
									/>
								</button>
							)
						})}
					</div>
				</div>
			</section>

			<AnimatePresence mode="wait">
				<motion.section
					key={t.key}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.25 }}
					className="mx-auto mt-12 max-w-7xl px-4 md:px-8"
				>
					<div className="relative isolate overflow-hidden rounded-2xl border border-gray-800">
						<img
							src={backdrop(t, "w1280")}
							alt=""
							className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
						/>
						<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/80 to-transparent" />
						<div className="max-w-2xl p-6 md:p-10">
							<h2 className="text-3xl font-bold leading-tight md:text-5xl">
								{t.title}{" "}
								<span className="font-normal text-gray-400">({t.year})</span>
							</h2>
							{t.mine != null && (
								<div className="mt-4">
									<YourScore score={t.mine} size="lg" label={entry.reason} />
								</div>
							)}
							<p className="mt-5 text-xl text-gray-100 md:text-2xl">
								It holds your taste for {list(why.map((a) => a.phrase))}.
							</p>
						</div>
					</div>
					<div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-3">
						<h3 className="text-xl font-bold">In the vein of {t.title}</h3>
						<ServicesSwitch state={services} />
					</div>
					<PickRow data={data} refs={services.filter(entry.next)} n={6} />
				</motion.section>
			</AnimatePresence>
		</div>
	)
}
