// PROTOTYPE - throwaway. Your eras (existing components): your taste across film history, one decade at
// a time, plus where it has been drifting in your latest ratings. Pick a decade on the strip to open it.
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import {
	PickRow,
	RatedPoster,
	ServicesSwitch,
	type ViewProps,
	YourScore,
	attrOf,
	itemsOf,
	list,
	useOnMine,
	vibe,
} from "../kit"

export default function Eras({ data }: ViewProps) {
	const r = data.report
	const best = [...r.eras].sort(
		(a, b) => b.avg * Math.sqrt(b.count) - a.avg * Math.sqrt(a.count),
	)[0]
	const [dec, setDec] = useState(best?.decade)
	const era = r.eras.find((e) => e.decade === dec) ?? best
	const services = useOnMine(data)
	const max = Math.max(1, ...r.eras.map((e) => e.count))
	const favorite = [...r.eras]
		.filter((e) => e.count >= Math.max(4, r.who.rated * 0.02))
		.sort((a, b) => b.avg - a.avg)[0]
	const d = r.drift
	// Keep the open decade in view on narrow screens, where the strip scrolls sideways.
	const strip = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = strip.current?.querySelector<HTMLElement>("[aria-selected=true]")
		if (strip.current && el)
			strip.current.scrollLeft =
				el.offsetLeft - strip.current.clientWidth / 2 + el.clientWidth / 2
	}, [dec])

	return (
		<div className="pb-32 text-white">
			<section className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-16">
				<p className="text-lg font-semibold text-amber-300">Your eras</p>
				<h1 className="mt-2 max-w-4xl text-4xl font-bold leading-tight md:text-6xl">
					{favorite
						? `Your ratings peak in the ${favorite.decade}s.`
						: "Your taste across the decades."}
				</h1>
				{favorite?.trait && (
					<p className="mt-3 max-w-3xl text-lg text-gray-300 md:text-xl">
						That's where you find the most {attrOf(data, favorite.trait).phrase}
						.
					</p>
				)}
			</section>

			{d && (
				<section className="mx-auto mt-10 max-w-7xl px-4 md:px-8">
					<div className="grid gap-6 rounded-2xl border border-gray-800 bg-gray-950/70 p-5 md:grid-cols-[1fr_1.4fr] md:p-8">
						<div>
							<h2 className="text-2xl font-bold">Lately</h2>
							<p className="mt-1 text-sm text-gray-400">
								Your ratings since{" "}
								{new Date(d.since).toLocaleDateString("en", {
									month: "long",
									year: "numeric",
								})}
								, against everything before.
							</p>
							<p className="mt-5 text-xl leading-snug text-gray-100">
								You've been drifting toward{" "}
								<span className="font-semibold text-emerald-300">
									{list(d.toward.map((k) => attrOf(data, k).phrase))}
								</span>
								, and away from{" "}
								<span className="font-semibold text-rose-300">
									{list(d.away.map((k) => attrOf(data, k).phrase))}
								</span>
								.
							</p>
						</div>
						<div className="grid grid-cols-4 content-start items-start gap-2">
							{itemsOf(data, d.recent).map((t) => (
								<RatedPoster key={t.key} t={t} size="w185" />
							))}
						</div>
					</div>
				</section>
			)}

			<section className="mx-auto mt-12 max-w-7xl px-4 md:px-8">
				<div
					ref={strip}
					className="relative flex items-end gap-1.5 overflow-x-auto pb-2 md:gap-3"
					role="tablist"
					aria-label="Decades"
				>
					{r.eras.map((e) => {
						const on = e.decade === era?.decade
						const cover = data.items[e.top[0]]
						return (
							<button
								key={e.decade}
								type="button"
								role="tab"
								aria-selected={on}
								onClick={() => setDec(e.decade)}
								className={`group flex min-w-[4.5rem] flex-1 flex-col items-stretch rounded-lg p-1 text-left transition ${on ? "bg-amber-900/30 ring-2 ring-amber-500" : "hover:bg-gray-800"}`}
							>
								<span
									className="relative block overflow-hidden rounded-md"
									style={{ height: 40 + (e.count / max) * 110 }}
								>
									{cover && (
										<img
											src={cover.poster.replace("/w342/", "/w185/")}
											alt=""
											className={`absolute inset-0 h-full w-full object-cover ${on ? "" : "opacity-60 grayscale-[50%] group-hover:opacity-90"}`}
										/>
									)}
									<span
										className="absolute inset-x-0 bottom-0 h-1.5"
										style={{ background: vibe(e.avg) }}
									/>
								</span>
								<span className="mt-1.5 text-sm font-bold tabular-nums">
									{e.decade}s
								</span>
								<span className="text-xs text-gray-400">{e.count} rated</span>
							</button>
						)
					})}
				</div>
			</section>

			<AnimatePresence mode="wait">
				{era && (
					<motion.section
						key={era.decade}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.25 }}
						className="mx-auto mt-10 max-w-7xl px-4 md:px-8"
					>
						<div className="flex flex-wrap items-center gap-4">
							<h2 className="text-4xl font-bold md:text-5xl">
								The {era.decade}s
							</h2>
							<YourScore
								score={Math.round(era.avg)}
								label={`Your average: ${era.avg} over ${era.count} titles`}
							/>
						</div>
						{era.trait && (
							<p className="mt-3 max-w-3xl text-lg text-gray-300">
								What draws you to this decade more than any other:{" "}
								{attrOf(data, era.trait).phrase}.
							</p>
						)}
						<div className="mt-6 grid grid-cols-4 gap-2 md:grid-cols-8">
							{itemsOf(data, era.top).map((t) => (
								<RatedPoster key={t.key} t={t} />
							))}
						</div>
						<div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-3">
							<h3 className="text-xl font-bold">
								Not seen yet from the {era.decade}s
							</h3>
							<ServicesSwitch state={services} />
						</div>
						<PickRow data={data} refs={services.filter(era.picks)} n={6} />
					</motion.section>
				)}
			</AnimatePresence>
		</div>
	)
}
