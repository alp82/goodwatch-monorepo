// PROTOTYPE - throwaway. What it does to your picks (existing): the attributes that set you apart, each with
// how many of your top picks it's behind, and a less/as-is/more switch that re-ranks the picks live so you see
// what each attribute pulls in. Nothing is saved; this shows what a taste control would do.
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { useMemo, useState } from "react"
import { EdgeBar, type ViewProps, attrOf, cap, firstName, list, maxEdge } from "../parts"
import { PosterCard, href } from "~/ui/prototype-rec-taste-2/kit"

type Level = -1 | 0 | 1
const N_PICKS = 12

const cos = (a: number[], b: number[]) => {
	let d = 0
	let na = 0
	let nb = 0
	for (let k = 0; k < a.length; k++) {
		d += a[k] * b[k]
		na += a[k] * a[k]
		nb += b[k] * b[k]
	}
	return na && nb ? d / Math.sqrt(na * nb) : 0
}
const toMatch = (sim: number) => Math.max(40, Math.min(99, Math.round(52 + sim * 58)))

export default function Tuner({ data }: ViewProps) {
	const controls = useMemo(
		() => [
			...data.headline.seek.slice(0, 5),
			...[...data.attrs].sort((a, b) => b.edge - a.edge).slice(5, 7).map((a) => a.key),
			...data.headline.avoid.slice(0, 3),
		].map((k) => attrOf(data, k)),
		[data],
	)
	const idx = useMemo(() => new Map(data.attrs.map((a, k) => [a.key, k])), [data.attrs])
	const [levels, setLevels] = useState<Record<string, Level>>({})
	const scale = Math.max(...data.you.map(Math.abs))
	const rank = (lv: Record<string, Level>) => {
		const v = [...data.you]
		for (const [key, l] of Object.entries(lv)) {
			const k = idx.get(key) ?? -1
			if (k >= 0 && l) v[k] += l * scale * 2.5
		}
		return data.candidates
			.map((c) => ({ c, sim: cos(c.z, v) }))
			.map((x) => ({ ...x, value: x.sim + x.c.q }))
			.sort((a, b) => b.value - a.value)
			.slice(0, N_PICKS)
			.map((x) => {
				// The two control attributes doing the most for this title: what it has, times how much you seek it.
				const why = controls
					.map((a) => {
						const k = idx.get(a.key) ?? 0
						return { a, c: x.c.z[k] > 0.4 && v[k] > 0 ? x.c.z[k] * v[k] : 0 }
					})
					.filter((r) => r.c > 0)
					.sort((p, q) => q.c - p.c)
					.slice(0, 2)
					.map((r) => r.a)
				return { key: x.c.key, match: toMatch(x.sim), why }
			})
	}
	const base = useMemo(() => rank({}), [data])
	const picks = useMemo(() => rank(levels), [levels, data])
	const baseKeys = new Set(base.map((p) => p.key))
	const added = picks.filter((p) => !baseKeys.has(p.key))
	const behind = (key: string) =>
		base.filter((p) => p.why.some((a) => a.key === key)).length
	const touched = Object.entries(levels).filter(([, l]) => l)
	const max = maxEdge(data)

	return (
		<div className="min-h-screen bg-gray-950 pb-40 text-white">
			<header className="mx-auto max-w-7xl px-4 pb-8 pt-12 md:px-8 md:pt-16">
				<p className="text-sm font-semibold text-amber-400">Your fingerprint at work</p>
				<h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight md:text-5xl">
					{(() => {
						const lead = controls
							.map((a) => ({ a, n: behind(a.key) }))
							.sort((x, y) => y.n - x.n)[0]
						return lead && lead.n
							? `${cap(lead.a.phrase)} is behind ${lead.n} of your ${N_PICKS} top picks.`
							: "Your top picks, and what's behind them."
					})()}
				</h1>
				<p className="mt-4 max-w-2xl text-gray-400">
					{firstName(data)}'s picks come from the attributes below. Turn one up or
					down and watch the picks change. Nothing is saved.
				</p>
			</header>

			<div className="mx-auto grid max-w-7xl gap-8 px-4 md:px-8 lg:grid-cols-[22rem_1fr]">
				<aside className="lg:sticky lg:top-20 lg:self-start">
					<ul className="grid grid-cols-2 gap-x-4 border-y border-white/10 lg:grid-cols-1 lg:divide-y lg:divide-white/10">
						{controls.map((a) => {
							const l = levels[a.key] ?? 0
							const n = behind(a.key)
							return (
								<li key={a.key} className="min-w-0 border-b border-white/10 py-3 lg:border-b-0">
									<div className="flex flex-wrap items-baseline justify-between gap-x-3">
										<span className="truncate font-semibold">{a.label}</span>
										<span className="text-xs text-gray-400">
											{n ? `Behind ${n} ${n === 1 ? "pick" : "picks"}` : a.edge < 0 ? "Keeps titles out" : "Behind none yet"}
										</span>
									</div>
									<EdgeBar a={a} max={max} className="mt-2 h-1.5" />
									<div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-gray-900 p-0.5 text-xs font-semibold" role="radiogroup" aria-label={`${a.label} weight`}>
										{([-1, 0, 1] as Level[]).map((v) => (
											<button
												key={v}
												type="button"
												role="radio"
												aria-checked={l === v}
												onClick={() => setLevels((s) => ({ ...s, [a.key]: v }))}
												className={`rounded-full px-1 py-1 transition ${l === v ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}
											>
												{v === -1 ? "Less" : v === 0 ? "Same" : "More"}
											</button>
										))}
									</div>
								</li>
							)
						})}
					</ul>
					{touched.length > 0 && (
						<button type="button" onClick={() => setLevels({})} className="mt-3 text-sm font-semibold text-amber-300 underline underline-offset-2">
							Back to your fingerprint
						</button>
					)}
				</aside>

				<section>
					<p className="mb-4 min-h-6 text-gray-300">
						{touched.length === 0
							? "Your top picks as your fingerprint ranks them."
							: added.length
								? `${added.length} new: ${list(added.slice(0, 3).map((p) => data.items[p.key]?.title ?? ""))}${added.length > 3 ? " and more" : ""}.`
								: "Same titles, different order."}
					</p>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
						{picks.map((p) => {
							const t = data.items[p.key]
							if (!t) return null
							const isNew = !baseKeys.has(p.key)
							return (
								<motion.div key={p.key} layout transition={{ type: "spring", stiffness: 420, damping: 38 }}>
									<Link to={href(t)} className="block">
										<PosterCard item={t} services={data.services} match={p.match} />
									</Link>
									<p className="mt-1.5 truncate text-xs text-gray-400">
										{isNew && <span className="mr-1.5 font-semibold text-amber-300">New</span>}
										{p.why.length
											? `Because of ${list(p.why.map((a) => a.label.toLowerCase()))}`
											: "A broad fit"}
									</p>
								</motion.div>
							)
						})}
					</div>
				</section>
			</div>
		</div>
	)
}
