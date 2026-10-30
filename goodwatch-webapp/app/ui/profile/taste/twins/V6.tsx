// Variant 6, two portraits: both avatars large, the match ring between them as a bridge, the tier word under it.
// Collapsed: one centred card; the comparison opens from a full-width soft button at its foot.
// Expanded: the panels stack under the card, each keyed by a bar running from theirs (amber) to yours.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { DISPLAY } from "~/ui/my-pages/bits"
import { EASE, Face, Panels, PullsSentence, Ring, matchFacts } from "./V6-kit"
import type { TwinsProps } from "./types"

const BIG = "[&>*]:size-16! [&>*]:text-3xl! sm:[&>*]:size-24! sm:[&>*]:text-5xl!"

export default function TwinsV6({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = matchFacts(compare)
	const tint = (n: number) => `color-mix(in srgb, ${f.color} ${n}%, transparent)`
	return (
		<motion.div ref={topRef} layout={still ? false : "position"} className="relative flex flex-col">
			<section
				aria-label="Taste match"
				className="relative overflow-hidden rounded-3xl bg-gray-950 ring-1 ring-white/10"
				style={{ backgroundImage: `radial-gradient(60% 70% at 50% 0%, ${tint(10 + f.strength * 8)}, transparent 70%)` }}
			>
				<div className="flex flex-col items-center gap-5 px-4 pt-6 pb-4 text-center sm:px-8 sm:pt-8">
					{/* The bridge: their face, the ring, yours, joined by a hairline in the match colour. */}
					<div className="relative mb-5 flex items-center justify-center gap-3 sm:gap-6">
						<span
							aria-hidden
							className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 sm:inset-x-12"
							style={{ background: `linear-gradient(90deg, #fbbf24, ${f.color} 35%, ${f.color} 65%, #fff)` }}
						/>
						<figure className="relative flex flex-col items-center gap-2">
							<span className="rounded-full p-1 ring-2 ring-amber-400/70">
								<Face who="them" shell={shell} size={BIG} />
							</span>
							<figcaption className="absolute top-full mt-2 max-w-28 truncate text-xs font-bold text-amber-300">
								@{shell.handle}
							</figcaption>
						</figure>
						<span className="relative rounded-full bg-gray-950 p-1.5">
							<span className="sm:hidden">
								<Ring p={f.p} color={f.color} still={still} px={92} stroke={9} />
							</span>
							<span className="max-sm:hidden">
								<Ring p={f.p} color={f.color} still={still} px={124} stroke={8} />
							</span>
						</span>
						<figure className="relative flex flex-col items-center gap-2">
							<span className="rounded-full p-1 ring-2 ring-white/70">
								<Face who="you" shell={shell} size={BIG} />
							</span>
							<figcaption className="absolute top-full mt-2 text-xs font-bold text-gray-200">You</figcaption>
						</figure>
					</div>
					<div className="flex max-w-2xl flex-col items-center gap-2">
						<h2 className={`${DISPLAY} text-4xl leading-none sm:text-5xl`} style={{ color: f.color }}>
							{f.tier}
						</h2>
						<PullsSentence c={compare} className="text-sm text-balance text-gray-300 sm:text-base" />
					</div>
					<dl className="grid w-full max-w-lg grid-cols-3 divide-x divide-white/10">
						{[
							["Both love", f.both],
							["Rated by both", f.rated],
							["Big splits", f.splits],
						].map(([k, v]) => (
							<div key={k} className="flex flex-col-reverse items-center gap-0.5 px-2">
								<dt className="text-xs text-gray-500">{k}</dt>
								<dd className="text-2xl font-black text-white tabular-nums">{v}</dd>
							</div>
						))}
					</dl>
				</div>
				<div className="px-3 pb-3 sm:px-4 sm:pb-4">
					<button
						type="button"
						aria-expanded={open}
						aria-controls={sectionId}
						onClick={toggle}
						className="group flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-4 text-sm font-bold text-gray-100 ring-1 ring-white/10 transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-base"
						data-compare-row
					>
						{label}
						<ChevronDownIcon
							className={`size-5 text-gray-400 transition-transform duration-200 group-hover:text-white ${open ? "rotate-180" : ""}`}
							aria-hidden
						/>
					</button>
				</div>
			</section>
			<AnimatePresence initial={false} mode="popLayout">
				{open && (
					<motion.section
						key="meet"
						id={sectionId}
						aria-label={label}
						className="relative flex flex-col gap-4 pt-4"
						initial={{ opacity: 0, y: still ? 0 : -12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: still ? 0 : -12 }}
						transition={{ duration: still ? 0 : 0.24, ease: EASE }}
					>
						<Panels
							handle={shell.handle}
							c={compare}
							frame={(k, node) => (
								<div key={k} className="relative">
									{/* The two sides' key: theirs amber at the left, yours white at the right, as in the panels. */}
									<span
										aria-hidden
										className="absolute inset-x-6 top-0 z-10 h-0.5 rounded-full bg-linear-to-r from-amber-400 via-white/20 to-white/80"
									/>
									{node}
								</div>
							)}
						/>
					</motion.section>
				)}
			</AnimatePresence>
		</motion.div>
	)
}
