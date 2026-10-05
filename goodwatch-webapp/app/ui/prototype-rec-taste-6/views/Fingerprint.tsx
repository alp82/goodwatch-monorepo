// PROTOTYPE - throwaway. The Fingerprint tab: #181's chosen `families` view with its refinements. The title
// names the person (their archetype) and says in one line what gets them and what doesn't, next to the
// titles that are most them. Family rows and attributes show a pointer and a clear hover; "The titles that
// are most you" runs two rows.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { RatedPoster } from "~/ui/prototype-rec-taste-2/kit"
import type { FamilyId, FpAttr, FpPayload } from "~/ui/prototype-rec-fingerprint/model"
import {
	AttrDetail,
	EdgeBar,
	Legend,
	attrOf,
	cap,
	colorOf,
	itemsOf,
	maxEdge,
} from "~/ui/prototype-rec-fingerprint/parts"

const joinOr = (xs: string[]) =>
	xs.length > 1 ? `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}` : (xs[0] ?? "")
const joinAnd = (xs: string[]) =>
	xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? "")

/** "Show you the unexpected, the surreal or absurd humor, and you're in. Grounded dramas and love stories rarely get a look." */
export function identityLine(data: FpPayload) {
	const seek = data.headline.seek.slice(0, 3).map((k) => attrOf(data, k).phrase)
	const avoid = data.headline.avoid.slice(0, 2).map((k) => attrOf(data, k).noun)
	const first = `Show you ${joinOr(seek)}, and you're in.`
	return avoid.length ? `${first} ${cap(joinAnd(avoid))} rarely get a look.` : first
}

/** The titles rated highly that carry the attributes that set the person apart, taken in turns. */
function mostYou(data: FpPayload, n: number) {
	const keys = [
		...data.headline.seek,
		...data.attrs.filter((a) => a.tier >= 2 && !data.headline.seek.includes(a.key)).sort((a, b) => b.edge - a.edge).map((a) => a.key),
	]
	const out: string[] = []
	for (let i = 0; i < 6 && out.length < n; i++)
		for (const k of keys) {
			const c = attrOf(data, k).carriers[i]
			if (c && !out.includes(c) && data.items[c]) out.push(c)
			if (out.length >= n) break
		}
	return out
}

export default function Fingerprint({ data }: { data: FpPayload }) {
	const max = maxEdge(data)
	const top = attrOf(data, data.headline.seek[0])
	const [open, setOpen] = useState<FamilyId | null>(top.family)
	const [sel, setSel] = useState<string>(top.key)
	const famAttrs = (id: FamilyId) =>
		data.attrs.filter((a) => a.family === id).sort((a, b) => b.edge - a.edge)
	const most = mostYou(data, 16)
	const cover = itemsOf(data, most.slice(0, 3))

	return (
		<div className="bg-gray-950 pb-40 text-white">
			<header className="mx-auto grid max-w-5xl items-center gap-8 px-4 pb-10 pt-12 md:grid-cols-[1fr_auto] md:px-8 md:pt-16">
				<div>
					<p className="text-sm text-gray-400">You are</p>
					<h1 className="mt-1 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
						{cap(data.archetype.name)}
					</h1>
					<p className="mt-5 max-w-xl text-xl leading-snug text-gray-100 md:text-2xl">
						{identityLine(data)}
					</p>
					<p className="mt-4 max-w-xl text-sm text-gray-400">
						Read from the title analysis of {data.who.rated.toLocaleString("en")} titles you
						rated, weighted by how you rated them. Five families, 74 attributes. Open one.
					</p>
				</div>
				<div className="relative mx-auto hidden h-60 w-72 md:block" aria-hidden>
					{cover.map((t, i) => (
						<img
							key={t.key}
							src={t.poster}
							alt=""
							className="absolute top-1/2 w-32 rounded-lg border-4 border-gray-800 shadow-2xl"
							style={{
								left: `calc(50% + ${(i - 1) * 64}px)`,
								transform: `translate(-50%, -50%) rotate(${(i - 1) * 7}deg)`,
								zIndex: i === 1 ? 3 : 1,
							}}
						/>
					))}
				</div>
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
									className={`group -mx-3 grid w-[calc(100%+1.5rem)] cursor-pointer grid-cols-[1fr_auto] items-center gap-4 rounded-lg px-3 py-5 text-left transition hover:bg-white/[0.05] md:grid-cols-[11rem_1fr_9rem_auto] md:gap-8 ${isOpen ? "bg-white/[0.03]" : ""}`}
								>
									<span>
										<span className="block text-xl font-bold transition group-hover:text-amber-200 md:text-2xl">
											{f.name}
										</span>
										<span className="block text-sm text-gray-400">{f.line}</span>
									</span>
									<span className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
										<FamilyShape attrs={attrs} max={max} />
										<span className="mt-2 block truncate text-sm text-gray-300">
											{lead.length
												? `Drawn to ${lead.map((a) => a.label.toLowerCase()).join(" and ")}`
												: "Nothing here pulls you much"}
											{low.length ? `, not ${low[0].label.toLowerCase()}` : ""}
										</span>
									</span>
									<span className="hidden -space-x-4 md:flex">
										{itemsOf(data, posterKeys).map((t) => (
											<img
												key={t.key}
												src={t.poster.replace("/w342/", "/w185/")}
												alt=""
												className="w-11 rotate-[-3deg] rounded-sm border-2 border-gray-950 transition group-hover:rotate-0"
											/>
										))}
									</span>
									<span
										className={`flex h-9 w-9 items-center justify-center rounded-full border text-2xl transition ${isOpen ? "rotate-90 border-amber-400/60 text-amber-300" : "border-white/15 text-gray-400 group-hover:border-white/40 group-hover:text-white"}`}
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
											<div className="grid gap-8 pb-8 pt-2 md:grid-cols-[18rem_1fr]">
												<ul className="space-y-0.5">
													{attrs.map((a) => (
														<li key={a.key}>
															<button
																type="button"
																onClick={() => setSel(a.key)}
																aria-pressed={sel === a.key}
																className={`grid w-full cursor-pointer grid-cols-[8.5rem_1fr] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition ${sel === a.key ? "bg-white/10 text-white ring-1 ring-amber-400/50" : "text-gray-300 hover:bg-white/[0.07] hover:text-white"}`}
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
						Rated highly, and carrying several of the attributes that set you apart.
					</p>
					<div className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-8">
						{itemsOf(data, most).map((t) => (
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
					<span key={a.key} className="relative w-1.5 shrink-0 md:w-2">
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
