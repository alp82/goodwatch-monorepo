// PROTOTYPE - throwaway. Variant 5's More panel, "More starts with a search": a large "Find a filter" field leads.
// Under it a short row of often used one-tap presets, then the niche groups as four tiles (name, the filters it holds
// as a quiet line, what's set). A tile opens its group with every filter at full size side by side and a small back
// link; typing in the field replaces the content with matching options from every filter (the real sheet search).
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { FilterState } from "~/domain/filter-state"
import { FilterGroups, FilterSearchField } from "~/ui/filter-bar"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { Chip, type Option } from "~/ui/filter-bar/SheetControls"
import { type ProtoDiscover, TAGS, type Tag } from "../kit"
import { type MoreProps, SECTION_LABEL } from "./R4-5-base"
import { NicheControl, type Pieces, chipsOf, clearCard, nicheFor } from "./R4-5-parts"

type Group = ReturnType<typeof nicheFor>[number]

// ---------------------------------------------------------------------------------------------------------------
// Often used

const tag = (group: Tag["group"], key: string) => TAGS.find((t) => t.group === group && t.key === key) as Tag

function presets(d: ProtoDiscover): Option[] {
	const s = d.filters.state
	const set = (patch: Partial<FilterState>) => d.filters.set(patch)
	const tagPreset = (t: Tag, label = t.name): Option => ({
		id: `tag-${t.key}`,
		label,
		active: d.isOn(t),
		count: d.countFor(t),
		toggle: () => d.toggle(t),
		swatch: <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />,
	})
	const under2 = s.runtime?.max === 120 && !s.runtime.min
	const critics = s.sourceScores?.metacritic === 75
	const korea = !!s.productionCountries?.includes("KR")
	const withoutMeta = () => {
		const { metacritic: _, ...rest } = s.sourceScores ?? {}
		return Object.keys(rest).length ? rest : undefined
	}
	return [
		{ id: "under2", label: "Under 2 hours", active: under2, count: null, toggle: () => set({ runtime: under2 ? undefined : { max: 120 } }) },
		{
			id: "critics",
			label: "Critics love it",
			active: critics,
			count: null,
			toggle: () => set({ sourceScores: critics ? withoutMeta() : { ...s.sourceScores, metacritic: 75 } }),
		},
		{
			id: "korea",
			label: "From Korea",
			active: korea,
			count: null,
			toggle: () => {
				const rest = (s.productionCountries ?? []).filter((c) => c !== "KR")
				set({ productionCountries: korea ? (rest.length ? rest : undefined) : [...rest, "KR"] })
			},
		},
		tagPreset(tag("themes", "true")),
		tagPreset(tag("styles", "slow")),
	]
}

function Presets({ d, phone }: { d: ProtoDiscover; phone: boolean }) {
	return (
		<div className={`flex items-center gap-2 ${phone ? "-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex-wrap"}`}>
			<span className={`${SECTION_LABEL} mr-1 shrink-0 text-gray-500`}>Often used</span>
			{presets(d).map((o) => (
				<div key={o.id} className="shrink-0">
					<Chip o={o} />
				</div>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Group tiles

const setIn = (pieces: Pieces, g: Group) => g.items.flatMap((i) => chipsOf(pieces, i.k))

function GroupTile({ g, pieces, onOpen, phone }: { g: Group; pieces: Pieces; onOpen: () => void; phone: boolean }) {
	const set = setIn(pieces, g)
	return (
		<motion.button
			type="button"
			whileTap={{ scale: 0.985 }}
			onClick={onOpen}
			className={`group relative flex min-w-0 flex-col items-start rounded-2xl p-4 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				phone ? "h-[118px]" : "h-full min-h-[148px] p-5"
			} ${set.length ? "bg-amber-400/[0.06] ring-1 ring-amber-400/25 hover:bg-amber-400/[0.1]" : "bg-white/[0.035] ring-1 ring-white/[0.07] hover:bg-white/[0.065]"}`}
		>
			{!phone && (
				<span className="mb-4 flex items-center gap-1.5" aria-hidden>
					{g.items.map((i) => (
						<span key={i.k} className={`h-2 w-2 rounded-full ${FILTER_ACCENTS[i.k].dot} ${chipsOf(pieces, i.k).length ? "" : "opacity-60"}`} />
					))}
				</span>
			)}
			<span className="flex w-full items-center gap-2">
				<span className={`min-w-0 font-semibold text-white ${phone ? "text-[15px] leading-snug" : "truncate text-[19px]"}`}>{g.kind}</span>
				{set.length > 0 && (
					<span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-gray-950 tabular-nums">
						{set.length}
					</span>
				)}
				<ChevronRightIcon className="ml-auto h-4 w-4 max-lg:hidden shrink-0 text-gray-600 transition-colors group-hover:text-gray-300" aria-hidden />
			</span>
			<span className={`mt-1.5 line-clamp-2 text-gray-500 ${phone ? "text-[12px]" : "text-[14px] leading-snug"}`}>{g.items.map((i) => i.title).join(" · ")}</span>
			{set.length > 0 && (
				<span className={`mt-auto w-full truncate font-medium text-amber-200/85 ${phone ? "text-[12px]" : "text-[13px]"}`}>
					{set.map((c) => c.label.replace(/^Produced in /, "Made in ")).join(", ")}
				</span>
			)}
		</motion.button>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// One group, every filter at full size

function FilterColumn({ d, pieces, item, phone }: { d: ProtoDiscover; pieces: Pieces; item: Group["items"][number]; phone: boolean }) {
	const set = chipsOf(pieces, item.k).length > 0
	return (
		<section aria-label={item.title} className={phone ? "" : "flex min-h-0 min-w-0 flex-col"}>
			<div className="mb-3 flex min-h-9 items-start gap-2">
				<div className="min-w-0">
					<h4 className="text-[15px] font-semibold text-gray-100">{item.title}</h4>
					<p className="truncate text-[12px] text-gray-500">{item.hint}</p>
				</div>
				{set && (
					<button
						type="button"
						onClick={() => clearCard(d, pieces, item.k)}
						className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
			</div>
			<div className={phone ? "" : "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-4"}>
				<NicheControl d={d} pieces={pieces} k={item.k} />
			</div>
		</section>
	)
}

const COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }

function GroupView({ d, pieces, g, onBack, phone }: { d: ProtoDiscover; pieces: Pieces; g: Group; onBack: () => void; phone: boolean }) {
	return (
		<div className={phone ? "" : "flex h-full min-h-0 flex-col"}>
			<div className="mb-4 flex h-8 shrink-0 items-center gap-3">
				<button
					type="button"
					onClick={onBack}
					className="-ml-1.5 flex h-8 items-center gap-0.5 rounded-md pr-2 pl-1 text-[13px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<ChevronLeftIcon className="h-4 w-4" aria-hidden />
					All groups
				</button>
				<span className="h-4 w-px bg-white/10" aria-hidden />
				<h3 className="text-[15px] font-semibold text-white">{g.kind}</h3>
			</div>
			<div
				className={
					phone
						? "flex flex-col gap-7"
						: `grid min-h-0 flex-1 gap-0 ${COLS[g.items.length] ?? "grid-cols-4"} [&>section+section]:border-l [&>section+section]:border-white/[0.06] [&>section+section]:pl-6 [&>section]:pr-6`
				}
			>
				{g.items.map((item) => (
					<FilterColumn key={item.k} d={d} pieces={pieces} item={item} phone={phone} />
				))}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function MoreSearchFirst({ d, pieces, phone }: MoreProps) {
	const groups = nicheFor(pieces)
	const [text, setText] = useState("")
	const [open, setOpen] = useState<string | null>(null)
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (!phone) input.current?.focus({ preventScroll: true })
	}, [phone])
	const q = text.trim()
	const g = groups.find((x) => x.kind === open)
	const view = q ? "search" : g ? `group-${g.kind}` : "tiles"
	return (
		<div className={phone ? "flex flex-col" : "flex h-full min-h-0 flex-col px-6 pt-5"}>
			<FilterSearchField
				value={text}
				onChange={setText}
				inputRef={input}
				className={`shrink-0 rounded-2xl bg-white/[0.07] px-4 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-gray-400 [&_input]:text-[17px] ${phone ? "h-[52px]" : "h-14"}`}
			/>
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={view}
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.14 }}
					className={phone ? "pt-4" : "flex min-h-0 flex-1 flex-col pt-4"}
				>
					{view === "search" ? (
						<div className={phone ? "" : "-mx-6 min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-5"}>
							<FilterGroups data={pieces.groups} query={q} />
						</div>
					) : g ? (
						<GroupView d={d} pieces={pieces} g={g} onBack={() => setOpen(null)} phone={phone} />
					) : (
						<>
							<Presets d={d} phone={phone} />
							<div className={`mt-5 grid gap-3 ${phone ? "grid-cols-2" : "min-h-0 flex-1 grid-cols-4 pb-5"}`}>
								{groups.map((x) => (
									<GroupTile key={x.kind} g={x} pieces={pieces} phone={phone} onOpen={() => setOpen(x.kind)} />
								))}
							</div>
						</>
					)}
				</motion.div>
			</AnimatePresence>
		</div>
	)
}
