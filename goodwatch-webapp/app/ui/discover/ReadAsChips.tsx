// How the search read the query, as small colored chips: one per interpreted concept. Wanted fingerprint dimensions
// wear their fingerprint color, required attributes (anime, a documentary) a quiet sky tint; what the search avoids or
// rules out renders struck through. The text phrases show only when the reading has nothing else.
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { fingerprintChipStyle } from "~/ui/title-card/ReasonChips"

/** Wanted concepts shown at most. */
const WANTS = 4
/** Avoided or ruled-out concepts shown at most. */
const AVOIDS = 2

const CHIP = "rounded-full px-2 py-0.5 text-xs font-semibold leading-tight"

/** The chips a reading shows, in order: wants and attributes, then what it avoids or rules out. */
export function readAsChips(reading: ReadingChip[]): ReadingChip[] {
	const wants = reading
		.filter((chip) => chip.kind === "want" || chip.kind === "attribute")
		.slice(0, WANTS)
	const avoids = reading
		.filter((chip) => chip.kind === "avoid" || chip.kind === "excluded")
		.slice(0, AVOIDS)
	if (wants.length || avoids.length) return [...wants, ...avoids]
	return reading.filter((chip) => chip.kind === "phrase").slice(0, WANTS)
}

// What an avoided or ruled-out chip names, without its "Low" or "Not": the strike says it.
function struckLabel(chip: ReadingChip) {
	if (chip.key) return getFingerprintMeta(chip.key).label
	const text = chip.text.replace(/^(not|low)\s+/i, "")
	return text.charAt(0).toUpperCase() + text.slice(1)
}

export function ReadAsChips({
	reading,
	className = "",
}: {
	reading: ReadingChip[]
	className?: string
}) {
	const chips = readAsChips(reading)
	if (!chips.length) return null
	return (
		<ul className={`flex flex-wrap gap-1 ${className}`}>
			{chips.map((chip) => {
				const id = `${chip.kind}:${chip.text}`
				if (chip.kind === "avoid" || chip.kind === "excluded")
					return (
						<li
							key={id}
							className={`${CHIP} bg-white/[0.05] text-gray-400 line-through decoration-rose-400/80 decoration-2 ring-1 ring-inset ring-white/10`}
						>
							<span className="sr-only">not </span>
							{struckLabel(chip)}
						</li>
					)
				if (chip.kind === "want" && chip.key)
					return (
						<li
							key={id}
							className={CHIP}
							style={fingerprintChipStyle(chip.key)}
						>
							{getFingerprintMeta(chip.key).label}
						</li>
					)
				return (
					<li
						key={id}
						className={`${CHIP} bg-sky-400/15 text-sky-100 ring-1 ring-inset ring-sky-400/30`}
					>
						{chip.text}
					</li>
				)
			})}
		</ul>
	)
}
