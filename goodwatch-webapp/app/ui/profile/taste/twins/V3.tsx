// Variant 3, tabs inside: the card carries its own segmented row (Overlap, Splits, Picks) as the way in.
// Collapsed: only the card; the row's caption says what it does and no segment is picked.
// Expanded: picking a segment opens that panel inside the card under the row; another segment swaps it, the picked one
// or the close button folds it away.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { DISPLAY } from "~/ui/my-pages/bits"
import { EASE, FRAMELESS, Pair, Ring, matchFacts, panelsFor, pullLines } from "./V1-kit"
import { Overlap, Picks, Splits } from "./parts"
import type { TwinsProps } from "./types"

type Tab = "overlap" | "splits" | "picks"
const TABS: { id: Tab; name: string; hint: string }[] = [
	{ id: "overlap", name: "Overlap", hint: "What you both love" },
	{ id: "splits", name: "Splits", hint: "Where you disagree" },
	{ id: "picks", name: "Picks", hint: "For each other" },
]

export default function TwinsV3({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = matchFacts(compare)
	const lines = pullLines(compare)
	const has = panelsFor(compare)
	const tabs = TABS.filter((t) => has[t.id])
	const [tab, setTab] = useState<Tab>("overlap")
	const shown = has[tab] ? tab : "overlap"
	const pick = (id: Tab) => {
		if (!open) {
			setTab(id)
			toggle()
		} else if (id === shown) toggle()
		else setTab(id)
	}
	return (
		<section
			ref={topRef as React.RefObject<HTMLElement>}
			aria-label="Taste match"
			className="relative overflow-hidden rounded-3xl bg-gray-950 ring-1 ring-white/10"
		>
			{/* A soft band of the match colour across the top edge. */}
			<span
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 h-40"
				style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${f.color} ${7 + f.strength * 7}%, transparent), transparent)` }}
			/>
			<span aria-hidden className="absolute inset-x-8 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${f.color}, transparent)` }} />
			<div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
				<div className="flex items-center gap-4">
					<Ring p={f.p} color={f.color} size={88} stroke={6} still={still}>
						<span className="text-2xl leading-none font-black tabular-nums" style={{ color: f.color }}>
							{f.p}
							<span className="text-sm">%</span>
						</span>
					</Ring>
					<div className="flex min-w-0 flex-col gap-1 sm:hidden">
						<h2 className={`${DISPLAY} text-3xl leading-none`} style={{ color: f.color }}>{f.tier}</h2>
						<p className="text-sm text-gray-400">with <span className="text-gray-100">@{shell.handle}</span></p>
					</div>
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="hidden items-baseline gap-3 sm:flex">
						<h2 className={`${DISPLAY} text-4xl leading-none`} style={{ color: f.color }}>{f.tier}</h2>
						<p className="text-sm text-gray-400">with <span className="text-gray-100">@{shell.handle}</span></p>
					</div>
					{(lines.both || lines.apart) && <p className="text-[15px] leading-relaxed text-gray-300">{lines.both} {lines.apart}</p>}
					<p className="text-xs text-gray-500 tabular-nums">
						<b className="text-gray-200">{f.both}</b> both love · <b className="text-gray-200">{f.rated}</b> rated by both ·{" "}
						<b className="text-gray-200">{f.splits}</b> big splits
					</p>
				</div>
				<span className="hidden sm:block">
					<Pair shell={shell} px={48} />
				</span>
			</div>

			<div className="relative flex flex-col gap-2 border-t border-white/10 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-7">
				<p className="px-2 text-xs font-semibold text-gray-400 sm:px-0">{label}</p>
				<div className="flex flex-1 items-center gap-2 sm:justify-end">
					<div role="group" aria-label={label} className="flex flex-1 gap-1 rounded-full bg-white/[0.05] p-1 ring-1 ring-white/10 sm:flex-none">
						{tabs.map((t) => {
							const on = open && shown === t.id
							return (
								<button
									key={t.id}
									type="button"
									aria-expanded={on}
									aria-controls={sectionId}
									aria-pressed={on}
									onClick={() => pick(t.id)}
									className={`relative min-h-10 flex-1 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white sm:flex-none sm:px-5 ${on ? "text-gray-950" : "text-gray-200 hover:bg-white/10 hover:text-white"}`}
									title={t.hint}
								>
									{on && (
										<motion.span
											layoutId={still ? undefined : "twins-v3-seg"}
											className="absolute inset-0 rounded-full bg-linear-to-b from-amber-300 to-amber-500"
											transition={{ duration: 0.25, ease: EASE }}
										/>
									)}
									<span className="relative">{t.name}</span>
								</button>
							)
						})}
					</div>
					<AnimatePresence initial={false}>
						{open && (
							<motion.button
								key="close"
								type="button"
								onClick={toggle}
								aria-label="Close the comparison"
								className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
								initial={{ opacity: 0, scale: still ? 1 : 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: still ? 1 : 0.8 }}
								transition={{ duration: still ? 0 : 0.18 }}
							>
								<XMarkIcon className="size-5" aria-hidden />
							</motion.button>
						)}
					</AnimatePresence>
				</div>
			</div>

			<AnimatePresence initial={false} mode="wait">
				{open && (
					<motion.div
						key={shown}
						id={sectionId}
						className={`relative border-t border-white/10 bg-white/[0.02] ${FRAMELESS}`}
						initial={{ opacity: 0, y: still ? 0 : -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, transition: { duration: still ? 0 : 0.1 } }}
						transition={{ duration: still ? 0 : 0.24, ease: EASE }}
					>
						{shown === "overlap" && <Overlap handle={shell.handle} c={compare} />}
						{shown === "splits" && <Splits handle={shell.handle} c={compare} />}
						{shown === "picks" && <Picks handle={shell.handle} c={compare} />}
					</motion.div>
				)}
			</AnimatePresence>
		</section>
	)
}
