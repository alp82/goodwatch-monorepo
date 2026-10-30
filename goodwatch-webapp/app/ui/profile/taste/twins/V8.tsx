// Variant 8, minimal: no box. The tier word, the percentage and the sentence are set on the page between hairlines.
// Collapsed: an underlined text control with a plus opens the comparison.
// Expanded: the plus turns into a minus; the panels appear unboxed under hairlines, in the same quiet style.
import { AnimatePresence, motion } from "framer-motion"
import { DISPLAY } from "~/ui/my-pages/bits"
import { CountUp } from "./parts"
import { EASE, Face, Panels, PullsSentence, matchFacts } from "./V6-kit"
import type { TwinsProps } from "./types"

const TINY = "[&>*]:size-7! [&>*]:text-xs! [&>*]:ring-2!"
/** Takes the panel's box away: no fill, no ring, no side padding; a hairline above instead. */
const UNBOXED =
	"border-t border-white/10 pt-2 [&>div]:rounded-none! [&>div]:bg-transparent! [&>div]:px-0! [&>div]:ring-0!"

function PlusMinus({ open }: { open: boolean }) {
	return (
		<span aria-hidden className="relative inline-block size-3.5 shrink-0">
			<span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-current" />
			<span
				className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded bg-current transition-transform duration-200 ${open ? "scale-y-0" : ""}`}
			/>
		</span>
	)
}

export default function TwinsV8({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = matchFacts(compare)
	return (
		<motion.div ref={topRef} layout={still ? false : "position"} className="relative flex flex-col">
			<section aria-label="Taste match" className="flex flex-col">
				<p className="flex items-center gap-2 pb-3 text-xs font-bold tracking-[0.18em] text-gray-500 uppercase">
					<span className="flex">
						<Face who="them" shell={shell} size={TINY} />
						<span className="-ml-2">
							<Face who="you" shell={shell} size={TINY} />
						</span>
					</span>
					You and @{shell.handle}
				</p>
				<div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2 border-t border-white/10 pt-4">
					<h2 className={`${DISPLAY} text-5xl leading-[0.95] sm:text-7xl`} style={{ color: f.color }}>
						{f.tier}
					</h2>
					<p className="flex items-baseline gap-2 pb-1">
						<span className={`${DISPLAY} text-5xl leading-none text-white tabular-nums sm:text-7xl`}>
							<CountUp to={f.p} still={still} />
							<span className="text-2xl text-gray-400 sm:text-3xl">%</span>
						</span>
						<span className="text-xs font-bold tracking-wider text-gray-500 uppercase">match</span>
					</p>
				</div>
				{/* A hairline scale under the words: how far along 0 to 100 the match is. */}
				<div aria-hidden className="relative mt-4 h-px bg-white/10">
					<motion.span
						className="absolute inset-y-0 left-0 w-full origin-left"
						style={{ background: f.color }}
						initial={still ? false : { scaleX: 0 }}
						animate={{ scaleX: f.p / 100 }}
						transition={{ duration: 1.1, ease: EASE }}
					/>
				</div>
				<div className="flex flex-col gap-x-10 gap-y-3 pt-4 md:flex-row md:items-baseline md:justify-between">
					<PullsSentence c={compare} className="max-w-2xl text-base text-gray-300 sm:text-lg" />
					<p className="shrink-0 text-sm text-gray-400 tabular-nums">
						<b className="text-white">{f.both}</b> both love
						<span className="mx-2 text-gray-700">/</span>
						<b className="text-white">{f.rated}</b> rated by both
						<span className="mx-2 text-gray-700">/</span>
						<b className="text-white">{f.splits}</b> big splits
					</p>
				</div>
				<div className="mt-4 border-t border-white/10 pt-4">
					<button
						type="button"
						aria-expanded={open}
						aria-controls={sectionId}
						onClick={toggle}
						className="group inline-flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-bold text-amber-400 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-base"
						data-compare-row
					>
						<PlusMinus open={open} />
						<span className="underline decoration-amber-400/40 decoration-2 underline-offset-[6px] group-hover:decoration-amber-300">
							{label}
						</span>
					</button>
				</div>
			</section>
			<AnimatePresence initial={false} mode="popLayout">
				{open && (
					<motion.section
						key="meet"
						id={sectionId}
						aria-label={label}
						className="flex flex-col gap-6 pt-6"
						initial={{ opacity: 0, y: still ? 0 : -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: still ? 0 : -8 }}
						transition={{ duration: still ? 0 : 0.22, ease: EASE }}
					>
						<Panels
							handle={shell.handle}
							c={compare}
							frame={(k, node) => (
								<div key={k} className={UNBOXED}>
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
