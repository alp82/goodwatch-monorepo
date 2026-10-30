// Variant 5, story: the card is one sentence ("You and @epix are taste twins, 94% alike"), the why under it, the
// counts as chips, and a thin bar that fills to the percent. Collapsed: the card ends in an amber text link with an arrow.
// Expanded: the arrow turns down and the three panels follow under the card one after another, each with a short
// lead-in line, fading in in turn.
import { ArrowRightIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { DISPLAY } from "~/ui/my-pages/bits"
import { EASE, Pair, TIER_PHRASE, matchFacts, panelsFor, pullLines } from "./V1-kit"
import { Overlap, Picks, Splits } from "./parts"
import type { TwinsProps } from "./types"

export default function TwinsV5({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = matchFacts(compare)
	const lines = pullLines(compare)
	const has = panelsFor(compare)
	const chapters = [
		{ id: "overlap", lead: "Start with what you share.", body: <Overlap handle={shell.handle} c={compare} /> },
		has.splits && { id: "splits", lead: "Then where you part ways.", body: <Splits handle={shell.handle} c={compare} /> },
		has.picks && { id: "picks", lead: "And what to swap next.", body: <Picks handle={shell.handle} c={compare} /> },
	].filter(Boolean) as { id: string; lead: string; body: JSX.Element }[]
	return (
		<div ref={topRef} className="flex flex-col gap-6">
			<section aria-label="Taste match" className="relative overflow-hidden rounded-3xl bg-gray-950 p-6 ring-1 ring-white/10 sm:p-9">
				<span
					aria-hidden
					className="pointer-events-none absolute inset-0"
					style={{ background: `radial-gradient(28rem 20rem at 100% 0%, color-mix(in srgb, ${f.color} ${8 + f.strength * 8}%, transparent), transparent 70%)` }}
				/>
				<div className="relative flex flex-col gap-5">
					<Pair shell={shell} px={40} />
					<h2 className={`${DISPLAY} max-w-[48rem] text-[2rem] leading-[1.08] text-white sm:text-5xl`}>
						You and <span className="text-gray-300">@{shell.handle}</span>{" "}
						<span style={{ color: f.color }}>{(TIER_PHRASE[f.tier] ?? f.tier).replace(/^(\S+) /, "$1 ")}</span>,{" "}
						<span className="tabular-nums" style={{ color: f.color }}>{f.p}%</span> alike.
					</h2>
					{/* The percent as a bar: the same colour, filled by transform. */}
					<span aria-hidden className="relative block h-1 w-full max-w-[28rem] overflow-hidden rounded-full bg-white/10">
						<motion.span
							className="absolute inset-0 origin-left rounded-full"
							style={{ background: f.color }}
							initial={still ? false : { scaleX: 0 }}
							animate={{ scaleX: f.p / 100 }}
							transition={{ duration: 0.9, ease: EASE }}
						/>
					</span>
					{(lines.both || lines.apart) && (
						<p className="max-w-[44rem] text-base leading-relaxed text-gray-300 sm:text-lg">
							{lines.both} {lines.apart}
						</p>
					)}
					<ul className="flex flex-wrap gap-2" aria-label="Counts">
						{[
							[f.both, "you both love"],
							[f.rated, "rated by both"],
							[f.splits, "big splits"],
						].map(([n, t]) => (
							<li key={t} className="rounded-full bg-white/[0.05] px-3 py-1.5 text-sm text-gray-400 ring-1 ring-white/10">
								<b className="font-black text-white tabular-nums">{n}</b> {t}
							</li>
						))}
					</ul>
					<button
						type="button"
						aria-expanded={open}
						aria-controls={sectionId}
						onClick={toggle}
						className="group -mx-1 mt-1 inline-flex cursor-pointer items-center gap-2 self-start rounded-md px-1 py-1 text-base font-bold text-amber-400 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-white"
					>
						<span className="underline decoration-amber-400/40 decoration-2 underline-offset-[6px] group-hover:decoration-amber-300">
							{open ? "Hide the comparison" : label}
						</span>
						<ArrowRightIcon
							className={`size-5 transition-transform duration-300 ${open ? "rotate-90" : "group-hover:translate-x-1"}`}
							aria-hidden
						/>
					</button>
				</div>
			</section>
			<AnimatePresence initial={false}>
				{open && (
					<motion.section
						key="story"
						id={sectionId}
						aria-label={label}
						className="flex flex-col gap-6"
						initial="hidden"
						animate="shown"
						exit={{ opacity: 0, transition: { duration: still ? 0 : 0.14 } }}
						variants={{ hidden: { opacity: 1 }, shown: { opacity: 1, transition: { staggerChildren: still ? 0 : 0.12 } } }}
					>
						{chapters.map((ch, i) => (
							<motion.div
								key={ch.id}
								className="flex flex-col gap-3"
								variants={{
									hidden: { opacity: 0, y: still ? 0 : 14 },
									shown: { opacity: 1, y: 0, transition: { duration: still ? 0 : 0.4, ease: EASE } },
								}}
							>
								<p className="flex items-center gap-3 px-1 text-sm font-semibold text-gray-400">
									<span className="flex size-6 items-center justify-center rounded-full bg-white/[0.06] text-xs font-black text-amber-300 ring-1 ring-white/10 tabular-nums">
										{i + 1}
									</span>
									{ch.lead}
								</p>
								{ch.body}
							</motion.div>
						))}
					</motion.section>
				)}
			</AnimatePresence>
		</div>
	)
}
