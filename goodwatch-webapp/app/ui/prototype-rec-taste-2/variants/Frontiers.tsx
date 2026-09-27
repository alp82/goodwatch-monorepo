// PROTOTYPE - throwaway. Frontiers (bolder): the edges of your map. Languages, countries, eras and kinds
// of story you have barely touched, where the few titles you did rate scored above your average.
// Each frontier is a full-bleed band with the evidence on one side and where to go next on the other.
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { useState } from "react"
import {
	MatchText,
	ServiceLogos,
	ServicesSwitch,
	type ViewProps,
	YourScore,
	backdrop,
	href,
	itemsOf,
	poster,
	useOnMine,
} from "../kit"
import type { Frontier } from "../model"

const WIDE = "'Archivo', 'Gabarito', sans-serif"
const FONT =
	"https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap"

const KIND: Record<Frontier["kind"], string> = {
	language: "A language",
	country: "A country",
	attr: "A kind of story",
	decade: "An era",
}

export default function Frontiers({ data }: ViewProps) {
	const r = data.report
	const services = useOnMine(data)
	const [open, setOpen] = useState<string | null>(null)

	return (
		<div className="bg-[#06090f] pb-32 text-white">
			<link rel="stylesheet" href={FONT} />
			<section className="mx-auto max-w-7xl px-4 pb-10 pt-12 md:px-8 md:pt-20">
				<h1
					className="max-w-5xl text-5xl font-black leading-[0.9] md:text-[7.5rem]"
					style={{ fontFamily: WIDE, fontStretch: "125%" }}
				>
					Your frontiers
				</h1>
				<div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
					<p className="max-w-2xl text-lg text-gray-300 md:text-xl">
						Places your taste has only visited. You've rated a handful of titles
						in each, and they scored above your usual {r.who.avg}. Here's where
						the map goes next.
					</p>
					<ServicesSwitch state={services} />
				</div>
			</section>

			{r.frontiers.map((f, i) => {
				// On your services first; fill up with titles elsewhere so a thin frontier still shows the way.
				const mine = services.filter(f.picks)
				const picks = [
					...mine,
					...f.picks.filter((p) => !mine.includes(p)),
				].slice(0, Math.max(4, mine.length))
				const lead = data.items[picks[0]?.key ?? f.picks[0]?.key]
				const expanded = open === f.id
				const evidence = itemsOf(data, f.evidence)
				return (
					<section
						key={f.id}
						className="relative isolate overflow-hidden border-t border-white/10"
					>
						{lead && (
							<img
								src={backdrop(lead)}
								alt=""
								className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30"
							/>
						)}
						<div
							className={`absolute inset-0 -z-10 ${i % 2 ? "bg-linear-to-l" : "bg-linear-to-r"} from-[#06090f] via-[#06090f]/85 to-[#06090f]/40`}
						/>
						<div
							className={`mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-[1fr_1.25fr] md:px-8 md:py-16 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}
						>
							<div className="min-w-0">
								<p className="text-sm text-gray-400">{KIND[f.kind]}</p>
								<h2
									className="mt-1 break-words text-4xl font-extrabold leading-[0.95] md:text-7xl"
									style={{ fontFamily: WIDE, fontStretch: "118%" }}
								>
									{f.name}
								</h2>
								<p className="mt-4 max-w-md text-lg text-gray-200">{f.line}</p>
								{evidence.length > 0 && (
									<div className="mt-6 flex items-center gap-3">
										<div className="flex -space-x-4">
											{evidence.map((t, j) => (
												<Link
													key={t.key}
													to={href(t)}
													title={t.title}
													className="relative block w-14 rounded-md border-2 border-[#06090f] md:w-16"
													style={{ zIndex: 10 - j }}
												>
													<img
														src={poster(t, "w185")}
														alt={t.title}
														className="aspect-[2/3] w-full rounded object-cover"
														loading="lazy"
													/>
												</Link>
											))}
										</div>
										<span className="text-sm text-gray-400">
											What you rated here
										</span>
									</div>
								)}
							</div>
							<div className="min-w-0">
								{picks.length === 0 ? (
									<p className="text-gray-400">
										Nothing from here on your services right now. Switch to
										Everywhere.
									</p>
								) : (
									<motion.div
										layout
										className="grid grid-cols-2 gap-3 sm:grid-cols-4"
									>
										{picks.slice(0, expanded ? 8 : 4).map((p) => {
											const t = data.items[p.key]
											return (
												<motion.div layout key={p.key}>
													<Link to={href(t)} className="group block">
														<img
															src={poster(t)}
															alt={`Poster for ${t.title}`}
															className="aspect-[2/3] w-full rounded-lg border-2 border-white/10 object-cover transition group-hover:border-white/40"
															loading="lazy"
														/>
														<p className="mt-2 line-clamp-1 text-sm font-semibold">
															{t.title}
														</p>
														<div className="mt-0.5 flex items-center justify-between gap-2">
															<MatchText match={p.match} short />
															<ServiceLogos
																item={t}
																services={data.services}
																size="w-5 h-5"
																onlyMine
															/>
														</div>
													</Link>
												</motion.div>
											)
										})}
									</motion.div>
								)}
								{picks.length > 4 && (
									<button
										type="button"
										onClick={() => setOpen(expanded ? null : f.id)}
										className="mt-5 text-sm font-semibold text-amber-300 underline underline-offset-4"
									>
										{expanded
											? "Fewer"
											: `Go further: ${Math.min(8, picks.length) - 4} more`}
									</button>
								)}
							</div>
						</div>
					</section>
				)
			})}

			{r.frontiers.length === 0 && (
				<p className="mx-auto max-w-7xl px-4 text-gray-400 md:px-8">
					Rate a few more titles to find your frontiers.
				</p>
			)}

			<section className="mx-auto max-w-7xl border-t border-white/10 px-4 pt-12 md:px-8">
				<h2
					className="text-3xl font-extrabold md:text-4xl"
					style={{ fontFamily: WIDE, fontStretch: "112%" }}
				>
					Home ground
				</h2>
				<p className="mt-2 max-w-2xl text-gray-400">
					Where most of your ratings come from, for comparison.
				</p>
				<div className="mt-6 grid gap-6 sm:grid-cols-2">
					{[
						{ name: "Countries", rows: r.people.countries },
						{ name: "Languages", rows: r.people.languages },
					].map((g) => (
						<div key={g.name}>
							<h3 className="text-sm font-semibold text-gray-400">{g.name}</h3>
							<ul className="mt-2 divide-y divide-white/10 border-y border-white/10">
								{g.rows.slice(0, 5).map((p) => (
									<li
										key={p.name}
										className="flex items-center justify-between gap-3 py-2"
									>
										<span className="truncate">{p.name}</span>
										<span className="flex items-center gap-3 text-sm text-gray-400">
											{p.count} rated
											<YourScore score={Math.round(p.avg)} size="sm" />
										</span>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</section>
		</div>
	)
}
