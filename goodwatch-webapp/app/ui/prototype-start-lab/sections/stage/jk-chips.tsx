// PROTOTYPE (start page lab, round 5): stage j and k's choices in Discover's own chip look: the filter sheet's option
// chip (round, white with a check when on, a mood's color dot), the phone quick row's "set" state for More moods,
// and the More moods popover (h's, with the chips inside).
import { AdjustmentsHorizontalIcon, CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { TAP } from "~/ui/filter-bar/motion"
import { presetPrompts } from "../../lab/fixture-search"
import { inertProps, moodHue, type StageFlow } from "./ab-shared"
import { FilterBox, SearchInstead, useDismiss, useFocusOnOpen } from "./hi-picker"
import { isChosen, pickVocab } from "./hi-shared"
import { GROUP_NAMES, groupsOf, ROW_MOODS, VOCAB, type VocabItem, vocabOf } from "./hi-vocab"

/**
 * Discover's option chip (FilterGroups OptionChip): 36 px, round, white and bold with a check when on, the count
 * quiet. A dark backing under it keeps it reading as it does on Discover's gray-950 when it sits over the room.
 */
export function DChip({
	on,
	label,
	swatch,
	count,
	onClick,
	big = false,
	className = "",
	ariaLabel,
}: {
	on: boolean
	label: ReactNode
	swatch?: ReactNode
	count?: number | null
	onClick: () => void
	/** 40 px on desktop, for the stage's first row. */
	big?: boolean
	className?: string
	ariaLabel?: string
}) {
	return (
		<span className={`inline-flex shrink-0 rounded-full bg-gray-950/85 shadow-[0_8px_24px_rgb(0_0_0/.45)] ${className}`}>
			<motion.button
				type="button"
				aria-pressed={on}
				aria-label={ariaLabel}
				whileTap={TAP}
				onClick={onClick}
				className={`flex h-9 items-center gap-2 rounded-full pl-3 pr-2.5 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ${big ? "lg:h-10 lg:pl-3.5 lg:pr-3 lg:text-[15px]" : ""} ${
					on
						? "bg-white font-bold text-gray-950 shadow-[0_6px_20px_-6px_rgba(255,255,255,.35)]"
						: "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/10"
				}`}
			>
				{swatch}
				{label}
				<span aria-hidden className="text-xs tabular-nums text-gray-500">
					{on ? <CheckIcon className="h-3.5 w-3.5" /> : count != null ? count.toLocaleString("en") : ""}
				</span>
			</motion.button>
		</span>
	)
}

/** A mood's color dot, as Discover's mood chips draw it. */
export const Dot = ({ color }: { color: string }) => <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />

/** The example searches: "Try" and the prompts as chips with a magnifier. One line, scrolls on phones. */
export function JkPresets({ f, className = "" }: { f: StageFlow; className?: string }) {
	// PROTOTYPE · Round 15: the presets moods can't stand in for (PRESETS).
	const prompts = presetPrompts(f.data)
	const on = f.source.kind === "prompt" ? f.source.q : null
	return (
		<div className={`pointer-events-auto -mx-4 overflow-x-auto px-4 py-1 [scrollbar-width:none] ${className}`}>
			<div className="mx-auto flex w-max items-center gap-2">
				<span className="shrink-0 pr-0.5 text-sm text-gray-300 [text-shadow:0_1px_8px_rgb(0_0_0/.9)]">Try</span>
				{prompts.map((p) => {
					const active = on === p.q
					return (
						<DChip
							key={p.q}
							on={active}
							big
							onClick={() => (active ? f.clear() : f.prompt(p.q))}
							swatch={<MagnifyingGlassIcon className={`h-4 w-4 shrink-0 ${active ? "text-gray-950" : "text-amber-400"}`} aria-hidden />}
							label={p.q}
						/>
					)
				})}
			</div>
		</div>
	)
}

/**
 * The most common moods in one row of Discover chips, then More moods in the phone quick row's look: quiet with a
 * chevron, or white with the choice's name when the choice is one the row doesn't show. On phones it leads the row,
 * as Filters leads Discover's phone quick row; on desktop it ends it.
 */
export function JkMoodRow({ f, onMore, moreOpen }: { f: StageFlow; onMore: () => void; moreOpen: boolean }) {
	const moods = f.data.guest.moods
	const row = ROW_MOODS.flatMap((k) => moods.find((m) => m.key === k) ?? [])
	const moodOn = f.source.kind === "mood" ? f.source.key : null
	const chosen = vocabOf(f.source)
	const elsewhere = chosen && !(chosen.moodKey && ROW_MOODS.includes(chosen.moodKey)) ? chosen : null
	const rest = VOCAB.length - row.length
	return (
		<div className="pointer-events-auto -mx-4 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0">
			<ul className="flex w-max items-center gap-2 lg:mx-auto">
				{row.map((m) => {
					const on = moodOn === m.key
					return (
						<li key={m.key}>
							<DChip on={on} big onClick={() => (on ? f.clear() : f.mood(m.key))} swatch={<Dot color={moodHue(m.key)} />} label={m.label} />
						</li>
					)
				})}
				<li className="order-first flex lg:order-none lg:pl-1">
					<span className="inline-flex rounded-full bg-gray-950/85 shadow-[0_8px_24px_rgb(0_0_0/.45)]">
						<motion.button
							type="button"
							whileTap={TAP}
							onClick={onMore}
							data-hi-more=""
							aria-expanded={moreOpen}
							aria-haspopup="dialog"
							aria-label={elsewhere ? `More moods: ${elsewhere.label}` : `More moods, ${rest} more`}
							className={`flex h-9 max-w-[14rem] shrink-0 items-center gap-1.5 rounded-full pr-2 pl-3 text-sm cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 lg:h-10 lg:pl-3.5 lg:text-[15px] ${
								elsewhere
									? "bg-white font-semibold text-gray-950"
									: moreOpen
										? "bg-white/[0.14] font-bold text-white ring-1 ring-white/25"
										: "bg-white/[0.08] font-bold text-white ring-1 ring-white/15 hover:bg-white/[0.12]"
							}`}
						>
							{elsewhere ? <Dot color={elsewhere.color} /> : <AdjustmentsHorizontalIcon className="h-4 w-4 shrink-0" aria-hidden />}
							<span className="truncate">{elsewhere ? elsewhere.label : "More moods"}</span>
							{elsewhere ? null : (
								<span aria-hidden className="grid h-5 min-w-5 place-items-center rounded-full bg-white/10 px-1.5 text-xs tabular-nums text-gray-400">
									{rest}
								</span>
							)}
							<ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${moreOpen ? "rotate-180" : ""}`} aria-hidden />
						</motion.button>
					</span>
				</li>
			</ul>
		</div>
	)
}

function VocabDChip({ f, item, onPicked }: { f: StageFlow; item: VocabItem; onPicked: () => void }) {
	const on = isChosen(f, item)
	return (
		<DChip
			on={on}
			className="!bg-transparent !shadow-none"
			onClick={() => {
				if (on) f.clear()
				else pickVocab(f, item)
				onPicked()
			}}
			swatch={<Dot color={item.color} />}
			label={item.label}
		/>
	)
}

/** More moods: h's popover under the row (filter box, the groups), with Discover chips in wrapping rows. */
export function JkMorePopover({ f, open, onClose }: { f: StageFlow; open: boolean; onClose: () => void }) {
	const panel = useRef<HTMLDivElement>(null)
	const input = useRef<HTMLInputElement>(null)
	const [q, setQ] = useState("")
	useDismiss(open, onClose, panel)
	useFocusOnOpen(open, input)
	useEffect(() => {
		if (!open) return
		const t = setTimeout(() => {
			const r = panel.current?.getBoundingClientRect()
			const room = window.innerHeight - 76
			if (r && r.bottom > room) window.scrollBy({ top: Math.min(r.top - 72, r.bottom - room), behavior: "smooth" })
		}, 30)
		return () => clearTimeout(t)
	}, [open])
	const groups = groupsOf(q)
	return (
		<div
			ref={panel}
			role="dialog"
			aria-label="More moods"
			{...inertProps(!open)}
			className="absolute inset-x-0 top-full z-40 mx-auto mt-2 w-full max-w-[980px] origin-top rounded-2xl bg-gray-900 text-gray-200 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9),0_8px_24px_rgb(0_0_0/.5),inset_0_1px_0_rgba(255,255,255,.06)] ring-1 ring-white/10 transition-[opacity,transform] duration-200 ease-out"
			style={{ opacity: open ? 1 : 0, transform: open ? "none" : "translateY(-8px) scale(.985)", pointerEvents: open ? "auto" : "none" }}
		>
			<div className="flex items-center gap-3 border-b border-white/10 px-3 pt-3 pb-3 sm:px-5">
				<h2 className="shrink-0 text-base font-bold text-white">More moods</h2>
				<FilterBox value={q} onChange={setQ} inputRef={input} count={VOCAB.length} className="min-w-0 flex-1 sm:max-w-[360px]" />
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="ml-auto grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-gray-400 outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-5 w-5" aria-hidden />
				</button>
			</div>
			<div className="max-h-[min(52svh,420px)] overflow-y-auto overscroll-contain px-3 pt-3 pb-4 sm:max-h-[min(46vh,400px)] sm:px-5">
				{groups.length ? (
					groups.map((g) => (
						<section key={g.group} className="mb-4 last:mb-0">
							<h3 className="mb-2 text-[13px] font-semibold text-gray-400">
								{GROUP_NAMES[g.group]} <span className="text-gray-500">· {g.items.length}</span>
							</h3>
							<div className="flex flex-wrap gap-1.5">
								{g.items.map((item) => (
									<VocabDChip key={item.id} f={f} item={item} onPicked={onClose} />
								))}
							</div>
						</section>
					))
				) : (
					<SearchInstead f={f} q={q.trim()} onPicked={onClose} />
				)}
			</div>
		</div>
	)
}
