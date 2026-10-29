// Phones: in place of the chip strip, Filters (with its count) and the most used filters as buttons in one scrolling
// row. Each opens the filter sheet at that filter; a filter with something set shows its value, lit. It repeats the
// slab's Filters key, which is easy to miss.
import {
	AdjustmentsHorizontalIcon,
	ChevronDownIcon,
} from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { FilterState } from "~/domain/filter-state"
import { type CardKey, cardOf } from "./filter-cards"
import { mergedChips } from "./ActiveFilters"
import type { ActiveChip } from "./labels"
import { TAP } from "./motion"

const BUTTONS: { key: CardKey; label: string }[] = [
	{ key: "type", label: "Movies & shows" },
	{ key: "moods", label: "Mood" },
	{ key: "genres", label: "Genre" },
	{ key: "minScore", label: "Score" },
	{ key: "services", label: "Streaming" },
	{ key: "minMatch", label: "Taste match" },
]

export function PhoneFilterRow({
	count,
	chips,
	state,
	onOpen,
}: {
	count: number
	chips: ActiveChip[]
	state: FilterState
	/** Opens the sheet; with a key, at that filter's card. */
	onOpen: (key: CardKey | null) => void
}) {
	const merged = mergedChips(chips)
	const setValue = (key: CardKey) => {
		if (key === "services" && state.onMyServices) return "My services"
		const labels = merged
			.filter((c) => cardOf(c.group) === key)
			.map((c) => c.label)
		if (!labels.length) return undefined
		return labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0]
	}
	return (
		<div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={() => onOpen(null)}
				aria-label={`Filters ${count} active`}
				className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] pr-2.5 pl-3 text-sm font-bold text-white ring-1 ring-white/15 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<AdjustmentsHorizontalIcon className="h-4 w-4" />
				Filters{" "}
				{count > 0 && (
					<span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs tabular-nums text-gray-950">
						{count}
					</span>
				)}
			</motion.button>
			{BUTTONS.map((b) => {
				const value = setValue(b.key)
				return (
					<motion.button
						key={b.key}
						type="button"
						whileTap={TAP}
						onClick={() => onOpen(b.key)}
						aria-label={value ? `${b.label}: ${value}` : b.label}
						className={`flex h-9 max-w-[13rem] shrink-0 items-center gap-1 rounded-full pr-2 pl-3.5 text-sm cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${value ? "bg-white font-semibold text-gray-950" : "bg-white/[0.06] text-gray-200 ring-1 ring-white/10"}`}
					>
						<span className="truncate">{value ?? b.label}</span>
						<ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-500" />
					</motion.button>
				)
			})}
		</div>
	)
}
