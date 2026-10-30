// Variant 4, compact strip: the whole match fits one slim row (ring, tier, counts, avatars), and the row is the button.
// Collapsed: just the strip, about 72 px tall, ending in "Compare side by side" and a chevron.
// Expanded: the strip becomes the head of a full-width dashboard: the card's details as stat tiles, then the overlap
// across, then the splits and the picks side by side.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { DISPLAY } from "~/ui/my-pages/bits"
import { EASE, Pair, Ring, matchFacts, pullLines } from "./V1-kit"
import { Overlap, Picks, Splits } from "./parts"
import type { TwinsProps } from "./types"

export default function TwinsV4({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = matchFacts(compare)
	const lines = pullLines(compare)
	const tiles: [string, number, string][] = [
		["Both love", f.both, "Both scored 8 or more"],
		["Rated by both", f.rated, "Titles you can compare"],
		["Big splits", f.splits, "3 points apart or more"],
	]
	return (
		<div
			ref={topRef}
			className={`relative rounded-2xl ring-1 transition-colors duration-300 ${open ? "bg-gray-900/60 ring-white/15" : "bg-gray-950 ring-white/10"}`}
		>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={sectionId}
				onClick={toggle}
				aria-label={`${f.p}% match with @${shell.handle}, ${f.tier}. ${label}`}
				className="group relative flex min-h-[4.5rem] w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white sm:gap-4 sm:px-4"
			>
				{/* The match colour fills the strip from the left as far as the percent reaches. */}
				<span
					aria-hidden
					className="pointer-events-none absolute inset-y-0 left-0"
					style={{
						width: `${f.p}%`,
						background: `linear-gradient(90deg, color-mix(in srgb, ${f.color} ${6 + f.strength * 6}%, transparent), transparent)`,
					}}
				/>
				<Ring p={f.p} color={f.color} size={48} stroke={9} still={still}>
					<span className="text-sm font-black tabular-nums" style={{ color: f.color }}>{f.p}</span>
				</Ring>
				<span className="relative flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
					<span className={`${DISPLAY} truncate text-xl leading-tight sm:text-2xl`} style={{ color: f.color }}>
						{f.tier}
					</span>
					<span className="truncate text-xs text-gray-400 sm:text-sm">
						with <span className="text-gray-200">@{shell.handle}</span>
					</span>
				</span>
				<span className={`relative hidden items-center gap-5 pr-2 text-xs text-gray-500 tabular-nums transition-opacity duration-200 lg:flex ${open ? "opacity-0" : ""}`}>
					<span><b className="text-sm text-white">{f.both}</b> both love</span>
					<span><b className="text-sm text-white">{f.rated}</b> rated by both</span>
					<span><b className="text-sm text-white">{f.splits}</b> big splits</span>
				</span>
				<span className={`relative hidden transition-opacity duration-200 sm:block ${open ? "opacity-0" : ""}`}>
					<Pair shell={shell} px={34} />
				</span>
				<span className="relative flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] py-2 pr-2.5 pl-3 text-sm font-bold text-amber-300 ring-1 ring-white/10 transition-colors group-hover:bg-amber-400 group-hover:text-gray-950 group-hover:ring-amber-400">
					<span className="max-sm:sr-only">{open ? "Hide" : "Compare side by side"}</span>
					<ChevronDownIcon className={`size-5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
				</span>
			</button>
			<AnimatePresence initial={false}>
				{open && (
					<motion.section
						key="dash"
						id={sectionId}
						aria-label={label}
						className="grid gap-3 border-t border-white/10 p-3 sm:gap-4 sm:p-4"
						initial="hidden"
						animate="shown"
						exit={{ opacity: 0, transition: { duration: still ? 0 : 0.12 } }}
						variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: still ? 0 : 0.2, staggerChildren: still ? 0 : 0.05 } } }}
					>
						<Cell still={still}>
							<div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] lg:items-stretch">
								<div className="flex flex-col justify-center gap-3 rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/10 sm:p-5">
									<div className="flex items-center gap-3">
										<Pair shell={shell} px={40} />
										<p className="text-sm text-gray-400">
											You and <b className="text-white">@{shell.handle}</b>
										</p>
									</div>
									{(lines.both || lines.apart) && (
										<p className="text-[15px] leading-relaxed text-gray-200">{lines.both} {lines.apart}</p>
									)}
								</div>
								<dl className="grid grid-cols-3 gap-2 sm:gap-3">
									{tiles.map(([t, n, note]) => (
										<div key={t} className="flex flex-col justify-between gap-2 rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/10">
											<dt className="text-xs font-semibold text-gray-400">{t}</dt>
											<dd className="flex flex-col">
												<span className={`${DISPLAY} text-3xl leading-none tabular-nums`}>{n}</span>
												<span className="mt-1 text-[11px] text-gray-500 max-sm:hidden">{note}</span>
											</dd>
										</div>
									))}
								</dl>
							</div>
						</Cell>
						<Cell still={still}>
							<Overlap handle={shell.handle} c={compare} />
						</Cell>
						<Cell still={still}>
							<div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
								{compare.shared.length > 0 && <Splits handle={shell.handle} c={compare} />}
								<Picks handle={shell.handle} c={compare} />
							</div>
						</Cell>
					</motion.section>
				)}
			</AnimatePresence>
		</div>
	)
}

function Cell({ still, children }: { still: boolean; children: React.ReactNode }) {
	return (
		<motion.div
			variants={{
				hidden: { opacity: 0, y: still ? 0 : 10 },
				shown: { opacity: 1, y: 0, transition: { duration: still ? 0 : 0.28, ease: EASE } },
			}}
		>
			{children}
		</motion.div>
	)
}
