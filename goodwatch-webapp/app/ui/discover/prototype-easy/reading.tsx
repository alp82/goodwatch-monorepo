// PROTOTYPE (discover-easy): how a search was read, in the start page's style (search-interpretation.css): fingerprint
// qualities as colored underlined words, filters as "Field Value" text. A filter opens Change in Advanced on press and
// shows × on hover or focus to remove it.
import { XMarkIcon } from "@heroicons/react/20/solid"
import type { CSSProperties } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { BarChip } from "~/ui/discover-bar/chips"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import "~/ui/start/search/search-interpretation.css"

const FIELD: Record<string, string> = {
	services: "Service", notSeenYet: "History", type: "Format", anime: "Anime", moods: "Mood", themes: "About",
	styles: "Style", genres: "Genre", minScore: "GW score", minMatch: "Taste match", released: "Released",
	years: "Released", similarTo: "Like", people: "With", productionCountries: "Origin", ageLimit: "Age",
	content: "Content", runtime: "Runtime", sourceScores: "Scores", scoreGap: "Scores", wishlist: "List",
	popularity: "Popularity", budget: "Budget", shows: "Shows", tasteGroups: "Taste", legacy: "Other",
}
export const fieldOf = (c: BarChip) => c.prefix ?? (c.group ? (FIELD[c.group] ?? c.group) : "Search")

export const qualitiesOf = (reading: ReadingChip[] | undefined) =>
	(reading ?? []).filter((t) => (t.kind === "want" || t.kind === "avoid") && t.key)

export function FingerprintList({ reading, className = "" }: { reading: ReadingChip[] | undefined; className?: string }) {
	const qualities = qualitiesOf(reading)
	if (!qualities.length) return null
	return (
		<span className={`sq-qualities ${className}`}>
			{qualities.map((t, i) => {
				const meta = getFingerprintMeta(t.key!)
				const avoid = t.kind === "avoid"
				return (
					<span
						key={`${t.key}:${i}`}
						className={`sq-quality shrink-0 ${avoid ? "sq-avoid" : ""}`}
						style={{ "--quality": meta.color } as CSSProperties}
						title={avoid ? "Ranked lower" : "Ranked higher"}
					>
						<i aria-hidden>{avoid ? "−" : ""}</i>
						{avoid && <small>Not</small>}
						<strong>{meta.label}</strong>
					</span>
				)
			})}
		</span>
	)
}

export function FilterItem({ chip, onOpen, onRemove }: { chip: BarChip; onOpen: () => void; onRemove: () => void }) {
	return (
		<span className="group/f sq-filter relative shrink-0 items-center! rounded-md pr-0.5 hover:bg-white/[0.05]">
			<button type="button" onClick={onOpen} title="Change" className="flex cursor-pointer items-baseline gap-[5px] pl-1 text-left">
				<span className="text-[12px] text-[#92a5bf]">{fieldOf(chip)}</span>
				<strong className="text-[12px] font-[650] text-white">{chip.label}</strong>
			</button>
			<button
				type="button"
				aria-label={`Remove ${chip.label}`}
				onClick={onRemove}
				className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-gray-500 opacity-0 group-hover/f:opacity-100 hover:text-white focus:opacity-100"
			>
				<XMarkIcon className="h-3 w-3" />
			</button>
		</span>
	)
}

export function FilterList({
	chips,
	onOpen,
	onRemove,
	className = "",
}: {
	chips: readonly BarChip[]
	onOpen: (c: BarChip) => void
	onRemove: (c: BarChip) => void
	className?: string
}) {
	const filters = chips.filter((c) => c.kind !== "query")
	if (!filters.length) return null
	return (
		<span className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
			{filters.map((c) => (
				<FilterItem key={c.key} chip={c} onOpen={() => onOpen(c)} onRemove={() => onRemove(c)} />
			))}
		</span>
	)
}

export function Label({ children }: { children: React.ReactNode }) {
	return <span className="shrink-0 text-[10px] font-semibold tracking-[0.075em] text-[#8395ae] uppercase">{children}</span>
}
