// The one line My movies and My shows say on arrival about the titles that landed on the member's services since
// their last visit (#456): "Dune is now on Netflix", and with several the names. In the sky blue of the signal
// that led here.
import { useState } from "react"
import type { LandedLine } from "~/domain/newly-available-signal"
import { landedLine } from "~/domain/newly-available-words"

export function LandedNote({
	kind,
	landed,
	className = "",
}: {
	kind: "movie" | "show"
	/** What landed when the member arrived; null when nothing did. */
	landed: LandedLine | null
	className?: string
}) {
	// The line stays for the visit, also when the page's data is read again.
	const [arrived] = useState(landed)
	const words = landedLine(kind, arrived)
	if (!words) return null
	return (
		<p
			className={`flex max-w-3xl items-baseline gap-2 text-sm text-sky-200 ${className}`}
			data-landed
		>
			<span
				className="h-2 w-2 shrink-0 -translate-y-px rounded-full bg-sky-400"
				aria-hidden
			/>
			<span>
				<b className="font-bold">{words.lead}</b> {words.rest}
			</span>
		</p>
	)
}
