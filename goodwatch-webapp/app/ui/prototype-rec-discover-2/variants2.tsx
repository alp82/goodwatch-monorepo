// PROTOTYPE - throwaway. Round 2 of #179: the `badge` page (match coin on every card, today's order), with "For you"
// as a fixed on/off switch that leans whichever sort is chosen. The six variants differ only in how the sort control
// and the switch are combined, on the desktop studio row and in the mobile slab. Everything else is shared.
import { ArrowUpIcon, ArrowsUpDownIcon, ArrowDownIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useState } from "react"
import { CoinCard } from "~/ui/prototype-rec-discover/cards"
import { SPRING, TAP, buzz } from "~/ui/prototype-rec-filter-bar-2/kit2"
import { GRID } from "~/ui/prototype-rec-filter-bar/kit"
import { ForYouRow, Knob, Pop, Recover2, SEG, SHELL, Shell2, type SlabSlots, SlabMenu, SortRows } from "./bar2"
import { type D2, PLAIN, SORTS, TUNED, sortLabel, useDiscover2 } from "./rank2"
import type { Payload } from "~/ui/prototype-rec-discover/types"

const LIMIT = 36

// ---------------------------------------------------------------- the result grid

// The existing card grid. Cards glide to their new place when the sort or the switch changes. With `showMoves`,
// each card that moved on the last switch flip says how far, for a few seconds.
function Grid({ d, showMoves = false }: { d: D2; showMoves?: boolean }) {
	const [, tick] = useState(0)
	const live = showMoves && d.before.current && Date.now() - d.flipAt < 2600
	useEffect(() => {
		if (!showMoves || !d.flipAt) return
		const id = setTimeout(() => tick((n) => n + 1), 2650)
		return () => clearTimeout(id)
	}, [showMoves, d.flipAt])
	const items = d.ranked.slice(0, LIMIT)
	return (
		<div className={GRID}>
			<AnimatePresence initial={false} mode="popLayout">
				{items.map((r, i) => {
					const was = live ? d.before.current?.get(r.t.ref) : undefined
					const delta = was == null ? 0 : was - i
					return (
						<motion.div
							key={r.t.ref}
							layout
							initial={{ opacity: 0, y: -12 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9 }}
							transition={showMoves ? { type: "spring", stiffness: 140, damping: 22 } : { duration: 0.3, type: "tween" }}
						>
							<CoinCard t={r.t} mine={d.data.mine}>
								<AnimatePresence>
									{delta !== 0 && (
										<motion.span
											key={`${d.flipAt}`}
											initial={{ opacity: 0, scale: 0.6 }}
											animate={{ opacity: 1, scale: 1 }}
											exit={{ opacity: 0 }}
											transition={SPRING}
											className={`absolute top-3 left-3 flex h-7 items-center gap-0.5 rounded-full px-2 text-[13px] font-black tabular-nums ring-[3px] ring-gray-900 shadow-lg ${delta > 0 ? "bg-amber-400 text-gray-950" : "bg-gray-700 text-gray-200"}`}
										>
											{delta > 0 ? <ArrowUpIcon className="h-3.5 w-3.5" /> : <ArrowDownIcon className="h-3.5 w-3.5" />}
											{Math.abs(delta)}
										</motion.span>
									)}
								</AnimatePresence>
							</CoinCard>
						</motion.div>
					)
				})}
			</AnimatePresence>
			{d.bar.recoveries.length > 0 && <Recover2 d={d} className={d.bar.results.length ? "aspect-[2/3] scale-95" : "col-span-full py-12"} />}
		</div>
	)
}

// ---------------------------------------------------------------- shared pieces

function Chevron({ open }: { open: boolean }) {
	return <ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
}

// A plain sort dropdown, the size of round 1's (fixed width), for variants that put the switch elsewhere.
function PlainSort({ d }: { d: D2 }) {
	return (
		<Pop
			width={288}
			trigger={(open, toggle) => (
				<motion.button type="button" whileTap={TAP} aria-expanded={open} aria-haspopup="menu" onClick={toggle} className={`flex h-12 w-52 items-center gap-2 px-4 text-sm cursor-pointer ${SHELL} ${open ? "ring-white/25" : "hover:ring-white/20"}`}>
					<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
					<span className="text-gray-400">Sort</span>
					<span className="flex-1 truncate text-left font-bold text-white">{sortLabel(d)}</span>
					<Chevron open={open} />
				</motion.button>
			)}
		>
			{(close) => (
				<div className="p-1.5">
					<SortRows d={d} onPick={close} id="plain" />
				</div>
			)}
		</Pop>
	)
}

// The slab's sort segment and its menu above the thumb. `top` is what sits where round 1 had the icon.
function SlabSort({ d, top, bottom, menu, label = "Sort" }: { d: D2; top?: ReactNode; bottom?: ReactNode; menu: (close: () => void) => ReactNode; label?: string }) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<motion.button
				type="button"
				data-slab-trigger
				whileTap={TAP}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-label={`${label}: ${sortLabel(d)}`}
				onClick={() => (buzz(), setOpen((o) => !o))}
				className={`${SEG} ${open ? "bg-white/10 text-white" : "text-gray-200"}`}
			>
				{top ?? <ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />}
				{bottom ?? <span className="w-full truncate px-1 text-center">{sortLabel(d)}</span>}
			</motion.button>
			<SlabMenu open={open} onClose={() => setOpen(false)}>
				{menu(() => setOpen(false))}
			</SlabMenu>
		</>
	)
}

function SlabForYou({ d, sub }: { d: D2; sub?: ReactNode }) {
	const on = d.forYou
	return (
		<motion.button type="button" role="switch" aria-checked={on} whileTap={TAP} onClick={() => (buzz(), d.setForYou(!on))} className={`${SEG} !flex-[0.7] ${on ? "text-gray-950" : "text-gray-400"}`}>
			<AnimatePresence initial={false}>{on && <motion.span layoutId="d2-slab-fy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 rounded-[14px] bg-linear-to-b from-amber-400 to-amber-600 shadow-[inset_0_1px_0_rgba(255,255,255,.35)]" />}</AnimatePresence>
			<span className="relative flex h-4 items-center">{sub ?? <Knob on={on} size="sm" className={on ? "!bg-gray-950/25 !shadow-none" : ""} />}</span>
			<span className="relative">For you</span>
		</motion.button>
	)
}

// ---------------------------------------------------------------- 1. split: split button

function SplitDesk({ d }: { d: D2 }) {
	const on = d.forYou
	return (
		<div className={`flex h-12 w-[20.5rem] items-stretch p-1 ${SHELL}`}>
			<Pop
				width={288}
				className="h-full"
				trigger={(open, toggle) => (
					<motion.button type="button" whileTap={TAP} aria-expanded={open} aria-haspopup="menu" onClick={toggle} className={`flex h-full w-[11.25rem] items-center gap-2 rounded-xl px-3 text-sm cursor-pointer ${open ? "bg-white/[0.07]" : "hover:bg-white/5"}`}>
						<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
						<span className="text-gray-400">Sort</span>
						<span className="flex-1 truncate text-left font-bold text-white">{sortLabel(d)}</span>
						<Chevron open={open} />
					</motion.button>
				)}
			>
				{(close) => (
					<div className="p-1.5">
						<SortRows d={d} onPick={close} id="split" />
					</div>
				)}
			</Pop>
			<span className="mx-1 my-2 w-px bg-white/10" />
			<motion.button
				type="button"
				role="switch"
				aria-checked={on}
				whileTap={TAP}
				onClick={() => (buzz(), d.setForYou(!on))}
				className={`flex flex-1 items-center justify-between gap-2 rounded-xl px-3 text-sm font-bold cursor-pointer transition-colors ${on ? "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/40" : "text-gray-400 hover:text-gray-200"}`}
			>
				For you
				<Knob on={on} />
			</motion.button>
		</div>
	)
}

function splitSlab(d: D2): SlabSlots {
	return {
		sort: (
			<>
				<SlabForYou d={d} />
				<SlabSort d={d} menu={(close) => <div className="p-1.5"><SortRows d={d} onPick={close} dense id="split-m" /></div>} />
			</>
		),
	}
}

function Split({ data }: { data: Payload }) {
	const d = useDiscover2(data)
	return (
		<Shell2 d={d} desk={<SplitDesk d={d} />} slab={splitSlab(d)}>
			<Grid d={d} />
		</Shell2>
	)
}

// ---------------------------------------------------------------- 2. header: the switch heads the sort menu

function StateTag({ on, small = false }: { on: boolean; small?: boolean }) {
	return (
		<span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold transition-colors ${small ? "h-4 px-1.5 text-[9px]" : "h-6 w-[4.75rem] text-xs"} ${on ? "bg-amber-500 text-gray-950" : "text-gray-400 ring-1 ring-inset ring-white/20"}`}>
			{on ? "For you" : "Taste off"}
		</span>
	)
}

function HeaderMenu({ d, close, id }: { d: D2; close: () => void; id: string }) {
	return (
		<div className="p-1.5">
			<ForYouRow d={d} className="!py-3" />
			<div className="mx-3 my-1.5 h-px bg-white/5" />
			<SortRows d={d} onPick={close} dense={id.endsWith("m")} id={id} />
		</div>
	)
}

function HeaderDesk({ d }: { d: D2 }) {
	return (
		<Pop
			width={320}
			trigger={(open, toggle) => (
				<motion.button type="button" whileTap={TAP} aria-expanded={open} aria-haspopup="menu" onClick={toggle} className={`flex h-12 w-[18.5rem] items-center gap-2 pl-4 pr-3 text-sm cursor-pointer ${SHELL} ${open ? "ring-white/25" : "hover:ring-white/20"}`}>
					<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
					<span className="text-gray-400">Sort</span>
					<span className="flex-1 truncate text-left font-bold text-white">{sortLabel(d)}</span>
					<StateTag on={d.forYou} />
					<Chevron open={open} />
				</motion.button>
			)}
		>
			{(close) => <HeaderMenu d={d} close={close} id="header" />}
		</Pop>
	)
}

function Header({ data }: { data: Payload }) {
	const d = useDiscover2(data)
	return (
		<Shell2 d={d} desk={<HeaderDesk d={d} />} slab={{ sort: <SlabSort d={d} top={<StateTag on={d.forYou} small />} menu={(close) => <HeaderMenu d={d} close={close} id="header-m" />} /> }}>
			<Grid d={d} />
		</Shell2>
	)
}

// ---------------------------------------------------------------- 3. lastrow: the switch closes the sort menu, the trigger says it

function TwoLine({ d, small = false }: { d: D2; small?: boolean }) {
	return (
		<span className={`flex min-w-0 flex-col leading-tight ${small ? "w-full items-center px-1" : "flex-1 items-start text-left"}`}>
			<span className={`w-full truncate font-bold text-white ${small ? "text-center text-[11px]" : "text-sm"}`}>{sortLabel(d)}</span>
			<span className={`w-full truncate ${small ? "text-center text-[10px]" : "text-xs"} ${d.forYou ? "text-amber-300" : "text-gray-500"}`}>{d.forYou ? TUNED : PLAIN}</span>
		</span>
	)
}

function LastRowMenu({ d, close, id }: { d: D2; close: () => void; id: string }) {
	return (
		<div className="p-1.5">
			<SortRows d={d} onPick={close} dense={id.endsWith("m")} id={id} />
			<div className="mx-3 my-1.5 h-px bg-white/10" />
			<ForYouRow d={d} tone="plain" />
		</div>
	)
}

function LastRowDesk({ d }: { d: D2 }) {
	return (
		<Pop
			width={300}
			trigger={(open, toggle) => (
				<motion.button type="button" whileTap={TAP} aria-expanded={open} aria-haspopup="menu" onClick={toggle} className={`flex h-12 w-56 items-center gap-3 pl-4 pr-3 cursor-pointer ${SHELL} ${open ? "ring-white/25" : "hover:ring-white/20"}`}>
					<span className={`h-6 w-[3px] shrink-0 rounded-full transition-colors ${d.forYou ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,.7)]" : "bg-white/15"}`} />
					<TwoLine d={d} />
					<Chevron open={open} />
				</motion.button>
			)}
		>
			{(close) => <LastRowMenu d={d} close={close} id="last" />}
		</Pop>
	)
}

function LastRow({ data }: { data: Payload }) {
	const d = useDiscover2(data)
	return (
		<Shell2 d={d} desk={<LastRowDesk d={d} />} slab={{ sort: <SlabSort d={d} top={<span className={`h-[3px] w-6 rounded-full ${d.forYou ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,.8)]" : "bg-white/15"}`} />} bottom={<TwoLine d={d} small />} menu={(close) => <LastRowMenu d={d} close={close} id="last-m" />} /> }}>
			<Grid d={d} />
		</Shell2>
	)
}

// ---------------------------------------------------------------- 4. segmented: every sort visible, a For you pill at the end

function SegSorts({ d, id, small = false }: { d: D2; id: string; small?: boolean }) {
	return (
		<>
			{SORTS[d.surface].map((s) => {
				const on = s.key === d.sort
				return (
					<motion.button
						key={s.key}
						type="button"
						role="radio"
						aria-checked={on}
						whileTap={TAP}
						onClick={() => (buzz(), d.setSort(s.key))}
						className={`relative flex h-full items-center justify-center rounded-xl font-bold whitespace-nowrap cursor-pointer transition-colors ${small ? `min-w-0 flex-1 px-0.5 ${SORTS[d.surface].length > 3 ? "text-[11px]" : "text-[12px]"}` : "px-3.5 text-sm"} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
					>
						{on && <motion.span layoutId={`d2-seg-${id}`} transition={SPRING} className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/15" />}
						<span className="relative">{s.label}</span>
					</motion.button>
				)
			})}
		</>
	)
}

function SegPill({ d, small = false }: { d: D2; small?: boolean }) {
	const on = d.forYou
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={on}
			whileTap={TAP}
			onClick={() => (buzz(), d.setForYou(!on))}
			className={`flex h-full shrink-0 items-center gap-2 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${small ? "px-2 text-[12px]" : "px-3.5 text-sm"} ${on ? "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/45" : "text-gray-400 ring-1 ring-white/10 hover:text-gray-200"}`}
		>
			<Knob on={on} size="sm" />
			For you
		</motion.button>
	)
}

function Segmented({ data }: { data: Payload }) {
	const d = useDiscover2(data)
	return (
		<Shell2
			d={d}
			desk={
				<div role="radiogroup" aria-label="Sort" className={`flex h-12 items-stretch gap-0.5 p-1 ${SHELL}`}>
					<SegSorts d={d} id="desk" />
					<span className="mx-1.5 my-2 w-px bg-white/10" />
					<SegPill d={d} />
				</div>
			}
			slab={{
				above: (
					<div role="radiogroup" aria-label="Sort" className="flex h-11 items-stretch gap-0.5 rounded-[16px] bg-white/[0.04] p-1 ring-1 ring-white/10">
						<SegPill d={d} small />
						<span className="mx-1 my-2 w-px shrink-0 bg-white/10" />
						<SegSorts d={d} id="slab" small />
					</div>
				),
			}}
		>
			<Grid d={d} />
		</Shell2>
	)
}

// ---------------------------------------------------------------- 5. subtitle: the order as a line under the bar

function OrderLine({ d, small = false }: { d: D2; small?: boolean }) {
	const on = d.forYou
	return (
		<motion.button type="button" role="switch" aria-checked={on} aria-label="For you" whileTap={{ scale: 0.97 }} onClick={() => (buzz(), d.setForYou(!on))} className={`group flex min-w-0 items-center gap-2.5 text-left cursor-pointer ${small ? "text-[13px]" : "text-sm"}`}>
			<Knob on={on} size={small ? "sm" : "md"} />
			<span className="min-w-0 truncate">
				<span className="font-bold text-white">{sortLabel(d)}</span>
				<span className="text-gray-500">, </span>
				<AnimatePresence mode="wait" initial={false}>
					<motion.span key={String(on)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className={`inline-block ${on ? "font-bold text-amber-300" : "text-gray-400 group-hover:text-gray-200"}`}>
						{on ? TUNED : PLAIN}
					</motion.span>
				</AnimatePresence>
			</span>
		</motion.button>
	)
}

function Subtitle({ data }: { data: Payload }) {
	const d = useDiscover2(data)
	return (
		<Shell2
			d={d}
			desk={<PlainSort d={d} />}
			deskLead={
				<>
					<OrderLine d={d} />
					<span className="h-4 w-px bg-white/10" />
				</>
			}
			slab={{
				line: (
					<div className="flex items-center gap-3">
						<OrderLine d={d} small />
						<span className="ml-auto shrink-0 text-xs text-gray-500 tabular-nums">{d.bar.results.length} showing</span>
					</div>
				),
				sort: <SlabSort d={d} menu={(close) => <div className="p-1.5"><SortRows d={d} onPick={close} dense id="sub-m" /></div>} />,
			}}
		>
			<Grid d={d} />
		</Shell2>
	)
}

// ---------------------------------------------------------------- 6. motion: flipping the switch shows what moved

function MovesCount({ d, className = "" }: { d: D2; className?: string }) {
	return (
		<span className={`inline-flex items-center gap-0.5 tabular-nums ${d.forYou && d.moves ? "text-amber-300/90" : "text-transparent"} ${className}`}>
			<ArrowUpIcon className="h-3 w-3" />
			{d.moves}
		</span>
	)
}

function MotionDesk({ d }: { d: D2 }) {
	const on = d.forYou
	return (
		<>
			<PlainSort d={d} />
			<motion.button
				type="button"
				role="switch"
				aria-checked={on}
				whileTap={TAP}
				title={on ? `${d.moves} titles moved up for your taste` : "Lean the order toward your taste"}
				onClick={() => (buzz(), d.setForYou(!on))}
				className={`flex h-12 w-48 items-center gap-2.5 px-4 text-sm font-bold whitespace-nowrap cursor-pointer transition-colors ${SHELL} ${on ? "text-amber-100 !ring-amber-500/40" : "text-gray-400 hover:text-gray-200"}`}
			>
				<span className="flex-1 text-left">For you</span>
				<MovesCount d={d} className="w-9 justify-end text-xs" />
				<Knob on={on} />
			</motion.button>
		</>
	)
}

function Motion({ data }: { data: Payload }) {
	const d = useDiscover2(data)
	return (
		<Shell2
			d={d}
			desk={<MotionDesk d={d} />}
			slab={{
				sort: (
					<>
						<SlabForYou d={d} sub={d.forYou ? <MovesCount d={d} className="!text-gray-950 text-[11px]" /> : undefined} />
						<SlabSort d={d} menu={(close) => <div className="p-1.5"><SortRows d={d} onPick={close} dense id="motion-m" /></div>} />
					</>
				),
			}}
		>
			<Grid d={d} showMoves />
		</Shell2>
	)
}

// ---------------------------------------------------------------- registry

export type Variant = { name: string; pitch: string; View: (p: { data: Payload }) => JSX.Element }

export const VARIANTS: Record<string, Variant> = {
	split: {
		name: "Split button",
		pitch: "One control, two halves: the sort on the left, the For you switch on the right, lit amber when on. On phones For you is its own amber slab segment next to the sort.",
		View: Split,
	},
	header: {
		name: "Switch heads the sort menu",
		pitch: "The sort button carries a For you / Taste off tag. Open it and the switch is the menu's first row, above the sorts it applies to.",
		View: Header,
	},
	lastrow: {
		name: "Switch closes the sort menu",
		pitch: "The sort reads in two lines, “Popular / tuned to you”, with an amber rule when taste is on. The switch is the menu's last row.",
		View: LastRow,
	},
	segmented: {
		name: "Segmented sort plus a For you pill",
		pitch: "Every sort is visible as a segment and For you is a pill at the end. On phones the same strip sits in the slab, always in reach.",
		View: Segmented,
	},
	subtitle: {
		name: "The order as a subtitle",
		pitch: "The sort stays a plain dropdown. Under the bar the order reads as a sentence, “Popular, tuned to you”, and its switch flips it.",
		View: Subtitle,
	},
	motion: {
		name: "A switch that shows what it moved",
		pitch: "For you sits next to the sort like Not seen yet, with how many titles it lifted. Flipping it glides the cards and tags each with how far it moved.",
		View: Motion,
	},
}
