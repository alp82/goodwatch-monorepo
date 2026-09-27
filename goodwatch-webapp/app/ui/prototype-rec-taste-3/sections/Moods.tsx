// PROTOTYPE - throwaway. Moods: how you rate each kind of evening. Open one to see what to watch for it.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import {
	Frame,
	Head,
	Pick,
	type View3Props,
	itemsOf,
	mineFirst,
} from "../kit3"
import { bestMood } from "../meta"

export default function Moods({ data }: View3Props) {
	const r = data.report
	const [open, setOpen] = useState<string | undefined>(bestMood(data)?.id)
	return (
		<Frame>
			<Head
				title="Moods"
				sub={`How you rate titles made for each kind of evening, against your usual ${r.who.avg}.`}
			/>
			<ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
				{r.moods.map((m) => {
					const on = m.id === open
					const tone =
						m.delta >= 0.2
							? "text-emerald-400"
							: m.delta <= -0.2
								? "text-rose-400"
								: "text-gray-400"
					return (
						<li key={m.id}>
							<button
								type="button"
								onClick={() => setOpen(on ? undefined : m.id)}
								aria-expanded={on}
								className="grid w-full grid-cols-[1fr_auto] items-center gap-4 py-5 text-left sm:grid-cols-[1fr_auto_auto]"
							>
								<span className="min-w-0">
									<span className="block text-2xl font-bold">{m.name}</span>
									<span className="block text-gray-400">{m.line}</span>
								</span>
								<span className="hidden gap-1.5 sm:flex">
									{itemsOf(data, m.top.slice(0, 3)).map((t) => (
										<img
											key={t.key}
											src={t.poster.replace("/w342/", "/w185/")}
											alt=""
											className="aspect-[2/3] w-10 rounded object-cover"
											loading="lazy"
										/>
									))}
								</span>
								<span
									className={`w-14 text-right text-xl font-bold tabular-nums ${tone}`}
								>
									{m.delta > 0 ? "+" : ""}
									{m.delta.toFixed(1)}
								</span>
							</button>
							<AnimatePresence initial={false}>
								{on && (
									<motion.div
										initial={{ height: 0, opacity: 0 }}
										animate={{ height: "auto", opacity: 1 }}
										exit={{ height: 0, opacity: 0 }}
										transition={{ duration: 0.25 }}
										className="overflow-hidden"
									>
										<p className="mb-4 text-gray-300">
											For your next {m.name.toLowerCase()} evening
										</p>
										<div className="grid grid-cols-3 gap-3 pb-8 sm:grid-cols-6">
											{mineFirst(data, m.picks)
												.slice(0, 6)
												.map((p) => {
													const t = data.items[p.key]
													return t ? (
														<Pick key={p.key} data={data} t={t} match={p.match} />
													) : null
												})}
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</li>
					)
				})}
			</ul>
		</Frame>
	)
}
