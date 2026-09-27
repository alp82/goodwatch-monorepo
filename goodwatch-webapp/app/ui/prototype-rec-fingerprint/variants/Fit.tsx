// PROTOTYPE - throwaway. Why this fits you (bolder): lay one title's fingerprint over yours. The title fills
// the screen; one sentence says why it fits and where it goes against your grain; a paired chart shows the
// attributes that decide it, the title's level above yours. Pick another title from your picks, titles you
// loved, or popular titles that clash with you.
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"
import { AVOID, type FpAttr, type Probe, SEEK } from "../model"
import {
	DISPLAY,
	DISPLAY_FONT,
	type ViewProps,
	colorOf,
	list,
	maxEdge,
} from "../parts"
import { backdrop, href } from "~/ui/prototype-rec-taste-2/kit"
import { Link } from "@remix-run/react"

const KIND_NAMES: Record<Probe["kind"], string> = {
	pick: "Picked for you",
	loved: "You loved",
	clash: "Popular, but not you",
}

export default function Fit({ data }: ViewProps) {
	const [key, setKey] = useState(data.probes[0]?.key ?? "")
	const probe = data.probes.find((p) => p.key === key) ?? data.probes[0]
	const t = probe ? data.items[probe.key] : null
	const max = maxEdge(data)
	const reasons = useMemo(() => {
		if (!probe) return { fit: [], against: [] }
		const rows = data.attrs.map((a, k) => ({ a, z: probe.z[k], c: probe.z[k] * a.edge }))
		const fit = rows
			.filter((r) => r.z > 0.5 && r.a.edge > 0)
			.sort((x, y) => y.c - x.c)
			.slice(0, 6)
		const against = rows
			.filter((r) => r.c < 0 && Math.abs(r.z) > 0.6)
			.sort((x, y) => x.c - y.c)
			.slice(0, 3)
		return { fit, against }
	}, [probe, data.attrs])
	if (!probe || !t) return null
	const hasAvoided = reasons.against.filter((r) => r.z > 0)
	const lacks = reasons.against.filter((r) => r.z < 0)
	const zMax = 3

	return (
		<div className="bg-black pb-40 text-white">
			<link rel="stylesheet" href={DISPLAY_FONT} />
			<section className="relative isolate overflow-hidden">
				<AnimatePresence mode="popLayout">
					<motion.img
						key={t.key}
						src={t.backdrop ? backdrop(t, "w1280") : t.poster}
						alt=""
						initial={{ opacity: 0 }}
						animate={{ opacity: 0.5 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.6 }}
						className="absolute inset-0 -z-10 h-full w-full object-cover"
					/>
				</AnimatePresence>
				<div className="absolute inset-0 -z-10 bg-linear-to-t from-black via-black/80 to-black/30" />
				<div className="mx-auto grid min-h-[68vh] max-w-7xl content-end gap-8 px-4 pb-10 pt-16 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-end">
					<div className="flex gap-5">
						<Link to={href(t)} className="w-28 shrink-0 md:w-44">
							<img
								src={t.poster}
								alt={`Poster for ${t.title}`}
								className="block aspect-[2/3] w-full rounded-md border-2 border-white/10 object-cover shadow-2xl"
							/>
						</Link>
						<div className="min-w-0">
							<p className="text-sm text-gray-300">{KIND_NAMES[probe.kind]}</p>
							<h1
								className="mt-1 text-4xl font-black leading-[0.9] md:text-7xl"
								style={{ fontFamily: DISPLAY }}
							>
								{t.title}
							</h1>
							<p className="mt-2 text-gray-400">{t.year}</p>
							<p className="mt-4 flex items-baseline gap-2">
								<span
									className="text-4xl font-black tabular-nums md:text-5xl"
									style={{
										fontFamily: DISPLAY,
										color: `var(--color-vibe-${Math.min(100, Math.floor(probe.match / 10) * 10)})`,
										filter: "brightness(1.5)",
									}}
								>
									{probe.match}%
								</span>
								<span className="text-sm text-gray-300">your taste</span>
							</p>
						</div>
					</div>
					<div className="self-end">
						<p className="text-xl leading-snug text-gray-100 md:text-2xl">
							{reasons.fit.length ? (
								<>
									It fits because it's full of{" "}
									{list(reasons.fit.slice(0, 3).map((r) => r.a.phrase))}, which you seek
									more than most people.
								</>
							) : (
								<>Little of what you seek is in it.</>
							)}
						</p>
						{(hasAvoided.length > 0 || lacks.length > 0) && (
							<p className="mt-3 text-lg text-gray-300">
								{hasAvoided.length > 0
									? `Against your grain: ${list(hasAvoided.map((r) => r.a.phrase))}.`
									: `It has little ${list(lacks.map((r) => r.a.phrase))}, which you usually look for.`}
							</p>
						)}
					</div>
				</div>
			</section>

			<section className="mx-auto max-w-7xl px-4 md:px-8">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
					<h2 className="text-lg font-bold">What decides it</h2>
					<div className="flex flex-wrap gap-4 text-xs text-gray-400">
						<span className="inline-flex items-center gap-1.5">
							<span className="h-2 w-4 rounded-sm border border-white/70" />
							{t.title}
						</span>
						<span className="inline-flex items-center gap-1.5">
							<span className="h-2 w-4 rounded-full" style={{ background: SEEK }} />
							You, more than most
						</span>
						<span className="inline-flex items-center gap-1.5">
							<span className="h-2 w-4 rounded-full" style={{ background: AVOID }} />
							You, less than most
						</span>
					</div>
				</div>
				<div className="mt-2 grid gap-x-10 md:grid-cols-2">
					<Pairs title="Why it fits" rows={reasons.fit} max={max} zMax={zMax} />
					<Pairs title="Against your grain" rows={reasons.against} max={max} zMax={zMax} empty="Nothing here works against you." />
				</div>
			</section>

			<section className="mx-auto mt-12 max-w-7xl px-4 md:px-8">
				<h2 className="text-lg font-bold">Lay another title over yours</h2>
				{(["pick", "loved", "clash"] as const).map((kind) => {
					const ps = data.probes.filter((p) => p.kind === kind)
					if (!ps.length) return null
					return (
						<div key={kind} className="mt-4">
							<p className="mb-2 text-sm text-gray-400">{KIND_NAMES[kind]}</p>
							<div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
								{ps.map((p) => {
									const it = data.items[p.key]
									if (!it) return null
									const on = p.key === probe.key
									return (
										<button
											key={p.key}
											type="button"
											onClick={() => {
												setKey(p.key)
												window.scrollTo({ top: 0, behavior: "smooth" })
											}}
											aria-pressed={on}
											className={`overflow-hidden rounded-md border-2 transition ${on ? "border-amber-400" : "border-gray-800 hover:border-gray-500"}`}
										>
											<img src={it.poster.replace("/w342/", "/w185/")} alt={it.title} className="block aspect-[2/3] w-full object-cover" loading="lazy" />
										</button>
									)
								})}
							</div>
						</div>
					)
				})}
			</section>
		</div>
	)
}

function Pairs({
	title,
	rows,
	max,
	zMax,
	empty,
}: {
	title: string
	rows: { a: FpAttr; z: number }[]
	max: number
	zMax: number
	empty?: string
}) {
	return (
		<div className="mt-4">
			<h3 className="text-sm font-semibold text-gray-300">{title}</h3>
			{!rows.length && <p className="mt-2 text-sm text-gray-500">{empty}</p>}
			<ul className="mt-2 space-y-3">
				{rows.map((r) => {
					const tw = Math.min(50, (Math.abs(r.z) / zMax) * 50)
					const yw = Math.min(50, (Math.abs(r.a.edge) / max) * 50)
					return (
						<li key={r.a.key} className="grid grid-cols-[8rem_1fr] items-center gap-3 text-sm md:grid-cols-[10rem_1fr]">
							<span className="truncate text-gray-200">{r.a.label}</span>
							<span className="relative block h-5" aria-hidden>
								<span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
								<span
									className="absolute top-0 h-2 rounded-sm border border-white/70"
									style={{ width: `${tw}%`, ...(r.z >= 0 ? { left: "50%" } : { right: "50%" }) }}
								/>
								<span
									className="absolute bottom-0 h-2 rounded-full"
									style={{
										width: `${yw}%`,
										background: colorOf(r.a.edge),
										...(r.a.edge >= 0 ? { left: "50%" } : { right: "50%" }),
									}}
								/>
							</span>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
