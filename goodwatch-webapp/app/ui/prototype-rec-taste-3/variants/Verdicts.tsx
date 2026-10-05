// PROTOTYPE - throwaway. Crowd: verdicts (existing). Round 2's You vs everyone, simplified: the stance as the
// headline, one side of the argument at a time, the biggest gap as a hero, the rest as posters that carry
// both scores. The per-genre bars became one sentence.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import {
	Frame,
	Head,
	Plain,
	Ring,
	type View3Props,
	YourScore,
	backdrop,
	href,
	list,
} from "../kit3"
import type { CrowdRow } from "../model"
import { noun } from "~/ui/prototype-rec-taste-2/words"

const SIDES = [
	{ id: "higher", name: "You rate higher", on: "border-emerald-500 bg-emerald-950/40 text-emerald-100" },
	{ id: "lower", name: "You rate lower", on: "border-rose-500 bg-rose-950/40 text-rose-100" },
] as const

export default function Verdicts({ data }: View3Props) {
	const c = data.report.crowd
	const [side, setSide] = useState<"higher" | "lower">("higher")
	const [n, setN] = useState(12)
	const rows = c[side]
	const [lead, ...rest] = rows
	const lt = lead && data.items[lead.key]
	const warm = c.attrs.filter((a) => a.delta >= 3).slice(0, 3)
	const cold = c.attrs.filter((a) => a.delta <= -3).slice(0, 3)

	return (
		<Frame>
			<Head
				title={c.stance}
				sub={
					warm.length || cold.length
						? [
								warm.length ? `You're warmer than the crowd on ${list(warm.map((a) => noun(a.key)))}.` : "",
								cold.length ? `You're colder on ${list(cold.map((a) => noun(a.key)))}.` : "",
							]
								.filter(Boolean)
								.join(" ")
						: undefined
				}
			/>
			<div className="mt-8 flex flex-wrap gap-2">
				{SIDES.map((s) => (
					<button
						key={s.id}
						type="button"
						onClick={() => {
							setSide(s.id)
							setN(12)
						}}
						aria-pressed={side === s.id}
						className={`rounded-full border-2 px-5 py-2 font-semibold transition ${side === s.id ? s.on : "border-gray-700 text-gray-300 hover:border-gray-500"}`}
					>
						{s.name} than everyone
					</button>
				))}
			</div>

			<AnimatePresence mode="wait">
				<motion.div
					key={side}
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
				>
					{lt && (
						<Link
							to={href(lt)}
							className="relative isolate mt-8 block overflow-hidden rounded-2xl border border-gray-800"
						>
							<img
								src={backdrop(lt)}
								alt=""
								className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
							/>
							<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/80 to-transparent" />
							<div className="flex items-end gap-5 p-5 md:gap-8 md:p-8">
								<img
									src={lt.poster}
									alt={`Poster for ${lt.title}`}
									className="w-24 rounded-lg border-2 border-gray-700 md:w-44"
								/>
								<div className="min-w-0 pb-1">
									<p className="text-xl font-bold leading-tight md:text-4xl">
										{lt.title}{" "}
										<span className="font-normal text-gray-400">({lt.year})</span>
									</p>
									<div className="mt-4 flex flex-wrap items-center gap-5">
										<YourScore score={lead.mine} size="lg" label="You" />
										<Ring item={lt} size={48} label />
									</div>
									<p className="mt-3 text-sm text-gray-300">
										{Math.abs(lead.delta)} points{" "}
										{side === "higher" ? "above" : "below"} the crowd, after
										your usual generosity.
									</p>
								</div>
							</div>
						</Link>
					)}
					<div className="mt-8 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
						{rest.slice(0, n).map((row) => (
							<Verdict key={row.key} data={data} row={row} />
						))}
					</div>
					{n < rest.length && (
						<button
							type="button"
							onClick={() => setN((x) => x + 12)}
							className="mt-8 text-sm font-semibold text-amber-300 underline underline-offset-4"
						>
							Show more
						</button>
					)}
				</motion.div>
			</AnimatePresence>
		</Frame>
	)
}

function Verdict({ data, row }: { data: View3Props["data"]; row: CrowdRow }) {
	const t = data.items[row.key]
	if (!t) return null
	return (
		<Link to={href(t)} className="block min-w-0">
			<Plain t={t} size="w185" linked={false} />
			<span className="mt-2 flex items-center gap-2">
				<YourScore score={row.mine} size="sm" />
				<Ring item={t} size={28} />
			</span>
			<span className="mt-1.5 block truncate text-sm text-gray-300">
				{t.title}
			</span>
		</Link>
	)
}
