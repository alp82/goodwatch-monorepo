// Variant 1, refined card: round 13's layout cleaned up; a calm corner glow, a thin ring, one type scale.
// Collapsed: the card ends in a footer bar, the label on the left and a round chevron button on the right.
// Expanded: the panels open inside the same frame under the bar, so card and comparison read as one surface.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { DISPLAY } from "~/ui/my-pages/bits"
import { EASE, Pair, Ring, matchFacts, pullLines } from "./V1-kit"
import { Meet } from "./parts"
import type { TwinsProps } from "./types"

export default function TwinsV1({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = matchFacts(compare)
	const lines = pullLines(compare)
	return (
		<div
			ref={topRef}
			className="relative overflow-hidden rounded-3xl bg-gray-950"
			style={{
				backgroundImage: `radial-gradient(60rem 22rem at -10% -30%, color-mix(in srgb, ${f.color} ${6 + f.strength * 8}%, transparent), transparent 70%)`,
			}}
		>
			<section aria-label="Taste match" className="grid items-center gap-x-8 gap-y-5 p-5 sm:p-7 md:grid-cols-[auto_minmax(0,1fr)_auto]">
				<div className="flex items-center gap-4">
					<Ring p={f.p} color={f.color} size={104} stroke={5} still={still}>
						<span className="text-[2rem] leading-none font-black tabular-nums" style={{ color: f.color }}>
							{f.p}
							<span className="text-base font-bold">%</span>
						</span>
						<span className="mt-1 text-[10px] font-bold tracking-[0.16em] text-gray-500 uppercase">match</span>
					</Ring>
					<span className="md:hidden">
						<Pair shell={shell} px={44} />
					</span>
				</div>
				<div className="flex min-w-0 flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<p className="text-xs font-semibold tracking-[0.14em] text-gray-400 uppercase">
							You and <span className="text-gray-200">@{shell.handle}</span>
						</p>
						<h2 className={`${DISPLAY} text-[2rem] leading-[1.05] sm:text-[2.5rem]`} style={{ color: f.color }}>
							{f.tier}
						</h2>
						{(lines.both || lines.apart) && (
							<p className="max-w-[44rem] text-[15px] leading-relaxed text-gray-300">
								{lines.both} {lines.apart}
							</p>
						)}
					</div>
					<dl className="flex divide-x divide-white/10">
						{[
							["Both love", f.both],
							["Rated by both", f.rated],
							["Big splits", f.splits],
						].map(([t, n], i) => (
							<div key={t} className={`flex flex-col-reverse ${i ? "pl-5" : ""} pr-5`}>
								<dt className="text-xs text-gray-500">{t}</dt>
								<dd className="text-xl font-black text-white tabular-nums">{n}</dd>
							</div>
						))}
					</dl>
				</div>
				<div className="hidden md:block">
					<Pair shell={shell} px={56} />
				</div>
			</section>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={sectionId}
				onClick={toggle}
				className="group flex min-h-16 w-full cursor-pointer items-center gap-4 border-t border-white/10 bg-white/[0.025] px-5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white sm:px-7"
			>
				<span className="min-w-0 flex-1">
					<span className="block text-[15px] font-bold text-white">{label}</span>
					<span className="block text-xs text-gray-400">Overlap, splits, and picks for each other</span>
				</span>
				<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07] ring-1 ring-white/15 transition-colors group-hover:bg-white/15">
					<ChevronDownIcon
						className={`size-5 text-gray-200 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
						aria-hidden
					/>
				</span>
			</button>
			<AnimatePresence initial={false}>
				{open && (
					<motion.section
						key="meet"
						id={sectionId}
						aria-label={label}
						className="flex flex-col gap-4 border-t border-white/10 bg-black/25 p-3 sm:p-5"
						initial={{ opacity: 0, y: still ? 0 : -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, transition: { duration: still ? 0 : 0.12 } }}
						transition={{ duration: still ? 0 : 0.28, ease: EASE }}
					>
						<Meet handle={shell.handle} c={compare} />
					</motion.section>
				)}
			</AnimatePresence>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 rounded-3xl"
				style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${f.color} 30%, rgba(255,255,255,.08))` }}
			/>
		</div>
	)
}
