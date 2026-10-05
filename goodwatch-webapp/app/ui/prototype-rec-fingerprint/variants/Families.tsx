// PROTOTYPE - throwaway. Five families (existing): never 74 things at once. One sentence on top, then the
// fingerprint's five families as rows with a small shape of each. Open a family to see its attributes against
// everyone; pick one to see what it means and the titles that carry it for you.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import type { FamilyId, FpAttr } from "../model"
import {
	AttrDetail,
	EdgeBar,
	Legend,
	type ViewProps,
	attrOf,
	colorOf,
	firstName,
	headlineWords,
	itemsOf,
	maxEdge,
} from "../parts"
import { RatedPoster } from "~/ui/prototype-rec-taste-2/kit"

export default function Families({ data }: ViewProps) {
	const max = maxEdge(data)
	const top = attrOf(data, data.headline.seek[0])
	const [open, setOpen] = useState<FamilyId | null>(top.family)
	const [sel, setSel] = useState<string>(top.key)
	const words = headlineWords(data)
	const famAttrs = (id: FamilyId) =>
		data.attrs.filter((a) => a.family === id).sort((a, b) => b.edge - a.edge)

	return (
		<div className="min-h-screen bg-gray-950 pb-40 text-white">
			<header className="mx-auto max-w-5xl px-4 pb-10 pt-12 md:px-8 md:pt-16">
				<p className="text-sm font-semibold text-amber-400">Your fingerprint</p>
				<h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
					You seek {words.seek} far more than most people, and steer around{" "}
					{words.avoid}.
				</h1>
				<p className="mt-4 max-w-2xl text-gray-400">
					{firstName(data)}, read from the title analysis of{" "}
					{data.who.rated.toLocaleString("en")} rated titles and weighted by how
					you rated them. Five families, 74 attributes. Open one.
				</p>
			</header>

			<div className="mx-auto max-w-5xl px-4 md:px-8">
				<Legend className="mb-3" />
				<ul className="divide-y divide-white/10 border-y border-white/10">
					{data.families.map((f) => {
						const attrs = famAttrs(f.id)
						const isOpen = open === f.id
						const lead = attrs.filter((a) => a.tier > 0).slice(0, 2)
						const low = attrs.filter((a) => a.tier < 0).slice(-1)
						const posterKeys = (lead[0] ?? attrs[0]).carriers.slice(0, 3)
						return (
							<li key={f.id}>
								<button
									type="button"
									onClick={() => {
										setOpen(isOpen ? null : f.id)
										if (!isOpen) setSel(attrs[0].key)
									}}
									aria-expanded={isOpen}
									className="grid w-full grid-cols-[1fr_auto] items-center gap-4 py-5 text-left md:grid-cols-[11rem_1fr_9rem_auto] md:gap-8"
								>
									<span>
										<span className="block text-xl font-bold md:text-2xl">
											{f.name}
										</span>
										<span className="block text-sm text-gray-400">{f.line}</span>
									</span>
									<span className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-1 md:col-start-2">
										<FamilyShape attrs={attrs} max={max} />
										<span className="mt-2 block truncate text-sm text-gray-300">
											{lead.length
												? `Drawn to ${lead.map((a) => a.label.toLowerCase()).join(" and ")}`
												: "Nothing here pulls you much"}
											{low.length
												? `, not ${low[0].label.toLowerCase()}`
												: ""}
										</span>
									</span>
									<span className="hidden -space-x-4 md:flex">
										{itemsOf(data, posterKeys).map((t) => (
											<img
												key={t.key}
												src={t.poster.replace("/w342/", "/w185/")}
												alt=""
												className="w-11 rotate-[-3deg] rounded-sm border-2 border-gray-950"
											/>
										))}
									</span>
									<span
										className={`text-2xl text-gray-500 transition ${isOpen ? "rotate-90" : ""}`}
										aria-hidden
									>
										›
									</span>
								</button>
								<AnimatePresence initial={false}>
									{isOpen && (
										<motion.div
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: "auto", opacity: 1 }}
											exit={{ height: 0, opacity: 0 }}
											transition={{ duration: 0.25 }}
											className="overflow-hidden"
										>
											<div className="grid gap-8 pb-8 md:grid-cols-[18rem_1fr]">
												<ul className="space-y-0.5">
													{attrs.map((a) => (
														<li key={a.key}>
															<button
																type="button"
																onClick={() => setSel(a.key)}
																aria-pressed={sel === a.key}
																className={`grid w-full grid-cols-[8.5rem_1fr] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition ${sel === a.key ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5"}`}
															>
																<span className="truncate">{a.label}</span>
																<EdgeBar a={a} max={max} muted={a.tier === 0} />
															</button>
														</li>
													))}
												</ul>
												<div className="md:sticky md:top-20 md:self-start">
													<AttrDetail data={data} a={attrOf(data, sel)} />
												</div>
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</li>
						)
					})}
				</ul>

				<section className="mt-14">
					<h2 className="text-xl font-bold">The titles that are most you</h2>
					<p className="mt-1 text-sm text-gray-400">
						Rated highly, and carrying several of the attributes that set you
						apart.
					</p>
					<div className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-8">
						{itemsOf(
							data,
							[
								...new Set(
									data.headline.seek.flatMap((k) =>
										attrOf(data, k).carriers.slice(0, 2),
									),
								),
							],
						)
							.slice(0, 8)
							.map((t) => (
								<RatedPoster key={t.key} t={t} size="w185" />
							))}
					</div>
				</section>
			</div>
		</div>
	)
}

/** A family's attributes as small up/down bars, strongest pull first. */
function FamilyShape({ attrs, max }: { attrs: FpAttr[]; max: number }) {
	return (
		<span className="flex h-12 items-stretch gap-1" aria-hidden>
			{attrs.map((a) => {
				const h = Math.max(3, (Math.abs(a.edge) / max) * 50)
				return (
					<span key={a.key} className="relative w-1.5 shrink-0 md:w-2" title={a.label}>
						<span className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
						<span
							className="absolute inset-x-0 rounded-sm"
							style={{
								background: colorOf(a.edge),
								opacity: a.tier === 0 ? 0.35 : 1,
								height: `${h}%`,
								...(a.edge >= 0 ? { bottom: "50%" } : { top: "50%" }),
							}}
						/>
					</span>
				)
			})}
		</span>
	)
}
