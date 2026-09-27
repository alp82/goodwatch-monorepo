// PROTOTYPE - throwaway. The reel (bolder): your fingerprint one attribute at a time, like title cards.
// Each frame is a full-bleed still from a title that carries the attribute for you, the attribute in big type,
// one sentence of what it means for you, and the posters behind it. Underneath, all 74 attributes run from
// what you seek most to what you avoid most; tap any of them to cut to it.
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"
import { AVOID, SEEK } from "../model"
import {
	DISPLAY,
	DISPLAY_FONT,
	TierTag,
	type ViewProps,
	colorOf,
	firstName,
	itemsOf,
	maxEdge,
	stanceLine,
} from "../parts"
import { RatedPoster, backdrop } from "~/ui/prototype-rec-taste-2/kit"

export default function Reel({ data }: ViewProps) {
	const sorted = useMemo(
		() => [...data.attrs].sort((a, b) => b.edge - a.edge),
		[data.attrs],
	)
	// The cut: your strongest pulls, then your strongest avoids.
	const cut = useMemo(
		() => [
			...sorted.filter((a) => a.carriers.length).slice(0, 7),
			...sorted
				.slice()
				.reverse()
				.filter((a) => a.tier < 0)
				.slice(0, 3),
		],
		[sorted],
	)
	const [key, setKey] = useState(cut[0].key)
	const a = sorted.find((x) => x.key === key) ?? cut[0]
	const idx = cut.findIndex((x) => x.key === key)
	const go = (step: number) => {
		const i = idx < 0 ? 0 : (idx + step + cut.length) % cut.length
		setKey(cut[i].key)
	}
	const sought = a.edge >= 0
	const shown = itemsOf(
		data,
		sought || !a.against.length ? a.carriers : a.against,
	)
	const still = shown.find((t) => t.backdrop) ?? itemsOf(data, a.carriers)[0]
	const max = maxEdge(data)

	return (
		<div className="bg-black pb-40 text-white">
			<link rel="stylesheet" href={DISPLAY_FONT} />
			<section className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden">
				<AnimatePresence mode="popLayout">
					<motion.img
						key={`${a.key}-bg`}
						src={still ? backdrop(still, "w1280") : ""}
						alt=""
						initial={{ opacity: 0, scale: 1.06 }}
						animate={{ opacity: 0.55, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
						className="absolute inset-0 -z-10 h-full w-full object-cover"
					/>
				</AnimatePresence>
				<div className="absolute inset-0 -z-10 bg-linear-to-t from-black via-black/70 to-black/20" />
				<div className="absolute inset-0 -z-10 bg-linear-to-r from-black/80 to-transparent" />

				<div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-4 pb-8 pt-10 md:px-8">
					<p className="text-sm text-gray-300">
						{firstName(data)}'s fingerprint.{" "}
						{idx >= 0 ? (
							<span className="tabular-nums text-gray-400">
								{idx + 1} of {cut.length}
							</span>
						) : (
							<span className="text-gray-400">Off the cut</span>
						)}
					</p>
					<AnimatePresence mode="wait">
						<motion.div
							key={a.key}
							initial={{ opacity: 0, y: 18 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							transition={{ duration: 0.35 }}
							className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-end"
						>
							<div className="min-w-0">
								<h1
									className="mt-2 break-words text-[3.6rem] font-black leading-[0.86] md:text-[8.5rem]"
									style={{ fontFamily: DISPLAY, color: sought ? "#fff" : "#e0f2fe" }}
								>
									{a.label}
								</h1>
								<div className="mt-4">
									<TierTag a={a} />
								</div>
								<p className="mt-3 max-w-xl text-lg text-gray-100 md:text-2xl">
									{stanceLine(a)}
								</p>
								<p className="mt-2 max-w-xl text-gray-400">{a.meaning}</p>
							</div>
							<div className="grid grid-cols-4 gap-2 lg:grid-cols-2 lg:gap-3 xl:grid-cols-4">
								{shown.slice(0, 4).map((t) => (
									<RatedPoster key={t.key} t={t} size="w185" />
								))}
							</div>
						</motion.div>
					</AnimatePresence>

					<div className="mt-8 flex items-center gap-3">
						<button
							type="button"
							onClick={() => go(-1)}
							className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10"
						>
							Previous
						</button>
						<button
							type="button"
							onClick={() => go(1)}
							className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black hover:bg-amber-200"
						>
							Next attribute
						</button>
					</div>
				</div>
			</section>

			<section className="mx-auto max-w-7xl px-4 pt-10 md:px-8">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="text-xl font-bold md:text-2xl">
						All 74, from what you seek most to what you avoid most
					</h2>
					<span className="text-sm text-gray-400">Tap any bar to cut to it</span>
				</div>
				<div
					className="mt-5 flex h-28 items-stretch gap-[2px]"
					role="group"
					aria-label="All attributes, sorted"
				>
					{sorted.map((x) => {
						const on = x.key === a.key
						const h = Math.max(3, (Math.abs(x.edge) / max) * 50)
						return (
							<button
								key={x.key}
								type="button"
								onClick={() => setKey(x.key)}
								aria-label={x.label}
								aria-pressed={on}
								title={x.label}
								className="group relative min-w-0 flex-1"
							>
								<span className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
								<span
									className="absolute inset-x-0 rounded-sm transition"
									style={{
										background: colorOf(x.edge),
										opacity: on ? 1 : x.tier === 0 ? 0.3 : 0.6,
										height: `${h}%`,
										outline: on ? "2px solid white" : undefined,
										outlineOffset: 1,
										...(x.edge >= 0 ? { bottom: "50%" } : { top: "50%" }),
									}}
								/>
							</button>
						)
					})}
				</div>
				<div className="mt-2 flex justify-between text-xs text-gray-400">
					<span style={{ color: SEEK }}>You seek it more than most people</span>
					<span style={{ color: AVOID }}>Less than most</span>
				</div>
			</section>
		</div>
	)
}
