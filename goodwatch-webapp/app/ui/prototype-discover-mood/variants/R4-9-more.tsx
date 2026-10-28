// PROTOTYPE - throwaway. Variant 9's More panel, "More as a chip index": every niche filter is a chip under four
// small group labels, all on one screen. A chip opens that filter's control in the focused area on the right (below
// on phones) while the index stays and the chip stays lit; a set filter shows its value inside its chip. "Find a
// filter" narrows the chips as you type and lists the matching options of every filter beside them (on desktop chips that don't match dim, so nothing moves; on phones they hide).
import { ChevronRightIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { FilterGroups, FilterSearchField } from "~/ui/filter-bar"
import { type CardKey, cardOf } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { TAGS } from "../kit"
import { type MoreProps, SECTION_LABEL } from "./R4-9-base"
import { NICHE_KEYS, NicheControl, type Pieces, chipsOf, clearCard, nicheFor } from "./R4-9-parts"

type Item = ReturnType<typeof nicheFor>[number]["items"][number]

/** Words a chip answers to beyond its name: its kind, its hint, and for About and Style their tag names. */
const wordsOf = (kind: string, it: Item) =>
	[
		kind,
		it.title,
		it.hint,
		...(it.k === "themes" || it.k === "styles" ? TAGS.filter((t) => t.group === it.k).map((t) => t.name) : []),
	]
		.join(" ")
		.toLowerCase()

const valueOf = (pieces: Pieces, k: CardKey) =>
	chipsOf(pieces, k)
		.map((c) => c.label.replace(/^Produced in /, "").replace(/^Similar to /, ""))
		.join(", ")

function IndexChip({ it, pieces, on, hit, onClick }: { it: Item; pieces: Pieces; on: boolean; hit: boolean; onClick: () => void }) {
	const value = valueOf(pieces, it.k)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-pressed={on}
			className={`flex h-9 max-w-full min-w-0 items-center gap-2 rounded-full pr-3.5 pl-3 text-[14px] whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on
					? "bg-white text-gray-950"
					: value
						? "bg-amber-400/[0.1] text-white ring-1 ring-inset ring-amber-400/35 hover:bg-amber-400/[0.16]"
						: hit
							? "bg-white/[0.1] text-white ring-1 ring-inset ring-white/30 hover:bg-white/[0.14]"
							: "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white"
			}`}
		>
			<span className={`h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[it.k].dot}`} aria-hidden />
			<span className="shrink-0 font-semibold">{it.title}</span>
			{value && <span className={`min-w-0 truncate ${on ? "text-gray-600" : "text-amber-200/90"}`}>{value}</span>}
		</motion.button>
	)
}

function Focused({ d, pieces, it }: MoreProps & { it: Item }) {
	const set = chipsOf(pieces, it.k).length > 0
	return (
		<>
			<div className="mb-4 flex items-start gap-3">
				<div className="min-w-0">
					<h3 className="text-[19px] font-bold text-white">{it.title}</h3>
					<p className="text-[13px] text-gray-500">{it.hint}</p>
				</div>
				{set && (
					<button
						type="button"
						onClick={() => clearCard(d, pieces, it.k)}
						className="ml-auto rounded-md px-2 py-1 text-[13px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
			</div>
			<NicheControl d={d} pieces={pieces} k={it.k} />
		</>
	)
}

/** The niche filter More opens at on desktop: the first one set, else About. */
const firstNiche = (pieces: Pieces): CardKey =>
	pieces.chips.map((c) => cardOf(c.group)).find((k): k is CardKey => !!k && NICHE_KEYS.has(k)) ?? "themes"

export function MoreChipIndex({ d, pieces, phone }: MoreProps) {
	const groups = nicheFor(pieces)
	const [text, setText] = useState("")
	const [picked, setPicked] = useState<CardKey | null>(() => (phone ? null : firstNiche(pieces)))
	const input = useRef<HTMLInputElement>(null)
	const area = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!phone) input.current?.focus({ preventScroll: true })
	}, [phone])
	const q = text.trim().toLowerCase()
	const hits = (kind: string, it: Item) => !q || wordsOf(kind, it).includes(q)
	const item = groups.flatMap((g) => g.items).find((i) => i.k === picked)
	const pick = (k: CardKey) => {
		setText("")
		setPicked(phone && picked === k ? null : k)
		if (phone) requestAnimationFrame(() => area.current?.scrollIntoView({ block: "start", behavior: "smooth" }))
	}

	const index = (
		<div className="flex flex-col gap-5">
			<FilterSearchField value={text} onChange={setText} inputRef={input} className="shrink-0" />
			{groups.map((g) => (
				<div key={g.kind} className={phone && q && !g.items.some((it) => hits(g.kind, it)) ? "hidden" : ""}>
					<h4 className={`${SECTION_LABEL} mb-2 text-gray-500`}>{g.kind}</h4>
					<div className="flex flex-wrap gap-2">
						{g.items.map((it) => (
							<div key={it.k} className={`max-w-full transition-opacity duration-150 ${hits(g.kind, it) ? "" : phone ? "hidden" : "opacity-40"}`}>
								<IndexChip it={it} pieces={pieces} on={!q && picked === it.k} hit={!!q && hits(g.kind, it)} onClick={() => pick(it.k)} />
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	)

	const focus = q ? (
		<div key="search">
			<div className="mb-3 flex items-center gap-2">
				<h3 className={`${SECTION_LABEL} text-gray-400`}>Options matching “{text.trim()}”</h3>
				<button
					type="button"
					onClick={() => setText("")}
					aria-label="Clear the filter search"
					className="ml-auto grid h-7 w-7 place-items-center rounded-md text-gray-500 cursor-pointer hover:bg-white/[0.06] hover:text-white"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			</div>
			<FilterGroups data={pieces.groups} query={text.trim()} />
		</div>
	) : item ? (
		<div key={item.k}>
			<Focused d={d} pieces={pieces} phone={phone} it={item} />
		</div>
	) : null

	if (phone)
		return (
			<div>
				{index}
				<div ref={area} className="scroll-mt-3">
					{focus && (
						<motion.div
							key={q ? "search" : item?.k}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.14 }}
							className="mt-6 rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07]"
						>
							{focus}
						</motion.div>
					)}
				</div>
			</div>
		)

	return (
		<div className="grid h-full min-h-0 grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
			<nav aria-label="More filters" className="min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] bg-black/20 px-6 py-5">
				{index}
			</nav>
			<div className="relative min-h-0 overflow-y-auto overscroll-contain px-7 py-5">
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={q ? "search" : (item?.k ?? "none")}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.14 }}
					>
						{focus ?? (
							<p className="flex items-center gap-1 text-[14px] text-gray-500">
								Pick a filter <ChevronRightIcon className="h-4 w-4 rotate-180" aria-hidden />
							</p>
						)}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	)
}
