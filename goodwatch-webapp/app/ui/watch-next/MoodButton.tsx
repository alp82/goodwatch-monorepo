// The mood picker's button ("Any mood" with its color fan, then "Add" or "Change") and its refusal of a fourth pick:
// what shows with the dropdown closed, apart from MoodPicker.tsx so a page can show it before the dropdown's code
// loads (the start page loads its panel on first use).
import { ChevronDownIcon } from "@heroicons/react/24/solid"
import type React from "react"
import { useEffect, useState } from "react"
import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { MAX_PICKS } from "~/domain/taste-picker"
import type { MoodControl } from "./MoodPicker"

export const refusalText = (name: string) =>
	`Three is the most. Remove one to add ${name}.`

/** The mood colors that stand for "Any mood". */
export const SPECTRUM: readonly MoodKey[] = [
	"funny",
	"romance",
	"crime",
	"worlds",
]

// Four mood colors in a small fan, for the "Any mood" button.
function Spectrum() {
	return (
		<span className="flex -space-x-2" aria-hidden>
			{SPECTRUM.map((mood) => (
				<span
					key={mood}
					className="h-6 w-6 rounded-full ring-2 ring-gray-900"
					style={{ background: MOOD_BY_KEY[mood].hue }}
				/>
			))}
		</span>
	)
}

/** Opens the dropdown: "Any mood" with nothing picked, "Add" or "Change" next to picked moods. */
export function MoodButton({
	control,
	buttonRef,
}: {
	control: MoodControl
	buttonRef: React.RefObject<HTMLButtonElement>
}) {
	const picked = control.picker.picks.length > 0
	return (
		<button
			ref={buttonRef}
			type="button"
			data-moodbutton
			aria-haspopup="dialog"
			aria-expanded={control.open}
			aria-label={picked ? "Change picks" : undefined}
			onClick={() => control.setOpen(!control.open)}
			className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/20 ${picked ? "px-2.5" : "pl-1.5 pr-3"} ${control.open ? "bg-white/15" : "bg-white/10"}`}
		>
			{picked ? (
				control.picker.picks.length < MAX_PICKS ? (
					"Add"
				) : (
					"Change"
				)
			) : (
				<>
					<Spectrum />
					Any mood
				</>
			)}
			<ChevronDownIcon
				className={`h-4 w-4 opacity-70 transition-transform ${control.open ? "rotate-180" : ""}`}
				aria-hidden
			/>
		</button>
	)
}

/** The refusal of a fourth pick, shown for a few seconds in place of the title. */
export function useRefusalHint(control: MoodControl): string | null {
	const [hint, setHint] = useState<string | null>(null)
	useEffect(() => {
		if (!control.refused) return
		setHint(refusalText(control.refused.name))
		const id = setTimeout(() => setHint(null), 3200)
		return () => clearTimeout(id)
	}, [control.refused])
	return hint
}
