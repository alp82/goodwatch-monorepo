// Variant 2, hero split: a big percentage in a ring on the left with both avatars sitting on its lower edge; the tier,
// who and why on the right. Collapsed: the card alone, with an amber pill button under the sentence.
// Expanded: a sheet slides out below the card, joined to it by a small notch that points up at the pill.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { DISPLAY } from "~/ui/my-pages/bits"
import { EASE, Pair, Ring, matchFacts, pullLines } from "./V1-kit"
import { Meet } from "./parts"
import type { TwinsProps } from "./types"

export default function TwinsV2({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = matchFacts(compare)
	const lines = pullLines(compare)
	return (
		<div ref={topRef} className="flex flex-col">
			<section
				aria-label="Taste match"
				className="relative overflow-hidden rounded-3xl bg-gray-900/70 ring-1 ring-white/10"
				style={{
					backgroundImage: `linear-gradient(100deg, color-mix(in srgb, ${f.color} ${8 + f.strength * 8}%, transparent) 0%, transparent 45%)`,
				}}
			>
				<div className="grid items-center gap-6 p-5 sm:p-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
					<div className="relative mx-auto pb-5 md:mx-0">
						<Ring p={f.p} color={f.color} size={176} stroke={4} still={still}>
							<span className={`${DISPLAY} text-[4.25rem] leading-none tabular-nums`} style={{ color: f.color }}>
								{f.p}
								<span className="ml-0.5 align-top text-2xl">%</span>
							</span>
							<span className="mt-1 text-[11px] font-bold tracking-[0.18em] text-gray-400 uppercase">match</span>
						</Ring>
						<span className="absolute bottom-0 left-1/2 -translate-x-1/2">
							<Pair shell={shell} px={44} />
						</span>
					</div>
					<div className="flex min-w-0 flex-col items-center gap-4 text-center md:items-start md:text-left">
						<div className="flex flex-col gap-2">
							<h2 className={`${DISPLAY} text-4xl leading-none sm:text-5xl`} style={{ color: f.color }}>
								{f.tier}
							</h2>
							<p className="text-sm font-semibold text-gray-400">
								You and <span className="text-white">@{shell.handle}</span>
							</p>
						</div>
						{(lines.both || lines.apart) && (
							<p className="max-w-[40rem] text-base leading-relaxed text-gray-200">
								{lines.both} {lines.apart && <span className="text-gray-400">{lines.apart}</span>}
							</p>
						)}
						<p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-gray-400 tabular-nums md:justify-start">
							<span><b className="text-white">{f.both}</b> both love</span>
							<span><b className="text-white">{f.rated}</b> rated by both</span>
							<span><b className="text-white">{f.splits}</b> big splits</span>
						</p>
						<button
							type="button"
							aria-expanded={open}
							aria-controls={sectionId}
							onClick={toggle}
							className={`mt-1 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-black transition-[filter,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${open ? "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15" : "bg-linear-to-b from-amber-400 to-amber-600 text-gray-950 shadow-lg shadow-amber-900/30 hover:brightness-110"}`}
						>
							{open ? (
								"Hide the comparison"
							) : (
								<>
									<span className="sm:hidden">Compare side by side</span>
									<span className="max-sm:hidden">{label}</span>
								</>
							)}
							<ChevronDownIcon className={`size-5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
						</button>
					</div>
				</div>
			</section>
			<AnimatePresence initial={false}>
				{open && (
					<motion.section
						key="sheet"
						id={sectionId}
						aria-label={label}
						className="relative mt-4 rounded-3xl bg-gray-900 ring-1 ring-white/10"
						initial={{ opacity: 0, y: still ? 0 : -16 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: still ? 0 : -8, transition: { duration: still ? 0 : 0.14 } }}
						transition={{ duration: still ? 0 : 0.32, ease: EASE }}
					>
						{/* The notch: a turned square half under the sheet's top edge, under the pill on wide screens. */}
						<span
							aria-hidden
							className="absolute -top-[7px] left-1/2 size-3.5 -translate-x-1/2 rotate-45 rounded-[3px] border-t border-l border-white/10 bg-gray-900 md:left-[calc(176px+2.5rem+2rem+3.5rem)]"
						/>
						<div className="flex flex-col gap-4 p-3 sm:p-5">
							<Meet handle={shell.handle} c={compare} />
						</div>
					</motion.section>
				)}
			</AnimatePresence>
		</div>
	)
}
