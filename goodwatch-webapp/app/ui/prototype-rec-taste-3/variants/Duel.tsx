// PROTOTYPE - throwaway. Crowd: hot takes (bolder). One disagreement at a time on a full-bleed stage: the
// title, your score against everyone's on the same scale, set huge. Step through your hottest takes, alternating
// between titles you defend and titles you don't buy, or jump to one from the strip.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import {
	CONDENSED,
	Frame,
	Head,
	type View3Props,
	backdrop,
	href,
	poster,
	vibe,
} from "../kit3"
import type { CrowdRow } from "../model"

export default function Duel({ data }: View3Props) {
	const c = data.report.crowd
	// Alternate: a title you defend, then one you don't buy.
	const takes: (CrowdRow & { up: boolean })[] = []
	for (let i = 0; i < 8; i++) {
		if (c.higher[i]) takes.push({ ...c.higher[i], up: true })
		if (c.lower[i]) takes.push({ ...c.lower[i], up: false })
	}
	const [i, setI] = useState(0)
	const take = takes[i]
	const t = take && data.items[take.key]
	if (!t)
		return (
			<Frame>
				<Head title="Your hot takes" sub="Rate more well-known titles to see where you part ways with everyone." />
			</Frame>
		)
	const crowd = (take.crowd / 10).toFixed(1)
	const step = (d: number) => setI((x) => (x + d + takes.length) % takes.length)

	return (
		<div>
			<Frame>
				<Head title="Your hot takes" sub={c.stance} />
			</Frame>
			<section className="relative isolate mt-8 overflow-hidden">
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.img
						key={t.key}
						src={backdrop(t)}
						alt=""
						initial={{ opacity: 0 }}
						animate={{ opacity: 0.4 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.4 }}
						className="absolute inset-0 -z-10 h-full w-full object-cover"
					/>
				</AnimatePresence>
				<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/75 to-gray-950/20" />
				<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-transparent to-gray-950/40" />
				<Frame className="py-10 md:py-16">
					<AnimatePresence mode="wait">
						<motion.div
							key={t.key}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="grid items-end gap-6 sm:grid-cols-[auto_minmax(0,1fr)] md:gap-10"
						>
							<Link to={href(t)} className="block w-32 md:w-60">
								<img
									src={poster(t, "w500")}
									alt={`Poster for ${t.title}`}
									className="w-full rounded-lg border-2 border-white/15 shadow-2xl"
								/>
							</Link>
							<div className="min-w-0">
								<p
									className={`text-lg font-semibold ${take.up ? "text-emerald-300" : "text-rose-300"}`}
								>
									{take.up ? "You defend it" : "You don't buy it"}
								</p>
								<Link
									to={href(t)}
									className="mt-1 block text-5xl font-extrabold leading-[0.92] md:text-7xl"
									style={CONDENSED}
								>
									{t.title}
								</Link>
								<div className="mt-6 flex items-end gap-6 md:gap-10">
									<Score label="You" value={String(take.mine)} color={vibe(take.mine)} />
									<span className="pb-5 text-xl text-gray-500 md:pb-8">vs</span>
									<Score label="Everyone" value={crowd} color={vibe(take.crowd / 10)} />
								</div>
							</div>
						</motion.div>
					</AnimatePresence>
					<div className="mt-10 flex items-center gap-3">
						<button
							type="button"
							onClick={() => step(-1)}
							className="rounded-full border-2 border-white/20 px-4 py-2 font-semibold hover:border-white/50"
							aria-label="Previous take"
						>
							Previous
						</button>
						<button
							type="button"
							onClick={() => step(1)}
							className="rounded-full bg-white px-5 py-2 font-semibold text-gray-950 hover:bg-gray-200"
							aria-label="Next take"
						>
							Next take
						</button>
						<span className="ml-2 text-sm tabular-nums text-gray-400">
							{i + 1} of {takes.length}
						</span>
					</div>
				</Frame>
			</section>
			<Frame>
				<div className="t3-noscroll -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
					{takes.map((x, j) => {
						const tt = data.items[x.key]
						if (!tt) return null
						return (
							<button
								key={x.key}
								type="button"
								onClick={() => setI(j)}
								aria-pressed={j === i}
								aria-label={tt.title}
								className={`w-14 shrink-0 overflow-hidden rounded-md border-b-4 transition md:w-16 ${x.up ? "border-emerald-500" : "border-rose-500"} ${j === i ? "opacity-100 ring-2 ring-white" : "opacity-50 hover:opacity-90"}`}
							>
								<img
									src={poster(tt, "w185")}
									alt=""
									className="aspect-[2/3] w-full object-cover"
									loading="lazy"
								/>
							</button>
						)
					})}
				</div>
			</Frame>
		</div>
	)
}

function Score({ label, value, color }: { label: string; value: string; color: string }) {
	return (
		<div>
			<p
				className="text-8xl font-extrabold leading-none tabular-nums md:text-[10rem]"
				style={{ ...CONDENSED, color }}
			>
				{value}
			</p>
			<p className="mt-1 text-sm text-gray-400">{label}</p>
		</div>
	)
}
