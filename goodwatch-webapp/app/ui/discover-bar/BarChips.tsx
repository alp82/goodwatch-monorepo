// The search state as one row of removable chips (chips.ts gives the order), shared by the status line and the panel
// footer. A chip's label opens the sub-tab that owns it; its cross removes it. The query chip is amber, steering
// chips carry a small poster (More like emerald, Less like red, Like rose), people chips a face, and mood chips their
// hue. The row scrolls sideways under a fade at its end.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { type CSSProperties, type ReactNode, lazy, Suspense } from "react"
import type { FilterState } from "~/domain/filter-state"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { PRIVATE } from "./DiscoverBar"
import type { BarChip } from "./chips"

const ReadingPreview = lazy(
	reloadOnStaleChunk(() =>
		import("~/ui/discover/ReadingPreview").then((module) => ({
			default: module.ReadingPreview,
		})),
	),
)

const IMAGE = "https://image.tmdb.org/t/p/w92"
const FADE = "linear-gradient(to right, black calc(100% - 2.5rem), transparent)"
const CHIP_MD =
	"inline-flex h-8 shrink-0 items-center rounded-full text-[13px] whitespace-nowrap"
/** The status line's chips: as tall as Ready to watch and For you + Sort, with their rounded rect. */
const CHIP_LG =
	"inline-flex h-10 shrink-0 items-center rounded-xl text-[13px] whitespace-nowrap [&>button:first-child]:rounded-l-xl [&>button:last-child]:rounded-r-xl"
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

const TINTS: Record<string, string> = {
	loved: "#34d399",
	disliked: "#f87171",
	similarTo: "#fb7185",
	people: "#c084fc",
}

const tinted = (hex: string): CSSProperties => ({
	background: `${hex}2e`,
	boxShadow: `inset 0 0 0 1px ${hex}88`,
})

function Remove({
	label,
	onClick,
	className = "text-gray-500",
}: {
	label: string
	onClick: () => void
	className?: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={`Remove ${label}`}
			className={`grid h-full w-7 shrink-0 place-items-center rounded-r-full cursor-pointer hover:text-white ${FOCUS} ${className}`}
		>
			<XMarkIcon className="h-3.5 w-3.5" />
		</button>
	)
}

function Picture({ chip }: { chip: BarChip }) {
	if (chip.kind === "person")
		return chip.image ? (
			<img
				src={`${IMAGE}${chip.image}`}
				alt=""
				className="h-6 w-6 shrink-0 rounded-full object-cover"
			/>
		) : (
			<span className="h-6 w-6 shrink-0 rounded-full bg-white/10" />
		)
	return chip.image ? (
		<img
			src={`${IMAGE}${chip.image}`}
			alt=""
			className="h-6 w-4 shrink-0 rounded-[3px] object-cover"
		/>
	) : (
		<span className="h-6 w-4 shrink-0 rounded-[3px] bg-white/10" />
	)
}

function OneChip({
	chip,
	reading,
	onOpen,
	onRemove,
	onClearSearch,
	large,
}: {
	large: boolean
	chip: BarChip
	reading?: ReadingChip[]
	onOpen: (chip: BarChip) => void
	onRemove: (chip: BarChip) => void
	onClearSearch: () => void
}) {
	const words = chip.prefix ? `${chip.prefix} ${chip.label}` : chip.label
	const CHIP = large ? CHIP_LG : CHIP_MD
	if (chip.kind === "query")
		return (
			<span
				className={`${CHIP} gap-2 bg-amber-400/[0.1] pl-3 ring-1 ring-inset ring-amber-400/35`}
			>
				<button
					type="button"
					onClick={() => onOpen(chip)}
					className={`flex max-w-[260px] items-center gap-1.5 font-semibold text-amber-100 cursor-pointer ${FOCUS} ${PRIVATE}`}
				>
					<MagnifyingGlassIcon
						className="h-3.5 w-3.5 shrink-0 text-amber-300"
						aria-hidden
					/>
					<span className="truncate">{chip.label}</span>
				</button>
				{reading && reading.length > 0 && (
					<Suspense fallback={null}>
						<ReadingPreview reading={reading} />
					</Suspense>
				)}
				<Remove
					label="the search"
					onClick={onClearSearch}
					className="text-amber-200/70"
				/>
			</span>
		)
	if (chip.kind === "steer" || chip.kind === "person") {
		const hex = TINTS[chip.group ?? ""] ?? TINTS.people
		return (
			<span
				className={`${CHIP} pl-1 font-semibold text-white`}
				style={tinted(hex)}
			>
				<button
					type="button"
					onClick={() => onOpen(chip)}
					className={`flex h-full items-center rounded-l-full cursor-pointer ${FOCUS}`}
				>
					<Picture chip={chip} />
					<span className="ml-1.5 font-normal text-white/70">
						{chip.prefix}
					</span>
					<span className="ml-1 max-w-[160px] truncate">{chip.label}</span>
				</button>
				<Remove
					label={words}
					onClick={() => onRemove(chip)}
					className="text-white/50"
				/>
			</span>
		)
	}
	return (
		<span
			className={`${CHIP} ${chip.hue ? "font-semibold text-white" : "bg-white/[0.06] text-gray-100"}`}
			style={chip.hue ? tinted(chip.hue) : undefined}
		>
			<button
				type="button"
				onClick={() => onOpen(chip)}
				className={`flex h-full items-center gap-1.5 rounded-l-full pl-3 cursor-pointer ${FOCUS}`}
			>
				{chip.hue ? (
					<span
						className="h-2 w-2 rounded-full"
						style={{ background: chip.hue }}
					/>
				) : (
					<span
						className={`h-1.5 w-1.5 rounded-full ${chip.group ? FILTER_ACCENTS[chip.group].dot : "bg-gray-400"}`}
					/>
				)}
				{chip.label}
			</button>
			<Remove label={words} onClick={() => onRemove(chip)} />
		</span>
	)
}

/** The chips in one sideways row. `trail` follows the last chip (the status line's Clear all). */
export function BarChips({
	chips,
	reading,
	onOpen,
	onChange,
	onClearSearch,
	trail,
	className = "",
	size = "md",
}: {
	/** lg: the status line's 40 px chips. */
	size?: "md" | "lg"
	chips: BarChip[]
	/** How the search read the query, inline in the query chip. */
	reading?: ReadingChip[]
	onOpen: (chip: BarChip) => void
	onChange: (change: (state: FilterState) => FilterState) => void
	onClearSearch: () => void
	trail?: ReactNode
	className?: string
}) {
	return (
		// relative: the row clips ReadAsChips' screen reader text, which is absolutely positioned.
		<ul
			aria-label="Active filters"
			className={`relative flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
			style={{ maskImage: FADE, WebkitMaskImage: FADE }}
		>
			{chips.map((chip) => (
				<li key={chip.key} className="flex shrink-0">
					<OneChip
						chip={chip}
						reading={reading}
						onOpen={onOpen}
						onRemove={(c) => c.remove && onChange(c.remove)}
						onClearSearch={onClearSearch}
						large={size === "lg"}
					/>
				</li>
			))}
			{trail && <li className="flex shrink-0">{trail}</li>}
		</ul>
	)
}
