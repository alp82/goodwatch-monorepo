// Variant 7, poster wall: one surface whose background is a dimmed, tilted mosaic of the titles you both love.
// Collapsed: the match sits on the wall; a solid amber bar along the bottom opens the comparison.
// Expanded: the surface grows under the bar and the wall keeps going behind the panels, which turn dark and solid.
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import type { ProfileTitle } from "~/domain/profile"
import { DISPLAY } from "~/ui/my-pages/bits"
import { posterUrl } from "../../parts"
import { EASE, Face, Panels, PullsSentence, Ring, matchFacts } from "./V6-kit"
import type { Ready } from "./parts"
import type { TwinsProps } from "./types"

const SMALL = "[&>*]:size-10! [&>*]:text-lg! [&>*]:ring-2!"

/** Titles for the wall: the ones you both love first, then each side's favorites, repeated to fill `n` tiles. */
function wallTitles(c: Ready, n: number): ProfileTitle[] {
	const pool = [...c.overlap.both, ...c.overlap.onlyThem, ...c.overlap.onlyYou].filter((t) => t.poster)
	const seen = new Set<string>()
	const unique = pool.filter((t) => !seen.has(t.key) && seen.add(t.key))
	if (!unique.length) return []
	return Array.from({ length: n }, (_, i) => unique[i % unique.length])
}

function Wall({ c }: { c: Ready }) {
	const tiles = wallTitles(c, 96)
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
			<div className="absolute -inset-x-[10%] -top-24 grid origin-top rotate-[-8deg] grid-cols-6 gap-2 opacity-40 sm:grid-cols-10 lg:grid-cols-12">
				{tiles.map((t, i) => (
					<img
						// biome-ignore lint/suspicious/noArrayIndexKey: the wall repeats titles; the index is the tile
						key={i}
						src={posterUrl(t.poster, "w154") ?? ""}
						alt=""
						loading="lazy"
						className={`aspect-[2/3] w-full rounded-md object-cover ${i % 2 ? "translate-y-6" : ""}`}
					/>
				))}
			</div>
			{/* Dim it: darkest at the left where the words sit, and toward the foot. */}
			<div className="absolute inset-0 bg-linear-to-r from-gray-950 via-gray-950/80 to-gray-950/40" />
			<div className="absolute inset-0 bg-linear-to-t from-gray-950/90 via-transparent to-gray-950/30" />
		</div>
	)
}

export default function TwinsV7({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = matchFacts(compare)
	const bar = (
		<button
			type="button"
			aria-expanded={open}
			aria-controls={sectionId}
			onClick={toggle}
			className="relative flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 bg-amber-400 px-5 text-left text-sm font-black text-gray-950 transition-colors hover:bg-amber-300 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-gray-950 sm:px-7 sm:text-base"
			data-compare-row
		>
			<span>{open ? "Hide the comparison" : label}</span>
			<span className="flex size-8 items-center justify-center rounded-full bg-gray-950/10">
				{open ? <ChevronUpIcon className="size-5" aria-hidden /> : <ChevronDownIcon className="size-5" aria-hidden />}
			</span>
		</button>
	)
	return (
		<motion.div
			ref={topRef}
			layout={still ? false : "position"}
			className="relative isolate overflow-hidden rounded-3xl bg-gray-950 ring-1 ring-white/10"
		>
			<Wall c={compare} />
			<section aria-label="Taste match" className="relative">
				<div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
					<div className="flex items-center gap-4 sm:block">
						<span className="rounded-full bg-gray-950/80 p-1 sm:block">
							<span className="sm:hidden">
								<Ring p={f.p} color={f.color} still={still} px={96} />
							</span>
							<span className="max-sm:hidden">
								<Ring p={f.p} color={f.color} still={still} px={136} />
							</span>
						</span>
						<span className="flex items-center gap-2 sm:hidden">
							<span className="flex">
								<Face who="them" shell={shell} size={SMALL} />
								<span className="-ml-3">
									<Face who="you" shell={shell} size={SMALL} />
								</span>
							</span>
						</span>
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-3">
						<p className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-gray-400 uppercase">
							<span className="flex max-sm:hidden">
								<Face who="them" shell={shell} size={SMALL} />
								<span className="-ml-3">
									<Face who="you" shell={shell} size={SMALL} />
								</span>
							</span>
							You and @{shell.handle}
						</p>
						<h2 className={`${DISPLAY} text-4xl leading-none sm:text-6xl`} style={{ color: f.color }}>
							{f.tier}
						</h2>
						<PullsSentence c={compare} className="max-w-xl text-sm text-gray-300 sm:text-base" />
						<p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-400">
							{[
								[f.both, "you both love"],
								[f.rated, "rated by both"],
								[f.splits, "big splits"],
							].map(([v, k]) => (
								<span key={k} className="whitespace-nowrap">
									<b className="text-lg font-black text-white tabular-nums">{v}</b> {k}
								</span>
							))}
						</p>
					</div>
				</div>
				{bar}
			</section>
			<AnimatePresence initial={false} mode="popLayout">
				{open && (
					<motion.section
						key="meet"
						id={sectionId}
						aria-label={label}
						className="relative flex flex-col"
						initial={{ opacity: 0, y: still ? 0 : -12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: still ? 0 : 0.26, ease: EASE }}
					>
						<div className="flex flex-col gap-4 px-3 py-4 sm:p-5">
							<Panels
								handle={shell.handle}
								c={compare}
								frame={(k, node) => (
									<div key={k} className="[&>div]:bg-gray-950/90">
										{node}
									</div>
								)}
							/>
						</div>
					</motion.section>
				)}
			</AnimatePresence>
		</motion.div>
	)
}
