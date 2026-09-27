// PROTOTYPE - throwaway. Your canon (existing components): the eight titles that define you, each with
// the part of your taste it carries. Pick one to put it center stage with what to watch in its vein.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import Button from "~/ui/button/Button"
import {
	PickRow,
	PosterCard,
	Ring,
	ServiceLogos,
	ServicesSwitch,
	type ViewProps,
	YourScore,
	attrOf,
	backdrop,
	href,
	list,
	useOnMine,
} from "../kit"

export default function Canon({ data }: ViewProps) {
	const r = data.report
	const [active, setActive] = useState(r.canon[0]?.key)
	const entry = r.canon.find((c) => c.key === active) ?? r.canon[0]
	const services = useOnMine(data)
	if (!entry)
		return (
			<p className="p-10 text-white">
				Rate a few titles 9 or 10 to see your canon.
			</p>
		)
	const t = data.items[entry.key]
	const why = entry.why.map((k) => attrOf(data, k))

	return (
		<div className="pb-32 text-white">
			<section className="relative isolate overflow-hidden">
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.img
						key={t.key}
						src={backdrop(t)}
						alt=""
						initial={{ opacity: 0, scale: 1.03 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.5 }}
						className="absolute inset-0 -z-10 h-full w-full object-cover object-top"
					/>
				</AnimatePresence>
				<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/85 to-gray-950/30" />
				<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-900 via-transparent to-transparent" />
				<div className="mx-auto max-w-7xl px-4 pb-10 pt-10 md:px-8 md:pt-16">
					<h1 className="text-lg font-semibold text-amber-300">Your canon</h1>
					<p className="mt-1 max-w-xl text-gray-300">
						The titles that define your taste, picked from your favorites and
						top ratings for how close they sit to everything else you love.
					</p>
					<AnimatePresence mode="wait">
						<motion.div
							key={t.key}
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6 }}
							transition={{ duration: 0.3 }}
							className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end"
						>
							<Link to={href(t)} className="w-40 shrink-0 md:w-56">
								<PosterCard
									item={t}
									services={data.services}
									showTitle={false}
								/>
							</Link>
							<div className="min-w-0 max-w-2xl">
								<h2 className="text-4xl font-bold leading-tight md:text-6xl">
									{t.title}{" "}
									<span className="font-normal text-gray-400">({t.year})</span>
								</h2>
								<div className="mt-4 flex flex-wrap items-center gap-5">
									{t.mine != null && (
										<YourScore score={t.mine} size="lg" label={entry.reason} />
									)}
									<Ring item={t} size={48} label />
									<ServiceLogos item={t} services={data.services} onlyMine />
								</div>
								<p className="mt-5 text-xl text-gray-100 md:text-2xl">
									It holds your taste for {list(why.map((a) => a.phrase))}.
								</p>
								<div className="mt-4 flex flex-wrap gap-2">
									{why.map((a) => (
										<span
											key={a.key}
											className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-sm"
										>
											<span
												className="h-2.5 w-2.5 rounded-full"
												style={{
													background: a.color.replace(/[\d.]+\)$/, "1)"),
												}}
											/>
											{a.label}
										</span>
									))}
								</div>
							</div>
						</motion.div>
					</AnimatePresence>
				</div>
			</section>

			<section className="mx-auto mt-6 max-w-7xl px-4 md:px-8">
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
					{r.canon.map((c) => {
						const it = data.items[c.key]
						const on = c.key === entry.key
						return (
							<button
								key={c.key}
								type="button"
								onClick={() => setActive(c.key)}
								className="group text-left"
								aria-pressed={on}
							>
								<div
									className={`rounded-xl transition ${on ? "ring-4 ring-amber-500" : "opacity-80 group-hover:opacity-100"}`}
								>
									<PosterCard
										item={it}
										services={data.services}
										showTitle={false}
									/>
								</div>
								<p className="mt-2 line-clamp-1 text-sm font-semibold">
									{it.title}
								</p>
								<p className="line-clamp-2 text-xs text-gray-400">
									{c.why
										.slice(0, 2)
										.map((k) => attrOf(data, k).label)
										.join(", ")}
								</p>
							</button>
						)
					})}
				</div>
			</section>

			<section className="mx-auto mt-14 max-w-7xl px-4 md:px-8">
				<div className="mb-5 flex flex-wrap items-end justify-between gap-3">
					<div>
						<h2 className="text-2xl font-bold md:text-3xl">
							In the vein of {t.title}
						</h2>
						<p className="mt-1 text-gray-400">
							Not seen yet, closest to this title and to your taste overall.
						</p>
					</div>
					<ServicesSwitch state={services} />
				</div>
				<PickRow data={data} refs={services.filter(entry.next)} n={6} />
			</section>

			<section className="mx-auto mt-14 max-w-7xl px-4 md:px-8">
				<div className="flex flex-col items-start gap-4 rounded-xl border border-gray-800 bg-gray-950/60 p-5 md:flex-row md:items-center md:justify-between">
					<p className="text-gray-300">
						Your canon updates as you rate. Favorites always count, and a 10
						counts more than a 9.
					</p>
					<Button
						highlight="amber"
						mode="dark"
						size="sm"
						onClick={() =>
							setActive(
								r.canon[
									(r.canon.findIndex((c) => c.key === entry.key) + 1) %
										r.canon.length
								].key,
							)
						}
					>
						Next in your canon
					</Button>
				</div>
			</section>
		</div>
	)
}
