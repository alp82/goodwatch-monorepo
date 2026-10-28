// PROTOTYPE - throwaway. Round 4 variant 3's More: every niche filter as a calm card in a 3-column grid (icon, name,
// current value or "Any"). A tap opens that card at full panel width in place; the others fold into one compact row
// above and one below, so nothing leaves the view. Find a filter sits on top and swaps the grid for matches.
import { ChevronUpIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { FilterGroups } from "~/ui/filter-bar"
import { FilterSearchField } from "~/ui/filter-bar/FilterGroups"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { TAP } from "~/ui/filter-bar/motion"
import { CardsGate, type MoreProps, NICHE_ICON, NicheControl, type Pieces, QuietMount, chipsOf, clearCard, nicheFor, nicheValue } from "./R4-3-parts"

/** The cards in reading order: story, scores, titles, then people, origin and age. */
const ORDER: CardKey[] = [
	"themes",
	"styles",
	"runtime",
	"minMatch",
	"sourceScores",
	"scoreGap",
	"similarTo",
	"loved",
	"disliked",
	"people",
	"productionCountries",
	"ageLimit",
]

const SPRING = { type: "spring", stiffness: 520, damping: 44 } as const
const NO_BAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
const ROW_FADE = "linear-gradient(to right, black calc(100% - 2rem), transparent)"

interface Item {
	k: CardKey
	title: string
	hint: string
}

function items(pieces: Pieces): Item[] {
	const all = nicheFor(pieces).flatMap((g) => g.items)
	return ORDER.map((k) => all.find((i) => i.k === k)).filter((i): i is Item => !!i)
}

function TierIcon({ k, on, small = false }: { k: CardKey; on: boolean; small?: boolean }) {
	const Icon = NICHE_ICON[k]
	if (!Icon) return null
	return (
		<span
			className={`grid shrink-0 place-items-center rounded-lg transition-colors ${small ? "h-6 w-6" : "h-9 w-9"} ${
				on ? "bg-amber-400/[0.12] text-amber-300" : "bg-white/[0.05] text-gray-400"
			}`}
		>
			<Icon className={small ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"} aria-hidden />
		</span>
	)
}

/** A collapsed filter: icon, name, value or "Any". Phones stack the icon over the name, so names fit two columns. */
function TierCard({
	d,
	pieces,
	item,
	onOpen,
	phone,
}: { d: MoreProps["d"]; pieces: Pieces; item: Item; onOpen: () => void; phone: boolean }) {
	const value = nicheValue(pieces, item.k)
	return (
		<motion.div layoutId={`tier-${item.k}`} layout="position" transition={SPRING} className="relative min-w-0">
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={onOpen}
				aria-expanded={false}
				className={`flex w-full min-w-0 rounded-2xl text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
					phone ? "h-[88px] flex-col justify-between p-3" : "h-[68px] items-center gap-3 px-3.5"
				} ${
					value ? "bg-amber-400/[0.05] ring-1 ring-amber-400/20 hover:bg-amber-400/[0.08]" : "bg-white/[0.03] ring-1 ring-white/[0.06] hover:bg-white/[0.06]"
				}`}
			>
				<TierIcon k={item.k} on={!!value} small={phone} />
				<span className={`block min-w-0 ${phone ? "w-full" : `flex-1 ${value ? "pr-6" : ""}`}`}>
					<span className={`block truncate font-semibold text-gray-100 ${phone ? "text-[13.5px]" : "text-[14px]"}`}>{item.title}</span>
					<span className={`block truncate ${phone ? "text-[12.5px]" : "text-[13px]"} ${value ? "font-medium text-amber-300" : "text-gray-500"}`}>
						{value || "Any"}
					</span>
				</span>
			</motion.button>
			{value && (
				<button
					type="button"
					onClick={() => clearCard(d, pieces, item.k)}
					aria-label={`Clear ${item.title}`}
					className={`absolute grid h-7 w-7 place-items-center rounded-md text-gray-500 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${
						phone ? "top-2 right-2" : "top-1/2 right-2 -translate-y-1/2"
					}`}
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</motion.div>
	)
}

/** A folded filter while another one is open: one small pill. */
function TierPill({ pieces, item, onOpen }: { pieces: Pieces; item: Item; onOpen: () => void }) {
	const value = nicheValue(pieces, item.k)
	return (
		<motion.button
			layoutId={`tier-${item.k}`}
			layout="position"
			transition={SPRING}
			type="button"
			whileTap={TAP}
			onClick={onOpen}
			className={`flex h-9 max-w-64 shrink-0 items-center gap-1.5 rounded-full pr-3 pl-1.5 text-[13px] whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				value ? "bg-amber-400/[0.07] ring-1 ring-amber-400/25 hover:bg-amber-400/[0.11]" : "bg-white/[0.04] ring-1 ring-white/[0.06] hover:bg-white/[0.08]"
			}`}
		>
			<TierIcon k={item.k} on={!!value} small />
			<span className="font-medium text-gray-200">{item.title}</span>
			{value && <span className="min-w-0 truncate font-medium text-amber-300">{value}</span>}
		</motion.button>
	)
}

function PillRow({ pieces, list, onOpen }: { pieces: Pieces; list: Item[]; onOpen: (k: CardKey) => void }) {
	if (!list.length) return null
	return (
		<div
			className={`-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 py-0.5 pr-8 ${NO_BAR}`}
			style={{ maskImage: ROW_FADE, WebkitMaskImage: ROW_FADE }}
		>
			{list.map((it) => (
				<TierPill key={it.k} pieces={pieces} item={it} onOpen={() => onOpen(it.k)} />
			))}
		</div>
	)
}

/** The open filter at full width: its real control. */
function TierOpen({
	d,
	pieces,
	item,
	onClose,
	phone,
}: { d: MoreProps["d"]; pieces: Pieces; item: Item; onClose: () => void; phone: boolean }) {
	const value = nicheValue(pieces, item.k)
	const set = chipsOf(pieces, item.k).length > 0
	return (
		<motion.section
			layoutId={`tier-${item.k}`}
			layout="position"
			transition={SPRING}
			aria-label={item.title}
			className={`flex min-w-0 flex-col rounded-2xl bg-white/[0.035] ring-1 ring-white/[0.09] ${phone ? "" : "min-h-0 flex-1"}`}
		>
			<header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] pr-2 pl-3.5">
				<TierIcon k={item.k} on={set} />
				<div className="min-w-0 flex-1">
					<h3 className="truncate text-[15px] font-bold text-white">{item.title}</h3>
					<p className={`truncate text-[12px] ${value ? "font-medium text-amber-300" : "text-gray-500"}`}>{value || item.hint}</p>
				</div>
				{set && (
					<button
						type="button"
						onClick={() => clearCard(d, pieces, item.k)}
						className="h-8 shrink-0 rounded-md px-2 text-[13px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
				<button
					type="button"
					onClick={onClose}
					aria-label={`Fold ${item.title}`}
					className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<ChevronUpIcon className="h-5 w-5" />
				</button>
			</header>
			<motion.div
				key={item.k}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.16, delay: 0.05 }}
				className={`px-4 pt-3 pb-4 ${phone ? "" : "min-h-0 flex-1 overflow-y-auto overscroll-contain"}`}
			>
				<CardsGate pieces={pieces}>
					<QuietMount>
						<NicheControl d={d} pieces={pieces} k={item.k} />
					</QuietMount>
				</CardsGate>
			</motion.div>
		</motion.section>
	)
}

export function MoreTiers({ d, pieces, phone, more, setMore }: MoreProps) {
	const list = items(pieces)
	const finding = more.find.trim() !== ""
	const openAt = list.findIndex((i) => i.k === more.open)
	const open = openAt >= 0 ? list[openAt] : null
	const setOpen = (k: CardKey | null) => setMore({ open: k })
	const body = finding ? (
		<motion.div
			key="find"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.14 }}
			className={phone ? "" : "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"}
		>
			<FilterGroups data={pieces.groups} query={more.find} />
		</motion.div>
	) : (
		<motion.div
			key="tiers"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.14 }}
			className={`flex min-w-0 flex-col gap-2.5 ${phone ? "" : "min-h-0 flex-1"}`}
		>
			<LayoutGroup id="r43-tiers">
				{open ? (
					<>
						<PillRow pieces={pieces} list={list.slice(0, openAt)} onOpen={setOpen} />
						<TierOpen d={d} pieces={pieces} item={open} onClose={() => setOpen(null)} phone={phone} />
						<PillRow pieces={pieces} list={list.slice(openAt + 1)} onOpen={setOpen} />
					</>
				) : (
					<div className={`grid gap-2.5 ${phone ? "grid-cols-2" : "grid-cols-3"}`}>
						{list.map((it) => (
							<TierCard key={it.k} d={d} pieces={pieces} item={it} phone={phone} onOpen={() => setOpen(it.k)} />
						))}
					</div>
				)}
			</LayoutGroup>
		</motion.div>
	)
	return (
		<div className={phone ? "flex flex-col gap-4" : "flex h-full min-h-0 flex-col gap-4 px-6 pt-5 pb-5"}>
			<FilterSearchField value={more.find} onChange={(find) => setMore({ find })} className="shrink-0" />
			<AnimatePresence mode="wait" initial={false}>
				{body}
			</AnimatePresence>
		</div>
	)
}
