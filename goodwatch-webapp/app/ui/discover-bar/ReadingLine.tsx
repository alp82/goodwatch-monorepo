// How a search was read, on one line that never wraps and scrolls sideways when long: the fingerprint qualities the
// ranking favors or ranks lower, then every filter. A filter's × removes it, and in Advanced its name opens it. With
// nothing to show the line offers the moods. Both | Movies | Shows joins when a search or filter set a type.
import { LockClosedIcon, XMarkIcon } from "@heroicons/react/20/solid"
import type { CSSProperties } from "react"
import type { FilterState } from "~/domain/filter-state"
import { WORDS } from "~/domain/taste-picker"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import type { BarChip } from "./chips"

const MOODS = WORDS.filter((word) => word.kind === "mood").slice(0, 8)

const FIELDS: Record<string, string> = {
	services: "Service",
	notSeenYet: "History",
	type: "Format",
	anime: "Anime",
	moods: "Mood",
	themes: "About",
	styles: "Style",
	genres: "Genre",
	minScore: "GW score",
	minMatch: "Taste match",
	released: "Released",
	years: "Released",
	similarTo: "Like",
	people: "With",
	productionCountries: "Origin",
	ageLimit: "Age",
	content: "Content",
	runtime: "Runtime",
	sourceScores: "Scores",
	scoreGap: "Scores",
	wishlist: "List",
	popularity: "Popularity",
	budget: "Budget",
	shows: "Shows",
	tasteGroups: "Taste",
	legacy: "Other",
}
const fieldOf = (chip: BarChip) =>
	chip.prefix ?? (chip.group ? (FIELDS[chip.group] ?? chip.group) : "Search")

const TYPES = [
	["all", "Both"],
	["movie", "Movies"],
	["show", "Shows"],
] as const

function TypePicker({
	type,
	onChange,
}: {
	type: FilterState["type"]
	onChange: (type: FilterState["type"]) => void
}) {
	return (
		<span
			role="radiogroup"
			aria-label="Movies or shows"
			className="flex shrink-0 rounded-full bg-white/[0.04] p-0.5 ring-1 ring-white/10"
		>
			{TYPES.map(([key, label]) => (
				<button
					key={key}
					type="button"
					role="radio"
					aria-checked={type === key}
					onClick={() => onChange(key)}
					className={`cursor-pointer rounded-full px-3 py-1 text-[12px] font-semibold ${type === key ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"}`}
				>
					{label}
				</button>
			))}
		</span>
	)
}

function Quality({ chip }: { chip: ReadingChip }) {
	const meta = getFingerprintMeta(chip.key as string)
	const avoid = chip.kind === "avoid"
	return (
		<span
			className={`inline-flex shrink-0 items-center gap-[5px] pt-0.5 pb-1 text-[12px] leading-tight ${
				avoid
					? "border-b border-dashed border-[#6f809750]"
					: "border-b-2 border-[color-mix(in_oklab,var(--quality)_32%,transparent)] text-[color-mix(in_oklab,var(--quality)_52%,#e2e8f0)]"
			}`}
			style={{ "--quality": meta.color } as CSSProperties}
			title={avoid ? "Ranked lower" : "Ranked higher"}
		>
			<i
				aria-hidden
				className={
					avoid
						? "flex h-[11px] w-[11px] items-center justify-center rounded-full bg-[#8c9cb61f] text-[14px] leading-[10px] font-semibold text-[#b4c1d3] not-italic"
						: "h-[5px] w-[5px] rounded-full bg-[var(--quality)]"
				}
			>
				{avoid ? "−" : ""}
			</i>
			{avoid && <small className="text-[10px] text-[#9ba9bb]">Not</small>}
			<strong
				className={`font-[550] ${avoid ? "text-[color-mix(in_oklab,var(--quality)_25%,#aebaca)] line-through decoration-[var(--quality)] decoration-[1.5px]" : ""}`}
			>
				{meta.label}
			</strong>
		</span>
	)
}

function Filter({
	chip,
	onOpen,
	onRemove,
}: {
	chip: BarChip
	onOpen?: () => void
	onRemove: () => void
}) {
	const words = (
		<>
			<span className="text-[12px] text-[#92a5bf]">{fieldOf(chip)}</span>
			<strong className="text-[12px] font-[650] text-white">{chip.label}</strong>
		</>
	)
	return (
		<span className="group/filter inline-flex shrink-0 items-center rounded-md pr-0.5 hover:bg-white/[0.05]">
			{onOpen ? (
				<button
					type="button"
					onClick={onOpen}
					className="flex cursor-pointer items-baseline gap-[5px] pl-1"
				>
					{words}
				</button>
			) : (
				<span className="flex items-baseline gap-[5px] pl-1">{words}</span>
			)}
			<button
				type="button"
				aria-label={`Remove ${chip.label}`}
				onClick={onRemove}
				className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-gray-500 opacity-0 group-hover/filter:opacity-100 hover:text-white focus:opacity-100 [@media(hover:none)]:opacity-100"
			>
				<XMarkIcon className="h-3 w-3" aria-hidden />
			</button>
		</span>
	)
}

const Divider = () => (
	<span className="h-4 w-px shrink-0 bg-white/10" aria-hidden />
)

export function ReadingLine({
	state,
	chips,
	reading,
	member,
	onOpen,
	onRemove,
	onType,
	onMood,
}: {
	state: FilterState
	chips: readonly BarChip[]
	reading: readonly ReadingChip[] | undefined
	member: boolean
	/** Only in Advanced: Easy never opens a panel. */
	onOpen?: (chip: BarChip) => void
	onRemove: (chip: BarChip) => void
	onType: (type: FilterState["type"]) => void
	onMood: (mood: string) => void
}) {
	const picker = state.type !== "all"
	const qualities = (reading ?? []).filter(
		(chip) => (chip.kind === "want" || chip.kind === "avoid") && chip.key,
	)
	const filters = chips.filter(
		(chip) => chip.kind !== "query" && !(picker && chip.group === "type"),
	)
	// A guest's Ready covers services only: Not seen yet waits for an account.
	const lockedUnseen = !member && state.onMyServices
	const typePicker = picker && <TypePicker type={state.type} onChange={onType} />
	const line = "flex h-8 min-w-0 flex-1 items-center gap-4 overflow-x-auto [scrollbar-width:none]"
	if (!qualities.length && !filters.length)
		return (
			<div className={line}>
				{typePicker}
				{typePicker && <Divider />}
				<span className="flex items-center gap-3 whitespace-nowrap">
					<span className="shrink-0 text-[10px] font-semibold tracking-[0.075em] text-[#8395ae] uppercase">
						Mood
					</span>
					{MOODS.map((word) => (
						<button
							key={word.id}
							type="button"
							onClick={() => onMood(word.key)}
							className="flex cursor-pointer items-center gap-1.5 text-[13px] text-gray-300 hover:text-white"
						>
							<span
								className="h-2 w-2 rounded-full"
								style={{ background: word.hue }}
								aria-hidden
							/>
							{word.name}
						</button>
					))}
				</span>
			</div>
		)
	return (
		<div className={`${line} search-private ph-no-capture sentry-mask`}>
			{typePicker}
			{qualities.length > 0 && (
				<span className="flex shrink-0 items-center gap-x-[17px]">
					{qualities.map((chip, index) => (
						<Quality key={`${chip.key}:${index}`} chip={chip} />
					))}
				</span>
			)}
			{qualities.length > 0 && filters.length > 0 && <Divider />}
			<span className="flex shrink-0 items-center gap-x-2">
				{filters.map((chip) => (
					<Filter
						key={chip.key}
						chip={chip}
						onOpen={onOpen && (() => onOpen(chip))}
						onRemove={() => onRemove(chip)}
					/>
				))}
				{lockedUnseen && (
					<a
						href="/sign-up"
						title="Sign up to hide what you've seen"
						className="flex shrink-0 items-center gap-1 rounded-md px-1 pr-5 hover:bg-white/[0.05]"
					>
						<span className="text-[12px] text-[#92a5bf]">History</span>
						<LockClosedIcon
							className="h-3 w-3 text-amber-500/70"
							aria-hidden
						/>
						<strong className="text-[12px] font-[650] text-amber-200/80">
							Not seen yet
						</strong>
					</a>
				)}
			</span>
		</div>
	)
}
