// Variant 9, accordion stack: the match card and three rows under it in one connected stack (Overlap, Where you
// split, Picks for each other), each with a one-line teaser such as "150 you both love".
// Collapsed: the card and the three teasers; any row opens on its own, "Open all" opens the three.
// Expanded: each open row shows its panel inside the stack; the header chip opens all three.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useState } from "react"
import { DISPLAY } from "~/ui/my-pages/bits"
import { Overlap, Picks, Splits } from "./parts"
import { EASE, Face, PullsSentence, Ring, matchFacts } from "./V6-kit"
import type { TwinsProps } from "./types"

type Key = "overlap" | "splits" | "picks"
const SMALL = "[&>*]:size-9! [&>*]:text-base! [&>*]:ring-2!"
/** Inside a row the panel loses its own box; the row is the box. */
const IN_ROW = "[&>div]:rounded-none! [&>div]:bg-transparent! [&>div]:ring-0! [&>div]:pt-0!"

export default function TwinsV9({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = matchFacts(compare)
	const hasPicks = f.forYou > 0 || f.forThem > 0
	const keys: Key[] = ["overlap", ...(f.rated ? (["splits"] as const) : []), ...(hasPicks ? (["picks"] as const) : [])]
	const [rows, setRows] = useState<Set<Key>>(new Set())
	// The chip (or the "Open all" control) opens every row; closing from outside closes them.
	// biome-ignore lint/correctness/useExhaustiveDependencies: follows `open` only; `keys` is derived from the props
	useEffect(() => {
		setRows((now) => (open ? (now.size ? now : new Set(keys)) : new Set()))
	}, [open])
	const flip = (k: Key) => {
		const next = new Set(rows)
		next.has(k) ? next.delete(k) : next.add(k)
		setRows(next)
		if (!!next.size !== open) toggle()
	}
	const all = rows.size === keys.length
	const toggleAll = () => {
		if (all) {
			setRows(new Set())
			if (open) toggle()
		} else {
			setRows(new Set(keys))
			if (!open) toggle()
		}
	}
	const rowDefs: Record<Key, { eyebrow: string; teaser: ReactNode; panel: ReactNode }> = {
		overlap: {
			eyebrow: "Overlap",
			teaser: (
				<>
					<b className="text-white tabular-nums">{f.both}</b> you both love
				</>
			),
			panel: <Overlap handle={shell.handle} c={compare} />,
		},
		splits: {
			eyebrow: "Where you split",
			teaser: (
				<>
					<b className="text-white tabular-nums">{f.splits}</b> big splits in {f.rated} you both rated
				</>
			),
			panel: <Splits handle={shell.handle} c={compare} />,
		},
		picks: {
			eyebrow: "Picks for each other",
			teaser: (
				<>
					<b className="text-white tabular-nums">{f.forYou}</b> for you
					{f.forThem > 0 && (
						<>
							, <b className="text-white tabular-nums">{f.forThem}</b> for @{shell.handle}
						</>
					)}
				</>
			),
			panel: <Picks handle={shell.handle} c={compare} />,
		},
	}
	return (
		<motion.div
			ref={topRef}
			layout={still ? false : "position"}
			className="relative overflow-hidden rounded-3xl bg-gray-950 ring-1 ring-white/10"
		>
			<section
				aria-label="Taste match"
				className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-6 sm:p-6"
				style={{
					backgroundImage: `linear-gradient(100deg, color-mix(in srgb, ${f.color} ${8 + f.strength * 10}%, transparent), transparent 55%)`,
				}}
			>
				<span className="sm:row-span-2">
					<span className="sm:hidden">
						<Ring p={f.p} color={f.color} still={still} px={84} stroke={9} label={false} />
					</span>
					<span className="max-sm:hidden">
						<Ring p={f.p} color={f.color} still={still} px={112} stroke={8} />
					</span>
				</span>
				<div className="flex min-w-0 flex-col gap-1.5 sm:self-end">
					<p className="truncate text-xs font-bold tracking-[0.16em] text-gray-500 uppercase">You and @{shell.handle}</p>
					<h2 className={`${DISPLAY} text-3xl leading-none sm:text-5xl`} style={{ color: f.color }}>
						{f.tier}
					</h2>
				</div>
				<span className="flex shrink-0 self-start max-sm:hidden sm:row-span-2">
					<Face who="them" shell={shell} size={SMALL} />
					<span className="-ml-2.5">
						<Face who="you" shell={shell} size={SMALL} />
					</span>
				</span>
				<PullsSentence
					c={compare}
					className="col-span-2 text-sm text-gray-300 sm:col-span-1 sm:col-start-2 sm:self-start"
				/>
			</section>
			<div id={sectionId} className="relative border-t border-white/10">
				<div className="flex min-h-11 items-center justify-between gap-3 bg-white/[0.02] px-4 sm:px-6">
					<p className="text-sm font-bold text-gray-200">{label}</p>
					<button
						type="button"
						aria-expanded={open}
						aria-controls={sectionId}
						onClick={toggleAll}
						className="min-h-10 shrink-0 cursor-pointer text-sm font-bold text-amber-400 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-white"
						data-compare-row
					>
						{all ? "Close all" : "Open all"}
					</button>
				</div>
				<ul className="divide-y divide-white/10 border-t border-white/10">
					{keys.map((k) => {
						const d = rowDefs[k]
						const on = rows.has(k)
						const id = `${sectionId}-${k}`
						return (
							<motion.li key={k} layout={still ? false : "position"} transition={{ duration: 0.22, ease: EASE }}>
								<button
									type="button"
									aria-expanded={on}
									aria-controls={id}
									onClick={() => flip(k)}
									className={`group flex min-h-16 w-full cursor-pointer items-center gap-4 px-4 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white sm:px-6 ${on ? "bg-white/[0.03]" : ""}`}
								>
									<span className="min-w-0 flex-1">
										<span className="block text-[11px] font-bold tracking-wider text-gray-500 uppercase">{d.eyebrow}</span>
										<span className="block truncate text-base text-gray-300 sm:text-lg">{d.teaser}</span>
									</span>
									<span
										className={`flex size-8 shrink-0 items-center justify-center rounded-full ring-1 transition-colors ${on ? "bg-white/10 ring-white/20" : "ring-white/15 group-hover:bg-white/[0.06]"}`}
									>
										<ChevronDownIcon
											className={`size-5 text-gray-300 transition-transform duration-200 ${on ? "rotate-180" : ""}`}
											aria-hidden
										/>
									</span>
								</button>
								<AnimatePresence initial={false} mode="popLayout">
									{on && (
										<motion.div
											key="panel"
											id={id}
											className={`bg-white/[0.03] px-1 pb-2 sm:px-2 ${IN_ROW}`}
											initial={{ opacity: 0, y: still ? 0 : -8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0 }}
											transition={{ duration: still ? 0 : 0.2, ease: EASE }}
										>
											{d.panel}
										</motion.div>
									)}
								</AnimatePresence>
							</motion.li>
						)
					})}
				</ul>
			</div>
		</motion.div>
	)
}
